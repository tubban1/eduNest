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

// Chat
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { conversation_id, message, ui_state } = req.body;
    const user_id = req.user.id;

    if (!conversation_id || !message) {
      return res.status(400).json({ error: 'conversation_id and message are required' });
    }

    const result = await aiGuideService.handleChat(conversation_id, message, ui_state, user_id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('API Error /chat:', error);
    res.status(500).json({ success: false, error: error.message, message: error.message, stack: error.stack });
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

