const express = require('express');
const router = express.Router();
const { supabase } = require('../services/database');
const { authenticateToken } = require('../middleware/auth');

// 创建Stripe支付会话
router.post('/create-session', authenticateToken, async (req, res) => {
  try {
    const { plan_type } = req.body;
    const userId = req.user.id;
    
    if (!plan_type || !['pro'].includes(plan_type)) {
      return res.status(400).json({ error: '不支持的计划类型' });
    }
    
    // 这里应该集成Stripe API创建支付会话
    // 暂时返回模拟数据
    const mockSession = {
      id: `cs_${Date.now()}`,
      url: `https://checkout.stripe.com/pay/${Date.now()}`,
      amount: plan_type === 'pro' ? 2000 : 500, // 20美元 = 2000分
      currency: 'usd',
      plan_type: plan_type
    };
    
    return res.json({
      success: true,
      session: mockSession
    });
    
  } catch (error) {
    console.error('创建支付会话错误:', error);
    return res.status(500).json({ error: '创建支付会话失败' });
  }
});

// Stripe webhook处理
router.post('/webhook', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    // 处理不同类型的webhook事件
    switch (type) {
      case 'checkout.session.completed':
        // 支付成功，更新订阅状态
        await handlePaymentSuccess(data.object);
        break;
      case 'invoice.payment_failed':
        // 支付失败，更新订阅状态
        await handlePaymentFailure(data.object);
        break;
      default:
        console.log(`未处理的webhook事件: ${type}`);
    }
    
    return res.json({ received: true });
    
  } catch (error) {
    console.error('处理webhook错误:', error);
    return res.status(500).json({ error: 'webhook处理失败' });
  }
});

// 查询支付历史
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 查询用户支付记录
    const { data: payments, error } = await supabase
      .from('payment_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    return res.json({ payments: payments || [] });
    
  } catch (error) {
    console.error('查询支付历史错误:', error);
    return res.status(500).json({ error: '查询支付历史失败' });
  }
});

// 处理支付成功
async function handlePaymentSuccess(session) {
  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: session.metadata.user_id,
        plan_type: session.metadata.plan_type,
        status: 'active',
        stripe_subscription_id: session.subscription || session.id,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
    
    if (error) {
      console.error('更新订阅状态错误:', error);
    }
  } catch (error) {
    console.error('处理支付成功错误:', error);
  }
}

// 处理支付失败
async function handlePaymentFailure(invoice) {
  try {
    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', invoice.subscription);
    
    if (error) {
      console.error('更新支付失败状态错误:', error);
    }
  } catch (error) {
    console.error('处理支付失败错误:', error);
  }
}

module.exports = router;
