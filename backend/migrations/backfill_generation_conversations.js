#!/usr/bin/env node

/**
 * 迁移脚本：为历史生成记录补写 ai_conversations + ai_messages
 *
 * 目标：
 * - 针对已经存在的 ai_usage_logs（action_type = 'generate' 且 content_id 不为 NULL）：
 *   1. 确保存在对应的 ai_conversations（按 user_id / visitor_id + content_id 绑定）；
 *   2. 在该会话下补写一条「生成起点」用户消息（prompt + 图片）：
 *      - role = 'user'
 *      - content = knowledge_point (+ description)
 *      - metadata.image_urls = [{ url, displayUrl, mime_type }]
 *      - metadata.image_count / images_pending = false
 *      - metadata.generation_request_id = request_id（用于幂等）
 *   3. 不再调用 AI 生成 start-session 消息，仅做 prompt + 图片落库；
 *      start-session 仍由 AI Guide 首次 init 时按现有逻辑生成。
 *
 * 幂等策略：
 * - 已存在 metadata.generation_request_id = request_id 的 user 消息则不重复写入；
 * - 已存在任何 assistant 消息则不再补写 start-session 初始回复。
 *
 * 使用方法（在 backend 目录下）：
 *   node migrations/backfill_generation_conversations.js
 */

const path = require('path');

// 加载环境变量（与其它迁移脚本保持一致）
const envPath = process.env.NODE_ENV === 'production'
  ? path.resolve(__dirname, '../.env')
  : path.resolve(__dirname, '../../.env');

try {
  require('dotenv').config({ path: envPath });
} catch (e) {
  // 忽略 .env 加载错误，后续 Supabase 初始化会做检查
}

const { supabase } = require('../src/services/database');
const { isVisitorId } = require('../src/utils/visitorId');

const BATCH_SIZE = 200;

function inferMimeTypeFromUrl(url) {
  if (!url || typeof url !== 'string') return 'image/jpeg';
  const lower = url.split('?')[0].toLowerCase();
  if (lower.endsWith('.png') || lower.includes('.png.')) return 'image/png';
  if (lower.endsWith('.gif') || lower.includes('.gif.')) return 'image/gif';
  if (lower.endsWith('.webp') || lower.includes('.webp.')) return 'image/webp';
  if (lower.endsWith('.jpeg') || lower.includes('.jpeg.')) return 'image/jpeg';
  if (lower.endsWith('.jpg') || lower.includes('.jpg.')) return 'image/jpeg';
  return 'image/jpeg';
}

async function backfillForLog(log) {
  const contentId = log.content_id;
  const userId = log.user_id || null;
  const visitorId = log.visitor_id || null;
  const ownerId = userId || visitorId;
  const requestId = log.request_id || null;

  if (!contentId || !ownerId) {
    return { skipped: true, reason: 'missing_owner_or_content' };
  }

  // 1) 找会话（优先已有的，按 updated_at DESC）
  let convQuery = supabase
    .from('ai_conversations')
    .select('id')
    .eq('content_id', contentId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (isVisitorId(ownerId)) {
    convQuery = convQuery.eq('visitor_id', ownerId).is('user_id', null);
  } else {
    convQuery = convQuery.eq('user_id', ownerId).is('visitor_id', null);
  }

  const { data: existingConvs, error: convFetchError } = await convQuery;
  if (convFetchError) {
    console.error('[backfill_generation_conversations] 查询 conversation 失败:', convFetchError);
    return { skipped: true, reason: 'conv_query_error' };
  }

  let conversationId = existingConvs && existingConvs.length > 0 ? existingConvs[0].id : null;

  // 如不存在则创建新会话（entry_point 标记为 ai_generate，便于后续分析）
  if (!conversationId) {
    const { data: convRow, error: convInsertError } = await supabase
      .from('ai_conversations')
      .insert({
        id: requestId || undefined, // 若 request_id 是 UUID，可直接用；否则让数据库生成
        user_id: isVisitorId(ownerId) ? null : ownerId,
        visitor_id: isVisitorId(ownerId) ? ownerId : null,
        content_id: contentId,
        entry_point: 'ai_generate'
      })
      .select('id')
      .single();

    if (convInsertError || !convRow) {
      console.error('[backfill_generation_conversations] 创建 conversation 失败:', convInsertError);
      return { skipped: true, reason: 'conv_insert_error' };
    }
    conversationId = convRow.id;
  }

  // 2) 幂等检查：是否已有本次 request 的生成起点 user 消息
  let alreadyHasGenUser = false;
  if (requestId) {
    const { data: existedMsgs, error: existedError } = await supabase
      .from('ai_messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('role', 'user')
      .contains('metadata', { generation_request_id: requestId })
      .limit(1);

    if (existedError) {
      console.warn('[backfill_generation_conversations] 检查生成起点 user 消息失败:', existedError);
    } else {
      alreadyHasGenUser = !!(existedMsgs && existedMsgs.length > 0);
    }
  }

  // 3) 构造用户内容 + 图片
  const gp = log.generation_params || {};
  const knowledgePoint = gp.knowledge_point || log.user_query || '';
  const description = gp.description || '';
  let userContent = knowledgePoint || '';
  if (description && description.trim()) {
    userContent = userContent ? `${userContent}\n\n${description}` : description;
  }

  // 图片来源优先级：image_urls 列 -> generation_params.image_urls
  const rawImageUrls = Array.isArray(log.image_urls) && log.image_urls.length
    ? log.image_urls
    : (Array.isArray(gp.image_urls) ? gp.image_urls : []);

  const imageMeta = rawImageUrls
    .filter((item) => item && typeof item.url === 'string')
    .map((item) => ({
      url: item.url,
      displayUrl: item.displayUrl || item.url,
      mime_type: item.mime_type || inferMimeTypeFromUrl(item.url)
    }));

  const userMetadataBase = {};
  if (imageMeta.length > 0) {
    userMetadataBase.image_urls = imageMeta;
    userMetadataBase.image_count = imageMeta.length;
    userMetadataBase.images_pending = false;
  }
  const idempotencyMeta = requestId ? { generation_request_id: requestId } : {};

  // 4) 补写用户消息（若还没有），created_at 使用日志时间，保证早于后续 assistant 回复
  if (!alreadyHasGenUser && (userContent || imageMeta.length > 0)) {
    const finalMetadata = {
      ...userMetadataBase,
      ...idempotencyMeta
    };
    const logCreatedAt = log.created_at ? new Date(log.created_at).toISOString() : undefined;
    const { error: userMsgError } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: userContent || '(生成请求)',
        metadata: Object.keys(finalMetadata).length ? finalMetadata : null,
        ...(logCreatedAt && { created_at: logCreatedAt })
      });

    if (userMsgError) {
      console.error('[backfill_generation_conversations] 创建用户生成消息失败:', userMsgError);
    }
  }

  // 5) 更新会话活跃时间（不强制补写 assistant，交给 AI Guide 首次 init 时生成）
  await supabase
    .from('ai_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return { skipped: false };
}

async function run() {
  console.log('🚀 开始为历史生成记录补写会话与对话消息...\n');

  try {
    const { count, error: countError } = await supabase
      .from('ai_usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('action_type', 'generate')
      .not('content_id', 'is', null);

    if (countError) {
      console.error('❌ 统计 ai_usage_logs 失败:', countError.message);
      process.exit(1);
    }

    console.log(`总共有 ${count || 0} 条 generate 日志带有 content_id\n`);
    if (!count || count === 0) {
      console.log('✅ 无需补写，直接结束。');
      process.exit(0);
    }

    let offset = 0;
    let processed = 0;
    let touched = 0;

    while (true) {
      console.log(`📥 读取批次：offset=${offset}, limit=${BATCH_SIZE}...`);
      const { data: logs, error } = await supabase
        .from('ai_usage_logs')
        .select('id, user_id, visitor_id, content_id, request_id, user_query, image_urls, generation_params')
        .eq('action_type', 'generate')
        .not('content_id', 'is', null)
        .order('id', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        console.error('❌ 读取 ai_usage_logs 失败:', error.message);
        break;
      }
      if (!logs || logs.length === 0) {
        console.log('✅ 已处理完所有记录。');
        break;
      }

      for (const log of logs) {
        processed += 1;
        const result = await backfillForLog(log);
        if (!result.skipped) {
          touched += 1;
        }
      }

      offset += logs.length;
      console.log(`📊 当前进度：已处理 ${processed}/${count} 条，已补写 ${touched} 条对应会话/消息\n`);

      if (logs.length < BATCH_SIZE) {
        console.log('✅ 最后一批读取完成。');
        break;
      }
    }

    console.log('🎉 补写完成！');
    console.log(`总计处理 ${processed} 条 generate 日志，其中 ${touched} 条完成了会话/消息补写。`);
  } catch (e) {
    console.error('❌ 迁移过程中出现异常:', e);
    process.exit(1);
  }
}

run();

