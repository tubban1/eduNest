# 🚀 Stripe配置完整指南

## 📋 概述

本指南将帮助您完成Stripe的完整配置，解决支付会话创建失败的问题。

## 🔑 第一步：获取Stripe API密钥

### 1. 登录Stripe Dashboard
- 访问：https://dashboard.stripe.com/
- 使用您的Stripe账户登录

### 2. 获取API密钥
- 进入 **Developers** > **API keys**
- 复制以下密钥：
  - **Publishable key** (以 `pk_test_` 或 `pk_live_` 开头)
  - **Secret key** (以 `sk_test_` 或 `sk_live_` 开头)

### 3. 确认环境
- **测试环境**: 使用 `test` 模式的密钥
- **生产环境**: 使用 `live` 模式的密钥

## 🏷️ 第二步：创建产品和价格

### 1. 创建产品
- 进入 **Products** > **Add product**
- 产品名称：`Pro Plan`
- 产品描述：`Unlimited AI usage, priority support, advanced features`

### 2. 创建价格
- 点击 **Add pricing**
- 价格类型：`Recurring price`
- 计费周期：`Monthly`
- 价格：`$20.00 USD`
- 复制生成的 **Price ID** (以 `price_` 开头)

## 🔗 第三步：配置Webhook

### 1. 创建Webhook端点
- 进入 **Developers** > **Webhooks**
- 点击 **Add endpoint**
- 端点URL：`https://your-domain.com/api/payments/webhook`
- 本地开发：`http://localhost:3001/api/payments/webhook`

### 2. 选择事件
选择以下事件：
- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`

### 3. 获取Webhook Secret
- 创建完成后，点击Webhook端点
- 复制 **Signing secret** (以 `whsec_` 开头)

## 🌐 第四步：配置环境变量

### 1. 后端环境变量 (.env)
```bash
# Stripe支付配置
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_PRICE_ID_PRO=price_your_pro_plan_price_id_here

# 前端URL配置
FRONTEND_URL=http://localhost:3000
```

### 2. 前端环境变量 (.env.local)
```bash
# 前端Stripe配置
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

## 🧪 第五步：测试配置

### 1. 运行配置检查脚本
```bash
cd edu/backend
node check-stripe-config.js
```

### 2. 测试Stripe连接
```bash
# 测试后端API
curl -X POST http://localhost:3001/api/payments/create-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"plan_type": "pro"}'
```

### 3. 测试Webhook
```bash
# 使用Stripe CLI测试webhook
stripe listen --forward-to localhost:3001/api/payments/webhook
```

## 🐛 常见问题解决

### 问题1: "Invalid API key provided"
**解决方案**: 检查 `STRIPE_SECRET_KEY` 是否正确设置

### 问题2: "No such price: 'price_xxx'"
**解决方案**: 检查 `STRIPE_PRICE_ID_PRO` 是否与Stripe Dashboard中的价格ID匹配

### 问题3: "Invalid webhook signature"
**解决方案**: 检查 `STRIPE_WEBHOOK_SECRET` 是否正确

### 问题4: "CORS error"
**解决方案**: 确保 `FRONTEND_URL` 在CORS允许列表中

## 🔒 安全注意事项

### 1. 密钥安全
- 永远不要将Secret Key提交到代码仓库
- 在生产环境中使用环境变量
- 定期轮换API密钥

### 2. Webhook安全
- 验证Webhook签名
- 使用HTTPS端点
- 限制Webhook访问

### 3. 测试vs生产
- 开发时使用测试密钥
- 部署前切换到生产密钥
- 使用不同的Webhook端点

## 📱 前端集成检查

### 1. 检查Stripe.js加载
```javascript
// 确保Stripe.js正确加载
import { loadStripe } from '@stripe/stripe-js';
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
```

### 2. 检查组件导入
```javascript
// 确保Stripe组件正确导入
import { Elements, PaymentElement } from '@stripe/react-stripe-js';
```

### 3. 检查环境变量
```javascript
// 检查环境变量是否正确加载
console.log('Stripe Key:', process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
```

## 🚀 部署检查清单

### 本地开发
- [ ] Stripe测试密钥已配置
- [ ] Webhook端点可访问
- [ ] 环境变量已设置
- [ ] 支付流程测试通过

### 生产部署
- [ ] Stripe生产密钥已配置
- [ ] HTTPS Webhook端点已配置
- [ ] 生产环境变量已设置
- [ ] 支付流程生产测试通过

## 📞 技术支持

如果仍然遇到问题：

1. **检查Stripe Dashboard日志**
2. **查看后端服务器日志**
3. **验证网络连接和防火墙设置**
4. **联系Stripe技术支持**

## 🔍 调试技巧

### 1. 启用详细日志
```javascript
// 在支付API中添加详细日志
console.log('Stripe配置:', {
  secretKey: process.env.STRIPE_SECRET_KEY?.substring(0, 10) + '...',
  priceId: process.env.STRIPE_PRICE_ID_PRO,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 10) + '...'
});
```

### 2. 测试Stripe连接
```javascript
// 测试Stripe连接
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
stripe.customers.list({ limit: 1 })
  .then(customers => console.log('Stripe连接成功'))
  .catch(error => console.error('Stripe连接失败:', error));
```

### 3. 验证Webhook
```bash
# 使用Stripe CLI测试webhook
stripe trigger checkout.session.completed
```
