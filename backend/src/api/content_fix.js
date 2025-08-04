const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const DatabaseService = require('../services/database');

// POST /api/content/fix
router.post('/', async (req, res) => {
  try {
    const { content_id, note, html, css, js, external_links, content_type, language, title, description } = req.body;
    if (!html || !js) {
      return res.status(400).json({ error: 'html, js 必填' });
    }
    
    // 如果是编辑模式，需要验证 content_id 并获取原始内容
    if (content_id) {
      const { data: original, error: dbErr } = await DatabaseService.getContentById(content_id);
      if (dbErr || !original) {
        return res.status(404).json({ error: '内容不存在' });
      }
      // 使用数据库中的原始内容信息
      const aiResult = await aiService.fixEducationalContent({
        html, css, js, external_links, note,
        content_type: original.content_type,
        language: original.language,
        title: original.title,
        description: original.description
      });
      if (!aiResult.success) {
        return res.status(500).json({ error: aiResult.error });
      }
      const { html: newHtml, css: newCss, js: newJs, external_links: newLinks, fixed } = aiResult.data;
      return res.json({ html: newHtml, css: newCss, js: newJs, external_links: newLinks, fixed });
    } else {
      // 如果是创建模式，直接使用前端传递的参数
      const aiResult = await aiService.fixEducationalContent({
        html, css, js, external_links, note,
        content_type: content_type || 'vue',
        language: language || 'zh-CN',
        title: title || '未命名内容',
        description: description || ''
      });
      if (!aiResult.success) {
        return res.status(500).json({ error: aiResult.error });
      }
      const { html: newHtml, css: newCss, js: newJs, external_links: newLinks, fixed } = aiResult.data;
      return res.json({ html: newHtml, css: newCss, js: newJs, external_links: newLinks, fixed });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router; 