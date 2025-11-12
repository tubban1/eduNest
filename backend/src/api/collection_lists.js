const express = require('express');
const DatabaseService = require('../services/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

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

// 根据 short_id 获取列表及其内容（支持未登录用户访问 public 列表）
router.get('/by-short-id/:short_id', optionalAuth, async (req, res) => {
  try {
    const { short_id } = req.params;
    const userId = req.user?.id || null; // 可选：如果已登录则获取用户ID
    
    const result = await DatabaseService.getCollectionListByShortId(short_id, userId);
    
    if (result.error) {
      if (result.error.message === '列表不存在') {
        return res.status(404).json({ error: result.error.message });
      }
      if (result.error.message === '无权限访问此列表') {
        return res.status(403).json({ error: result.error.message });
      }
      return res.status(500).json({ error: result.error.message });
    }
    
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新列表设置（仅创建者）
router.put('/:id/settings', authenticateToken, async (req, res) => {
  try {
    const listId = req.params.id;
    const { pricing_mode, price, currency, description, visibility, name } = req.body;
    
    // 验证权限：仅创建者可修改
    const { data: list, error: listError } = await DatabaseService.supabase
      .from('collection_lists')
      .select('user_id')
      .eq('id', listId)
      .single();
    
    if (listError || !list || list.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权限修改此列表' });
    }
    
    // 验证价格（如果设置为付费）
    if (pricing_mode === 'premium') {
      if (!price || price <= 0) {
        return res.status(400).json({ error: '付费列表必须设置有效价格' });
      }
    }
    
    // 更新列表
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (pricing_mode !== undefined) {
      updateData.pricing_mode = pricing_mode || 'free';
      // 如果设置为付费，必须提供价格；否则清空价格
      if (pricing_mode === 'premium') {
        updateData.price = price;
        updateData.currency = currency || 'USD';
      } else {
        updateData.price = null;
      }
    }
    if (currency !== undefined && pricing_mode === 'premium') {
      updateData.currency = currency;
    }
    
    const { error: updateError } = await DatabaseService.supabase
      .from('collection_lists')
      .update(updateData)
      .eq('id', listId);
    
    if (updateError) {
      throw updateError;
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 