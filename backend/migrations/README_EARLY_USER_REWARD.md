# 早期用户奖励发放指南

## 📋 概述

本指南说明如何给所有现有用户发放100积分作为早期用户奖励，并发送邮件通知。邮件中包含链接，用户点击后可额外领取50积分。

## ⚠️ 重要提示

**外键约束问题**：
- `user_credits` 表的外键指向 `users` 表（不是 `auth.users`）
- 如果 `auth.users` 中有用户但 `users` 表中没有，需要先同步
- 执行 `award_early_user_credits.sql` 前，建议先执行 `sync_auth_users_to_users.sql` 同步用户

## 🎯 两种方式

### 方式 1：使用 SQL 脚本（推荐，快速）

**适用场景**：只需要发放积分，不需要自动发送邮件

**步骤**：

1. **（可选但推荐）** 如果 `auth.users` 中有用户但 `users` 表中没有，先执行 `sync_auth_users_to_users.sql` 同步用户
2. 在 Supabase Dashboard 中打开 SQL Editor
3. 复制 `award_early_user_credits.sql` 的内容
4. 执行 SQL 脚本
5. 查看执行结果，确认发放成功

**优点**：
- ✅ 快速、简单
- ✅ 避免重复发放（自动检查）
- ✅ 可以查看详细的发放记录

**缺点**：
- ❌ 需要手动发送邮件通知

---

### 方式 2：使用 JavaScript 脚本（完整功能）

**适用场景**：需要自动发放积分并发送邮件通知

**步骤**：

#### 1. 安装邮件依赖（可选）

如果需要发送邮件，需要安装 `nodemailer`：

```bash
cd edu/backend
npm install nodemailer
```

#### 2. 配置环境变量（可选）

在 `.env` 文件中添加邮件配置（如果使用 SMTP）：

```env
# SMTP 配置（可选）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@edunest.app
```

**注意**：
- 如果使用 Gmail，需要生成"应用专用密码"
- 如果使用其他邮件服务，请参考相应的 SMTP 配置

#### 3. 执行脚本

```bash
cd edu/backend
node scripts/award_early_user_credits.js
```

#### 4. 查看执行结果

脚本会输出：
- 总用户数
- 成功发放积分的用户数
- 跳过（已发放）的用户数
- 邮件发送成功/失败的数量

**优点**：
- ✅ 自动发放积分
- ✅ 自动发送邮件通知
- ✅ 详细的执行日志

**缺点**：
- ⚠️ 需要配置邮件服务（可选）
- ⚠️ 如果没有邮件服务，只发放积分不发送邮件

---

## 📧 邮件内容

邮件主题：`EduNest AI Beta Release - Early User Reward`

邮件正文：
```
Dear early user,

It's our pleasure to have you trying our system. EduNest AI has released our beta version.

At the same time we offer each user 100 credits to your account.

🎁 Bonus Offer: Click the link below to claim an additional 50 credits!

Thank you for being part of our journey!

Kind regards,
EduNest AI Team
```

**奖励机制**：
- ✅ 自动发放：100积分（`change_type = 'early_user'`）
- 🎁 链接领取：50积分（`change_type = 'early_user_bonus'`），通过邮件中的链接领取

## 🔗 额外奖励链接

用户点击邮件中的链接后，会调用以下API：

**端点**：`GET /api/early-user-bonus/claim?token=xxx`

**功能**：
- 验证token有效性
- 检查用户是否已领取过额外奖励
- 如果未领取，发放50积分
- 返回领取结果和新的积分余额

**安全机制**：
- Token有效期：30天
- 防重复领取：每个用户只能领取一次
- Token包含用户ID验证，确保只能领取自己的奖励

---

## 🔍 验证发放结果

### 使用 SQL 查询

```sql
-- 查看所有早期用户奖励记录（100积分）
SELECT 
    u.email,
    u.name,
    uc.change_amount,
    uc.created_at,
    (SELECT SUM(change_amount) FROM user_credits WHERE user_id = u.id) as total_credits
FROM user_credits uc
JOIN auth.users u ON u.id = uc.user_id
WHERE uc.change_type = 'early_user'
ORDER BY uc.created_at DESC;

-- 查看额外奖励领取情况（50积分）
SELECT 
    u.email,
    u.name,
    uc.change_amount,
    uc.created_at
FROM user_credits uc
JOIN auth.users u ON u.id = uc.user_id
WHERE uc.change_type = 'early_user_bonus'
ORDER BY uc.created_at DESC;

-- 统计发放情况
SELECT 
    change_type,
    COUNT(*) as total_awarded_users,
    SUM(change_amount) as total_credits_awarded
FROM user_credits
WHERE change_type IN ('early_user', 'early_user_bonus')
GROUP BY change_type;
```

### 使用 API 查询

```bash
# 查询特定用户的积分历史
curl -X GET "https://your-api.com/api/credits/history" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 检查是否已领取额外奖励
curl -X GET "https://your-api.com/api/early-user-bonus/status?userId=USER_ID"

# 领取额外奖励（通过邮件链接中的token）
curl -X GET "https://your-api.com/api/early-user-bonus/claim?token=TOKEN_FROM_EMAIL"
```

---

## ⚠️ 注意事项

1. **备份数据库**：执行前请先备份数据库
2. **避免重复发放**：两种方式都包含重复检查逻辑，不会重复发放
3. **邮件发送**：
   - 如果没有配置邮件服务，JavaScript 脚本会记录日志，需要手动发送邮件
   - 建议先测试邮件发送功能
4. **执行时间**：如果有大量用户，JavaScript 脚本可能需要较长时间（每个用户之间有 100ms 延迟）

---

## 🐛 故障排除

### SQL 脚本执行失败

**错误：`violates foreign key constraint "user_credits_user_id_fkey"`**

**原因**：`user_credits` 表的外键指向 `users` 表，但 SQL 脚本从 `auth.users` 查询用户，导致某些用户不存在于 `users` 表。

**解决方法**：
1. 先执行 `sync_auth_users_to_users.sql` 同步用户
2. 然后再执行 `award_early_user_credits.sql`

**其他常见问题**：
- 检查是否有 `user_credits` 表
- 检查是否有 `users` 表
- 检查是否有足够的权限

### JavaScript 脚本执行失败

- 检查环境变量是否正确配置
- 检查数据库连接是否正常
- 查看日志文件：`logs/combined.log` 和 `logs/error.log`

### 邮件发送失败

- 检查 SMTP 配置是否正确
- 检查网络连接
- 如果使用 Gmail，确保已生成"应用专用密码"
- 如果没有配置邮件服务，脚本会记录日志，可以后续手动发送

---

## 📝 后续操作

1. **手动发送邮件**（如果使用 SQL 脚本）：
   - 从数据库导出用户邮箱列表
   - 使用邮件服务（如 Mailchimp、SendGrid）批量发送

2. **监控积分使用**：
   - 定期检查用户积分余额
   - 分析早期用户的使用情况

3. **用户反馈**：
   - 收集用户对奖励的反馈
   - 根据反馈调整后续活动

---

*最后更新：2025-01-XX*
