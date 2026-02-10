#!/usr/bin/env node

/**
 * 检查问题是否已在 kb_entries 中存在
 *
 * 用法（在 backend 目录）：
 *   1. 检查单个问题：
 *      node rag/check-qa.js "如何使用 AI 生成功能？"
 *
 *   2. 批量检查 JSON 文件中的问题：
 *      node rag/check-qa.js qa-batch.json
 *
 *   3. 按问题文本模糊匹配：
 *      node rag/check-qa.js "AI生成" --fuzzy
 *
 * 选项：
 *   --fuzzy    模糊匹配（检查 question/title/content 是否包含关键词）
 *   --language  指定语言代码（默认 zh-CN）
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

/**
 * 检查单个问题是否已存在
 */
async function checkSingleQuestion(supabase, query, languageCode, fuzzy = false) {
  const q = (query || '').trim();
  if (!q) {
    console.error('问题不能为空');
    return;
  }

  if (fuzzy) {
    // 模糊匹配：检查 question/title/content 是否包含关键词
    const { data, error } = await supabase
      .from('kb_entries')
      .select('id, category, title, question, answer, source')
      .eq('language_code', languageCode)
      .or(`question.ilike.%${q}%,title.ilike.%${q}%,content.ilike.%${q}%`)
      .limit(20);

    if (error) {
      console.error('查询失败:', error.message);
      return;
    }

    if (!data || data.length === 0) {
      console.log(`未找到包含 "${q}" 的条目`);
      return;
    }

    console.log(`找到 ${data.length} 条相关条目:\n`);
    data.forEach((e, i) => {
      console.log(`${i + 1}. [${e.category}] ${e.title || e.question || '(无标题)'}`);
      if (e.question && e.question !== e.title) {
        console.log(`   问题: ${e.question}`);
      }
      if (e.source) {
        console.log(`   来源: ${e.source}`);
      }
      console.log();
    });
  } else {
    // 精确匹配：检查 question 或 title 是否完全匹配
    const { data, error } = await supabase
      .from('kb_entries')
      .select('id, category, title, question, answer, source')
      .eq('language_code', languageCode)
      .or(`question.eq.${q},title.eq.${q}`)
      .limit(10);

    if (error) {
      console.error('查询失败:', error.message);
      return;
    }

    if (!data || data.length === 0) {
      console.log(`"${q}" 不存在，可以新增`);
      return;
    }

    console.log(`找到 ${data.length} 条匹配条目:\n`);
    data.forEach((e, i) => {
      console.log(`${i + 1}. [${e.category}] ${e.title || e.question || '(无标题)'}`);
      if (e.question && e.question !== e.title) {
        console.log(`   问题: ${e.question}`);
      }
      if (e.answer) {
        const preview = e.answer.length > 100 ? e.answer.slice(0, 100) + '...' : e.answer;
        console.log(`   答案: ${preview}`);
      }
      if (e.source) {
        console.log(`   来源: ${e.source}`);
      }
      console.log(`   ID: ${e.id}`);
      console.log();
    });
  }
}

/**
 * 批量检查 JSON 文件中的问题
 */
async function checkBatchFile(supabase, filePath, languageCode) {
  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    return;
  }

  let entries;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    entries = JSON.parse(content);
    if (!Array.isArray(entries)) {
      throw new Error('JSON 文件应包含一个数组');
    }
  } catch (err) {
    console.error('解析 JSON 文件失败:', err.message);
    return;
  }

  console.log(`检查 ${entries.length} 条问题...\n`);

  const results = {
    exists: [],
    notExists: [],
    errors: [],
  };

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const query = entry.question || entry.title || '';
    if (!query) {
      results.errors.push({ index: i + 1, reason: '缺少 question 和 title' });
      continue;
    }

    try {
      const { data, error } = await supabase
        .from('kb_entries')
        .select('id, category, title, question, source')
        .eq('language_code', languageCode)
        .or(`question.eq.${query},title.eq.${query}`)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        results.exists.push({
          index: i + 1,
          query,
          existing: data[0],
        });
      } else {
        results.notExists.push({
          index: i + 1,
          query,
        });
      }
    } catch (err) {
      results.errors.push({
        index: i + 1,
        query,
        reason: err.message,
      });
    }
  }

  // 输出结果
  console.log(`\n检查结果:`);
  console.log(`  已存在: ${results.exists.length} 条`);
  console.log(`  不存在: ${results.notExists.length} 条`);
  if (results.errors.length > 0) {
    console.log(`  错误: ${results.errors.length} 条\n`);
  } else {
    console.log();
  }

  if (results.exists.length > 0) {
    console.log('已存在的问题:');
    results.exists.forEach((r) => {
      console.log(`  ${r.index}. "${r.query}"`);
      console.log(`     → 已存在: [${r.existing.category}] ${r.existing.title || r.existing.question}`);
      console.log(`       来源: ${r.existing.source || '(未设置)'}`);
      console.log();
    });
  }

  if (results.notExists.length > 0) {
    console.log('可以新增的问题:');
    results.notExists.slice(0, 10).forEach((r) => {
      console.log(`  ${r.index}. "${r.query}"`);
    });
    if (results.notExists.length > 10) {
      console.log(`  ... 还有 ${results.notExists.length - 10} 条`);
    }
    console.log();
  }

  if (results.errors.length > 0) {
    console.log('检查出错的问题:');
    results.errors.forEach((r) => {
      console.log(`  ${r.index}. "${r.query || '(无问题)'}": ${r.reason}`);
    });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const queryOrFile = args.find((a) => !a.startsWith('--'));
  const fuzzy = args.includes('--fuzzy');
  const languageCode = args.find((a) => a.startsWith('--language='))
    ? args.find((a) => a.startsWith('--language=')).split('=')[1]
    : 'zh-CN';

  if (!queryOrFile) {
    console.error('用法:');
    console.error('  检查单个问题: node rag/check-qa.js "问题文本" [--fuzzy]');
    console.error('  批量检查文件: node rag/check-qa.js <qa-file.json>');
    console.error('  模糊匹配: node rag/check-qa.js "关键词" --fuzzy');
    process.exit(1);
  }

  const supabase = getSupabase();

  // 判断是文件还是单个问题
  const isFile = queryOrFile.endsWith('.json') || fs.existsSync(queryOrFile);
  const queryPath = path.isAbsolute(queryOrFile) ? queryOrFile : path.join(__dirname, '..', queryOrFile);

  if (isFile && fs.existsSync(queryPath)) {
    await checkBatchFile(supabase, queryPath, languageCode);
  } else {
    await checkSingleQuestion(supabase, queryOrFile, languageCode, fuzzy);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
