const express = require('express');
const router = express.Router();
const { supabase } = require('../services/database');
const { authenticateToken } = require('../middleware/auth');

// 获取用户订阅状态
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 查询用户订阅信息
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }
    
    // 如果没有订阅记录，返回免费用户状态
    if (!subscription) {
      return res.json({
        status: 'free',
        plan: null,
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
        is_active: false
      });
    }
    
    // 检查订阅是否过期
    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);
    const isActive = subscription.status === 'active' && periodEnd > now;
    
    return res.json({
      status: subscription.status,
      plan: subscription.plan, // 使用 plan 字段，不是 plan_type
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      is_active: isActive,
      stripe_subscription_id: subscription.stripe_subscription_id
    });
    
  } catch (error) {
    console.error('获取订阅状态错误:', error);
    return res.status(500).json({ error: '获取订阅状态失败' });
  }
});

// 升级订阅计划
router.post('/upgrade', authenticateToken, async (req, res) => {
  try {
    const { plan_type, stripe_session_id } = req.body;
    const userId = req.user.id;
    
    if (!plan_type || !stripe_session_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 验证计划类型（支持 monthly, yearly, pro）
    if (!['pro', 'monthly', 'yearly'].includes(plan_type)) {
      return res.status(400).json({ error: '不支持的计划类型。支持的类型：monthly, yearly, pro' });
    }
    
    // 创建或更新订阅记录
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('创建订阅记录错误:', error);
      return res.status(500).json({ error: '创建订阅记录失败' });
    }
    
    return res.json({
      success: true,
      message: '订阅升级成功',
      subscription: data
    });
    
  } catch (error) {
    console.error('升级订阅错误:', error);
    return res.status(500).json({ error: '升级订阅失败' });
    }
});

// 取消订阅
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) {
      console.error('取消订阅失败:', error);
      return res.status(500).json({ error: '取消订阅失败' });
    }
    
    return res.json({
      success: true,
      message: '订阅将在当前周期结束后取消',
      subscription: data
    });
    
  } catch (error) {
    console.error('取消订阅错误:', error);
    return res.status(500).json({ error: '取消订阅失败' });
  }
});

module.exports = router;
