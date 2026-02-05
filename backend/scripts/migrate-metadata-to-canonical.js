#!/usr/bin/env node

/**
 * 迁移脚本：将 content.metadata_json 逐条统一为 { canonical, extras } 格式
 *
 * 流程：查询 → 适配 → 更新 → 验证
 *
 * 用法：
 *   node scripts/migrate-metadata-to-canonical.js [--dry-run] [--limit=N]
 *
 * 选项：
 *   --dry-run    只执行查询和适配，不更新、不验证
 *   --limit=N    限制处理数量（默认：全部）
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');
const { normalizeMetadata } = require('../src/utils/metadataNormalizer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 与 aiGuideService METADATA_PROMPT 中的 canonical schema 一致
const CANONICAL_REQUIRED = ['topic', 'language', 'stages', 'learning_objectives'];
const STAGE_REQUIRED = ['index', 'title'];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { dryRun: false, limit: null };

  args.forEach((arg) => {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--limit=')) options.limit = parseInt(arg.split('=')[1], 10) || null;
  });

  return options;
}

/** 验证 canonical 结构是否符合定义 */
function verifyCanonical(normalized) {
  const issues = [];
  const { canonical, extras } = normalized;

  if (!canonical || typeof canonical !== 'object') {
    issues.push('缺少 canonical 对象');
    return { ok: false, issues };
  }

  for (const k of CANONICAL_REQUIRED) {
    if (canonical[k] === undefined) issues.push(`canonical 缺少必填字段: ${k}`);
  }
  if (!Array.isArray(canonical.stages)) issues.push('canonical.stages 必须为数组');
  else {
    canonical.stages.forEach((s, i) => {
      if (!s || typeof s !== 'object') {
        issues.push(`stages[${i}] 格式错误`);
      } else {
        for (const f of STAGE_REQUIRED) {
          if (s[f] === undefined) issues.push(`stages[${i}] 缺少 ${f}`);
        }
        if (typeof s.index === 'number' && s.index < 1) {
          issues.push(`stages[${i}].index 必须 1-based，当前为 ${s.index}`);
        }
      }
    });
  }

  if (canonical.concept_map && !Array.isArray(canonical.concept_map)) {
    issues.push('concept_map 必须为数组');
  }
  if (canonical.interactions_summary && !Array.isArray(canonical.interactions_summary)) {
    issues.push('interactions_summary 必须为数组');
  }

  return { ok: issues.length === 0, issues };
}

async function main() {
  const options = parseArgs();

  // 1. 查询所有含 metadata_json 的 content
  const { data: rows, error: queryErr } = await supabase
    .from('content')
    .select('id, short_id, title, metadata_json')
    .not('metadata_json', 'is', null)
    .order('created_at', { ascending: true });

  if (queryErr) {
    console.error('查询失败:', queryErr);
    process.exit(1);
  }

  let list = (rows || []).filter((r) => r.metadata_json != null);
  if (options.limit) list = list.slice(0, options.limit);

  console.log(`共 ${list.length} 条 content 含有 metadata_json，逐条处理...\n`);

  if (list.length === 0) {
    console.log('没有需要处理的记录。');
    return;
  }

  if (options.dryRun) {
    console.log('[DRY RUN 模式 - 不更新、不验证]\n');
  }

  let success = 0;
  const errors = [];
  const verified = [];

  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    const idx = i + 1;

    try {
      // 2. 适配：转为 canonical + extras
      const normalized = normalizeMetadata(row.metadata_json);

      // 适配后先校验
      const verify = verifyCanonical(normalized);
      if (!verify.ok) {
        throw new Error(`适配后校验失败: ${verify.issues.join('; ')}`);
      }

      if (options.dryRun) {
        console.log(
          `  [${idx}/${list.length}] [DRY RUN] ${row.short_id} | stages: ${normalized.canonical.stages?.length ?? 0} | topic: ${(normalized.canonical.topic || '').slice(0, 35)}`
        );
        success++;
        continue;
      }

      // 3. 执行更新
      const { error: updErr } = await supabase
        .from('content')
        .update({
          metadata_json: normalized,
          metadata_updated_at: new Date().toISOString()
        })
        .eq('id', row.id);

      if (updErr) throw updErr;

      // 4. 验证：重新查询并检查
      const { data: refetch, error: refetchErr } = await supabase
        .from('content')
        .select('metadata_json')
        .eq('id', row.id)
        .single();

      if (refetchErr || !refetch?.metadata_json) {
        throw new Error(`验证查询失败: ${refetchErr?.message || '无数据'}`);
      }

      const stored = refetch.metadata_json;
      const reVerify = verifyCanonical(stored);
      if (!reVerify.ok) {
        throw new Error(`验证失败: ${reVerify.issues.join('; ')}`);
      }

      if (!stored.canonical || !stored.hasOwnProperty('extras')) {
        throw new Error('验证失败: 存储结构不符合 { canonical, extras }');
      }

      success++;
      verified.push({
        short_id: row.short_id,
        stages: stored.canonical.stages?.length ?? 0,
        topic: (stored.canonical.topic || '').slice(0, 40)
      });
      console.log(`  [${idx}/${list.length}] ✓ ${row.short_id} | stages: ${stored.canonical.stages?.length ?? 0} | ${(stored.canonical.topic || '').slice(0, 35)}`);
    } catch (e) {
      errors.push({ short_id: row.short_id, title: (row.title || '').slice(0, 30), error: e.message });
      console.error(`  [${idx}/${list.length}] ✗ ${row.short_id}: ${e.message}`);
    }
  }

  console.log(`\n========== 完成 ==========`);
  console.log(`成功: ${success} | 失败: ${errors.length} | 总计: ${list.length}`);

  if (verified.length > 0 && !options.dryRun) {
    console.log('\n已验证记录（前 10 条）:');
    verified.slice(0, 10).forEach((v) => console.log(`  - ${v.short_id} | ${v.stages} stages | ${v.topic}`));
  }

  if (errors.length > 0) {
    console.log('\n失败详情:');
    errors.forEach((e) => console.log(`  - ${e.short_id} (${e.title}): ${e.error}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
