/**
 * 知识库问答服务（方案 C 混合检索）
 * ① 静态规则（§3.5）→ ② 精确匹配（仅主语言）→ ③ 向量检索 → LLM 生成
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const logger = require('../utils/logger');

// 主语言：仅在此语言下走精确匹配
const MAIN_LANGUAGE = 'zh-CN';

/**
 * 静态规则（§3.5 多源答案）：极短/口语化问法，命中则直接返回，不查库
 * 每条：{ patterns: string[] | RegExp[], answer: string, category?: string }
 */
const STATIC_RULES = [
  {
    patterns: [/^这是什么[？?]?$/, /^这是啥[？?]?$/, /^what is this\s*[？?]?$/i],
    answer: '这是 EduNest，一个基于 AI 的智能教育平台。您可以：用 AI 生成交互式课件（输入知识点即可）、通过 AI Guide 获得个性化辅导、查看学习分析报告。支持从幼儿园到高三全学段、全学科，教师、学生、家长、机构都可使用。',
    category: '产品',
  },
  {
    patterns: [/^怎么用[？?]?$/, /^怎么使用[？?]?$/, /^如何使用[？?]?$/, /^怎么搞[？?]?$/],
    answer: '1) AI 生成：登录后点击「创建」或「AI 生成」，输入知识点（如「分数运算」），选择类型后生成。2) AI Guide：打开任意内容，点击「AI Guide」提问。3) 学习报告：进入学习分析页面查看。新用户有免费积分可体验。',
    category: '产品',
  },
  {
    patterns: [/^还有什么[？?]?$/, /^还有别的吗[？?]?$/, /好像很多数学题.*还有别的/, /只有数学/, /还有什么学科/],
    answer: '不只是数学。EduNest 支持全学段、全学科：数学、语文、英语、科学、物理、化学、生物等。输入知识点时可指定年级和学科，AI 会按对应难度生成内容。',
    category: '产品',
  },
];

function staticRulesMatch(query, languageCode) {
  if (!query || typeof query !== 'string') return null;
  const q = query.trim();
  if (!q) return null;
  for (const rule of STATIC_RULES) {
    for (const p of rule.patterns) {
      if (typeof p === 'string' && q.includes(p)) return rule;
      if (p instanceof RegExp && p.test(q)) return rule;
    }
  }
  return null;
}

// 价格/退款/联系方式关键词 → 对应 category 或检索方式
const EXACT_KEYWORDS = {
  price: ['月付', '年付', '$29.8', '$240', '多少钱', '价格', '订阅费用', '积分', '500积分', 'pro计划', '订阅计划'],
  refund: ['退款', '退订', '取消订阅', '如何退'],
  contact: ['客服', '联系方式', '电话', '邮箱', 'support', '联系'],
};

/**
 * 精确匹配（仅主语言）：FAQ question ILIKE、价格/退款/联系方式关键词
 * @param {object} supabase - Supabase client
 * @param {string} query - 用户输入
 * @param {string} languageCode - 当前语言
 * @returns {Promise<object|null>} 命中条目或 null
 */
async function exactMatch(supabase, query, languageCode) {
  if (languageCode !== MAIN_LANGUAGE) return null;
  const q = (query || '').trim();
  if (!q) return null;

  // 1. FAQ：question 包含用户输入或用户输入包含 question 片段
  const { data: faqRows } = await supabase
    .from('kb_entries')
    .select('id, category, title, content, question, answer, source')
    .eq('language_code', MAIN_LANGUAGE)
    .not('question', 'is', null)
    .ilike('question', `%${q}%`)
    .limit(1);
  if (faqRows && faqRows.length > 0) return faqRows[0];

  // 反向：用户输入较短时，用 question 包含 query 的 ILIKE 可能无结果；再试 content/answer 含 query
  const { data: faqByContent } = await supabase
    .from('kb_entries')
    .select('id, category, title, content, question, answer, source')
    .eq('language_code', MAIN_LANGUAGE)
    .or(`question.ilike.%${q}%,answer.ilike.%${q}%,content.ilike.%${q}%`)
    .limit(1);
  if (faqByContent && faqByContent.length > 0) return faqByContent[0];

  // 2. 价格关键词 → 查 category=价格
  const isPrice = EXACT_KEYWORDS.price.some((k) => q.includes(k));
  if (isPrice) {
    const { data: priceRows } = await supabase
      .from('kb_entries')
      .select('id, category, title, content, question, answer, source')
      .eq('language_code', MAIN_LANGUAGE)
      .eq('category', '价格')
      .limit(1);
    if (priceRows && priceRows.length > 0) return priceRows[0];
  }

  // 3. 退款关键词 → 售后且内容含退款
  const isRefund = EXACT_KEYWORDS.refund.some((k) => q.includes(k));
  if (isRefund) {
    const { data: refundRows } = await supabase
      .from('kb_entries')
      .select('id, category, title, content, question, answer, source')
      .eq('language_code', MAIN_LANGUAGE)
      .eq('category', '售后')
      .or('content.ilike.%退款%,answer.ilike.%退款%,content.ilike.%取消%')
      .limit(1);
    if (refundRows && refundRows.length > 0) return refundRows[0];
  }

  // 4. 联系方式关键词 → 售后或 content 含联系方式
  const isContact = EXACT_KEYWORDS.contact.some((k) => q.includes(k));
  if (isContact) {
    const { data: contactRows } = await supabase
      .from('kb_entries')
      .select('id, category, title, content, question, answer, source')
      .eq('language_code', MAIN_LANGUAGE)
      .or('content.ilike.%客服%,content.ilike.%support%,content.ilike.%@%')
      .limit(1);
    if (contactRows && contactRows.length > 0) return contactRows[0];
  }

  return null;
}

/**
 * 向量检索：调用 match_kb_entries RPC
 * @param {object} supabase
 * @param {number[]} queryEmbedding - 1536 维向量
 * @param {object} opts - { matchThreshold, matchCount, filterCategory }
 */
async function vectorSearch(supabase, queryEmbedding, opts = {}) {
  const { matchThreshold = 0.35, matchCount = 5, filterCategory = null } = opts;
  try {
    const params = {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    };
    if (filterCategory) params.filter_category = filterCategory;
    const { data, error } = await supabase.rpc('match_kb_entries', params);
    if (error) {
      logger.warn('[kbAsk] match_kb_entries RPC 失败', { error: error.message });
      return [];
    }
    return data || [];
  } catch (e) {
    logger.error('[kbAsk] vectorSearch', e);
    return [];
  }
}

/**
 * 用 LLM 根据检索到的 context 生成回答（用户语言）
 * @param {Array} retrievedEntries - 检索到的知识库条目
 * @param {string} userQuery - 当前用户问题
 * @param {string} languageCode - 用户语言
 * @param {Array} [history] - 多轮对话历史 [{ role: 'user'|'assistant', content: string }]，最近若干轮
 */
const RAG_SYSTEM_PROMPT = `你是一个 EduNest 产品顾问，只根据以下知识库内容回答用户问题。

规则：
1. 仅使用提供的「参考内容」回答，不得编造价格、联系方式或政策。
2. 若参考内容不足以回答，请明确说「该问题暂无法从知识库回答，建议联系客服」。
3. 回复必须使用用户的语言（根据 language_code）。
4. 回复简洁清晰，必要时可分点列举。
5. 可适当引导用户「点击下方推荐内容亲自体验」。
6. 若用户进行追问（如「那价格呢」「上面说的怎么用」），请结合上文对话与参考内容作答。`;

const MAX_HISTORY_MESSAGES = 6;

async function generateAnswer(retrievedEntries, userQuery, languageCode, history = []) {
  const AIProviderFactory = require('./aiProviderFactory');
  const aiProviderFactory = new AIProviderFactory();
  const context = (retrievedEntries || [])
    .map((e, i) => {
      const text = e.answer || e.content || '';
      const title = e.title || e.question || '(无标题)';
      return `[${i + 1}] 标题：${title}\n内容：${text}`;
    })
    .join('\n\n---\n\n');

  const systemContent = `${RAG_SYSTEM_PROMPT}\n\n参考内容：\n---\n${context || '(无)'}\n---`;
  const userContent = `用户问题：${userQuery}\n用户语言：${languageCode}\n请根据上述参考内容用用户语言回答。`;

  const historyMessages = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));

  const messages = [
    { role: 'system', content: systemContent },
    ...historyMessages,
    { role: 'user', content: userContent },
  ];

  const result = await aiProviderFactory.createChatCompletion({
    provider: 'qenda',
    messages,
    max_tokens: 1500,
    temperature: 0.4,
    stream: false,
  });

  return result.content || '';
}

module.exports = {
  staticRulesMatch,
  exactMatch,
  vectorSearch,
  generateAnswer,
  MAIN_LANGUAGE,
};
