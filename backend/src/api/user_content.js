const express = require('express');
const DatabaseService = require('../services/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 点赞内容
router.post('/:contentId/like', authenticateToken, async (req, res) => {
  try {
    const { contentId } = req.params;
    
    const result = await DatabaseService.likeContent(req.user.id, contentId);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 取消点赞内容
router.delete('/:contentId/like', authenticateToken, async (req, res) => {
  try {
    const { contentId } = req.params;
    
    const result = await DatabaseService.unlikeContent(req.user.id, contentId);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取内容的喜欢状态
router.get('/:contentId/like', authenticateToken, async (req, res) => {
  try {
    const { contentId } = req.params;
    
    const result = await DatabaseService.getContentLikeStatus(req.user.id, contentId);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, data: { isLiked: result.data } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户喜欢的所有内容
router.get('/liked', authenticateToken, async (req, res) => {
  try {
    const result = await DatabaseService.getUserLikedContent(req.user.id);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 