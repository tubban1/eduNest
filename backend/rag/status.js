#!/usr/bin/env node

/**
 * RAG 状态查看脚本
 *
 * 功能：
 * - 按 `source` 统计 kb_entries 条数与 embedding 完成情况
 * - 帮助快速了解「哪些来源的内容已经进库、是否已向量化」
 *
 * 用法（在 backend 目录）：
 *   node rag/status.js
 *
 * 输出示例：
 *   总条目: 120, 已向量化: 118, 待处理: 2
 *
 *   经销商产品培训文档.md / 3. 常见用户问题: total=40, embedded=40, pending=0
 *   运营补充: total=20, embedded=18, pending=2
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_KEY，请检查 .env');
  }
  return createClient(url, key);
}

async function main() {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('kb_entries')
    .select('source, embedding')
    .order('source', { ascending: true });

  if (error) {
    console.error('查询 kb_entries 失败:', error.message);
    process.exit(1);
  }

  const global = { total: 0, withEmbedding: 0 };
  const bySource = {};

  for (const row of data || []) {
    const rawSource = row.source || '(未设置 source)';
    // 如果以后约定 source 前缀（如 "md:文件名#节标题"），这里可以按前缀聚合
    const key = rawSource.split('#')[0];

    global.total += 1;
    if (!bySource[key]) {
      bySource[key] = { total: 0, withEmbedding: 0 };
    }
    bySource[key].total += 1;
    if (row.embedding) {
      global.withEmbedding += 1;
      bySource[key].withEmbedding += 1;
    }
  }

  const pending = global.total - global.withEmbedding;
  console.log(
    `总条目: ${global.total}, 已向量化: ${global.withEmbedding}, 待处理: ${pending}\n`
  );

  Object.entries(bySource)
    .sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
    .forEach(([src, stat]) => {
      const p = stat.total - stat.withEmbedding;
      console.log(
        `${src}: total=${stat.total}, embedded=${stat.withEmbedding}, pending=${p}`
      );
    });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

