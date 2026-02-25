const express = require('express');
const DatabaseService = require('../services/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { optionalVisitorId } = require('../middleware/visitorId');
const accessKeysRoutes = require('./access_keys');

const router = express.Router();

/**
 * 从 HTML 中解析 <script type="application/edu-content-meta" id="edu-meta">...</script> 的 JSON
 * 约定见 Interactive_HTML_Skill_Workflow.md §2.1
 */
function parseEduMetaFromHtml(html) {
  if (!html || typeof html !== 'string') return null;
  const match = html.match(/<script[^>]*type=["']application\/edu-content-meta["'][^>]*id=["']edu-meta["'][^>]*>([\s\S]*?)<\/script>/i)
    || html.match(/<script[^>]*id=["']edu-meta["'][^>]*type=["']application\/edu-content-meta["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match || !match[1]) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

// 创建列表
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, visibility = 'private' } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: '列表名称不能为空' });
    }

    const result = await DatabaseService.createCollectionList({
      name: name.trim(),
      visibility,
      user_id: req.user.id,
      parent_id: null, // 所有列表都是顶级
      order_index: 0
    });
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户的列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await DatabaseService.getCollectionListsByUser(req.user.id);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新列表顺序
router.put('/order', authenticateToken, async (req, res) => {
  try {
    const { orders } = req.body;
    
    if (!Array.isArray(orders)) {
      return res.status(400).json({ error: 'orders必须是数组' });
    }

    const result = await DatabaseService.updateCollectionListOrder(orders);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除列表
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await DatabaseService.deleteCollectionList(req.params.id, req.user.id);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, deleted: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 挂载密钥管理子路由（/:id/access-keys）
router.use('/:id/access-keys', accessKeysRoutes);

// 批量导入 HTML 内容到列表（仅列表创建者）
// POST /api/collection_lists/:id/import
// Body: { items: [ { full_html, title?, description?, tags?, language_code?, content_type?, svg_thumbnail?, knowledge_points?, metadata_json?, tech_stack? }, ... ] }
// 若未传 title/description/tags/language_code/content_type，则从 HTML 内 <script type="application/edu-content-meta" id="edu-meta">...</script> 解析
router.post('/:id/import', authenticateToken, async (req, res) => {
  try {
    const listId = req.params.id;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items 不能为空，且必须为数组' });
    }
    if (items.length > 100) {
      return res.status(400).json({ error: '单次最多导入 100 条' });
    }

    const { data: list, error: listError } = await DatabaseService.supabase
      .from('collection_lists')
      .select('id, user_id')
      .eq('id', listId)
      .single();

    if (listError || !list || list.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权限向此列表导入' });
    }

    const results = [];
    const errors = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const full_html = it.full_html != null ? String(it.full_html) : '';
      if (!full_html.trim()) {
        errors.push({ index: i, title: '(无标题)', error: 'full_html 必填' });
        continue;
      }
      const meta = parseEduMetaFromHtml(full_html);
      const title = (it.title != null && String(it.title).trim()) ? String(it.title).trim() : (meta?.title && String(meta.title).trim()) || '';
      if (!title) {
        errors.push({ index: i, title: '(无标题)', error: 'title 必填，请传参或在 HTML 内提供 <script type="application/edu-content-meta" id="edu-meta">{"title":"..."}</script>' });
        continue;
      }
      const description = (it.description != null ? String(it.description) : (meta?.description != null ? String(meta.description) : '')).trim();
      const tags = Array.isArray(it.tags) ? it.tags : (Array.isArray(meta?.tags) ? meta.tags : []);
      const language_code = (it.language_code != null && String(it.language_code).trim()) ? String(it.language_code).trim() : (meta?.language_code && String(meta.language_code).trim()) || 'zh-CN';
      const content_type = (it.content_type != null && String(it.content_type).trim()) ? String(it.content_type).trim() : (meta?.content_type && String(meta.content_type).trim()) || 'interactive';
      const svg_thumbnail = (it.svg_thumbnail != null && typeof it.svg_thumbnail === 'string' && it.svg_thumbnail.trim()) ? it.svg_thumbnail.trim() : undefined;
      const knowledge_points = Array.isArray(it.knowledge_points)
        ? it.knowledge_points.map(String)
        : (Array.isArray(meta?.knowledge_points) ? meta.knowledge_points.map(String) : undefined);
      const metadata_json = (it.metadata_json && typeof it.metadata_json === 'object')
        ? it.metadata_json
        : ((meta?.metadata_json && typeof meta.metadata_json === 'object') ? meta.metadata_json : undefined);
      const tech_stack = Array.isArray(it.tech_stack)
        ? it.tech_stack.map(String)
        : (Array.isArray(meta?.tech_stack) ? meta.tech_stack.map(String) : undefined);
      try {
        const content = await DatabaseService.createContent({
          title,
          full_html,
          description: description || '',
          tags,
          content_type,
          language_code,
          svg_thumbnail,
          knowledge_points,
          metadata_json,
          tech_stack,
        }, req.user.id);
        const addResult = await DatabaseService.addContentToList(req.user.id, content.id, listId);
        if (addResult.error) throw addResult.error;
        results.push({ index: i, id: content.id, short_id: content.short_id, title: content.title });
      } catch (err) {
        errors.push({ index: i, title: title || '(无标题)', error: err.message || '创建失败' });
      }
    }

    res.json({
      success: true,
      created: results.length,
      failed: errors.length,
      results,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 临时：按 title + language_code 在“当前列表”内 upsert 更新字段（仅列表创建者）
// POST /api/collection_lists/:id/import-upsert
// Body: { items: [ { full_html, title?, description?, tags?, language_code?, content_type?, svg_thumbnail?, knowledge_points?, metadata_json?, tech_stack? }, ... ] }
router.post('/:id/import-upsert', authenticateToken, async (req, res) => {
  try {
    const listId = req.params.id;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items 不能为空，且必须为数组' });
    }
    if (items.length > 100) {
      return res.status(400).json({ error: '单次最多导入 100 条' });
    }

    const { data: list, error: listError } = await DatabaseService.supabase
      .from('collection_lists')
      .select('id, user_id')
      .eq('id', listId)
      .single();

    if (listError || !list || list.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权限向此列表导入' });
    }

    // 取出该列表已有内容（用于按 title+language_code 匹配）
    const { data: existingLinks, error: existingError } = await DatabaseService.supabase
      .from('user_collections')
      .select('content_id, content:content_id (id, title, language_code)')
      .eq('list_id', listId);
    if (existingError) {
      return res.status(500).json({ error: existingError.message || '读取列表内容失败' });
    }
    const existingMap = new Map();
    (existingLinks || []).forEach((row) => {
      const c = row.content;
      if (!c?.id || !c?.title) return;
      const key = `${String(c.title)}__${String(c.language_code || 'zh-CN')}`;
      existingMap.set(key, c.id);
    });

    const results = [];
    const errors = [];
    let updated = 0;
    let created = 0;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const full_html = it.full_html != null ? String(it.full_html) : '';
      if (!full_html.trim()) {
        errors.push({ index: i, title: '(无标题)', error: 'full_html 必填' });
        continue;
      }
      const meta = parseEduMetaFromHtml(full_html);
      const title = (it.title != null && String(it.title).trim()) ? String(it.title).trim() : (meta?.title && String(meta.title).trim()) || '';
      if (!title) {
        errors.push({ index: i, title: '(无标题)', error: 'title 必填（按 title 匹配更新）' });
        continue;
      }
      const description = (it.description != null ? String(it.description) : (meta?.description != null ? String(meta.description) : '')).trim();
      const tags = Array.isArray(it.tags) ? it.tags : (Array.isArray(meta?.tags) ? meta.tags : []);
      const language_code = (it.language_code != null && String(it.language_code).trim()) ? String(it.language_code).trim() : (meta?.language_code && String(meta.language_code).trim()) || 'zh-CN';
      const content_type = (it.content_type != null && String(it.content_type).trim()) ? String(it.content_type).trim() : (meta?.content_type && String(meta.content_type).trim()) || 'interactive';
      const svg_thumbnail = (it.svg_thumbnail != null && typeof it.svg_thumbnail === 'string' && it.svg_thumbnail.trim()) ? it.svg_thumbnail.trim() : undefined;
      const knowledge_points = Array.isArray(it.knowledge_points)
        ? it.knowledge_points.map(String)
        : (Array.isArray(meta?.knowledge_points) ? meta.knowledge_points.map(String) : undefined);
      const metadata_json = (it.metadata_json && typeof it.metadata_json === 'object')
        ? it.metadata_json
        : ((meta?.metadata_json && typeof meta.metadata_json === 'object') ? meta.metadata_json : undefined);
      const tech_stack = Array.isArray(it.tech_stack)
        ? it.tech_stack.map(String)
        : (Array.isArray(meta?.tech_stack) ? meta.tech_stack.map(String) : undefined);

      const key = `${title}__${language_code}`;
      const existingId = existingMap.get(key);

      try {
        if (existingId) {
          const updatePayload = {
            title,
            full_html,
            description: description || '',
            tags,
            content_type,
            language_code,
            svg_thumbnail: svg_thumbnail || null,
            knowledge_points: knowledge_points || null,
            metadata_json: metadata_json || null,
            tech_stack: tech_stack || null,
            updated_at: new Date().toISOString(),
            metadata_updated_at: metadata_json ? new Date().toISOString() : null,
          };
          const { error: upErr } = await DatabaseService.supabase
            .from('content')
            .update(updatePayload)
            .eq('id', existingId);
          if (upErr) throw upErr;
          updated++;
          results.push({ index: i, id: existingId, title, action: 'updated' });
        } else {
          const content = await DatabaseService.createContent({
            title,
            full_html,
            description: description || '',
            tags,
            content_type,
            language_code,
            svg_thumbnail,
            knowledge_points,
            metadata_json,
            tech_stack,
          }, req.user.id);
          const addResult = await DatabaseService.addContentToList(req.user.id, content.id, listId);
          if (addResult.error) throw addResult.error;
          created++;
          results.push({ index: i, id: content.id, short_id: content.short_id, title, action: 'created' });
        }
      } catch (err) {
        errors.push({ index: i, title: title || '(无标题)', error: err.message || '更新失败' });
      }
    }

    res.json({
      success: true,
      created,
      updated,
      failed: errors.length,
      results,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 根据 short_id 获取列表及其内容（支持未登录用户访问 public 列表，可选传 visitor_id 供后续密钥绑定）
router.get('/by-short-id/:short_id', optionalAuth, optionalVisitorId, async (req, res) => {
  try {
    const { short_id } = req.params;
    const userId = req.user?.id || null;
    const deviceId = req.visitorId || null; // 用于密钥解锁判定
    
    const result = await DatabaseService.getCollectionListByShortId(short_id, userId, deviceId);
    
    if (result.error) {
      if (result.error.message === '列表不存在') {
        return res.status(404).json({ error: result.error.message });
      }
      if (result.error.message === '无权限访问此列表') {
        return res.status(403).json({ error: result.error.message });
      }
      return res.status(500).json({ error: result.error.message });
    }
    
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新列表设置（仅创建者）
router.put('/:id/settings', authenticateToken, async (req, res) => {
  try {
    const listId = req.params.id;
    const { pricing_mode, price, currency, description, visibility, name, language_code } = req.body;
    
    // 验证权限：仅创建者可修改
    const { data: list, error: listError } = await DatabaseService.supabase
      .from('collection_lists')
      .select('user_id')
      .eq('id', listId)
      .single();
    
    if (listError || !list || list.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权限修改此列表' });
    }
    
    // 规范化 pricing_mode，兼容旧值：
    // - 'premium'       => 'one_time'
    // - 'free_preview'  => 'subscription'
    const rawPricingMode = pricing_mode || 'free';
    const normalizedPricingMode =
      rawPricingMode === 'premium'
        ? 'one_time'
        : rawPricingMode === 'free_preview'
        ? 'subscription'
        : rawPricingMode;

    // 验证价格（如果设置为一次性付费）
    if (normalizedPricingMode === 'one_time') {
      if (!price || price <= 0) {
        return res.status(400).json({ error: '付费列表必须设置有效价格' });
      }
    }
    
    // 更新列表
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (pricing_mode !== undefined) {
      updateData.pricing_mode = normalizedPricingMode || 'free';
      // 如果设置为一次性付费，必须提供价格；否则清空价格
      if (normalizedPricingMode === 'one_time') {
        updateData.price = price;
        updateData.currency = currency || 'USD';
      } else {
        updateData.price = null;
      }
    }
    if (currency !== undefined && normalizedPricingMode === 'one_time') {
      updateData.currency = currency;
    }
    if (language_code !== undefined) {
      updateData.language_code = language_code === '' || language_code == null ? null : language_code;
    }

    const { error: updateError } = await DatabaseService.supabase
      .from('collection_lists')
      .update(updateData)
      .eq('id', listId);
    
    if (updateError) {
      throw updateError;
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新单个列表内容的免费预览标记（仅创建者）
router.put('/:id/items/:contentId/preview', authenticateToken, async (req, res) => {
  try {
    const listId = req.params.id;
    const contentId = req.params.contentId;
    const { is_free_preview } = req.body;

    if (typeof is_free_preview !== 'boolean') {
      return res.status(400).json({ error: 'is_free_preview 必须为布尔值' });
    }

    const result = await DatabaseService.updateListItemPreviewFlag(
      req.user.id,
      listId,
      contentId,
      is_free_preview
    );

    if (!result.success) {
      const message = result.error?.message || '更新预览标记失败';
      if (message === '无权限修改此列表') {
        return res.status(403).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 