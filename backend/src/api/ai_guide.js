const express = require('express');
const router = express.Router();
const aiGuideService = require('../services/aiGuideService');
const learningAnalysisService = require('../services/learningAnalysisService');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validateVisitorId, optionalVisitorId } = require('../middleware/visitorId');
const { isValidVisitorId } = require('../utils/visitorId');
const visitorUsageService = require('../services/visitorUsageService');
const DatabaseService = require('../services/database');
const { t } = require('../utils/i18n');

// Initialize conversation（支持 force_new：强制新建会话，不恢复最近一条）
router.post('/init', authenticateToken, async (req, res) => {
  try {
    const { content_id, force_new } = req.body;
    const user_id = req.user.id;

    if (!content_id) {
      return res.status(400).json({ error: t(req, 'CONTENT_ID_REQUIRED', 'content_id is required') });
    }
    if (!user_id) {
      return res.status(401).json({ error: t(req, 'USER_NOT_AUTHENTICATED', 'User not authenticated') });
    }

    const result = await aiGuideService.initConversation(content_id, user_id, { forceNew: !!force_new });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('API Error /init:', error);
    res.status(500).json({ success: false, error: error.message, message: error.message, stack: error.stack });
  }
});

// Chat (Streaming support)
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { conversation_id, message, images } = req.body;
    // Learn 页通过 iframe postMessage 读取 runtime getUIState() 后传入，兼容 ui_state / uiState
    const ui_state = req.body.ui_state ?? req.body.uiState;
    const user_id = req.user.id;

    if (!conversation_id || !message) {
      return res.status(400).json({ error: t(req, 'CONVERSATION_ID_REQUIRED', 'conversation_id and message are required') });
    }

    // 验证图片数组（最多3张）
    if (images && Array.isArray(images)) {
      if (images.length > 3) {
        return res.status(400).json({ 
          success: false, 
          error: 'TOO_MANY_IMAGES',
          message: '最多只能上传3张图片' 
        });
      }
      // 验证每张图片格式
      for (const img of images) {
        if (typeof img !== 'object' || !img.mime_type || !img.data) {
          return res.status(400).json({ 
            success: false, 
            error: 'INVALID_IMAGE_FORMAT',
            message: '图片格式无效' 
          });
        }
        const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validMimeTypes.includes(img.mime_type)) {
          return res.status(400).json({ 
            success: false, 
            error: 'INVALID_IMAGE_TYPE',
            message: '不支持的图片格式，请使用 JPEG、PNG、GIF 或 WebP' 
          });
        }
      }
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

    const streamGenerator = await aiGuideService.handleChat(conversation_id, message, ui_state, user_id, shouldConsume, CREDITS_COST, images);

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

// 从数据库 ai_conversations 表查询最近一次 conversation（支持登录用户和访客）
router.get('/last-conversation', optionalAuth, optionalVisitorId, async (req, res) => {
  try {
    // 优先使用登录用户的 user_id，否则使用 visitor_id
    const userId = req.user?.id || req.visitorId;
    if (!userId) {
      return res.json({ success: true, data: null });
    }
    const conversation = await aiGuideService.getLastConversationFromDB(userId);
    res.json({ success: true, data: conversation });
  } catch (error) {
    console.error('API Error /last-conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取当前用户/访客的 ai_conversations 对话数（用于气泡提示：3 次以上不显示）
router.get('/conversation-count', optionalAuth, async (req, res) => {
  try {
    let userId = null;
    if (req.user?.id) {
      userId = req.user.id;
    } else {
      const visitorId = req.headers['x-visitor-id'];
      if (visitorId && isValidVisitorId(visitorId)) {
        userId = visitorId;
      }
    }
    const count = await aiGuideService.getConversationCount(userId);
    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('API Error /conversation-count:', error);
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
    const { content_id, force_new } = req.body;
    const visitor_id = req.visitorId;

    if (!content_id) {
      return res.status(400).json({ success: false, error: t(req, 'CONTENT_ID_REQUIRED', 'content_id is required') });
    }

    const canUse = await visitorUsageService.canUseAiGuide(visitor_id);
    if (!canUse) {
      return res.status(403).json({
        success: false,
        error: 'FREE_TRIAL_USED',
        message: t(req, 'PLEASE_LOGIN'),
        requiresRegistration: true
      });
    }

    const result = await aiGuideService.initConversation(content_id, visitor_id, { forceNew: !!force_new });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('API Error /init-free:', error);
    res.status(500).json({ success: false, error: error.message, message: error.message, stack: error.stack });
  }
});

// 免费对话接口（无需认证，需要 visitor_id）
router.post('/chat-free', validateVisitorId, async (req, res) => {
  try {
    const { conversation_id, message, images } = req.body;
    // Learn 页从 iframe runtime getUIState() 取到的状态，兼容 ui_state / uiState
    const ui_state = req.body.ui_state ?? req.body.uiState;
    const visitor_id = req.visitorId;

    if (!conversation_id || !message) {
      return res.status(400).json({ success: false, error: t(req, 'CONVERSATION_ID_REQUIRED', 'conversation_id and message are required') });
    }

    // 验证图片数组（最多3张）
    if (images && Array.isArray(images)) {
      if (images.length > 3) {
        return res.status(400).json({ 
          success: false, 
          error: 'TOO_MANY_IMAGES',
          message: '最多只能上传3张图片' 
        });
      }
      // 验证每张图片格式
      for (const img of images) {
        if (typeof img !== 'object' || !img.mime_type || !img.data) {
          return res.status(400).json({ 
            success: false, 
            error: 'INVALID_IMAGE_FORMAT',
            message: '图片格式无效' 
          });
        }
        const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validMimeTypes.includes(img.mime_type)) {
          return res.status(400).json({ 
            success: false, 
            error: 'INVALID_IMAGE_TYPE',
            message: '不支持的图片格式，请使用 JPEG、PNG、GIF 或 WebP' 
          });
        }
      }
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
    const streamGenerator = await aiGuideService.handleChat(conversation_id, message, ui_state, visitor_id, false, 0, images);

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

// 学习分析报表（基于 ai_messages.metadata、ai_usage_logs.request_payload）
router.post('/learning-reports/generate', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      return res.status(401).json({ error: t(req, 'USER_NOT_AUTHENTICATED', 'User not authenticated') });
    }
    const { report_type = 'monthly', period_start, period_end } = req.body;
    const end = period_end ? new Date(period_end) : new Date();
    const start = period_start ? new Date(period_start) : new Date(end.getFullYear(), end.getMonth(), 1);
    const result = await learningAnalysisService.generateLearningReport(
      user_id,
      report_type,
      start.toISOString(),
      end.toISOString()
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('API Error /learning-reports/generate:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/learning-reports', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      return res.status(401).json({ error: t(req, 'USER_NOT_AUTHENTICATED', 'User not authenticated') });
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const list = await learningAnalysisService.listReportsByUser(user_id, limit);
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('API Error /learning-reports list:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/learning-reports/:id', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      return res.status(401).json({ error: t(req, 'USER_NOT_AUTHENTICATED', 'User not authenticated') });
    }
    const report = await learningAnalysisService.getReport(req.params.id);
    if (!report || report.user_id !== user_id) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json({ success: true, data: report });
  } catch (error) {
    console.error('API Error /learning-reports get:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

