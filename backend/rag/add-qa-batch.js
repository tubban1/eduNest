#!/usr/bin/env node

/**
 * 批量导入 QA 条目到 kb_entries
 *
 * 用法（在 backend 目录）：
 *   node rag/add-qa-batch.js <qa-file.json> [--db] [--skip-embedding]
 *
 * 参数：
 *   <qa-file.json>  包含 QA 条目的 JSON 文件路径（相对于 backend 目录）
 *
 * 选项：
 *   --db            写入 Supabase（否则只验证格式并打印预览）
 *   --skip-embedding  插入后不自动调用 embedding 同步（默认会提示运行 sync-kb-embeddings.js）
 *
 * JSON 文件格式示例（qa-batch.json）：
 * [
 *   {
 *     "category": "FAQ",
 *     "subcategory": "使用",
 *     "title": "如何使用 AI 生成功能？",
 *     "content": "登录后点击「创建」或「AI 生成」，输入知识点即可。",
 *     "content_type": "faq",
 *     "question": "如何使用 AI 生成功能？",
 *     "answer": "登录后点击「创建」或「AI 生成」，输入知识点（如「分数运算」），选择学习阶段和类型，点击生成即可。",
 *     "tags": ["AI生成", "使用"],
 *     "source": "批量补充",
 *     "language_code": "zh-CN"
 *   }
 * ]
 */

const path = require('path');
const fs = require('fs');
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

function validateEntry(entry, index) {
  const required = ['category', 'title', 'content', 'content_type', 'language_code'];
  const missing = required.filter((f) => !entry[f]);
  if (missing.length > 0) {
    throw new Error(`条目 ${index + 1} 缺少必填字段: ${missing.join(', ')}`);
  }

  const validCategories = ['产品', '价格', '销售', '售后', '分销', 'FAQ'];
  if (!validCategories.includes(entry.category)) {
    throw new Error(`条目 ${index + 1} category 无效: ${entry.category}，应为: ${validCategories.join(', ')}`);
  }

  const validContentTypes = ['faq', 'feature', 'pricing', 'sales_script', 'support', 'distributor'];
  if (!validContentTypes.includes(entry.content_type)) {
    throw new Error(`条目 ${index + 1} content_type 无效: ${entry.content_type}，应为: ${validContentTypes.join(', ')}`);
  }

  return {
    category: entry.category,
    subcategory: entry.subcategory || null,
    title: entry.title,
    content: entry.content,
    content_type: entry.content_type,
    question: entry.question || null,
    answer: entry.answer || null,
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    source: entry.source || '批量补充',
    language_code: entry.language_code || 'zh-CN',
  };
}

async function main() {
  const args = process.argv.slice(2);
  const qaFile = args.find((a) => !a.startsWith('--'));
  const writeDb = args.includes('--db');
  const skipEmbedding = args.includes('--skip-embedding');

  if (!qaFile) {
    console.error('用法: node rag/add-qa-batch.js <qa-file.json> [--db] [--skip-embedding]');
    console.error('示例: node rag/add-qa-batch.js qa-batch.json --db');
    process.exit(1);
  }

  const qaPath = path.isAbsolute(qaFile) ? qaFile : path.join(__dirname, '..', qaFile);
  if (!fs.existsSync(qaPath)) {
    console.error(`文件不存在: ${qaPath}`);
    process.exit(1);
  }

  let entries;
  try {
    const content = fs.readFileSync(qaPath, 'utf-8');
    entries = JSON.parse(content);
    if (!Array.isArray(entries)) {
      throw new Error('JSON 文件应包含一个数组');
    }
  } catch (err) {
    console.error('解析 JSON 文件失败:', err.message);
    process.exit(1);
  }

  console.log(`读取到 ${entries.length} 条 QA 条目\n`);

  // 验证所有条目
  const validated = [];
  for (let i = 0; i < entries.length; i++) {
    try {
      validated.push(validateEntry(entries[i], i));
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }

  // 预览前 5 条
  console.log('预览前 5 条:');
  validated.slice(0, 5).forEach((e, i) => {
    console.log(`  ${i + 1}. [${e.category}] ${e.title || e.question || '(无标题)'}`);
  });
  if (validated.length > 5) {
    console.log(`  ... 还有 ${validated.length - 5} 条\n`);
  } else {
    console.log();
  }

  // 检查哪些问题已存在（无论是否 --db）
  const supabase = getSupabase();
  console.log('检查数据库中是否已存在...\n');
  const checkResults = {
    exists: [],
    notExists: [],
  };

  for (let i = 0; i < validated.length; i++) {
    const entry = validated[i];
    const query = entry.question || entry.title || '';
    if (!query) continue;

    try {
      const { data, error } = await supabase
        .from('kb_entries')
        .select('id, category, title, question, source')
        .eq('language_code', entry.language_code)
        .or(`question.eq.${query},title.eq.${query}`)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        checkResults.exists.push({
          index: i + 1,
          entry,
          existing: data[0],
        });
      } else {
        checkResults.notExists.push({
          index: i + 1,
          entry,
        });
      }
    } catch (err) {
      // 检查失败不影响后续插入
      checkResults.notExists.push({ index: i + 1, entry });
    }
  }

  console.log(`检查结果: 已存在 ${checkResults.exists.length} 条，可新增 ${checkResults.notExists.length} 条\n`);

  if (checkResults.exists.length > 0) {
    console.log('已存在的问题（将跳过）:');
    checkResults.exists.slice(0, 10).forEach((r) => {
      const q = r.entry.question || r.entry.title;
      console.log(`  ${r.index}. "${q}"`);
      console.log(`     → 已存在: [${r.existing.category}] ${r.existing.title || r.existing.question}`);
      console.log(`       来源: ${r.existing.source || '(未设置)'}`);
    });
    if (checkResults.exists.length > 10) {
      console.log(`  ... 还有 ${checkResults.exists.length - 10} 条已存在`);
    }
    console.log();
  }

  if (!writeDb) {
    console.log('（未使用 --db，仅预览。要实际写入，请加上 --db 选项）');
    if (checkResults.notExists.length > 0) {
      console.log(`\n提示: 有 ${checkResults.notExists.length} 条可以新增`);
    }
    return;
  }

  // 只插入不存在的问题
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  console.log('开始写入 Supabase（仅写入不存在的问题）...\n');

  for (const result of checkResults.notExists) {
    const entry = result.entry;
    try {
      const { error } = await supabase.from('kb_entries').insert(entry);
      if (error) {
        // 如果是重复（如 title+question 相同），跳过但不报错
        if (error.code === '23505') {
          skipped++;
          console.log(`  [${result.index}/${validated.length}] 跳过（可能重复）: ${entry.title || entry.question}`);
          continue;
        }
        throw error;
      }
      inserted++;
      if (inserted % 10 === 0 || inserted === checkResults.notExists.length) {
        console.log(`  已插入 ${inserted}/${checkResults.notExists.length} 条`);
      }
    } catch (err) {
      failed++;
      console.error(`  [${result.index}/${validated.length}] 插入失败: ${entry.title || entry.question}`, err.message);
    }
  }

  skipped += checkResults.exists.length;
  console.log(`\n完成: 成功 ${inserted}, 跳过 ${skipped}（已存在）, 失败 ${failed}`);

  console.log(`\n完成: 成功 ${inserted}, 失败 ${failed}`);

  if (inserted > 0 && !skipEmbedding) {
    console.log('\n提示: 新插入的条目 embedding 为 NULL，需要生成向量。');
    console.log('运行: node rag/sync-kb-embeddings.js --limit=' + inserted);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
