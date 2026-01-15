/**
 * 早期用户额外奖励API
 * 处理用户通过邮件链接领取额外50积分
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const DatabaseService = require('../services/database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * 领取早期用户额外奖励（通过邮件链接）
 * GET /api/early-user-bonus/claim?token=xxx
 */
router.get('/claim', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少token参数' 
      });
    }
    
    // 验证token
    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET || 'dev-secret-key');
    } catch (jwtError) {
      logger.warn('早期用户奖励token验证失败', { error: jwtError.message });
      return res.status(401).json({ 
        success: false, 
        error: '无效或过期的链接' 
      });
    }
    
    // 检查token类型和用户ID
    if (decoded.type !== 'early_user_bonus' || !decoded.userId) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的奖励链接' 
      });
    }
    
    const userId = decoded.userId;
    
    // 检查用户是否存在
    const { data: user, error: userError } = await DatabaseService.getUserById(userId);
    if (userError || !user) {
      return res.status(404).json({ 
        success: false, 
        error: '用户不存在' 
      });
    }
    
    // 检查是否已经领取过额外奖励
    const { data: existingCredits } = await DatabaseService.getCreditsHistory(userId, 100, 0);
    const hasBonusCredit = existingCredits && existingCredits.some(
      credit => credit.change_type === 'early_user_bonus'
    );
    
    if (hasBonusCredit) {
      // 已经领取过，返回成功但提示已领取
      const { data: balance } = await DatabaseService.getCreditsBalance(userId);
      return res.json({ 
        success: true, 
        data: { 
          alreadyClaimed: true,
          message: '您已经领取过额外奖励了',
          balance 
        } 
      });
    }
    
    // 发放额外50积分
    const BONUS_CREDITS = 50;
    const { error: creditError } = await DatabaseService.addCreditChange(
      userId,
      'early_user_bonus',
      BONUS_CREDITS
    );
    
    if (creditError) {
      logger.error('发放早期用户额外奖励失败', { userId, error: creditError });
      return res.status(500).json({ 
        success: false, 
        error: '发放奖励失败，请稍后重试' 
      });
    }
    
    // 获取新的积分余额
    const { data: balance } = await DatabaseService.getCreditsBalance(userId);
    
    logger.info(`早期用户额外奖励发放成功: user_id=${userId}, credits=${BONUS_CREDITS}`);
    
    res.json({ 
      success: true, 
      data: { 
        claimed: true,
        creditsAwarded: BONUS_CREDITS,
        balance,
        message: '成功领取50积分！'
      } 
    });
    
  } catch (error) {
    logger.error('领取早期用户额外奖励失败', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || '服务器错误' 
    });
  }
});

/**
 * 检查是否已领取额外奖励（需要登录）
 * GET /api/early-user-bonus/status
 */
router.get('/status', async (req, res) => {
  try {
    // 从token中获取用户ID（如果提供了Authorization header）
    const authHeader = req.headers['authorization'];
    let userId = null;
    
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.decode(token);
          userId = decoded?.userId || decoded?.sub;
        } catch (e) {
          // 忽略token解析错误
        }
      }
    }
    
    // 或者从query参数中获取（用于前端页面检查）
    if (!userId && req.query.userId) {
      userId = req.query.userId;
    }
    
    if (!userId) {
      return res.json({ 
        success: true, 
        data: { 
          canClaim: false,
          message: '请先登录' 
        } 
      });
    }
    
    // 检查是否已经领取过
    const { data: existingCredits } = await DatabaseService.getCreditsHistory(userId, 100, 0);
    const hasBonusCredit = existingCredits && existingCredits.some(
      credit => credit.change_type === 'early_user_bonus'
    );
    
    res.json({ 
      success: true, 
      data: { 
        alreadyClaimed: hasBonusCredit,
        canClaim: !hasBonusCredit
      } 
    });
    
  } catch (error) {
    logger.error('检查早期用户额外奖励状态失败', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || '服务器错误' 
    });
  }
});

module.exports = router;
