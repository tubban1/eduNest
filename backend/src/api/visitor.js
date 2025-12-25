/**
 * 游客相关 API 路由
 * 处理免费试用状态检查和数据合并
 */

const express = require('express');
const { validateVisitorId } = require('../middleware/visitorId');
const { authenticateToken } = require('../middleware/auth');
const visitorUsageService = require('../services/visitorUsageService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * 检查免费试用状态
 * GET /api/visitor/check-trial
 * 无需认证，但需要 visitor_id
 */
router.get('/check-trial', validateVisitorId, async (req, res) => {
  try {
    const visitorId = req.visitorId;
    const status = await visitorUsageService.getVisitorUsageStatus(visitorId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('检查免费试用状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '检查免费试用状态失败'
    });
  }
});

/**
 * 注册后合并游客数据到用户账号
 * POST /api/visitor/merge-on-login
 * 需要认证（用户已注册）
 */
router.post('/merge-on-login', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { visitor_id } = req.body;

    if (!visitor_id) {
      return res.status(400).json({
        success: false,
        error: 'VISITOR_ID_REQUIRED',
        message: '游客ID缺失'
      });
    }

    // 合并数据
    const result = await visitorUsageService.mergeVisitorDataToUser(visitor_id, userId);

    res.json({
      success: true,
      data: {
        contentCount: result.contentCount,
        conversationCount: result.conversationCount,
        message: '我们已经帮你保存了刚才的学习进度'
      }
    });
  } catch (error) {
    logger.error('合并游客数据失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '合并游客数据失败'
    });
  }
});

module.exports = router;

