# 🌍 Stripe订阅支付配置完整指南

## 📋 当前系统状况分析

### ✅ 已完成的功能

#### 前端 (Frontend)
- ✅ 订阅管理页面 (`/subscription`)
- ✅ 月付/年付选择器（默认选中年付）
- ✅ 价格显示：月付 $29.8/月，年付 $240/年
- ✅ 多语言支持（中英文）
- ✅ 订阅状态显示和管理
- ✅ 支付会话创建和重定向

#### 后端 (Backend)
- ✅ Stripe API 集成
- ✅ 支付会话创建 API (`/api/payments/create-session`)
- ✅ Webhook 事件处理 (`/api/payments/webhook`)
- ✅ 订阅状态管理
- ✅ 多地区支付方式支持
- ✅ 订阅续费、取消、失败处理

### ⚠️ 需要完成的配置

#### 后端代码更新（待完成）
- ❌ 后端目前只支持 `plan_type: 'pro'`，需要支持 `'monthly'` 和 `'yearly'`
- ❌ 后端使用固定的 `STRIPE_PRICE_ID_PRO`，需要根据计划类型动态选择价格ID
- ✅ Webhook 处理逻辑已完整（无需修改）

#### Stripe Dashboard 配置（待完成）
- ❌ 创建月付价格：$29.8/月（Recurring, Monthly）
- ❌ 创建年付价格：$240/年（Recurring, Yearly）
- ❌ 获取并配置两个价格ID到环境变量
- ✅ Webhook 端点配置（如已配置则无需修改）

---

## 🚀 Stripe Dashboard 配置步骤

### 第一步：创建产品和价格

#### 1.1 创建产品

1. 登录 [Stripe Dashboard](https://dashboard.stripe.com/)
2. 进入 **Products** > **Add product**
3. 填写产品信息：
   - **Name**: `Pro Plan`
   - **Description**: `Unlimited AI content generation (Interactive & Animated), unlimited content creation & management, AI content auto-fix, priority support, advanced features`
4. 点击 **Save product**

#### 1.2 创建月付价格（$29.8/月）

1. 在产品页面，点击 **Add pricing**
2. 配置价格：
   - **Pricing model**: `Recurring price`
   - **Price**: `29.80`
   - **Currency**: `USD` (或根据目标市场选择)
   - **Billing period**: `Monthly`
   - **Usage type**: `Licensed`
3. 点击 **Save pricing**
4. **重要**：复制生成的 **Price ID**（以 `price_` 开头），例如：
   ```
   price_1ABC123monthly...
   ```
5. 保存到环境变量：`STRIPE_PRICE_ID_MONTHLY`

#### 1.3 创建年付价格（$240/年）

1. 在同一产品页面，再次点击 **Add pricing**
2. 配置价格：
   - **Pricing model**: `Recurring price`
   - **Price**: `240.00`
   - **Currency**: `USD` (或根据目标市场选择)
   - **Billing period**: `Yearly`
   - **Usage type**: `Licensed`
3. 点击 **Save pricing**
4. **重要**：复制生成的 **Price ID**（以 `price_` 开头），例如：
   ```
   price_1XYZ789yearly...
   ```
5. 保存到环境变量：`STRIPE_PRICE_ID_YEARLY`

### 第二步：配置 Webhook（如未配置）

#### 2.1 创建 Webhook 端点

1. 进入 **Developers** > **Webhooks**
2. 点击 **Add endpoint**
3. 配置端点：
   - **Endpoint URL**: 
     - 生产环境：`https://your-domain.com/api/payments/webhook`
     - 测试环境：使用 Stripe CLI 转发（见下方）
   - **Description**: `Subscription payment webhooks`

#### 2.2 选择 Webhook 事件

选择以下事件（必需）：
- ✅ `checkout.session.completed` - 支付成功
- ✅ `invoice.payment_succeeded` - 订阅续费成功
- ✅ `invoice.payment_failed` - 支付失败
- ✅ `customer.subscription.updated` - 订阅状态更新
- ✅ `customer.subscription.deleted` - 订阅删除
- ✅ `customer.subscription.trial_will_end` - 试用期即将结束（可选）

#### 2.3 获取 Webhook Secret

1. 创建完成后，点击 Webhook 端点
2. 复制 **Signing secret**（以 `whsec_` 开头）
3. 保存到环境变量：`STRIPE_WEBHOOK_SECRET`

#### 2.4 本地开发测试（使用 Stripe CLI）

```bash
# 安装 Stripe CLI
# macOS: brew install stripe/stripe-cli/stripe
# 其他系统: https://stripe.com/docs/stripe-cli

# 登录 Stripe CLI
stripe login

# 转发 Webhook 到本地服务器
stripe listen --forward-to localhost:3001/api/payments/webhook

# 复制输出的 Webhook signing secret（以 whsec_ 开头）
# 保存到 .env 文件的 STRIPE_WEBHOOK_SECRET
```

### 第三步：获取 API 密钥

1. 进入 **Developers** > **API keys**
2. 确认环境模式：
   - **测试模式**：使用 `test` 模式的密钥
   - **生产模式**：使用 `live` 模式的密钥
3. 复制以下密钥：
   - **Publishable key** (以 `pk_test_` 或 `pk_live_` 开头)
   - **Secret key** (以 `sk_test_` 或 `sk_live_` 开头)

---

## 🔧 环境变量配置

### 后端环境变量 (`.env`)

```bash
# Stripe API 密钥
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe 价格ID（必需）
STRIPE_PRICE_ID_MONTHLY=price_1ABC123monthly...
STRIPE_PRICE_ID_YEARLY=price_1XYZ789yearly...

# 保留旧的价格ID（向后兼容，可选）
# STRIPE_PRICE_ID_PRO=price_old_pro_plan...

# 前端URL
FRONTEND_URL=http://localhost:3000
# 生产环境: FRONTEND_URL=https://your-domain.com
```

### 前端环境变量 (`.env.local`)

```bash
# Stripe Publishable Key（前端使用）
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

---

## 💻 后端代码更新（必需）

### 更新 `edu/backend/src/api/payments.js`

需要修改 `create-session` 端点，支持 `monthly` 和 `yearly` 计划类型：

```javascript
// 当前代码（第69行）
if (!plan_type || !['pro'].includes(plan_type)) {
  return res.status(400).json({ error: '不支持的计划类型' });
}

// 需要改为
if (!plan_type || !['monthly', 'yearly'].includes(plan_type)) {
  return res.status(400).json({ error: '不支持的计划类型' });
}

// 当前代码（第132行）
price: process.env.STRIPE_PRICE_ID_PRO,

// 需要改为
price: plan_type === 'monthly' 
  ? process.env.STRIPE_PRICE_ID_MONTHLY 
  : process.env.STRIPE_PRICE_ID_YEARLY,
```

### 完整修改示例

```javascript
router.post('/create-session', authenticateToken, async (req, res) => {
  try {
    const { plan_type, success_url, cancel_url } = req.body;
    const userId = req.user.id;
    
    // ✅ 更新：支持 monthly 和 yearly
    if (!plan_type || !['monthly', 'yearly'].includes(plan_type)) {
      return res.status(400).json({ error: '不支持的计划类型。支持的类型：monthly, yearly' });
    }
    
    // ... 其他代码保持不变 ...
    
    // ✅ 更新：根据计划类型选择价格ID
    const priceId = plan_type === 'monthly' 
      ? process.env.STRIPE_PRICE_ID_MONTHLY 
      : process.env.STRIPE_PRICE_ID_YEARLY;
    
    if (!priceId) {
      return res.status(500).json({ 
        error: `未配置 ${plan_type} 计划的价格ID。请检查环境变量 STRIPE_PRICE_ID_${plan_type.toUpperCase()}` 
      });
    }
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: paymentMethods,
      line_items: [
        {
          price: priceId, // ✅ 使用动态价格ID
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // ... 其他配置保持不变 ...
    });
    
    // ... 返回结果 ...
  } catch (error) {
    // ... 错误处理 ...
  }
});
```

---

## 🧪 测试流程

### 1. 本地开发测试

#### 启动服务

```bash
# 后端服务器
cd edu/backend
npm start
# 运行在 http://localhost:3001

# 前端服务器
cd edu/frontend
npm run dev
# 运行在 http://localhost:3000

# Stripe CLI（转发 Webhook）
stripe listen --forward-to localhost:3001/api/payments/webhook
```

#### 测试步骤

1. **访问订阅页面**：`http://localhost:3000/subscription`
2. **检查价格显示**：
   - 默认应显示年付 $240/年
   - 切换到月付应显示 $29.8/月
3. **测试月付订阅**：
   - 选择月付
   - 点击"升级到Pro"
   - 应重定向到 Stripe Checkout 页面
   - 使用测试卡号：`4242 4242 4242 4242`
   - 任意未来日期、任意CVC
4. **测试年付订阅**：
   - 选择年付
   - 点击"升级到Pro"
   - 应重定向到 Stripe Checkout 页面
   - 使用相同测试卡号完成支付
5. **验证 Webhook**：
   - 支付成功后，检查后端日志
   - 确认订阅状态已更新到数据库
   - 检查 `subscriptions` 表中的记录

### 2. API 测试

```bash
# 测试月付订阅
curl -X POST http://localhost:3001/api/payments/create-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "plan_type": "monthly",
    "success_url": "http://localhost:3000/subscription/success",
    "cancel_url": "http://localhost:3000/subscription/cancel"
  }'

# 测试年付订阅
curl -X POST http://localhost:3001/api/payments/create-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "plan_type": "yearly",
    "success_url": "http://localhost:3000/subscription/success",
    "cancel_url": "http://localhost:3000/subscription/cancel"
  }'
```

### 3. Stripe 测试卡号

- **成功支付**：`4242 4242 4242 4242`
- **需要3D验证**：`4000 0025 0000 3155`
- **支付失败**：`4000 0000 0000 0002`
- **更多测试卡号**：[Stripe 测试卡号文档](https://stripe.com/docs/testing)

---

## 📊 支付方式说明

### 💳 信用卡/借记卡 (card)
- **支持地区**: 全球
- **货币**: 所有货币
- **特点**: 最通用的支付方式

### 🏦 银行转账类
- **SEPA Debit** (EUR): 欧洲银行转账
- **US Bank Account** (USD): 美国银行账户
- **BACS Debit** (GBP): 英国银行转账
- **AU BECS Debit** (AUD): 澳大利亚银行转账
- **ACSS Debit** (CAD): 加拿大银行转账

### 🏪 本地支付
- **iDEAL** (EUR): 荷兰在线银行
- **Sofort** (EUR): 德国即时转账
- **Bancontact** (EUR): 比利时银行卡
- **Konbini** (JPY): 日本便利店支付

---

## ⚠️ 重要注意事项

### 1. 价格ID配置
- ✅ **必须**配置 `STRIPE_PRICE_ID_MONTHLY` 和 `STRIPE_PRICE_ID_YEARLY`
- ❌ 不要混淆月付和年付的价格ID
- ✅ 测试环境和生产环境需要不同的价格ID

### 2. 货币一致性
- 支付方式必须与价格货币匹配
- 如果价格是 USD，支付方式必须支持 USD
- 不同货币需要创建不同的价格

### 3. Webhook 安全
- ✅ 生产环境必须配置 Webhook Secret
- ✅ 验证 Webhook 签名（后端代码已实现）
- ✅ 使用 HTTPS 端点（生产环境）

### 4. 订阅周期
- **月付**：每30天自动续费
- **年付**：每365天自动续费
- Stripe 会自动处理续费，无需额外代码

### 5. 取消订阅
- 用户可以在 Stripe Customer Portal 取消
- 或通过后端 API 取消（代码已实现）
- 取消后，订阅在当前周期结束后失效

---

## 🚀 生产环境部署检查清单

### Stripe 配置
- [ ] 切换到 **Live mode**
- [ ] 创建生产环境的月付价格（$29.8/月）
- [ ] 创建生产环境的年付价格（$240/年）
- [ ] 配置生产环境的 Webhook 端点（HTTPS）
- [ ] 获取生产环境的 API 密钥（`pk_live_` 和 `sk_live_`）
- [ ] 获取生产环境的 Webhook Secret（`whsec_`）

### 环境变量
- [ ] 更新后端 `.env` 文件（生产环境）
- [ ] 更新前端 `.env.local` 文件（生产环境）
- [ ] 确认所有价格ID正确配置
- [ ] 确认 Webhook Secret 正确配置

### 代码更新
- [ ] 更新后端代码支持 `monthly` 和 `yearly`
- [ ] 测试月付订阅流程
- [ ] 测试年付订阅流程
- [ ] 测试 Webhook 事件处理
- [ ] 测试订阅取消功能

### 数据库
- [ ] 确认 `subscriptions` 表结构正确
- [ ] 确认 `payments` 表结构正确
- [ ] 测试订阅状态更新

---

## 📞 支持资源

### Stripe 文档
- [Stripe 订阅文档](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Checkout 文档](https://stripe.com/docs/payments/checkout)
- [Stripe Webhook 文档](https://stripe.com/docs/webhooks)
- [Stripe 测试模式](https://stripe.com/docs/testing)

### 常见问题
- **Q: 如何测试订阅续费？**
  - A: 在 Stripe Dashboard 中，可以手动触发发票支付来测试续费流程

- **Q: 如何查看订阅状态？**
  - A: 在 Stripe Dashboard > Customers > Subscriptions 中查看

- **Q: 如何处理支付失败？**
  - A: Stripe 会自动重试，Webhook 会收到 `invoice.payment_failed` 事件

- **Q: 如何退款？**
  - A: 在 Stripe Dashboard 中手动处理，或通过 API 实现自动退款逻辑

---

## 📝 更新日志

- **2024-01-XX**: 添加月付/年付支持
- **2024-01-XX**: 更新文档，添加完整配置步骤

### 📌 字段值映射关系

| 计划类型 | plan 字段值 | 月付金额 | 年付金额 | Stripe Price ID |
|---------|------------|---------|---------|----------------|
| 月付 | `monthly` | $29.8 | - | `STRIPE_PRICE_ID_MONTHLY` |
| 年付 | `yearly` | - | $240 | `STRIPE_PRICE_ID_YEARLY` |
| 兼容值 | `pro` | $29.8 | - | 迁移为 `monthly` |
| 轻量版 | `lite` | - | - | 保留（如需要） |

### 📊 相关表结构详细说明

#### `subscriptions` 表
根据 `DataStructure.md`，当前结构：
- `id` (uuid, PRIMARY KEY)
- `user_id` (uuid) - 用户ID
- `plan` (text, NOT NULL) - **需要更新值域**
- `status` (text, default 'active')
- `start_date` (timestamp with time zone)
- `end_date` (timestamp with time zone)
- `current_period_start` (timestamp with time zone)
- `current_period_end` (timestamp with time zone)
- `cancel_at_period_end` (boolean, default false)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

**需要添加的字段**：
- `stripe_subscription_id` (TEXT) - Stripe 订阅ID，用于 Webhook 事件处理

**需要更新的字段**：
- `plan` (TEXT) - 值域从 `['lite', 'pro']` 扩展为 `['lite', 'monthly', 'yearly', 'pro']`

#### `payments` 表
根据 `DataStructure.md`，当前结构：
- `id` (uuid, PRIMARY KEY)
- `user_id` (uuid) - 用户ID
- `amount_usd` (numeric, NOT NULL) - **需要根据计划类型存储正确金额**
- `currency` (text, default 'USD')
- `plan` (text) - **需要支持 'monthly' 和 'yearly'**
- `status` (text, default 'pending')
- `stripe_session_id` (text)
- `created_at` (timestamp with time zone)

**更新需求：**
- `plan` 字段值域扩展为 `['monthly', 'yearly', 'lite', 'pro']`
- `amount_usd` 字段需要根据计划类型存储：
  - `monthly`: 29.80
  - `yearly`: 240.00

#### 其他相关表（无需变更）
- **`user_credits`** - 无需变更，订阅用户不受积分限制
- **`ai_usage_logs`** - 无需变更，订阅检查在业务逻辑层处理
- **`collection_lists`** - 无需变更，订阅检查在业务逻辑层处理

## 💰 Lite 充值功能说明

### 功能概述

Lite 充值是一个一次性支付选项，用户支付 $10 即可获得 500 积分，用于 AI 内容生成。

### 实现细节

#### 前端实现
- 在订阅页面添加了 Lite 充值选项卡片
- 显示价格：$10
- 显示功能：获得 500 积分，一次性支付，无需订阅
- 点击"充值积分"按钮触发支付流程

#### 后端实现
- **支付模式**：使用 Stripe Checkout 的 `payment` 模式（一次性支付），而非 `subscription` 模式
- **价格设置**：使用 `price_data` 动态创建价格，无需在 Stripe Dashboard 中预先创建价格
- **Webhook 处理**：支付成功后，自动添加 500 积分到用户账户
- **支付记录**：在 `payments` 表中记录支付信息，`plan='lite'`, `amount_usd=10.00`

#### 积分添加逻辑
```javascript
// 在 handlePaymentSuccess 函数中
if (planType === 'lite') {
  // 添加500积分
  await DatabaseService.addCreditChange(
    userId,
    'purchase_bonus', // 充值类型
    500, // 500积分
    null, // related_user_id
    null  // related_content_id
  );
  
  // 记录支付记录
  await supabase.from('payments').insert({
    user_id: userId,
    amount_usd: 10.00,
    currency: 'USD',
    plan: 'lite',
    status: 'success',
    stripe_session_id: session.id,
  });
}
```

### 数据库影响

#### `user_credits` 表
- 新增记录：`change_type='purchase_bonus'`, `change_amount=500`
- 用于记录 Lite 充值获得的积分

#### `payments` 表
- 新增记录：`plan='lite'`, `amount_usd=10.00`, `status='success'`
- 用于记录 Lite 充值支付历史

### 测试步骤

1. **访问订阅页面**：`http://localhost:3000/subscription`
2. **查看 Lite 充值选项**：
   - 应显示蓝色卡片，标题为 "Lite 充值"
   - 显示价格 $10
   - 显示功能说明：获得 500 积分，一次性支付，无需订阅
3. **测试充值流程**：
   - 点击"充值积分"按钮
   - 应重定向到 Stripe Checkout 页面（一次性支付模式）
   - 使用测试卡号：`4242 4242 4242 4242`
   - 完成支付
4. **验证结果**：
   - 检查后端日志，确认积分已添加
   - 查询 `user_credits` 表，确认有 `change_type='purchase_bonus'`, `change_amount=500` 的记录
   - 查询 `payments` 表，确认有 `plan='lite'`, `amount_usd=10.00` 的记录
   - 检查用户积分余额是否增加了 500

### 注意事项

1. **无需 Stripe 价格配置**：Lite 充值使用动态 `price_data`，不需要在 Stripe Dashboard 中创建价格
2. **一次性支付**：使用 `payment` 模式，不是 `subscription` 模式
3. **积分立即到账**：支付成功后，积分会立即添加到用户账户
4. **可重复充值**：用户可以多次充值，每次充值都会获得 500 积分
