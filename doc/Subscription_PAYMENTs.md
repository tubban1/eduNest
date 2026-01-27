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
- ✅ Lite 充值功能（积分购买）：$10 获得 500 积分，集成在积分历史对话框中

#### 后端 (Backend)
- ✅ Stripe API 集成
- ✅ 支付会话创建 API (`/api/payments/create-session`)
- ✅ Webhook 事件处理 (`/api/payments/webhook`)
- ✅ 订阅状态管理
- ✅ 多地区支付方式支持
- ✅ 订阅续费、取消、失败处理
- ✅ Lite 充值功能：支持一次性支付 $10 获得 500 积分（无需 Stripe Price ID）

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

**⚠️ 重要：确认当前模式**

1. 登录 [Stripe Dashboard](https://dashboard.stripe.com/)
2. **检查右上角模式切换器**：
   - 应该显示 **"Test mode"**（测试模式）或 **"Live mode"**（生产模式）
   - 测试环境必须使用 **"Test mode"**
   - 如果没有看到模式切换器，点击右上角的切换按钮
3. 进入 **Products** > **Add product**
4. 填写产品信息：
   - **Name**: `Pro Plan`
   - **Description**: `Unlimited AI content generation (Interactive & Animated), unlimited content creation & management, AI Guide (AI Teacher) for personalized learning assistance, AI Learning Analysis for time-aware learning trajectory insights, AI content auto-fix, priority support, advanced features`
5. 点击 **Save product**

**注意**：Stripe 没有 "sandbox" 模式，只有 "Test mode" 和 "Live mode"。确保在正确的模式下创建产品。

#### 1.2 创建月付价格（$29.8/月）

**⚠️ 重要：确保在正确的模式下创建价格**

1. **确认当前模式**：
   - 在 Stripe Dashboard 右上角，确认当前是 **Test mode**（测试模式）还是 **Live mode**（生产模式）
   - 测试环境必须使用 **Test mode** 创建的价格
   - 生产环境必须使用 **Live mode** 创建的价格

2. 在产品页面，点击 **Add pricing**
3. 配置价格：
   - **Pricing model**: `Recurring price`
   - **Price**: `29.80`
   - **Currency**: `USD` (或根据目标市场选择)
   - **Billing period**: `Monthly`
   - **Usage type**: `Licensed`
4. 点击 **Save pricing**
5. **重要**：复制生成的 **Price ID**（以 `price_` 开头），例如：
   ```
   price_1ABC123monthly...
   ```
   - ⚠️ **测试模式和生产模式的价格ID不同**，即使价格相同
   - 确保使用的价格ID与 `STRIPE_SECRET_KEY` 的模式匹配：
     - `sk_test_...` → 使用测试模式的价格ID
     - `sk_live_...` → 使用生产模式的价格ID
6. 保存到环境变量：`STRIPE_PRICE_ID_MONTHLY`

#### 1.3 创建年付价格（$240/年）

**⚠️ 重要：确保在正确的模式下创建价格**

1. **确认当前模式**：
   - 在 Stripe Dashboard 右上角，确认当前是 **Test mode**（测试模式）还是 **Live mode**（生产模式）
   - 测试环境必须使用 **Test mode** 创建的价格
   - 生产环境必须使用 **Live mode** 创建的价格

2. 在同一产品页面，再次点击 **Add pricing**
3. 配置价格：
   - **Pricing model**: `Recurring price`
   - **Price**: `240.00`
   - **Currency**: `USD` (或根据目标市场选择)
   - **Billing period**: `Yearly`
   - **Usage type**: `Licensed`
4. 点击 **Save pricing**
5. **重要**：复制生成的 **Price ID**（以 `price_` 开头），例如：
   ```
   price_1XYZ789yearly...
   ```
   - ⚠️ **测试模式和生产模式的价格ID不同**，即使价格相同
   - 确保使用的价格ID与 `STRIPE_SECRET_KEY` 的模式匹配：
     - `sk_test_...` → 使用测试模式的价格ID
     - `sk_live_...` → 使用生产模式的价格ID
6. 保存到环境变量：`STRIPE_PRICE_ID_YEARLY`

#### 1.4 Lite 充值功能说明

**重要**：Lite 充值功能（$10 获得 500 积分）**不需要**在 Stripe Dashboard 中创建价格。

**原因**：
- Lite 充值是一次性支付（`mode: 'payment'`），不是订阅
- 后端代码使用动态 `price_data` 创建价格，无需预先配置 Price ID
- 支付成功后，Webhook 会自动添加 500 积分到用户账户

**功能特点**：
- ✅ 价格：$10 USD
- ✅ 获得积分：500 积分
- ✅ 支付类型：一次性支付（One-time payment）
- ✅ 无需订阅：不会创建订阅记录
- ✅ 可重复购买：用户可以多次充值
- ✅ 即时到账：支付成功后立即添加积分

**实现位置**：
- 前端：`CreditsHistoryDialog.tsx` - 积分历史对话框中的充值按钮
- 后端：`payments.js` - `create-session` 端点支持 `plan_type: 'lite'`
- Webhook：`payments.js` - `handlePaymentSuccess` 函数处理 Lite 充值

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

**⚠️ 重要：macOS 用户需要先安装 Command Line Tools 和接受 Xcode 许可证**

**步骤 1：安装 Command Line Tools（macOS Sequoia 必需）**

如果遇到 "Xcode alone is not sufficient on Sequoia" 错误，请先安装 Command Line Tools：

```bash
# 安装 Command Line Tools（会弹出安装对话框）
xcode-select --install
```

**步骤 2：接受 Xcode 许可证**

如果遇到 "You have not agreed to the Xcode license" 错误，请执行：

```bash
# 接受 Xcode 许可证（需要管理员权限）
sudo xcodebuild -license accept
```

**步骤 3：安装 Stripe CLI**

完成上述步骤后，继续安装 Stripe CLI：

```bash
# 安装 Stripe CLI
# macOS: brew install stripe/stripe-cli/stripe
# 其他系统: https://stripe.com/docs/stripe-cli

# 如果安装后提示 "it's just not linked"，执行链接命令：
brew link stripe/stripe-cli/stripe

# 验证安装（如果命令不可用，可能需要重启终端或执行 source ~/.zshrc）
stripe --version

# 登录 Stripe CLI
stripe login

# 转发 Webhook 到本地服务器
stripe listen --forward-to localhost:3001/api/payments/webhook

# 复制输出的 Webhook signing secret（以 whsec_ 开头）
# 例如：whsec_6b006d867a73de50cb4812821593cd4f1ae8cb58de1538a3542b9c08c15d0da6
# 保存到 .env 文件的 STRIPE_WEBHOOK_SECRET

# ⚠️ 注意：
# 1. 如果看到 websocket 错误（i/o timeout），这通常不影响功能
#    Stripe CLI 会自动重连，webhook 事件仍会正常转发
# 2. 每次运行 `stripe listen` 都会生成新的 webhook secret
#    如果重启 Stripe CLI，需要更新 .env 文件中的 STRIPE_WEBHOOK_SECRET
# 3. 保持此终端窗口运行，不要关闭，否则 webhook 转发会停止
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

### ✅ Webhook 安全验证（已完成）

**重要**：已添加 Stripe webhook 签名验证，确保 webhook 请求来自 Stripe：

1. **`edu/backend/src/server.js`**：添加了原始请求体处理（在 `express.json()` 之前）
   ```javascript
   // Stripe webhook 需要原始请求体来验证签名
   app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
   ```

2. **`edu/backend/src/api/payments.js`**：添加了 `stripe.webhooks.constructEvent()` 签名验证
   ```javascript
   const sig = req.headers['stripe-signature'];
   const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
   event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
   ```

**配置要求**：
- ✅ 必须配置 `STRIPE_WEBHOOK_SECRET` 环境变量
- ✅ Webhook 端点会自动验证所有请求的签名
- ✅ 签名验证失败会返回 400 错误

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
    
    // ✅ 更新：根据计划类型选择支付模式
    let sessionConfig;
    
    if (plan_type === 'lite') {
      // Lite 充值：一次性支付，使用动态 price_data
      sessionConfig = {
        payment_method_types: paymentMethods,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Lite Top-up',
                description: '500 credits',
              },
              unit_amount: 1000, // $10.00 (以分为单位)
            },
            quantity: 1,
          },
        ],
        mode: 'payment', // 一次性支付
        // ... 其他配置保持不变 ...
      };
    } else {
      // 订阅计划：使用预配置的价格ID
      const priceId = plan_type === 'monthly' 
        ? process.env.STRIPE_PRICE_ID_MONTHLY 
        : process.env.STRIPE_PRICE_ID_YEARLY;
      
      if (!priceId) {
        return res.status(500).json({ 
          error: `未配置 ${plan_type} 计划的价格ID。请检查环境变量 STRIPE_PRICE_ID_${plan_type.toUpperCase()}` 
        });
      }
      
      sessionConfig = {
        payment_method_types: paymentMethods,
        line_items: [
          {
            price: priceId, // ✅ 使用预配置的价格ID
            quantity: 1,
          },
        ],
        mode: 'subscription', // 订阅模式
        // ... 其他配置保持不变 ...
      };
    }
    
    const session = await stripe.checkout.sessions.create(sessionConfig);
    
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
5. **测试 Lite 充值**：
   - 打开积分历史对话框（点击积分余额）
   - 点击"Lite Top-up"按钮
   - 应重定向到 Stripe Checkout 页面（显示 $10）
   - 使用测试卡号：`4242 4242 4242 4242` 完成支付
   - 支付成功后，检查积分余额是否增加 500 积分
   - 检查 `user_credits` 表中是否有 `change_type: 'purchase_bonus'` 的记录
   - 检查 `payments` 表中是否有 `plan: 'lite'` 的记录
6. **验证 Webhook**：
   - 支付成功后，检查后端日志
   - 确认订阅状态已更新到数据库（订阅支付）
   - 确认积分已添加到账户（Lite 充值）
   - 检查 `subscriptions` 表中的记录（订阅支付）
   - 检查 `payments` 表中的记录（所有支付）

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

# 测试 Lite 充值（积分购买）
curl -X POST http://localhost:3001/api/payments/create-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "plan_type": "lite",
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
- ⚠️ **关键**：价格ID必须与API密钥模式匹配
  - 如果 `STRIPE_SECRET_KEY` 是 `sk_test_...`，必须使用**测试模式**创建的价格ID
  - 如果 `STRIPE_SECRET_KEY` 是 `sk_live_...`，必须使用**生产模式**创建的价格ID
  - **错误示例**：`No such price: 'price_xxx'; a similar object exists in live mode, but a test mode key was used`
    - **原因**：使用了生产模式的价格ID，但API密钥是测试模式
    - **解决**：在 Stripe Dashboard 切换到测试模式，创建对应的价格，使用测试模式的价格ID

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

## 📊 数据库结构要求

### 当前状态

⚠️ **重要说明**：目前 `subscriptions` 和 `payments` 表尚未开始使用，没有历史数据需要迁移，也没有旧的 'pro' 账号标记。可以直接使用新的计划类型。

### 数据库表结构要求

#### 1. `subscriptions` 表

**必需字段：**

```sql
-- 确保 subscriptions 表包含以下字段：

-- 基础字段（通常已存在）
id UUID PRIMARY KEY
user_id UUID NOT NULL
plan TEXT NOT NULL  -- 计划类型：'monthly' 或 'yearly'
status TEXT DEFAULT 'active'  -- 状态：'active', 'cancelled', 'past_due' 等
start_date TIMESTAMP WITH TIME ZONE
end_date TIMESTAMP WITH TIME ZONE
current_period_start TIMESTAMP WITH TIME ZONE
current_period_end TIMESTAMP WITH TIME ZONE
cancel_at_period_end BOOLEAN DEFAULT false
created_at TIMESTAMP WITH TIME ZONE
updated_at TIMESTAMP WITH TIME ZONE

-- 新增必需字段（如果不存在，需要添加）
stripe_subscription_id TEXT  -- Stripe 订阅 ID（用于管理订阅）
```

**添加 stripe_subscription_id 字段（如果不存在）：**

```sql
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- 添加注释
COMMENT ON COLUMN subscriptions.plan IS 
  '订阅计划类型: monthly (月付$29.8), yearly (年付$240)';
COMMENT ON COLUMN subscriptions.stripe_subscription_id IS 
  'Stripe 订阅 ID，用于通过 Stripe API 管理订阅';
```

#### 2. `payments` 表

**必需字段：**

```sql
-- 确保 payments 表包含以下字段：

-- 基础字段（通常已存在）
id UUID PRIMARY KEY
user_id UUID NOT NULL
plan TEXT  -- 计划类型：'monthly' 或 'yearly'
amount DECIMAL(10, 2)  -- 支付金额
currency TEXT DEFAULT 'USD'
status TEXT  -- 支付状态：'pending', 'succeeded', 'failed'
stripe_payment_intent_id TEXT  -- Stripe 支付意图 ID
stripe_session_id TEXT  -- Stripe Checkout Session ID
created_at TIMESTAMP WITH TIME ZONE
updated_at TIMESTAMP WITH TIME ZONE

-- 添加注释
COMMENT ON COLUMN payments.plan IS 
  '支付计划类型: monthly (月付$29.8), yearly (年付$240)';
```

### 📝 代码中需要更新的查询

**需要修改的文件：**

1. **`edu/backend/src/services/database.js`**
   ```javascript
   // 更新计划类型检查，支持 'monthly' 和 'yearly'
   // 如果代码中有 .in('plan', ['lite', 'pro'])，需要改为：
   .in('plan', ['lite', 'monthly', 'yearly'])
   ```

2. **`edu/backend/src/api/ai.js`** (第55行)
   ```javascript
   // 更新订阅检查逻辑
   // 从：
   if (subscription && subscription.plan === 'pro')
   
   // 改为：
   if (subscription && (subscription.plan === 'monthly' || subscription.plan === 'yearly'))
   
   // 或者创建辅助函数：
   function isProPlan(plan) {
     return plan === 'monthly' || plan === 'yearly';
   }
   ```

3. **`edu/backend/src/services/asyncGenerationQueue.js`**
   ```javascript
   // 更新订阅检查
   // 从：
   if (!subscription || subscription.plan !== 'pro')
   
   // 改为：
   if (!subscription || !isProPlan(subscription.plan))
   ```

4. **`edu/backend/src/api/content_fix.js`**
   ```javascript
   // 更新订阅检查
   // 从：
   if (!subscription || subscription.plan !== 'pro')
   
   // 改为：
   if (!subscription || !isProPlan(subscription.plan))
   ```

5. **`edu/backend/src/api/payments.js`**
   ```javascript
   // 确保 Webhook 处理时，将 plan_type 写入 plan 字段：
   plan: session.metadata.plan_type, // 'monthly' 或 'yearly'
   stripe_subscription_id: subscription.id, // Stripe 订阅 ID
   ```

### 🔄 数据库初始化脚本

创建初始化脚本 `edu/backend/migrations/init_subscription_tables.sql`（如果表不存在）：

```sql
-- ============================================
-- 订阅和支付表初始化脚本
-- ============================================

-- 1. 确保 subscriptions 表有 stripe_subscription_id 字段
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- 2. 添加字段注释
COMMENT ON COLUMN subscriptions.plan IS 
  '订阅计划类型: monthly (月付$29.8), yearly (年付$240)';
COMMENT ON COLUMN subscriptions.stripe_subscription_id IS 
  'Stripe 订阅 ID，用于通过 Stripe API 管理订阅';

COMMENT ON COLUMN payments.plan IS 
  '支付计划类型: monthly (月付$29.8), yearly (年付$240), lite (充值$10获得500积分)';

-- 3. 验证表结构
DO $$
BEGIN
    RAISE NOTICE '✅ 订阅表结构检查完成';
    RAISE NOTICE '📊 subscriptions 表字段已确认';
    RAISE NOTICE '📊 payments 表字段已确认';
END $$;
```

### 📋 实施检查清单

#### 数据库检查
- [ ] 确认 `subscriptions` 表存在
- [ ] 确认 `subscriptions` 表有 `stripe_subscription_id` 字段（如不存在则添加）
- [ ] 确认 `payments` 表存在
- [ ] 确认 `plan` 字段支持 'monthly' 和 'yearly' 值

#### 代码更新
- [ ] 更新 `database.js` 中的计划类型检查（支持 'monthly', 'yearly'）
- [ ] 更新 `ai.js` 中的订阅检查逻辑
- [ ] 更新 `asyncGenerationQueue.js` 中的订阅检查
- [ ] 更新 `content_fix.js` 中的订阅检查
- [ ] 更新 `payments.js` 中的字段映射（确保写入正确的 plan 值）
- [ ] 更新 `ai_guide.js` 中的订阅检查（已支持 'monthly', 'yearly'）

#### 测试验证
- [ ] 测试月付订阅创建
- [ ] 测试年付订阅创建
- [ ] 测试订阅状态查询
- [ ] 测试订阅权限检查（AI 生成、内容修复等）
- [ ] 验证 Webhook 正确处理订阅数据

### 🎯 实施建议

**由于没有历史数据，可以直接使用新的计划类型：**

1. **统一使用 `plan` 字段**，值域为 `['monthly', 'yearly', 'lite']`
2. **不需要保留 'pro' 值**（因为没有历史数据）
3. **确保所有代码检查逻辑**使用 `plan === 'monthly' || plan === 'yearly'`（订阅计划检查）
4. **Webhook 处理时**，直接将 `plan_type` 写入 `plan` 字段
5. **Lite 充值处理**：
   - `plan_type: 'lite'` 时，创建一次性支付会话（`mode: 'payment'`）
   - 支付成功后，添加 500 积分到 `user_credits` 表（`change_type: 'purchase_bonus'`）
   - 记录支付到 `payments` 表（`plan: 'lite'`, `amount_usd: 10.00`）
   - **不创建订阅记录**（Lite 充值不是订阅）

---

## 📝 更新日志

- **2024-01-XX**: 添加月付/年付支持
- **2024-01-XX**: 更新文档，添加完整配置步骤
- **2024-01-XX**: 添加数据库结构更新需求分析