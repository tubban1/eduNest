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
 * 注册后合并游客数据到用户账号（或仅发放初始积分）
 * POST /api/visitor/merge-on-login
 * 需要认证（用户已注册）
 * 
 * 如果提供了 visitor_id，则合并游客数据并发放初始积分
 * 如果没有 visitor_id，则仅发放初始积分（适用于直接注册的用户）
 */
router.post('/merge-on-login', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { visitor_id } = req.body;

    // 检查并发放初始积分（统一在这里处理，无论是否有 visitor_id）
    const DatabaseService = require('../services/database');
    const logger = require('../utils/logger');
    
    try {
      const { data: existingCredits } = await DatabaseService.getCreditsHistory(userId, 1, 0);
      const hasInitialCredits = existingCredits && existingCredits.some(
        credit => credit.change_type === 'initial'
      );
      
      if (!hasInitialCredits) {
        const INITIAL_CREDITS = 100; // 新用户注册奖励：+100 积分
        await DatabaseService.addCreditChange(userId, 'initial', INITIAL_CREDITS);
        logger.info(`首次登录发放初始积分: user_id=${userId}, credits=${INITIAL_CREDITS}`);
      }
    } catch (creditError) {
      logger.warn(`发放初始积分失败: user_id=${userId}`, creditError);
    }

    // 如果有 visitor_id，则合并游客数据
    if (visitor_id) {
      try {
        const result = await visitorUsageService.mergeVisitorDataToUser(visitor_id, userId);
        return res.json({
          success: true,
          data: {
            contentCount: result.contentCount,
            conversationCount: result.conversationCount,
            message: '我们已经帮你保存了刚才的学习进度'
          }
        });
      } catch (mergeError) {
        // 合并失败不影响积分发放，只记录错误
        logger.warn('合并游客数据失败，但积分已发放:', mergeError);
        return res.json({
          success: true,
          data: {
            contentCount: 0,
            conversationCount: 0,
            message: '初始积分已发放',
            mergeError: mergeError.message
          }
        });
      }
    } else {
      // 没有 visitor_id，只返回成功（积分已在上面的逻辑中发放）
      return res.json({
        success: true,
        data: {
          contentCount: 0,
          conversationCount: 0,
          message: '初始积分已发放'
        }
      });
    }
  } catch (error) {
    logger.error('处理首次登录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '处理首次登录失败'
    });
  }
});

module.exports = router;

