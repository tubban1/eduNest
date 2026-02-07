#!/usr/bin/env node

/**
 * 解析《经销商产品培训文档》为知识库条目
 * 输出 kb_entries.json，可选直写 Supabase（--db）
 *
 * 用法（在 backend 目录）：
 *   node scripts/parse-kb-md.js [--db] [--dry-run] [--replace]
 *
 * 选项：
 *   --db       写入 Supabase（需 SUPABASE_URL、SUPABASE_SERVICE_KEY）
 *   --replace  与 --db 同用时，先删除 language_code=zh-CN 的旧条目再插入（用于重跑后价格/分销等分类正确）
 *   --dry-run  只解析并打印条数，不写文件、不写库
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const MD_PATH = path.join(__dirname, '../../doc/经销商产品培训文档.md');
const OUTPUT_JSON = path.join(__dirname, '../kb_entries.json');

// ## 标题 → kb category（与文档 § 一 映射一致；1. 提示词库 暂不放入）
const SECTION_TO_CATEGORY = {
  '0. 所有功能介绍': '产品',
  '2. 系统深度分析体系': '产品',
  '3. 常见用户问题': 'FAQ',
  '4. 产品优势与销售话术': '销售',
  '5. 演示流程与最佳实践': '销售',
  '6. 技术支持与资源': '售后',
  '6.2 经销商支持': '分销',
  '附录': '产品', // A. 快速参考、B. 术语表
};

const CONTENT_TYPE_MAP = {
  '产品': 'feature',
  '价格': 'pricing',
  '销售': 'sales_script',
  '售后': 'support',
  '分销': 'distributor',
  'FAQ': 'faq',
};

const TAG_KEYWORDS = ['AI生成', 'AI Guide', '积分', '订阅', 'Pro', '教师', '学生', '家长', '经销商', '退款', '价格', '月付', '年付', '学习分析', '内容生成', '分享'];

function extractTags(text) {
  if (!text || typeof text !== 'string') return [];
  return TAG_KEYWORDS.filter((k) => text.includes(k));
}

function mapContentType(category) {
  return CONTENT_TYPE_MAP[category] || 'faq';
}

/**
 * 确定当前大节对应的 category；6.2 需在 6. 下单独判断
 */
function getCategoryForSection(headerLine, currentCategory) {
  if (headerLine.includes('6.2 经销商支持')) return '分销';
  for (const [key, cat] of Object.entries(SECTION_TO_CATEGORY)) {
    if (key === '6.2 经销商支持') continue;
    if (headerLine.includes(key)) return cat;
  }
  return currentCategory;
}

/**
 * 解析 FAQ：#### ❓ **Qn: 问题** ... **A:** 答案
 */
function extractFaq(section, currentCategory, sourceHeader) {
  const entries = [];
  const faqBlock = /####\s*❓\s*\*\*Q\d+:\s*(.+?)\*\*[\s\S]*?\*\*A:\*\*\s*([\s\S]+?)(?=####\s*❓|##\s|$)/gi;
  let m;
  while ((m = faqBlock.exec(section)) !== null) {
    const question = m[1].trim();
    const answer = m[2].trim();
    if (answer.length < 2) continue;
    entries.push({
      category: currentCategory,
      subcategory: null,
      title: question,
      content: answer,
      content_type: 'faq',
      question,
      answer,
      tags: extractTags(question + ' ' + answer),
      source: sourceHeader,
      language_code: 'zh-CN',
    });
  }
  return entries;
}

/**
 * 按 ### 或 #### 切分非 FAQ 区块，每条成一条目（内容过短则跳过）
 * blockCategory: 若传入则对该 block 覆盖 category（用于 6.2 分销、价格速查等）
 */
function extractNonFaqBlocks(section, currentCategory, sourceHeader, blockCategory) {
  const entries = [];
  const blocks = section.split(/\n(?=###\s|####\s)/);
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const firstLine = block.split('\n')[0] || '';
    const titleMatch = firstLine.match(/^(?:###|####)\s*(.+)$/);
    const rawSub = titleMatch ? titleMatch[1] : '';
    const subTitle = rawSub.replace(/^[📊🎯🤝💼📞📚🎓🔄📢🎯💰📞📐🔤📖🔬🧪🌍🧬]+\s*/g, '').replace(/\*\*/g, '').trim();
    const body = block.replace(/^(?:###|####)\s*.+\n?/, '').trim();
    const isPriceBlock = /价格速查|月付.*\$29\.8|订阅与积分/.test(subTitle + body);
    if (body.length < 30 && !isPriceBlock) continue;
    if (/^\s*❓\s*\*\*Q\d+:/i.test(block)) continue;
    if (/^#+\s*[📋📚]/.test(firstLine)) continue;
    let effectiveCategory = currentCategory;
    if (blockCategory) effectiveCategory = blockCategory;
    else {
      const titleAndSub = firstLine + subTitle;
      if (/6\.2\s*经销商支持/.test(titleAndSub)) effectiveCategory = '分销';
      else if (/价格速查|订阅与积分系统|订阅与积分|月付.*年付|^\s*\- \*\*月付\*\*/.test(titleAndSub + body)) effectiveCategory = '价格';
    }
    entries.push({
      category: effectiveCategory,
      subcategory: subTitle,
      title: subTitle || firstLine.slice(0, 80),
      content: body,
      content_type: mapContentType(effectiveCategory),
      question: null,
      answer: null,
      tags: extractTags(subTitle + ' ' + body),
      source: sourceHeader + (subTitle ? ' / ' + subTitle : ''),
      language_code: 'zh-CN',
    });
  }
  return entries;
}

function parseMdToEntries(mdContent) {
  const entries = [];
  const mainSections = mdContent.split(/\n(?=##\s)/);
  let currentCategory = '产品';

  for (const section of mainSections) {
    const lines = section.split('\n');
    const headerLine = lines[0] || '';
    const sectionTitle = headerLine.replace(/^##\s*/, '').trim();

    if (!headerLine.startsWith('## ')) continue;
    if (/^##\s*📋\s*目录/.test(headerLine)) continue;
    if (sectionTitle.includes('1. 各年级各科目提示词库')) continue; // 文档建议暂不放入

    currentCategory = getCategoryForSection(headerLine, currentCategory);

    // FAQ（3. 常见用户问题 等有 Q/A 的节）
    const faqEntries = extractFaq(section, currentCategory, sectionTitle);
    entries.push(...faqEntries);

    // 无 FAQ 时再按 ### / #### 拆条，避免与 FAQ 重复
    if (faqEntries.length === 0) {
      // 6. 技术支持与资源：按 ### 切分，6.2 经销商支持 整块用 category 分销
      if (headerLine.includes('6. 技术支持与资源')) {
        const subSections = section.split(/\n(?=###\s)/);
        for (let j = 0; j < subSections.length; j++) {
          const sub = subSections[j];
          const subFirst = sub.split('\n')[0] || '';
          const blockCategory = /6\.2\s*经销商支持/.test(subFirst) ? '分销' : '售后';
          const nonFaq = extractNonFaqBlocks(sub, blockCategory, sectionTitle + (subFirst ? ' / ' + subFirst.replace(/^#+\s*/, '') : ''), blockCategory);
          entries.push(...nonFaq);
        }
      } else {
        const nonFaq = extractNonFaqBlocks(section, currentCategory, sectionTitle);
        entries.push(...nonFaq);
      }
    }
  }

  // 若文档解析后没有「价格」条目，补一条价格速查（附录 #### 💰 有时被合并到上一块）
  if (!entries.some((e) => e.category === '价格')) {
    entries.push({
      category: '价格',
      subcategory: '价格速查',
      title: '价格速查',
      content: '**月付**：$29.8/月\n**年付**：$240/年（节省 $118）\n**积分**：$10 = 500 积分',
      content_type: 'pricing',
      question: null,
      answer: null,
      tags: ['价格', '月付', '年付', '积分', '订阅'],
      source: '附录 / 价格速查',
      language_code: 'zh-CN',
    });
  }

  // 若「分销」条目少于 2 条，补足 6.2 经销商支持下的技术支持、数据分析支持（避免该 Tab 空）
  const distributorCount = entries.filter((e) => e.category === '分销').length;
  if (distributorCount < 2) {
    entries.push(
      {
        category: '分销',
        subcategory: '技术支持',
        title: '经销商技术支持',
        content: '**技术培训**：技术深度培训\n**技术支持**：技术问题解答\n**产品更新**：及时通知产品更新',
        content_type: 'distributor',
        question: null,
        answer: null,
        tags: ['经销商', '技术'],
        source: '6. 技术支持与资源 / 6.2 经销商支持',
        language_code: 'zh-CN',
      },
      {
        category: '分销',
        subcategory: '数据分析支持',
        title: '经销商数据分析支持',
        content: '**销售数据**：提供销售数据分析\n**用户数据**：提供用户使用数据分析\n**市场洞察**：分享市场趋势和洞察',
        content_type: 'distributor',
        question: null,
        answer: null,
        tags: ['经销商', '数据'],
        source: '6. 技术支持与资源 / 6.2 经销商支持',
        language_code: 'zh-CN',
      }
    );
  }

  return entries;
}

async function main() {
  const args = process.argv.slice(2);
  const writeDb = args.includes('--db');
  const replace = args.includes('--replace');
  const dryRun = args.includes('--dry-run');

  if (!fs.existsSync(MD_PATH)) {
    console.error('未找到文档:', MD_PATH);
    process.exit(1);
  }

  const md = fs.readFileSync(MD_PATH, 'utf-8');
  const entries = parseMdToEntries(md);
  console.log('解析得到条目数:', entries.length);

  if (dryRun) {
    entries.slice(0, 5).forEach((e, i) => {
      console.log(`  ${i + 1}. [${e.category}] ${e.title || e.question || '(无标题)'}`);
    });
    if (entries.length > 5) console.log('  ...');
    return;
  }

  if (!writeDb) {
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(entries, null, 2), 'utf-8');
    console.log('已写入:', OUTPUT_JSON);
    return;
  }

  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('写入 DB 需要 SUPABASE_URL、SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const table = 'kb_entries';
  if (replace) {
    const { error: delErr } = await supabase.from(table).delete().eq('language_code', 'zh-CN');
    if (delErr) {
      console.error('删除旧条目失败:', delErr.message);
      process.exit(1);
    }
    console.log('已删除 language_code=zh-CN 的旧条目');
  }
  const toRow = (e) => ({
    category: e.category,
    subcategory: e.subcategory || null,
    title: e.title || '',
    content: e.content || '',
    content_type: e.content_type,
    question: e.question || null,
    answer: e.answer || null,
    tags: e.tags || [],
    source: e.source || null,
    language_code: e.language_code || 'zh-CN',
  });

  let inserted = 0;
  for (const e of entries) {
    const { error } = await supabase.from(table).insert(toRow(e));
    if (error) {
      console.error('插入失败:', e.title || e.question, error.message);
      continue;
    }
    inserted++;
  }
  console.log('已写入 Supabase 条数:', inserted);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
