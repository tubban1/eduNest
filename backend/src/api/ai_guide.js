const express = require('express');
const router = express.Router();
const aiGuideService = require('../services/aiGuideService');
const { authenticateToken } = require('../middleware/auth');
const { validateVisitorId } = require('../middleware/visitorId');
const visitorUsageService = require('../services/visitorUsageService');
const DatabaseService = require('../services/database');
const { t } = require('../utils/i18n');

// Initialize conversation
router.post('/init', authenticateToken, async (req, res) => {
  try {
    const { content_id } = req.body;
    const user_id = req.user.id;

    if (!content_id) {
      return res.status(400).json({ error: t(req, 'CONTENT_ID_REQUIRED', 'content_id is required') });
    }
    if (!user_id) {
      return res.status(401).json({ error: t(req, 'USER_NOT_AUTHENTICATED', 'User not authenticated') });
    }

    // 初始化对话不扣分
    const result = await aiGuideService.initConversation(content_id, user_id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('API Error /init:', error);
    res.status(500).json({ success: false, error: error.message, message: error.message, stack: error.stack });
  }
});

// Chat (Streaming support)
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { conversation_id, message, ui_state } = req.body;
    const user_id = req.user.id;

    if (!conversation_id || !message) {
      return res.status(400).json({ error: t(req, 'CONVERSATION_ID_REQUIRED', 'conversation_id and message are required') });
    }

    // 检查订阅状态和积分余额（每次对话消耗积分）
    const CREDITS_COST = 2; // AI Guide 每次对话消耗 2 积分
    let shouldConsume = true;
    const { data: subscription } = await DatabaseService.getActiveSubscription(user_id);
    if (subscription && (subscription.plan === 'pro' || subscription.plan === 'monthly' || subscription.plan === 'yearly')) {
      shouldConsume = false;
    } else {
      const { data: balance } = await DatabaseService.getCreditsBalance(user_id);
      if ((balance || 0) < CREDITS_COST) {
        return res.status(402).json({ 
          success: false, 
          error: t(req, 'INSUFFICIENT_CREDITS'),
          message: t(req, 'INSUFFICIENT_CREDITS_MESSAGE')
        });
      }
    }

    const streamGenerator = await aiGuideService.handleChat(conversation_id, message, ui_state, user_id, shouldConsume, CREDITS_COST);

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of streamGenerator) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      // Explicitly flush if possible (Express/Node might buffer)
      if (res.flush) res.flush();
    }
    
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('API Error /chat:', error);
    // If headers are not sent, send JSON error
    if (!res.headersSent) {
        res.status(500).json({ success: false, error: error.message, message: error.message, stack: error.stack });
    } else {
        // If headers sent (streaming started), send error event
        res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
        res.end();
    }
  }
});

// Get conversations
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const { content_id } = req.query;
    const user_id = req.user.id;

    if (!content_id) {
      return res.status(400).json({ error: 'content_id is required' });
    }

    const conversations = await aiGuideService.getConversations(content_id, user_id);
    res.json({ success: true, data: { conversations } });
  } catch (error) {
    console.error('API Error /conversations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get messages
router.get('/messages', authenticateToken, async (req, res) => {
  try {
    const { conversation_id } = req.query;

    if (!conversation_id) {
      return res.status(400).json({ error: 'conversation_id is required' });
    }

    const messages = await aiGuideService.getMessages(conversation_id);
    res.json({ success: true, data: { messages } });
  } catch (error) {
    console.error('API Error /messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 免费初始化会话（无需认证，需要 visitor_id）
router.post('/init-free', validateVisitorId, async (req, res) => {
  try {
    const { content_id } = req.body;
    const visitor_id = req.visitorId;

    if (!content_id) {
      return res.status(400).json({ success: false, error: t(req, 'CONTENT_ID_REQUIRED', 'content_id is required') });
    }

    // 检查免费试用状态
    const canUse = await visitorUsageService.canUseAiGuide(visitor_id);
    if (!canUse) {
      return res.status(403).json({
        success: false,
        error: 'FREE_TRIAL_USED',
        message: t(req, 'PLEASE_LOGIN'),
        requiresRegistration: true
      });
    }

    // 使用 visitor_id 作为 user_id 初始化会话
    const result = await aiGuideService.initConversation(content_id, visitor_id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('API Error /init-free:', error);
    res.status(500).json({ success: false, error: error.message, message: error.message, stack: error.stack });
  }
});

// 免费对话接口（无需认证，需要 visitor_id）
router.post('/chat-free', validateVisitorId, async (req, res) => {
  try {
    const { conversation_id, message, ui_state } = req.body;
    const visitor_id = req.visitorId;

    if (!conversation_id || !message) {
      return res.status(400).json({ success: false, error: t(req, 'CONVERSATION_ID_REQUIRED', 'conversation_id and message are required') });
    }

    // 检查是否已使用免费对话（在第一次对话时标记）
    const canUse = await visitorUsageService.canUseAiGuide(visitor_id);
    let freeTrialUsed = false;
    
    if (canUse) {
      // 第一次对话，标记为已使用
      await visitorUsageService.markAiGuideUsed(visitor_id);
      freeTrialUsed = true;
    }

    // 使用 visitor_id 作为 user_id 处理对话
    const streamGenerator = await aiGuideService.handleChat(conversation_id, message, ui_state, visitor_id);

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // 如果这是第一次对话，在响应头中标记
    if (freeTrialUsed) {
      res.setHeader('X-Free-Trial-Used', 'true');
    }

    for await (const chunk of streamGenerator) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      // Explicitly flush if possible (Express/Node might buffer)
      if (res.flush) res.flush();
    }
    
    // 在最后一条消息中标记免费试用已使用
    if (freeTrialUsed) {
      res.write(`data: ${JSON.stringify({ freeTrialUsed: true })}\n\n`);
    }
    
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('API Error /chat-free:', error);
    // If headers are not sent, send JSON error
    if (!res.headersSent) {
        res.status(500).json({ success: false, error: error.message, message: error.message, stack: error.stack });
    } else {
        // If headers sent (streaming started), send error event
        res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
        res.end();
    }
  }
});

module.exports = router;

