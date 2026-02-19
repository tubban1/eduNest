#!/usr/bin/env node

/**
 * 迁移脚本：规范 ai_usage_logs.image_urls 结构
 *
 * 目标：
 * - 将历史数据中「只保存一个 URL」或「字符串数组」的 image_urls
 *   统一迁移为数组，每个元素结构为：
 *   { url: string, displayUrl: string | null, mime_type: string }
 *
 * 规则：
 * - 如果是缩略图地址（例如 *.md.jpg / *.md.png / *.md.webp ...）：
 *   - displayUrl = 原始 URL
 *   - url = 去掉 `.md.` 的原图 URL（例如 foo.md.jpg -> foo.jpg）
 * - 否则：
 *   - url = 原始 URL
 *   - displayUrl = null
 * - mime_type 根据扩展名推断：jpg/jpeg/png/gif/webp，无法识别时 fallback 为 image/jpeg
 *
 * 使用方法（在 backend 目录下）：
 *   node migrations/fix_ai_usage_logs_image_urls.js
 */

const path = require('path');

// 确保 .env 加载（与其它迁移脚本保持一致）
const envPath = process.env.NODE_ENV === 'production'
  ? path.resolve(__dirname, '../.env')
  : path.resolve(__dirname, '../../.env');

try {
  require('dotenv').config({ path: envPath });
} catch (e) {
  // 忽略 .env 加载错误，后续 Supabase 初始化会做检查
}

const { supabase } = require('../src/services/database');

const BATCH_SIZE = 500;

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

function normalizeSingleUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const urlWithoutQuery = rawUrl.split('?')[0];

  // 处理 *.md.<ext> 的缩略图形式
  const mdMatch = urlWithoutQuery.match(/^(.*)\.md\.(jpg|jpeg|png|gif|webp)$/i);
  let url = rawUrl;
  let displayUrl = null;

  if (mdMatch) {
    const base = mdMatch[1];
    const ext = mdMatch[2];
    url = `${base}.${ext}`;
    displayUrl = rawUrl;
  } else {
    url = rawUrl;
    displayUrl = null;
  }

  const mime_type = inferMimeTypeFromUrl(url);
  return { url, displayUrl, mime_type };
}

function normalizeImageUrlsField(imageUrls) {
  if (!imageUrls) return null;

  // 情况 1：已经是对象数组，但可能只有 url，需要补充 displayUrl / mime_type
  if (Array.isArray(imageUrls) && imageUrls.length > 0 && typeof imageUrls[0] === 'object' && imageUrls[0] !== null && 'url' in imageUrls[0]) {
    // 如果每一项都已经有 mime_type，则认为是“新结构”，不再改动
    const allHaveMimeType = imageUrls.every(
      (item) => item && typeof item === 'object' && typeof item.url === 'string' && typeof item.mime_type === 'string'
    );
    if (allHaveMimeType) {
      return null;
    }
    // 否则使用 url 重新规范化（兼容 {url:"...md.jpg"} 这种旧数据）
    const items = imageUrls
      .map((item) => (item && typeof item.url === 'string' ? normalizeSingleUrl(item.url) : null))
      .filter(Boolean);
    return items;
  }

  // 情况 2：单个字符串
  if (typeof imageUrls === 'string') {
    const item = normalizeSingleUrl(imageUrls);
    return item ? [item] : [];
  }

  // 情况 3：字符串数组
  if (Array.isArray(imageUrls) && imageUrls.length > 0 && typeof imageUrls[0] === 'string') {
    const items = imageUrls
      .map((u) => normalizeSingleUrl(u))
      .filter(Boolean);
    return items;
  }

  // 其它情况：保持不变
  return null;
}

async function run() {
  console.log('🚀 开始迁移 ai_usage_logs.image_urls 结构...\n');

  try {
    // 先统计总数（只看 image_urls 非空的记录）
    const { count, error: countError } = await supabase
      .from('ai_usage_logs')
      .select('id', { count: 'exact', head: true })
      .not('image_urls', 'is', null);

    if (countError) {
      console.error('❌ 统计 ai_usage_logs 失败:', countError.message);
      process.exit(1);
    }

    console.log(`总共有 ${count || 0} 条记录的 image_urls 非空\n`);
    if (!count || count === 0) {
      console.log('✅ 无需迁移，直接结束。');
      process.exit(0);
    }

    let offset = 0;
    let processed = 0;
    let updated = 0;

    while (true) {
      console.log(`📥 读取批次：offset=${offset}, limit=${BATCH_SIZE}...`);
      const { data: rows, error } = await supabase
        .from('ai_usage_logs')
        .select('id, image_urls')
        .not('image_urls', 'is', null)
        .order('id', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        console.error('❌ 查询 ai_usage_logs 失败:', error.message);
        break;
      }

      if (!rows || rows.length === 0) {
        console.log('✅ 已处理完所有记录。');
        break;
      }

      for (const row of rows) {
        processed += 1;
        const normalized = normalizeImageUrlsField(row.image_urls);
        if (normalized === null) {
          continue; // 不需要更新
        }

        try {
          const { error: updateError } = await supabase
            .from('ai_usage_logs')
            .update({ image_urls: normalized })
            .eq('id', row.id);

          if (updateError) {
            console.error(`⚠️ 更新记录 ${row.id} 失败:`, updateError.message);
          } else {
            updated += 1;
          }
        } catch (e) {
          console.error(`⚠️ 更新记录 ${row.id} 异常:`, e.message);
        }
      }

      offset += rows.length;
      console.log(`📊 当前进度：已处理 ${processed}/${count} 条，已更新 ${updated} 条\n`);

      if (rows.length < BATCH_SIZE) {
        console.log('✅ 最后一批读取完成。');
        break;
      }
    }

    console.log('🎉 迁移完成!');
    console.log(`总计处理 ${processed} 条记录，其中 ${updated} 条进行了 image_urls 结构更新。`);
  } catch (e) {
    console.error('❌ 迁移过程中出现异常:', e);
    process.exit(1);
  }
}

run();

