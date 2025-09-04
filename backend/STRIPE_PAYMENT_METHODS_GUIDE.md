# 🌍 Stripe支付方式配置指南

## 📋 概述

本指南介绍如何在测试环境中配置不同的支付方式，以适应不同国家的用户需求。

## 🏦 支持的货币和支付方式

### 💰 USD (美元)
- **支付方式**: `card`, `us_bank_account`
- **适用地区**: 美国
- **配置**: `STRIPE_CURRENCY=usd`

### 💶 EUR (欧元)
- **支付方式**: `card`, `sepa_debit`, `ideal`, `sofort`, `bancontact`
- **适用地区**: 欧洲
- **配置**: `STRIPE_CURRENCY=eur`

### 💷 GBP (英镑)
- **支付方式**: `card`, `bacs_debit`
- **适用地区**: 英国
- **配置**: `STRIPE_CURRENCY=gbp`

### 💴 JPY (日元)
- **支付方式**: `card`, `konbini`
- **适用地区**: 日本
- **配置**: `STRIPE_CURRENCY=jpy`

### 💵 AUD (澳元)
- **支付方式**: `card`, `au_becs_debit`
- **适用地区**: 澳大利亚
- **配置**: `STRIPE_CURRENCY=aud`

### 💵 CAD (加元)
- **支付方式**: `card`, `acss_debit`
- **适用地区**: 加拿大
- **配置**: `STRIPE_CURRENCY=cad`

## 🔧 配置步骤

### 1. 环境变量配置

在 `.env` 文件中设置货币：

```bash
# 美元配置
STRIPE_CURRENCY=usd

# 欧元配置
STRIPE_CURRENCY=eur

# 英镑配置
STRIPE_CURRENCY=gbp
```

### 2. Stripe Dashboard配置

#### 创建对应货币的价格

1. 登录 [Stripe Dashboard](https://dashboard.stripe.com/)
2. 进入 **Products** > **Add product**
3. 设置产品名称和描述
4. 在 **Pricing** 中选择对应货币
5. 设置价格（例如：20 EUR, 20 USD）
6. 保存产品

#### 更新环境变量

```bash
# 欧元价格ID示例
STRIPE_PRICE_ID_PRO=price_1S2IUJRZHmumwvWUtXo7inwKl21NHFOsgMT0clqnFV08MstMnDTs1u5NYwOdfA2Gwi7BpqCz77we1IlOO8Cwr0un00iP7hdyak
```

### 3. 重启服务器

```bash
# 停止服务器
pkill -f "node.*server.js"

# 重启服务器
npm start
```

## 🧪 测试不同配置

### 测试脚本

运行测试脚本查看当前配置：

```bash
node test-payment-methods.js
```

### API测试

测试支付会话创建：

```bash
curl -X POST http://localhost:3001/api/payments/create-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"plan_type": "pro"}'
```

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

## ⚠️ 注意事项

1. **货币一致性**: 支付方式必须与价格货币匹配
2. **地区限制**: 某些支付方式只在特定地区可用
3. **测试模式**: 在测试环境中，所有支付方式都可以模拟
4. **生产环境**: 需要根据实际业务地区选择合适的支付方式

## 🚀 生产环境建议

### 多货币策略
1. **按地区分价格**: 为不同地区创建不同货币的价格
2. **动态配置**: 根据用户IP或偏好动态选择支付方式
3. **A/B测试**: 测试不同支付方式的转化率

### 用户体验优化
1. **本地化**: 显示用户熟悉的支付方式
2. **简化流程**: 减少支付步骤
3. **错误处理**: 提供清晰的错误信息

## 📞 支持

如有问题，请参考：
- [Stripe支付方式文档](https://stripe.com/docs/payments/payment-methods)
- [Stripe货币支持](https://stripe.com/docs/currencies)
- [Stripe测试模式](https://stripe.com/docs/testing)
