const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const DatabaseService = require('../services/database');

const router = express.Router();

// 获取积分余额
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: balance, error } = await DatabaseService.getCreditsBalance(userId);
    if (error) throw error;
    res.json({ success: true, data: { balance } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取积分历史
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const { data, error } = await DatabaseService.getCreditsHistory(userId, limit, offset);
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 消耗积分（通用接口）
router.post('/consume', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount = 1, reason = 'usage' } = req.body || {};
    if (amount <= 0) return res.status(400).json({ success: false, error: 'amount 必须为正数' });

    // 判断订阅豁免
    const { data: subscription } = await DatabaseService.getActiveSubscription(userId);
    if (subscription && subscription.plan === 'pro') {
      return res.json({ success: true, data: { balance: null, skipped: true, reason: 'pro_subscription' } });
    }

    // 获取余额
    const { data: balance } = await DatabaseService.getCreditsBalance(userId);
    if ((balance || 0) < amount) {
      return res.status(402).json({ success: false, error: '积分不足', balance: balance || 0 });
    }

    // 扣减积分
    const { error } = await DatabaseService.addCreditChange(userId, reason, -Math.abs(amount));
    if (error) throw error;

    const { data: newBalance } = await DatabaseService.getCreditsBalance(userId);
    res.json({ success: true, data: { balance: newBalance } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 管理员获取所有用户列表
router.get('/admin/users', authenticateToken, async (req, res) => {
  try {
    // 检查是否为管理员
    if (!req.user.role || !req.user.role.includes('admin')) {
      return res.status(403).json({ success: false, error: '权限不足' });
    }

    const { data: users, error } = await DatabaseService.getAllUsers();
    if (error) throw error;
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 管理员查询指定用户积分余额
router.get('/admin/credits/balance', authenticateToken, async (req, res) => {
  try {
    // 检查是否为管理员
    if (!req.user.role || !req.user.role.includes('admin')) {
      return res.status(403).json({ success: false, error: '权限不足' });
    }

    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: '缺少用户ID参数' });
    }

    const { data: balance, error } = await DatabaseService.getCreditsBalance(userId);
    if (error) throw error;
    res.json({ success: true, data: { balance } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 管理员手动增加积分
router.post('/admin/credits/add', authenticateToken, async (req, res) => {
  try {
    // 检查是否为管理员
    if (!req.user.role || !req.user.role.includes('admin')) {
      return res.status(403).json({ success: false, error: '权限不足' });
    }

    const { userId, amount, reason } = req.body;
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, error: '参数错误' });
    }

    // 增加积分
    const { error } = await DatabaseService.addCreditChange(userId, reason, amount);
    if (error) throw error;

    // 获取新的余额
    const { data: newBalance } = await DatabaseService.getCreditsBalance(userId);
    res.json({ success: true, data: { balance: newBalance } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

