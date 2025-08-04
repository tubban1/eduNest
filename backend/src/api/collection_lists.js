const express = require('express');
const DatabaseService = require('../services/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 创建列表
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, visibility = 'private' } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: '列表名称不能为空' });
    }

    const result = await DatabaseService.createCollectionList({
      name: name.trim(),
      visibility,
      user_id: req.user.id,
      parent_id: null, // 所有列表都是顶级
      order_index: 0
    });
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户的列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await DatabaseService.getCollectionListsByUser(req.user.id);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新列表顺序
router.put('/order', authenticateToken, async (req, res) => {
  try {
    const { orders } = req.body;
    
    if (!Array.isArray(orders)) {
      return res.status(400).json({ error: 'orders必须是数组' });
    }

    const result = await DatabaseService.updateCollectionListOrder(orders);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除列表
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await DatabaseService.deleteCollectionList(req.params.id, req.user.id);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    res.json({ success: true, deleted: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 