const express = require('express');
const { body, param, validationResult } = require('express-validator');
const DatabaseService = require('../services/database');
const { optionalAuth } = require('../middleware/auth');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// 添加评分
router.post('/', [
  optionalAuth,
  body('content_id').isUUID().withMessage('内容ID必须是有效的UUID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('评分必须是1-5之间的整数'),
  body('comment').optional().isLength({ max: 500 }).withMessage('评论长度不能超过500字符')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: '参数验证失败', 
        details: errors.array() 
      });
    }

    const { content_id, rating, comment } = req.body;
    const userId = req.user ? req.user.id : null;

    // 检查内容是否存在
    try {
      await DatabaseService.getContentById(content_id);
    } catch (error) {
      return res.status(404).json({ 
        error: '内容不存在',
        message: '要评分的内容不存在' 
      });
    }

    const ratingData = {
      content_id,
      rating,
      comment: comment || null,
      user_id: userId,
      user_ip: req.ip,
      user_agent: req.get('User-Agent')
    };

    const result = await DatabaseService.addRating(ratingData);
    
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// 获取内容评分统计
router.get('/stats/:contentId', [
  param('contentId').isUUID().withMessage('内容ID必须是有效的UUID')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: '参数验证失败', 
        details: errors.array() 
      });
    }

    const { contentId } = req.params;

    const stats = await DatabaseService.getContentRatingStats(contentId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

// 获取内容评分列表
router.get('/:contentId', [
  param('contentId').isUUID().withMessage('内容ID必须是有效的UUID')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: '参数验证失败', 
        details: errors.array() 
      });
    }

    const { contentId } = req.params;

    const ratings = await DatabaseService.getContentRatings(contentId);
    
    res.json({
      success: true,
      data: ratings
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 