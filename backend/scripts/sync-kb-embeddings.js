#!/usr/bin/env node

/**
 * 为 kb_entries 中 embedding 为空的记录生成并写入 embedding
 * 使用 text-embedding-3-small，API Key 从 .env 的 GPT_REALTIME_API_KEY 读取
 *
 * 用法（在 backend 目录下）：
 *   node scripts/sync-kb-embeddings.js [--dry-run] [--limit=N]
 *
 * 选项：
 *   --dry-run  只列出待处理条数，不调用 API、不写库
 *   --limit=N  最多处理 N 条（默认 100）
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');
const { embedEntry } = require('../src/services/kbEmbeddingService');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { dryRun: false, limit: 100 };
  args.forEach((arg) => {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--limit=')) options.limit = parseInt(arg.split('=')[1], 10) || 100;
  });
  return options;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_KEY，请检查 .env');
  }
  return createClient(url, key);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const options = parseArgs();
  const supabase = getSupabase();

  const { data: entries, error: fetchError } = await supabase
    .from('kb_entries')
    .select('id, title, content, question, answer')
    .is('embedding', null)
    .limit(options.limit);

  if (fetchError) {
    console.error('查询 kb_entries 失败:', fetchError.message);
    process.exit(1);
  }

  const total = entries?.length ?? 0;
  console.log(`待写入 embedding 条数: ${total}${options.dryRun ? ' (dry-run，不实际执行)' : ''}`);

  if (total === 0) {
    console.log('没有需要处理的记录。');
    return;
  }

  if (options.dryRun) {
    entries.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.title || e.question || e.id}`);
    });
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const entry of entries) {
    try {
      const embedding = await embedEntry(entry);
      const { error: updateError } = await supabase
        .from('kb_entries')
        .update({
          embedding,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entry.id);

      if (updateError) throw updateError;
      ok++;
      console.log(`  [${ok + fail}/${total}] ${entry.title || entry.question || entry.id}`);
    } catch (err) {
      fail++;
      console.error(`  [${ok + fail}/${total}] 失败 ${entry.id}:`, err.message);
    }
    await sleep(150);
  }

  console.log(`\n完成: 成功 ${ok}, 失败 ${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
