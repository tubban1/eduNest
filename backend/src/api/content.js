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
  body('language_code').optional().isString().withMessage('语言必须是字符串（BCP 47）'),
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
    if (req.query.language_prefix) {
      filters.language_prefix = String(req.query.language_prefix).toLowerCase();
    }
    if (req.query.language_code) {
      filters.language_code = String(req.query.language_code);
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

// 定向语言公开内容（保留）
router.get('/public/by-language', async (req, res) => {
  try {
    const { language_prefix, language_code } = req.query;
    const limit = req.query.limit ? parseInt(req.query.limit) : 12;
    if (!language_prefix && !language_code) {
      return res.status(400).json({ success: false, error: '缺少语言参数：language_prefix 或 language_code 其一必填' });
    }
    const result = await DatabaseService.getContents({ language_prefix, language_code, limit });
    if (result.error) {
      return res.status(500).json({ success: false, error: result.error.message });
    }
    return res.json({ success: true, data: result.data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 新：仅语言限制的公开接口（推荐）
// GET /api/content/by-language?language_prefix=en&limit=18
// 或 GET /api/content/by-language?language_code=en-US&limit=18
router.get('/by-language', async (req, res) => {
  try {
    const { language_prefix, language_code } = req.query;
    const limit = req.query.limit ? Math.max(1, Math.min(parseInt(req.query.limit), 60)) : 12;
    if (!language_prefix && !language_code) {
      return res.status(400).json({ success: false, error: '缺少语言参数：language_prefix 或 language_code 其一必填' });
    }
    const result = await DatabaseService.getContents({ language_prefix, language_code, limit });
    if (result.error) {
      return res.status(500).json({ success: false, error: result.error.message });
    }
    return res.json({ success: true, data: result.data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 获取内容总数
router.get('/count', async (req, res) => {
  try {
    const result = await DatabaseService.getContents({ limit: 1000 }); // 获取足够多的数据来计算总数
    if (result.error) {
      return res.status(500).json({ success: false, error: result.error.message });
    }
    return res.json({ success: true, count: result.data ? result.data.length : 0 });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
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

    const { title, code_html, code_css, code_js, tags, external_links, description, content_type, language_code } = req.body;
    
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
      language_code: language_code || 'zh-CN'
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