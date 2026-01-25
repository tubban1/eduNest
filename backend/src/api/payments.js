const express = require('express');
const router = express.Router();
const { supabase } = require('../services/database');
const DatabaseService = require('../services/database');
const { authenticateToken } = require('../middleware/auth');

// 获取可用的支付方式（支持地区参数）
router.get('/payment-methods', async (req, res) => {
  try {
    const { region } = req.query;
    
    // 根据地区获取支付方式
    const getPaymentMethodsByRegion = (regionCode) => {
      const regionConfigs = {
        'CH': { currency: 'CHF', methods: ['card', 'sepa_debit', 'sofort'] },
        'US': { currency: 'USD', methods: ['card', 'us_bank_account'] },
        'CN': { currency: 'CNY', methods: ['card', 'alipay', 'wechat_pay'] },
        'DE': { currency: 'EUR', methods: ['card', 'sepa_debit', 'sofort', 'giropay'] },
        'FR': { currency: 'EUR', methods: ['card', 'sepa_debit', 'bancontact'] },
        'NL': { currency: 'EUR', methods: ['card', 'sepa_debit', 'ideal'] },
        'IT': { currency: 'EUR', methods: ['card', 'sepa_debit'] },
        'ES': { currency: 'EUR', methods: ['card', 'sepa_debit'] },
        'GB': { currency: 'GBP', methods: ['card', 'bacs_debit'] }
      };
      
      return regionConfigs[regionCode] || { currency: 'USD', methods: ['card'] };
    };

    const regionConfig = getPaymentMethodsByRegion(region);
    
    // 支付方式说明
    const methodDescriptions = {
      card: '信用卡/借记卡',
      sepa_debit: '欧洲银行转账',
      sofort: '德国即时转账',
      giropay: '德国银行转账',
      ideal: '荷兰在线银行',
      bancontact: '比利时银行卡',
      us_bank_account: '美国银行账户',
      bacs_debit: '英国银行转账',
      alipay: '支付宝',
      wechat_pay: '微信支付'
    };

    const availableMethods = regionConfig.methods.map(method => ({
      id: method,
      name: methodDescriptions[method] || method,
      available: true
    }));

    return res.json({
      success: true,
      region: region || 'US',
      currency: regionConfig.currency,
      payment_methods: availableMethods
    });

  } catch (error) {
    console.error('获取支付方式错误:', error);
    return res.status(500).json({ error: '获取支付方式失败' });
  }
});

// 创建Stripe支付会话
router.post('/create-session', authenticateToken, async (req, res) => {
  try {
    const { plan_type, success_url, cancel_url } = req.body;
    const userId = req.user.id;
    
    if (!plan_type || !['pro', 'monthly', 'yearly', 'lite'].includes(plan_type)) {
      return res.status(400).json({ error: '不支持的计划类型' });
    }
    
    // Lite 充值不需要检查订阅状态
    if (plan_type !== 'lite') {
      // 检查用户是否已有活跃订阅
      const { data: existingSubscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
      
      if (existingSubscription) {
        return res.status(400).json({ error: '用户已有活跃订阅' });
      }
    }
    
    // 创建Stripe Checkout Session
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    // 从请求中获取用户选择的支付方式和地区
    const { payment_methods, region } = req.body;
    
    // 根据地区获取支付方式配置
    const getPaymentMethodsByRegion = (regionCode) => {
      const regionConfigs = {
        'CH': { currency: 'chf', methods: ['card', 'sepa_debit', 'sofort'] },
        'US': { currency: 'usd', methods: ['card', 'us_bank_account'] },
        'CN': { currency: 'cny', methods: ['card', 'alipay', 'wechat_pay'] },
        'DE': { currency: 'eur', methods: ['card', 'sepa_debit', 'sofort', 'giropay'] },
        'FR': { currency: 'eur', methods: ['card', 'sepa_debit', 'bancontact'] },
        'NL': { currency: 'eur', methods: ['card', 'sepa_debit', 'ideal'] },
        'IT': { currency: 'eur', methods: ['card', 'sepa_debit'] },
        'ES': { currency: 'eur', methods: ['card', 'sepa_debit'] },
        'GB': { currency: 'gbp', methods: ['card', 'bacs_debit'] }
      };
      
      return regionConfigs[regionCode] || { currency: 'usd', methods: ['card'] };
    };

    const regionConfig = getPaymentMethodsByRegion(region);
    
    // 根据用户选择的支付方式过滤
    const getPaymentMethods = (selectedMethods = []) => {
      const allMethods = regionConfig.methods;
      
      if (selectedMethods && selectedMethods.length > 0) {
        // 过滤出用户选择且可用的支付方式
        return selectedMethods.filter(method => allMethods.includes(method));
      }
      
      // 如果没有选择，返回所有可用方式
      return allMethods;
    };
    
    const paymentMethods = getPaymentMethods(payment_methods);
    console.log(`配置支付方式 [${regionConfig.currency}]:`, paymentMethods);
    console.log('用户选择的支付方式:', payment_methods);
    console.log('用户地区:', region);
    
    // Lite 充值使用一次性支付，其他使用订阅
    const isLite = plan_type === 'lite';
    const isSubscription = !isLite;
    
    // 构建 line_items
    let lineItems;
    if (isLite) {
      // Lite 充值：$10，500积分
      lineItems = [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Lite Credits Top-up',
              description: '500 credits for AI content generation',
            },
            unit_amount: 1000, // $10.00 in cents
          },
          quantity: 1,
        },
      ];
    } else {
      // 订阅计划：根据 plan_type 选择价格ID
      const priceId = plan_type === 'monthly' 
        ? process.env.STRIPE_PRICE_ID_MONTHLY 
        : plan_type === 'yearly'
        ? process.env.STRIPE_PRICE_ID_YEARLY
        : process.env.STRIPE_PRICE_ID_PRO; // 向后兼容
      
      if (!priceId) {
        return res.status(500).json({ 
          error: `未配置 ${plan_type} 计划的价格ID。请检查环境变量 STRIPE_PRICE_ID_${plan_type.toUpperCase()}` 
        });
      }
      
      lineItems = [
        {
          price: priceId,
          quantity: 1,
        },
      ];
    }
    
    const sessionConfig = {
      payment_method_types: paymentMethods,
      line_items: lineItems,
      mode: isSubscription ? 'subscription' : 'payment', // Lite 使用 payment 模式
      success_url: success_url || `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${process.env.FRONTEND_URL}/subscription/cancel`,
      customer_email: req.user.email,
      metadata: {
        user_id: userId,
        plan_type: plan_type,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      locale: 'auto', // 自动检测用户语言
    };
    
    // 只有订阅模式才需要 subscription_data
    if (isSubscription) {
      sessionConfig.subscription_data = {
        metadata: {
          user_id: userId,
          plan_type: plan_type,
        },
      };
    }
    
    const session = await stripe.checkout.sessions.create(sessionConfig);
    
    return res.json({
      success: true,
      session: {
        id: session.id,
        client_secret: session.client_secret,
        url: session.url,
        amount: session.amount_total,
        currency: session.currency,
        plan_type: plan_type
      }
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
      case 'invoice.payment_succeeded':
        // 订阅续费成功
        await handleSubscriptionRenewal(data.object);
        break;
      case 'invoice.payment_failed':
        // 支付失败，更新订阅状态
        await handlePaymentFailure(data.object);
        break;
      case 'customer.subscription.updated':
        // 订阅状态更新
        await handleSubscriptionUpdate(data.object);
        break;
      case 'customer.subscription.deleted':
        // 订阅删除
        await handleSubscriptionDeletion(data.object);
        break;
      case 'customer.subscription.trial_will_end':
        // 试用期即将结束
        await handleTrialEnd(data.object);
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
      .from('payments')
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
    const userId = session.metadata.user_id;
    const planType = session.metadata.plan_type;
    
    // Lite 充值：添加积分，不创建订阅
    if (planType === 'lite') {
      // 添加500积分
      const { error: creditError } = await DatabaseService.addCreditChange(
        userId,
        'purchase_bonus', // 充值类型
        500, // 500积分
        null, // related_user_id
        null  // related_content_id
      );
      
      if (creditError) {
        console.error('添加积分错误:', creditError);
      } else {
        console.log(`✅ 用户 ${userId} 充值成功，已添加500积分`);
      }
      
      // 记录支付记录
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          user_id: userId,
          amount_usd: 10.00,
          currency: 'USD',
          plan: 'lite',
          status: 'success',
          stripe_session_id: session.id,
          created_at: new Date().toISOString()
        });
      
      if (paymentError) {
        console.error('记录支付记录错误:', paymentError);
      }
      
      return; // Lite 充值不需要创建订阅
    }
    
    // 订阅计划：创建或更新订阅
    const { data, error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        plan: planType === 'monthly' ? 'monthly' : planType === 'yearly' ? 'yearly' : 'pro', // 使用 plan 字段
        status: 'active',
        stripe_subscription_id: session.subscription || session.id,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + (planType === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
    
    if (error) {
      console.error('更新订阅状态错误:', error);
    } else {
      console.log(`✅ 用户 ${userId} 订阅成功，计划类型: ${planType}`);
    }
  } catch (error) {
    console.error('处理支付成功错误:', error);
  }
}

// 处理支付失败
async function handlePaymentFailure(invoice) {
  try {
    const { error } = await supabase
      .from('subscriptions')
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

// 处理订阅续费成功
async function handleSubscriptionRenewal(invoice) {
  try {
    const subscription = invoice.subscription;
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    const currentPeriodStart = new Date(subscription.current_period_start * 1000);
    
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: currentPeriodStart.toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);
    
    if (error) {
      console.error('更新订阅续费状态错误:', error);
    }
  } catch (error) {
    console.error('处理订阅续费错误:', error);
  }
}

// 处理订阅状态更新
async function handleSubscriptionUpdate(subscription) {
  try {
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    const currentPeriodStart = new Date(subscription.current_period_start * 1000);
    
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: currentPeriodStart.toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);
    
    if (error) {
      console.error('更新订阅状态错误:', error);
    }
  } catch (error) {
    console.error('处理订阅更新错误:', error);
  }
}

// 处理订阅删除
async function handleSubscriptionDeletion(subscription) {
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);
    
    if (error) {
      console.error('更新订阅删除状态错误:', error);
    }
  } catch (error) {
    console.error('处理订阅删除错误:', error);
  }
}

// 处理试用期即将结束
async function handleTrialEnd(subscription) {
  try {
    // 可以在这里发送邮件通知用户试用期即将结束
    console.log(`用户 ${subscription.metadata?.user_id} 的试用期即将结束`);
    
    // 更新订阅状态
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'trialing',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);
    
    if (error) {
      console.error('更新试用期状态错误:', error);
    }
  } catch (error) {
    console.error('处理试用期结束错误:', error);
  }
}

module.exports = router;
