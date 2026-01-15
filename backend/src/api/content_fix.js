const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const DatabaseService = require('../services/database');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// POST /api/content/fix（只支持 full_html）
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { content_id, note, full_html, content_type, language_code, title, description, provider, requestId } = req.body;
    if (!full_html || typeof full_html !== 'string' || full_html.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'full_html 必填' });
    }
    
    const userId = req.user.id;

    // AI使用日志由aiService.fixEducationalContent统一记录
    
    // 积分验证和扣除（非pro订阅用户）
    const CREDITS_COST = 10; // 内容修复消耗 10 积分
    const { data: subscription } = await DatabaseService.getActiveSubscription(userId);
    if (!subscription || subscription.plan !== 'pro') {
      const { data: balance } = await DatabaseService.getCreditsBalance(userId);
      if ((balance || 0) < CREDITS_COST) {
        return res.status(402).json({ success: false, error: '积分不足' });
      }
    }
    
    // 如果是编辑模式，需要验证 content_id 并获取原始内容
    if (content_id) {
      const { data: original, error: dbErr } = await DatabaseService.getContentById(content_id);
      if (dbErr || !original) {
        return res.status(404).json({ success: false, error: '内容不存在' });
      }
      // 使用数据库中的原始内容信息
      const aiResult = await aiService.fixEducationalContent({
        full_html: original.full_html || full_html,
        note,
        content_type: original.content_type,
        language_code: original.language_code,
        title: original.title,
        description: original.description,
        user_id: userId,
        provider,
        requestId
      });
      if (!aiResult.success) {
        return res.status(500).json({ success: false, error: aiResult.error });
      }
      
      // 成功修复后扣除积分（非pro订阅用户）
      if (!subscription || subscription.plan !== 'pro') {
        await DatabaseService.addCreditChange(userId, 'usage', -CREDITS_COST);
      }
      
      const { full_html: newFullHtml, fixed } = aiResult.data;

      // AI使用日志由aiService.fixEducationalContent统一记录

      return res.json({ 
        success: true, 
        full_html: newFullHtml, 
        fixed 
      });
    } else {
      // 如果是创建模式，直接使用前端传递的参数
      const aiResult = await aiService.fixEducationalContent({
        full_html,
        note,
        content_type: content_type || 'vue',
        language_code: language_code || 'zh-CN',
        title: title || '未命名内容',
        description: description || '',
        user_id: userId,
        provider,
        requestId
      });
      if (!aiResult.success) {
        // AI使用日志由aiService.fixEducationalContent统一记录
        return res.status(500).json({ success: false, error: aiResult.error });
      }
      
      // 成功修复后扣除积分（非pro订阅用户）
      if (!subscription || subscription.plan !== 'pro') {
        await DatabaseService.addCreditChange(userId, 'usage', -CREDITS_COST);
      }
      
      const { full_html: newFullHtml, fixed } = aiResult.data;

      // AI使用日志由aiService.fixEducationalContent统一记录

      return res.json({ 
        success: true, 
        full_html: newFullHtml, 
        fixed 
      });
    }
  } catch (e) {
    // AI使用日志由aiService.fixEducationalContent统一记录
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router; 