/**
 * 页面访问统计 API 路由
 * 处理页面访问记录、统计查询
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const pageViewService = require('../services/pageViewService');
const { optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * 记录页面访问
 * POST /api/page-views/record
 * 无需认证（支持游客访问）
 */
router.post('/record', [
  body('content_id').isUUID().withMessage('内容ID必须是有效的UUID'),
  body('referer').optional().isString().withMessage('来源页面必须是字符串')
], async (req, res) => {
  try {
    // 开发环境可选：可以通过环境变量禁用统计（避免测试数据污染）
    // 如果设置了 DISABLE_PAGE_VIEWS=true，则跳过记录
    if (process.env.DISABLE_PAGE_VIEWS === 'true') {
      return res.json({
        success: true,
        data: { skipped: true, reason: 'disabled_by_env' }
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: errors.array()
      });
    }

    const { content_id, referer } = req.body;
    
    // 获取客户端信息
    const viewerIp = pageViewService.getClientIp(req);
    const viewerUserAgent = req.get('User-Agent') || null;
    const viewerUserId = req.user ? req.user.id : null;

    // 记录访问
    const result = await pageViewService.recordPageView({
      contentId: content_id,
      viewerIp,
      viewerUserAgent,
      referer: referer || null,
      viewerUserId
    });

    // 如果是唯一访问，异步发放积分（不阻塞响应）
    if (result.data.is_unique) {
      // 异步处理积分发放，不等待结果
      pageViewService.awardCreditsForPageView(content_id, result.data.id)
        .then(awardResult => {
          if (awardResult.awarded) {
            logger.info(`页面点击积分发放成功: content_id=${content_id}, page_view_id=${result.data.id}`);
          }
        })
        .catch(error => {
          logger.error(`页面点击积分发放失败: content_id=${content_id}, page_view_id=${result.data.id}`, error);
        });
    }

    res.json({
      success: true,
      data: {
        page_view_id: result.data.id,
        is_unique: result.data.is_unique
      }
    });
  } catch (error) {
    logger.error('记录页面访问失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '记录页面访问失败'
    });
  }
});

/**
 * 获取内容访问统计
 * GET /api/page-views/stats/:contentId
 * 需要认证（内容创建者或管理员）
 */
router.get('/stats/:contentId', [
  optionalAuth,
  param('contentId').isUUID().withMessage('内容ID必须是有效的UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: errors.array()
      });
    }

    const { contentId } = req.params;
    const days = parseInt(req.query.days) || 30;

    // 检查内容是否存在
    const DatabaseService = require('../services/database');
    const { data: content, error: contentError } = await DatabaseService.supabase
      .from('content')
      .select('id, created_by')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      return res.status(404).json({
        success: false,
        error: '内容不存在'
      });
    }

    // 权限检查：只有内容创建者或管理员可以查看统计
    if (req.user) {
      const isCreator = content.created_by === req.user.id;
      const isAdmin = req.user.role === 'admin';
      
      if (!isCreator && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: '无权查看此内容的统计信息'
        });
      }
    } else {
      // 未登录用户不能查看统计
      return res.status(401).json({
        success: false,
        error: '需要登录才能查看统计信息'
      });
    }

    // 获取统计
    const stats = await pageViewService.getContentStats(contentId, { days });

    res.json(stats);
  } catch (error) {
    logger.error('获取内容统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取内容统计失败'
    });
  }
});

/**
 * 获取热门内容排行
 * GET /api/page-views/popular
 * 无需认证（公开数据）
 */
router.get('/popular', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const DatabaseService = require('../services/database');
    
    // 查询热门内容（按唯一访问量排序）
    const { data, error } = await DatabaseService.supabase
      .from('page_views')
      .select(`
        content_id,
        content:content_id (
          id,
          short_id,
          title,
          created_by
        )
      `)
      .eq('is_unique', true)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 统计每个内容的访问量
    const contentStats = {};
    data.forEach(item => {
      if (item.content) {
        const contentId = item.content.id;
        if (!contentStats[contentId]) {
          contentStats[contentId] = {
            content: item.content,
            unique_views: 0
          };
        }
        contentStats[contentId].unique_views++;
      }
    });

    // 转换为数组并排序
    const popularContent = Object.values(contentStats)
      .sort((a, b) => b.unique_views - a.unique_views)
      .slice(0, limit);

    res.json({
      success: true,
      data: popularContent,
      period_days: days
    });
  } catch (error) {
    logger.error('获取热门内容失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取热门内容失败'
    });
  }
});

module.exports = router;
