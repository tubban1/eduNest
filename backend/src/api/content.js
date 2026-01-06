const express = require('express');
const { body, validationResult } = require('express-validator');
const DatabaseService = require('../services/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// 创建内容（只支持 full_html）
router.post('/', authenticateToken, [
  body('title').isString().isLength({ min: 1, max: 200 }).withMessage('标题不能为空且长度不能超过200字'),
  body('full_html').isString().isLength({ min: 1 }).withMessage('完整HTML内容不能为空'),
  body('tags').optional().isArray().withMessage('标签必须是数组'),
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

// 获取精选内容（自动从 admin 账号提取，公开接口）
router.get('/featured', async (req, res) => {
  try {
    const {
      limit = 20,
      offset = 0,
      category = null,
      sortBy = 'quality_score',
      tags = null,
      language_code = null
    } = req.query;
    
    const result = await DatabaseService.getFeaturedContents({
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      category: category || null,
      sortBy: sortBy || 'quality_score',
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : null,
      language_code: language_code || null
    });
    
    if (result.error) {
      return res.status(500).json({ success: false, error: result.error.message });
    }
    
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取精选内容的分类统计（公开接口）
router.get('/featured/categories', async (req, res) => {
  try {
    const result = await DatabaseService.getFeaturedContentCategories();
    
    if (result.error) {
      return res.status(500).json({ success: false, error: result.error.message });
    }
    
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取指定收藏列表的公开内容（公开接口）
router.get('/collection-list/:listId', async (req, res) => {
  try {
    const { listId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    
    const result = await DatabaseService.getPublicCollectionListContent(listId, {
      limit,
      offset
    });
    
    if (result.error) {
      return res.status(500).json({ success: false, error: result.error.message });
    }
    
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取内容列表（支持未登录用户按语言筛选）
router.get('/', optionalAuth, async (req, res) => {
  try {
    const filters = {};
    
    // 如果提供了 created_by，需要认证
    if (req.query.created_by) {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '需要认证才能查询指定用户的内容' });
      }
      filters.created_by = req.query.created_by;
    }
    
    // 支持按语言筛选（未登录用户）
    if (req.query.language_code) {
      filters.language_code = req.query.language_code;
    }
    
    // 支持分页参数
    if (req.query.limit) {
      filters.limit = parseInt(req.query.limit, 10);
    }
    if (req.query.offset) {
      filters.offset = parseInt(req.query.offset, 10);
    }
    
    // 首页与公开列表需要显示提示角标所依赖的 user_query/image_url
    // 为所有列表查询合并最新的生成日志字段（不影响权限控制）
    const result = await DatabaseService.getContentsWithGenerationStatus(filters);
    
    if (result.error) {
      return res.status(500).json({ success: false, error: result.error.message });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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

// 更新内容（只支持 full_html）
router.put('/:id', authenticateToken, [
  body('title').optional().isString().isLength({ min: 1, max: 200 }).withMessage('标题长度不能超过200字'),
  body('full_html').optional().isString().isLength({ min: 1 }).withMessage('完整HTML内容不能为空'),
  body('tags').optional().isArray().withMessage('标签必须是数组'),
  body('description').optional().isString().withMessage('描述必须是字符串'),
  body('content_type').optional().isString().withMessage('内容类型必须是字符串'),
  body('language_code').optional().isString().withMessage('语言必须是字符串（BCP 47）'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: '参数验证失败', details: errors.array() });
    }

    const { title, full_html, tags, description, content_type, language_code } = req.body;
    
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (full_html !== undefined) updateData.full_html = full_html;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
    if (description !== undefined) updateData.description = description || '';
    if (content_type !== undefined) updateData.content_type = content_type || 'vue';
    if (language_code !== undefined) updateData.language_code = language_code || 'zh-CN';

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

// 手动触发缩略图生成
router.post('/:id/generate-thumbnail', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get content with short_id
    const { data: content, error: contentError } = await DatabaseService.supabase
      .from('content')
      .select('id, short_id')
      .eq('id', id)
      .single();

    if (contentError || !content || !content.short_id) {
      return res.status(404).json({ success: false, error: 'Content not found or missing short_id' });
    }

    // Get frontend base URL from environment
    const baseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
    
    // Import thumbnail service
    const { generateThumbnail } = require('../services/thumbnailService');
    
    // Check if this is a test request (from test-thumbnail page)
    // Test page should use Playwright for Canvas rendering
    const usePlaywright = req.query.usePlaywright === 'true' || req.body?.usePlaywright === true;
    
    // Trigger thumbnail generation asynchronously (don't await, return immediately)
    generateThumbnail(content.id, content.short_id, baseUrl, usePlaywright)
      .catch(error => {
        console.error(`[Thumbnail] Thumbnail generation failed for content ${content.id}:`, error);
      });

    res.json({ 
      success: true, 
      message: 'Thumbnail generation task started' 
    });
  } catch (error) {
    console.error('[Thumbnail] Failed to trigger thumbnail generation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 批量重新生成缩略图（仅管理员）
router.post('/regenerate-thumbnails', authenticateToken, async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin permission required' });
    }

    // Find all pending/failed thumbnails
    const { data, error } = await DatabaseService.supabase
      .from('content')
      .select('id, short_id')
      .in('thumbnail_status', ['pending', 'failed'])
      .limit(100); // Limit batch size

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!data || data.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No thumbnails to regenerate',
        count: 0
      });
    }

    // Get frontend base URL from environment
    const baseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
    
    // Import thumbnail service
    const { generateThumbnail } = require('../services/thumbnailService');
    
    // Trigger thumbnail generation for all items asynchronously
    data.forEach(item => {
      if (item.short_id) {
        generateThumbnail(item.id, item.short_id, baseUrl)
          .catch(error => {
            console.error(`[Thumbnail] Failed to regenerate thumbnail for content ${item.id}:`, error);
          });
      }
    });

    res.json({ 
      success: true, 
      message: `Started thumbnail generation for ${data.length} items`,
      count: data.length
    });
  } catch (error) {
    console.error('[Thumbnail] Failed to batch regenerate thumbnails:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router; 
