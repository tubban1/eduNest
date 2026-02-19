#!/usr/bin/env node

/**
 * 修正「迁移进来的 user 消息」与「对应 assistant 回复」的 created_at 顺序
 *
 * 目标：
 * - 所有通过 backfill 写入的 user 消息（metadata.generation_request_id 存在）：
 *   将其 created_at 设为对应 ai_usage_logs.created_at（更早）。
 * - 同一会话中，若某条 assistant 的 created_at 早于或等于该 user 消息：
 *   将 assistant 的 created_at 设为 user_created_at + 1 分钟，保证顺序。
 *
 * 使用方法（在 backend 目录下）：
 *   node migrations/fix_backfilled_message_timestamps.js
 */

const path = require('path');

const envPath = process.env.NODE_ENV === 'production'
  ? path.resolve(__dirname, '../.env')
  : path.resolve(__dirname, '../../.env');

try {
  require('dotenv').config({ path: envPath });
} catch (e) {}

const db = require('../src/services/database');
const supabase = db.supabase;

if (!supabase) {
  console.error('❌ Supabase 客户端未初始化，请检查 .env 中 SUPABASE_URL、SUPABASE_SERVICE_KEY 是否配置且可访问。');
  process.exit(1);
}

const ASSISTANT_OFFSET_SECONDS = 60; // assistant 比 user 晚 1 分钟

function logFetchError(label, err) {
  const msg = err?.message || String(err);
  const cause = err?.cause ? ` (cause: ${err.cause?.message || err.cause})` : '';
  console.error(`❌ ${label}: ${msg}${cause}`);
}

async function run() {
  console.log('🚀 开始修正迁移进来的 user/assistant 消息时间顺序...\n');

  try {
    // 1) 查出所有「由 backfill 写入」的 user 消息：metadata->>'generation_request_id' 不为空
    let userMsgs, userErr;
    try {
      const res = await supabase
        .from('ai_messages')
        .select('id, conversation_id, created_at, metadata')
        .eq('role', 'user')
        .not('metadata->generation_request_id', 'is', null);
      userMsgs = res.data;
      userErr = res.error;
    } catch (e) {
      console.error('❌ 请求 ai_messages 时发生网络/运行时错误:', e.message);
      if (e.cause) console.error('   原因:', e.cause.message || e.cause);
      console.error('\n请检查：1) .env 中 SUPABASE_URL、SUPABASE_SERVICE_KEY 是否正确；2) 本机网络能否访问 Supabase。');
      process.exit(1);
    }

    if (userErr) {
      logFetchError('查询 backfill user 消息失败', userErr);
      process.exit(1);
    }

    if (!userMsgs || userMsgs.length === 0) {
      console.log('✅ 没有带 generation_request_id 的 user 消息，无需修正。');
      process.exit(0);
    }

    const requestIds = [...new Set(userMsgs.map((m) => m.metadata?.generation_request_id).filter(Boolean))];
    if (requestIds.length === 0) {
      console.log('✅ 无有效 generation_request_id，退出。');
      process.exit(0);
    }

    // 2) 分批查 ai_usage_logs 的 created_at（避免 URL 过长或超时）
    const BATCH = 100;
    const logs = [];
    for (let i = 0; i < requestIds.length; i += BATCH) {
      const chunk = requestIds.slice(i, i + BATCH);
      const { data: part, error: logsErr } = await supabase
        .from('ai_usage_logs')
        .select('request_id, created_at')
        .in('request_id', chunk);

      if (logsErr) {
        logFetchError('查询 ai_usage_logs 失败', logsErr);
        process.exit(1);
      }
      if (part && part.length) logs.push(...part);
    }

    const logByRequestId = new Map(logs.map((l) => [l.request_id, l]));

    // 3) 更新每条 backfill user 消息的 created_at 为 log.created_at
    let updatedUsers = 0;
    const conversationUserTime = new Map(); // conversation_id -> 该会话中 backfill user 的 created_at（取最小，一般就一条）

    for (const msg of userMsgs) {
      const rid = msg.metadata?.generation_request_id;
      const log = rid ? logByRequestId.get(rid) : null;
      if (!log || !log.created_at) continue;

      const newCreatedAt = new Date(log.created_at).toISOString();
      const { error: upErr } = await supabase
        .from('ai_messages')
        .update({ created_at: newCreatedAt })
        .eq('id', msg.id);

      if (upErr) {
        console.warn('⚠️ 更新 user 消息 created_at 失败:', msg.id, upErr.message);
        continue;
      }
      updatedUsers += 1;

      const convId = msg.conversation_id;
      const prev = conversationUserTime.get(convId);
      if (!prev || new Date(newCreatedAt) < new Date(prev)) {
        conversationUserTime.set(convId, newCreatedAt);
      }
    }

    console.log(`✅ 已将 ${updatedUsers} 条 backfill user 消息的 created_at 设为对应 ai_usage_logs 时间。\n`);

    // 4) 对每个会话，把「早于或等于该 user 时间」的 assistant 消息改为 user_created_at + 1 分钟
    let updatedAssistants = 0;
    for (const [convId, userCreatedAt] of conversationUserTime) {
      const laterTime = new Date(new Date(userCreatedAt).getTime() + ASSISTANT_OFFSET_SECONDS * 1000).toISOString();

      const { data: assistants, error: aErr } = await supabase
        .from('ai_messages')
        .select('id, created_at')
        .eq('conversation_id', convId)
        .eq('role', 'assistant')
        .lte('created_at', userCreatedAt);

      if (aErr || !assistants || assistants.length === 0) continue;

      for (let i = 0; i < assistants.length; i++) {
        const a = assistants[i];
        const newAt = i === 0
          ? laterTime
          : new Date(new Date(laterTime).getTime() + (i + 1) * 1000).toISOString();
        const { error: uErr } = await supabase
          .from('ai_messages')
          .update({ created_at: newAt })
          .eq('id', a.id);
        if (!uErr) updatedAssistants += 1;
      }
    }

    console.log(`✅ 已将 ${updatedAssistants} 条 assistant 消息的 created_at 调整为晚于对应 user 消息。`);
    console.log('🎉 时间顺序修正完成。');
  } catch (e) {
    console.error('❌ 执行异常:', e);
    process.exit(1);
  }
}

run();
