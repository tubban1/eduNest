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
      
      // 验证价格ID是否存在于当前模式
      const isTestKey = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
      const isLiveKey = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_');
      
      if (isTestKey) {
        console.log(`✅ 使用测试模式API密钥，价格ID: ${priceId}`);
        console.log('✅ Stripe Dashboard 显示 "测试模式"（Test mode）');
        console.log('✅ 环境配置正确：测试模式 API 密钥 + 测试模式价格ID');
      } else if (isLiveKey) {
        console.log(`✅ 使用生产模式API密钥，价格ID: ${priceId}`);
        console.log('⚠️ 请确认：1) Stripe Dashboard 右上角显示 "Live mode" 2) 价格是在 Live mode 下创建的');
      } else {
        console.warn('⚠️ 无法识别API密钥模式，请检查 STRIPE_SECRET_KEY 格式');
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
    
    console.log('准备创建 Stripe Checkout Session...');
    console.log('Session 配置:', JSON.stringify({
      mode: sessionConfig.mode,
      payment_method_types: sessionConfig.payment_method_types,
      line_items_count: sessionConfig.line_items.length,
      plan_type: plan_type,
      has_metadata: !!sessionConfig.metadata
    }, null, 2));
    
    const session = await stripe.checkout.sessions.create(sessionConfig);
    
    console.log('✅ Stripe Checkout Session 创建成功:', session.id);
    console.log('Session URL:', session.url);
    
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
    console.error('❌ 创建支付会话错误:', error);
    console.error('错误类型:', error.type);
    console.error('错误代码:', error.code);
    console.error('错误消息:', error.message);
    console.error('错误详情:', error.raw || error);
    
    // 提供更友好的错误提示
    if (error.type === 'StripeInvalidRequestError') {
      if (error.code === 'resource_missing') {
        if (error.message.includes('similar object exists in live mode')) {
          return res.status(400).json({ 
            error: '价格ID模式不匹配',
            message: '您使用的价格ID是生产模式的，但API密钥是测试模式的。请在Stripe Dashboard的测试模式下创建对应的价格，并使用测试模式的价格ID。',
            details: '测试模式价格ID应该以 price_ 开头（与生产模式相同），但需要在测试模式下创建。请检查环境变量 STRIPE_PRICE_ID_MONTHLY 和 STRIPE_PRICE_ID_YEARLY。'
          });
        }
        return res.status(400).json({ 
          error: '资源不存在',
          message: error.message || '请求的资源在Stripe中不存在',
          details: `请检查：1) 价格ID是否正确 2) 是否在正确的模式下创建 3) 资源是否被删除`
        });
      }
      
      if (error.code === 'parameter_invalid_empty') {
        return res.status(400).json({ 
          error: '参数无效',
          message: error.message || '请求参数为空或无效',
          details: '请检查请求参数是否完整'
        });
      }
    }
    
    // 检查是否是 Stripe API 密钥问题
    if (error.type === 'StripeAuthenticationError') {
      return res.status(401).json({ 
        error: 'Stripe API 密钥无效',
        message: '无法验证 Stripe API 密钥，请检查环境变量 STRIPE_SECRET_KEY'
      });
    }
    
    return res.status(500).json({ 
      error: '创建支付会话失败',
      message: error.message || '未知错误',
      type: error.type,
      code: error.code
    });
  }
});

// Stripe webhook处理
router.post('/webhook', async (req, res) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    // 验证 webhook 签名
    if (!sig || !webhookSecret) {
      console.error('缺少 webhook 签名或 secret');
      return res.status(400).json({ error: '缺少 webhook 签名或 secret' });
    }
    
    let event;
    try {
      // 验证签名并解析事件
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook 签名验证失败:', err.message);
      return res.status(400).json({ error: `Webhook 签名验证失败: ${err.message}` });
    }
    
    const { type, data } = event;
    console.log(`收到 Stripe webhook 事件: ${type}`);
    
    // 处理不同类型的webhook事件
    switch (type) {
      case 'checkout.session.completed':
        // 支付成功，更新订阅状态
        try {
          await handlePaymentSuccess(data.object);
        } catch (error) {
          console.error('处理 checkout.session.completed 错误:', error);
          // 不返回错误，避免 Stripe 重试
        }
        break;
      case 'invoice.payment_succeeded':
        // 订阅续费成功
        try {
          await handleSubscriptionRenewal(data.object);
        } catch (error) {
          console.error('处理 invoice.payment_succeeded 错误:', error);
        }
        break;
      case 'invoice.payment_failed':
        // 支付失败，更新订阅状态
        try {
          await handlePaymentFailure(data.object);
        } catch (error) {
          console.error('处理 invoice.payment_failed 错误:', error);
        }
        break;
      case 'customer.subscription.updated':
        // 订阅状态更新
        try {
          await handleSubscriptionUpdate(data.object);
        } catch (error) {
          console.error('处理 customer.subscription.updated 错误:', error);
        }
        break;
      case 'customer.subscription.deleted':
        // 订阅删除
        try {
          await handleSubscriptionDeletion(data.object);
        } catch (error) {
          console.error('处理 customer.subscription.deleted 错误:', error);
        }
        break;
      case 'customer.subscription.trial_will_end':
        // 试用期即将结束
        try {
          await handleTrialEnd(data.object);
        } catch (error) {
          console.error('处理 customer.subscription.trial_will_end 错误:', error);
        }
        break;
      default:
        console.log(`未处理的webhook事件: ${type}`);
    }
    
    // 始终返回成功，避免 Stripe 重试
    return res.json({ received: true });
    
  } catch (error) {
    console.error('处理webhook错误:', error);
    // 即使出错也返回 200，避免 Stripe 无限重试
    return res.status(200).json({ received: true, error: error.message });
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
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    // 检查 metadata 是否存在
    if (!session.metadata || !session.metadata.user_id || !session.metadata.plan_type) {
      console.error('Session metadata 缺失:', session.metadata);
      return;
    }
    
    const userId = session.metadata.user_id;
    const planType = session.metadata.plan_type;
    
    console.log(`处理支付成功: userId=${userId}, planType=${planType}, sessionId=${session.id}`);
    
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
        throw creditError;
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
          status: 'succeeded',
          stripe_session_id: session.id,
          created_at: new Date().toISOString()
        });
      
      if (paymentError) {
        console.error('记录支付记录错误:', paymentError);
        throw paymentError;
      }
      
      console.log(`✅ Lite 充值完成: userId=${userId}`);
      return; // Lite 充值不需要创建订阅
    }
    
    // 订阅计划：需要从 Stripe 获取完整的 subscription 对象
    if (!session.subscription) {
      console.error('❌ 订阅 session 缺少 subscription ID:', {
        session_id: session.id,
        session_mode: session.mode,
        metadata: session.metadata
      });
      return;
    }
    
    console.log(`📋 获取 Stripe 订阅信息: subscription_id=${session.subscription}`);
    
    // 从 Stripe 获取完整的 subscription 对象（使用 expand 确保获取完整数据）
    let subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(session.subscription, {
        expand: ['items.data.price.product']
      });
    } catch (error) {
      console.error('❌ 无法从 Stripe 获取订阅信息:', {
        subscription_id: session.subscription,
        error: error.message,
        error_type: error.type
      });
      return;
    }
    
    if (!subscription) {
      console.error('❌ 订阅对象为空:', session.subscription);
      return;
    }
    
    // 获取订阅周期数据（可能在根级别或 items.data[0] 中）
    let periodStartTimestamp = subscription.current_period_start;
    let periodEndTimestamp = subscription.current_period_end;
    
    // 如果根级别没有，尝试从 items.data[0] 获取
    if (!periodStartTimestamp || !periodEndTimestamp) {
      if (subscription.items && subscription.items.data && subscription.items.data.length > 0) {
        const firstItem = subscription.items.data[0];
        periodStartTimestamp = firstItem.current_period_start || periodStartTimestamp;
        periodEndTimestamp = firstItem.current_period_end || periodEndTimestamp;
      }
    }
    
    console.log(`📋 Stripe 订阅信息:`, {
      subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: periodStartTimestamp,
      current_period_end: periodEndTimestamp,
      cancel_at_period_end: subscription.cancel_at_period_end,
      has_items: !!(subscription.items && subscription.items.data && subscription.items.data.length > 0)
    });
    
    // 验证订阅周期数据
    if (!periodStartTimestamp || !periodEndTimestamp) {
      console.error('❌ 订阅缺少周期数据:', {
        subscription_id: subscription.id,
        current_period_start: periodStartTimestamp,
        current_period_end: periodEndTimestamp,
        subscription_root: {
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end
        },
        subscription_items: subscription.items ? {
          data_length: subscription.items.data?.length,
          first_item: subscription.items.data?.[0] ? {
            current_period_start: subscription.items.data[0].current_period_start,
            current_period_end: subscription.items.data[0].current_period_end
          } : null
        } : null
      });
      return;
    }
    
    // 计算订阅周期（Stripe 返回的是 Unix 时间戳，单位是秒）
    
    // 验证时间戳是否为有效数字
    if (typeof periodStartTimestamp !== 'number' || typeof periodEndTimestamp !== 'number') {
      console.error('❌ 订阅周期时间戳类型错误:', {
        subscription_id: subscription.id,
        current_period_start: periodStartTimestamp,
        current_period_start_type: typeof periodStartTimestamp,
        current_period_end: periodEndTimestamp,
        current_period_end_type: typeof periodEndTimestamp
      });
      return;
    }
    
    const periodStart = new Date(periodStartTimestamp * 1000);
    const periodEnd = new Date(periodEndTimestamp * 1000);
    
    // 验证日期是否有效
    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      console.error('❌ 无效的订阅周期日期:', {
        subscription_id: subscription.id,
        current_period_start_timestamp: periodStartTimestamp,
        current_period_end_timestamp: periodEndTimestamp,
        periodStart: periodStart.toString(),
        periodEnd: periodEnd.toString(),
        periodStart_isNaN: isNaN(periodStart.getTime()),
        periodEnd_isNaN: isNaN(periodEnd.getTime())
      });
      return;
    }
    
    console.log(`✅ 订阅周期验证通过:`, {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    });
    
    // 确定计划类型
    const plan = planType === 'monthly' ? 'monthly' : planType === 'yearly' ? 'yearly' : 'pro';
    
    // 先查询是否已有订阅记录
    const { data: existingSubscription, error: queryError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (queryError && queryError.code !== 'PGRST116') {
      console.error('查询订阅记录错误:', queryError);
      throw queryError;
    }
    
    const subscriptionData = {
      user_id: userId,
      plan: plan,
      status: subscription.status === 'active' ? 'active' : subscription.status,
      stripe_subscription_id: subscription.id,
      start_date: periodStart.toISOString(),
      end_date: periodEnd.toISOString(),
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      updated_at: new Date().toISOString()
    };
    
    let data, error;
    
    if (existingSubscription) {
      // 更新现有订阅记录
      const { data: updatedData, error: updateError } = await supabase
        .from('subscriptions')
        .update(subscriptionData)
        .eq('user_id', userId)
        .select()
        .single();
      
      data = updatedData;
      error = updateError;
    } else {
      // 创建新订阅记录
      const { data: insertedData, error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          ...subscriptionData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      data = insertedData;
      error = insertError;
    }
    
    if (error) {
      console.error('更新订阅状态错误:', error);
      throw error;
    } else {
      console.log(`✅ 用户 ${userId} 订阅成功，计划类型: ${plan}, 状态: ${subscription.status}`);
    }
    
    // 记录支付记录
    const amountTotal = session.amount_total ? session.amount_total / 100 : 0; // 转换为美元
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount_usd: amountTotal,
        currency: session.currency?.toUpperCase() || 'USD',
        plan: plan,
        status: 'succeeded',
        stripe_session_id: session.id,
        created_at: new Date().toISOString()
      });
    
    if (paymentError) {
      console.error('记录支付记录错误:', paymentError);
    }
    
  } catch (error) {
    console.error('处理支付成功错误:', error);
    console.error('错误堆栈:', error.stack);
    // 不抛出错误，避免 webhook 重试
    // 错误已记录，可以手动处理
  }
}

// 处理支付失败
async function handlePaymentFailure(invoice) {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    // invoice.subscription 可能是字符串（subscription ID）或对象
    const subscriptionId = typeof invoice.subscription === 'string' 
      ? invoice.subscription 
      : invoice.subscription?.id;
    
    if (!subscriptionId) {
      console.error('Invoice 缺少 subscription ID:', invoice);
      return;
    }
    
    // 从 Stripe 获取完整的 subscription 对象，以获取实际状态
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    if (!subscription) {
      console.error('无法从 Stripe 获取订阅信息:', subscriptionId);
      return;
    }
    
    // 使用 Stripe 的实际状态（past_due, unpaid, canceled 等）
    const subscriptionStatus = subscription.status;
    
    console.log(`⚠️ 订阅续费失败: subscription_id=${subscription.id}, status=${subscriptionStatus}`);
    
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: subscriptionStatus, // 使用 Stripe 的实际状态
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);
    
    if (error) {
      console.error('更新支付失败状态错误:', error);
    } else {
      console.log(`✅ 订阅状态已更新为: ${subscriptionStatus}`);
    }
  } catch (error) {
    console.error('处理支付失败错误:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 处理订阅续费成功
async function handleSubscriptionRenewal(invoice) {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    // invoice.subscription 可能是字符串（subscription ID）或对象
    const subscriptionId = typeof invoice.subscription === 'string' 
      ? invoice.subscription 
      : invoice.subscription?.id;
    
    if (!subscriptionId) {
      console.error('Invoice 缺少 subscription ID:', invoice);
      return;
    }
    
    // 从 Stripe 获取完整的 subscription 对象（使用 expand 确保获取完整数据）
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price.product']
    });
    
    if (!subscription) {
      console.error('无法从 Stripe 获取订阅信息:', subscriptionId);
      return;
    }
    
    // 获取订阅周期数据（可能在根级别或 items.data[0] 中）
    let periodStartTimestamp = subscription.current_period_start;
    let periodEndTimestamp = subscription.current_period_end;
    
    // 如果根级别没有，尝试从 items.data[0] 获取
    if (!periodStartTimestamp || !periodEndTimestamp) {
      if (subscription.items && subscription.items.data && subscription.items.data.length > 0) {
        const firstItem = subscription.items.data[0];
        periodStartTimestamp = firstItem.current_period_start || periodStartTimestamp;
        periodEndTimestamp = firstItem.current_period_end || periodEndTimestamp;
      }
    }
    
    // 验证订阅周期数据
    if (!periodStartTimestamp || !periodEndTimestamp) {
      console.error('❌ 订阅缺少周期数据:', {
        subscription_id: subscription.id,
        current_period_start: periodStartTimestamp,
        current_period_end: periodEndTimestamp,
        subscription_root: {
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end
        },
        subscription_items: subscription.items ? {
          data_length: subscription.items.data?.length,
          first_item: subscription.items.data?.[0] ? {
            current_period_start: subscription.items.data[0].current_period_start,
            current_period_end: subscription.items.data[0].current_period_end
          } : null
        } : null
      });
      return;
    }
    
    // 计算订阅周期（Stripe 返回的是 Unix 时间戳，单位是秒）
    const currentPeriodStart = new Date(periodStartTimestamp * 1000);
    const currentPeriodEnd = new Date(periodEndTimestamp * 1000);
    
    // 验证日期是否有效
    if (isNaN(currentPeriodStart.getTime()) || isNaN(currentPeriodEnd.getTime())) {
      console.error('无效的订阅周期日期:', {
        subscription_id: subscription.id,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end
      });
      return;
    }
    
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status === 'active' ? 'active' : subscription.status,
        current_period_start: currentPeriodStart.toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end || false,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);
    
    if (error) {
      console.error('更新订阅续费状态错误:', error);
    } else {
      console.log(`✅ 订阅续费成功: subscription_id=${subscription.id}, status=${subscription.status}`);
    }
  } catch (error) {
    console.error('处理订阅续费错误:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 处理订阅状态更新
async function handleSubscriptionUpdate(subscription) {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    // 如果 subscription 是字符串 ID，需要从 Stripe 获取完整对象
    let subscriptionObj = subscription;
    if (typeof subscription === 'string') {
      subscriptionObj = await stripe.subscriptions.retrieve(subscription, {
        expand: ['items.data.price.product']
      });
    }
    
    // 获取订阅周期数据（可能在根级别或 items.data[0] 中）
    let periodStartTimestamp = subscriptionObj.current_period_start;
    let periodEndTimestamp = subscriptionObj.current_period_end;
    
    // 如果根级别没有，尝试从 items.data[0] 获取
    if (!periodStartTimestamp || !periodEndTimestamp) {
      if (subscriptionObj.items && subscriptionObj.items.data && subscriptionObj.items.data.length > 0) {
        const firstItem = subscriptionObj.items.data[0];
        periodStartTimestamp = firstItem.current_period_start || periodStartTimestamp;
        periodEndTimestamp = firstItem.current_period_end || periodEndTimestamp;
      }
    }
    
    if (!periodStartTimestamp || !periodEndTimestamp) {
      console.error('❌ 订阅更新缺少周期数据:', {
        subscription_id: subscriptionObj.id,
        current_period_start: periodStartTimestamp,
        current_period_end: periodEndTimestamp
      });
      return;
    }
    
    const currentPeriodEnd = new Date(periodEndTimestamp * 1000);
    const currentPeriodStart = new Date(periodStartTimestamp * 1000);
    
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: subscriptionObj.status,
        current_period_start: currentPeriodStart.toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        cancel_at_period_end: subscriptionObj.cancel_at_period_end || false,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscriptionObj.id);
    
    if (error) {
      console.error('更新订阅状态错误:', error);
    } else {
      console.log(`✅ 订阅状态更新成功: subscription_id=${subscriptionObj.id}, status=${subscriptionObj.status}`);
    }
  } catch (error) {
    console.error('处理订阅更新错误:', error);
    console.error('错误堆栈:', error.stack);
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
