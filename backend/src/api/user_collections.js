const express = require('express');
const DatabaseService = require('../services/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 添加内容到列表
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { content_id, list_id } = req.body;
    
    if (!content_id || !list_id) {
      return res.status(400).json({ error: 'content_id和list_id不能为空' });
    }

    const result = await DatabaseService.addContentToList(req.user.id, content_id, list_id);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 从列表中移除内容
router.delete('/:contentId/:listId', authenticateToken, async (req, res) => {
  try {
    const { contentId, listId } = req.params;
    
    const result = await DatabaseService.removeContentFromList(req.user.id, contentId, listId);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取内容的所有收藏列表
router.get('/content/:contentId', authenticateToken, async (req, res) => {
  try {
    const { contentId } = req.params;
    
    const result = await DatabaseService.getContentCollections(req.user.id, contentId);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户的收藏分组
router.get('/groups', authenticateToken, async (req, res) => {
  try {
    const result = await DatabaseService.getUserCollectionGroups(req.user.id);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取指定分组的收藏内容
router.get('/group/:groupId', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const result = await DatabaseService.getUserCollectionsByGroup(req.user.id, groupId);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户喜欢的内容
router.get('/liked', authenticateToken, async (req, res) => {
  try {
    const result = await DatabaseService.getUserLikedCollections(req.user.id);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 点赞/取消点赞收藏内容
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

module.exports = router; 