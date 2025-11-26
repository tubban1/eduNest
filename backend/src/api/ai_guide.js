const express = require('express');
const router = express.Router();
const aiGuideService = require('../services/aiGuideService');
const { authenticateToken } = require('../middleware/auth');

// Initialize conversation
router.post('/init', authenticateToken, async (req, res) => {
  try {
    const { content_id } = req.body;
    const user_id = req.user.id;

    if (!content_id) {
      return res.status(400).json({ error: 'content_id is required' });
    }
    if (!user_id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

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
      return res.status(400).json({ error: 'conversation_id and message are required' });
    }

    const streamGenerator = await aiGuideService.handleChat(conversation_id, message, ui_state, user_id);

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

module.exports = router;

