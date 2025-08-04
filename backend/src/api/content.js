const express = require('express');
const { body, validationResult } = require('express-validator');
const DatabaseService = require('../services/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 创建内容
router.post('/', authenticateToken, [
  body('title').isString().isLength({ min: 1, max: 200 }).withMessage('标题不能为空且长度不能超过200字'),
  body('code_html').isString().withMessage('HTML代码不能为空'),
  body('code_css').isString().withMessage('CSS代码不能为空'),
  body('code_js').isString().withMessage('JS代码不能为空'),
  body('tags').isArray().withMessage('标签必须是数组'),
  body('external_links').isArray().withMessage('外部链接必须是数组'),
  body('description').optional().isString().withMessage('描述必须是字符串'),
  body('content_type').optional().isString().withMessage('内容类型必须是字符串'),
  body('language').optional().isString().withMessage('语言必须是字符串'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: '参数验证失败', 
        details: errors.array() 
      });
    }

    const contentData = req.body;
    const result = await DatabaseService.createContent(contentData, req.user.id);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取内容列表（公开）
router.get('/public', async (req, res) => {
  try {
    const filters = {};
    if (req.query.limit) {
      filters.limit = parseInt(req.query.limit);
    }
    
    const result = await DatabaseService.getContents(filters);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取内容列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const filters = {};
    if (req.query.created_by) {
      filters.created_by = req.query.created_by;
    }
    
    const result = await DatabaseService.getContents(filters);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个内容
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await DatabaseService.getContentById(req.params.id);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    if (!result.data) {
      return res.status(404).json({ error: '内容不存在' });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 通过short_id获取内容
router.get('/short/:shortId', async (req, res) => {
  try {
    const result = await DatabaseService.getContentByShortId(req.params.shortId);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    if (!result.data) {
      return res.status(404).json({ error: '内容不存在' });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新内容
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: '参数验证失败', details: errors.array() });
    }

    const { title, code_html, code_css, code_js, tags, external_links, description, content_type, language } = req.body;
    
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: '标题不能为空' });
    }

    const updateData = {
      title: title.trim(),
      code_html: code_html || '',
      code_css: code_css || '',
      code_js: code_js || '',
      tags: Array.isArray(tags) ? tags : [],
      external_links: Array.isArray(external_links) ? external_links : [],
      description: description || '',
      content_type: content_type || 'vue',
      language: language || 'zh-CN'
    };

    const result = await DatabaseService.updateContent(req.params.id, updateData);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除内容
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await DatabaseService.deleteContent(req.params.id);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 