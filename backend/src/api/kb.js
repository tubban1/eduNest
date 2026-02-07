/**
 * 知识库 API：产品咨询（Phase 1 + Phase 2）+ 运维管理（§10.2）
 * GET    /api/kb/entries     - 分类 + 关键词检索
 * GET    /api/kb/recommend   - 按场景推荐精选内容
 * POST   /api/kb/ask         - 混合检索：精确匹配 → 向量 → LLM 生成，返回回答 + 推荐
 * POST   /api/kb/entries     - [鉴权] 新增条目
 * PUT    /api/kb/entries/:id - [鉴权] 更新条目
 * DELETE /api/kb/entries/:id - [鉴权] 删除条目
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const config = require('../config');
const DatabaseService = require('../services/database');
const kbAskService = require('../services/kbAskService');
const kbEmbeddingService = require('../services/kbEmbeddingService');
const logger = require('../utils/logger');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const KB_CATEGORIES = ['产品', '价格', '销售', '售后', '分销', 'FAQ'];
const KB_CONTENT_TYPES = ['faq', 'feature', 'pricing', 'sales_script', 'support', 'distributor'];

function getSupabase() {
  const url = config.SUPABASE_URL || process.env.SUPABASE_URL;
  const key = config.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase 未配置');
  return createClient(url, key);
}

/**
 * GET /api/kb/entries
 * Query: category, q, limit, language_code
 */
router.get('/entries', async (req, res) => {
  try {
    const { category, q, limit = 20, language_code = 'zh-CN' } = req.query;
    const supabase = getSupabase();

    let query = supabase
      .from('kb_entries')
      .select('id, category, subcategory, title, content, content_type, question, answer, tags, source')
      .eq('language_code', language_code)
      .limit(Math.min(parseInt(limit, 10) || 20, 100));

    if (category && category.trim()) {
      query = query.eq('category', category.trim());
    }
    if (q && q.trim()) {
      const term = q.trim();
      query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%,question.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) {
      logger.warn('[kb/entries] 查询失败', { error: error.message });
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json({ success: true, data: data || [] });
  } catch (e) {
    logger.error('[kb/entries]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /api/kb/recommend
 * Query: category, role, tags, language_code, limit
 * 复用 featured 接口，按分类/角色映射 tags
 */
const CATEGORY_TO_TAGS = {
  '产品': ['数学', '分数', '几何'],
  '销售': ['教师', '演示'],
  'FAQ': [],
  '价格': [],
  '售后': [],
  '分销': [],
};

router.get('/recommend', async (req, res) => {
  try {
    const { category, role, tags, language_code = 'zh-CN', limit = 4 } = req.query;
    const tagsParam = tags
      ? (Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim()).filter(Boolean))
      : (category && CATEGORY_TO_TAGS[category]) || [];
    const result = await DatabaseService.getFeaturedContents({
      limit: Math.min(parseInt(limit, 10) || 4, 20),
      offset: 0,
      category: null,
      tags: tagsParam.length ? tagsParam : null,
      language_code: language_code || 'zh-CN',
    });
    if (result.error) {
      return res.status(500).json({ success: false, error: result.error.message });
    }
    res.json({ success: true, data: result.data || [] });
  } catch (e) {
    logger.error('[kb/recommend]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/** 内部：按 category/tags 取推荐内容，供 ask 使用 */
async function getRecommendForAsk(supabase, { category, tags, language_code = 'zh-CN', limit = 4 }) {
  const tagsParam = Array.isArray(tags) && tags.length
    ? tags
    : (category && CATEGORY_TO_TAGS[category]) || [];
  const result = await DatabaseService.getFeaturedContents({
    limit: Math.min(limit, 20),
    offset: 0,
    category: null,
    tags: tagsParam.length ? tagsParam : null,
    language_code,
  });
  return result.data || [];
}

/**
 * POST /api/kb/ask
 * Body: { query, language_code?, role? }
 * 混合检索：精确匹配（仅 zh-CN）→ 向量 → LLM 生成；返回 answer、sources、recommend
 */
router.post('/ask', async (req, res) => {
  try {
    const { query, language_code = 'zh-CN', role, history } = req.body || {};
    const q = (query || '').trim();
    if (!q) {
      return res.status(400).json({ success: false, error: 'query 不能为空' });
    }
    const supabase = getSupabase();

    // 0. 静态规则（§3.5 多源）：极短/口语化问法，直接返回
    const staticHit = kbAskService.staticRulesMatch(q, language_code);
    if (staticHit) {
      const recommend = await getRecommendForAsk(supabase, {
        category: staticHit.category,
        language_code,
        limit: 4,
      });
      return res.json({
        success: true,
        answer: staticHit.answer,
        source: { title: '产品说明', category: staticHit.category, source: '静态规则' },
        sources: [],
        recommend,
        from_exact: true,
        source_type: 'static',
      });
    }

    // 1. 精确匹配（仅主语言）
    const exact = await kbAskService.exactMatch(supabase, q, language_code);
    if (exact) {
      const answer = exact.answer || exact.content || '';
      const recommend = await getRecommendForAsk(supabase, {
        category: exact.category,
        tags: exact.tags,
        language_code,
        limit: 4,
      });
      return res.json({
        success: true,
        answer,
        source: { id: exact.id, title: exact.title, category: exact.category, source: exact.source },
        sources: [exact],
        recommend,
        from_exact: true,
        source_type: 'exact',
      });
    }

    // 2. 向量检索
    let queryEmbedding;
    try {
      queryEmbedding = await kbEmbeddingService.getEmbedding(q);
    } catch (embErr) {
      logger.warn('[kb/ask] embedding 失败', { error: embErr.message });
      return res.status(503).json({
        success: false,
        error: 'Embedding 服务暂不可用，请稍后再试',
      });
    }
    const retrieved = await kbAskService.vectorSearch(supabase, queryEmbedding, {
      matchThreshold: 0.35,
      matchCount: 5,
    });

    if (!retrieved || retrieved.length === 0) {
      const recommend = await getRecommendForAsk(supabase, { language_code, limit: 4 });
      return res.json({
        success: true,
        answer: '暂未找到与您问题直接相关的知识库内容，建议联系客服或换个方式描述您的问题。',
        sources: [],
        recommend,
        from_exact: false,
        source_type: 'vector',
      });
    }

    // 3. LLM 生成（多轮对话：传入 history）
    let answer;
    try {
      answer = await kbAskService.generateAnswer(retrieved, q, language_code, history);
    } catch (genErr) {
      logger.error('[kb/ask] LLM 生成失败', genErr);
      answer = (retrieved[0] && (retrieved[0].answer || retrieved[0].content)) || '回答生成失败，请稍后再试。';
    }

    const recommend = await getRecommendForAsk(supabase, {
      category: retrieved[0]?.category,
      tags: retrieved[0]?.tags,
      language_code,
      limit: 4,
    });

    res.json({
      success: true,
      answer,
      sources: retrieved.map((e) => ({ id: e.id, title: e.title, category: e.category, source: e.source })),
      recommend,
      from_exact: false,
      source_type: 'vector',
    });
  } catch (e) {
    logger.error('[kb/ask]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/kb/feedback（Phase 3 反馈：有用/无用）
 * Body: { query, helpful: true|false, source_type?, entry_id? }
 * 匿名提交，无需鉴权；用于统计与优化检索。
 */
router.post('/feedback', async (req, res) => {
  try {
    const { query, helpful, source_type, entry_id } = req.body || {};
    const q = query != null ? String(query).trim() : '';
    if (!q) {
      return res.status(400).json({ success: false, error: 'query 不能为空' });
    }
    if (typeof helpful !== 'boolean') {
      return res.status(400).json({ success: false, error: 'helpful 必须为 true 或 false' });
    }
    const row = {
      query: q,
      helpful,
      source_type: ['static', 'exact', 'vector'].includes(source_type) ? source_type : null,
      entry_id: entry_id || null,
    };
    const supabase = getSupabase();
    const { error } = await supabase.from('kb_ask_feedback').insert(row);
    if (error) {
      logger.warn('[kb/feedback] 写入失败', { error: error.message });
      return res.status(500).json({ success: false, error: error.message });
    }
    res.status(201).json({ success: true });
  } catch (e) {
    logger.error('[kb/feedback]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/kb/entries（§10.2 管理 API）
 * Body: { category, title, content, content_type, tags?, source?, question?, answer?, subcategory?, language_code? }
 * 鉴权：admin。新增后同步生成 embedding（失败仅打日志，不阻塞返回）
 */
router.post('/entries', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const {
      category,
      title,
      content,
      content_type,
      tags,
      source,
      question,
      answer,
      subcategory,
      language_code,
    } = body;

    if (!category || !title || !content || !content_type) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段：category, title, content, content_type',
      });
    }
    if (!KB_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        error: `category 必须是其中之一：${KB_CATEGORIES.join(', ')}`,
      });
    }
    if (!KB_CONTENT_TYPES.includes(content_type)) {
      return res.status(400).json({
        success: false,
        error: `content_type 必须是其中之一：${KB_CONTENT_TYPES.join(', ')}`,
      });
    }

    const row = {
      category,
      title: String(title).trim(),
      content: String(content).trim(),
      content_type,
      subcategory: subcategory != null ? String(subcategory).trim() || null : null,
      question: question != null ? String(question).trim() || null : null,
      answer: answer != null ? String(answer).trim() || null : null,
      tags: Array.isArray(tags) ? tags.filter((t) => t != null).map(String) : [],
      source: source != null ? String(source).trim() || null : null,
      language_code: language_code && String(language_code).trim() ? String(language_code).trim() : 'zh-CN',
    };

    const supabase = getSupabase();
    const { data: inserted, error } = await supabase
      .from('kb_entries')
      .insert(row)
      .select('id, category, subcategory, title, content, content_type, question, answer, tags, source, language_code, created_at')
      .single();

    if (error) {
      logger.warn('[kb/entries POST] 插入失败', { error: error.message });
      return res.status(500).json({ success: false, error: error.message });
    }

    // 异步生成 embedding 并回写（不阻塞响应；失败仅打日志）
    const fullEntry = { ...inserted, embedding: null };
    kbEmbeddingService.embedEntry(fullEntry)
      .then((embedding) => {
        getSupabase()
          .from('kb_entries')
          .update({ embedding, updated_at: new Date().toISOString() })
          .eq('id', inserted.id)
          .then(({ error: updateErr }) => {
            if (updateErr) logger.warn('[kb/entries POST] embedding 回写失败', { id: inserted.id, error: updateErr.message });
          });
      })
      .catch((embErr) => logger.warn('[kb/entries POST] embedding 生成失败', { id: inserted.id, error: embErr.message }));

    res.status(201).json({ success: true, data: inserted });
  } catch (e) {
    logger.error('[kb/entries POST]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * PUT /api/kb/entries/:id（§10.2 管理 API）
 * Body: 同 POST，字段均可选（部分更新）。鉴权：admin。更新后重新生成 embedding。
 */
router.put('/entries/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: '缺少 id' });
    }

    const body = req.body || {};
    const {
      category,
      title,
      content,
      content_type,
      tags,
      source,
      question,
      answer,
      subcategory,
      language_code,
    } = body;

    const supabase = getSupabase();
    const updates = {};
    if (category !== undefined) {
      if (!KB_CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, error: `category 必须是：${KB_CATEGORIES.join(', ')}` });
      }
      updates.category = category;
    }
    if (content_type !== undefined) {
      if (!KB_CONTENT_TYPES.includes(content_type)) {
        return res.status(400).json({ success: false, error: `content_type 必须是：${KB_CONTENT_TYPES.join(', ')}` });
      }
      updates.content_type = content_type;
    }
    if (title !== undefined) updates.title = String(title).trim();
    if (content !== undefined) updates.content = String(content).trim();
    if (subcategory !== undefined) updates.subcategory = String(subcategory).trim() || null;
    if (question !== undefined) updates.question = String(question).trim() || null;
    if (answer !== undefined) updates.answer = String(answer).trim() || null;
    if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags.filter((t) => t != null).map(String) : [];
    if (source !== undefined) updates.source = String(source).trim() || null;
    if (language_code !== undefined) updates.language_code = String(language_code).trim() || 'zh-CN';

    updates.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('kb_entries')
      .update(updates)
      .eq('id', id)
      .select('id, category, subcategory, title, content, content_type, question, answer, tags, source, language_code, updated_at')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: '条目不存在' });
      }
      logger.warn('[kb/entries PUT] 更新失败', { id, error: error.message });
      return res.status(500).json({ success: false, error: error.message });
    }

    // 重新生成 embedding 并回写
    const fullEntry = { ...updated, embedding: null };
    kbEmbeddingService.embedEntry(fullEntry)
      .then((embedding) => {
        getSupabase()
          .from('kb_entries')
          .update({ embedding, updated_at: new Date().toISOString() })
          .eq('id', id)
          .then(({ error: updateErr }) => {
            if (updateErr) logger.warn('[kb/entries PUT] embedding 回写失败', { id, error: updateErr.message });
          });
      })
      .catch((embErr) => logger.warn('[kb/entries PUT] embedding 生成失败', { id, error: embErr.message }));

    res.json({ success: true, data: updated });
  } catch (e) {
    logger.error('[kb/entries PUT]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * DELETE /api/kb/entries/:id（§10.2 管理 API）
 * 鉴权：admin。硬删除。
 */
router.delete('/entries/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: '缺少 id' });
    }

    const supabase = getSupabase();
    const { error } = await supabase.from('kb_entries').delete().eq('id', id);

    if (error) {
      logger.warn('[kb/entries DELETE] 失败', { id, error: error.message });
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true });
  } catch (e) {
    logger.error('[kb/entries DELETE]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
