# 🚀 用户体系与数据结构设计

## 1️⃣ 用户完整路径与交互逻辑

1. **注册 → 免费体验**

   * 注册成功后系统自动生成唯一 **推荐码 (referral\_code)**。
   * 新用户初始获得 **3 积分**（可用 3 次 AI 体验）。

2. **推荐 → 裂变增长**

   * 用户分享自己的推荐码或专属邀请链接：
     `https://yourapp.com/signup?ref=ABC123`
    推荐码用nanoid生成。

   * 新用户通过该推荐码注册：

     * 新用户获得初始 **3 积分**。
     * 推荐人获得 **3 积分**（即时奖励）。

   * 每累计 **成功邀请 5 人**：推荐人额外获得 **10 积分**（里程碑奖励）。

   > 📌 推荐奖励 **即时叠加 + 里程碑额外**，例如：
   >
   > * 邀请 1 人 → +3
   > * 邀请 5 人 → 5×3 +10 = +25
   > * 邀请 6 人 → +28
   > * 邀请 10 人 → 10×3 +20 = +50

3. **使用 → 积分消耗**

   * 每次成功(ai_usage_logs.is_json_valid=true)调用 AI（生成 / 修改）消耗 **1 积分**。
   * 积分不足时，提示「邀请好友获得积分」或「升级订阅」。

4. **付费 → 升级订阅**

   * 用户可通过 **Stripe 支付**升级：

     * **Lite**：\$5（20Credits，满足中轻度用户）。
     * **Pro**：\$20/月（无限使用，适合重度用户）。
   * 订阅成功后，写入 `subscriptions` 表，若需要可赠送积分作为奖励。

5. **订阅管理 → 生命周期**

   * 系统定期检查订阅有效期，到期自动恢复为 `free` 用户。
   * 推荐满 5 人 → 系统自动发放 10 积分（无需支付记录）。

---

## 2️⃣ 数据结构设计（修正版）

### users（用户基础表）

```sql
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE,
    name text,
    role text DEFAULT 'user',
    referral_code text UNIQUE, -- 注册时系统生成的推荐码
    created_at timestamptz DEFAULT now()
);
```

---

### user\_credits（积分流水表）

```sql
CREATE TABLE user_credits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    change_type text NOT NULL, -- 'initial' / 'referral' / 'milestone' / 'usage' / 'purchase_bonus'
    change_amount int NOT NULL, -- +3 / +10 / -1
    related_user_id uuid,       -- 推荐奖励时记录被邀请的用户
    created_at timestamptz DEFAULT now()
);

-- 查询积分余额
-- SELECT COALESCE(SUM(change_amount), 0) FROM user_credits WHERE user_id='xxx';
```

---

### referral\_logs（推荐关系表）

```sql
CREATE TABLE referral_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id uuid REFERENCES users(id), -- 邀请人
    invitee_id uuid REFERENCES users(id), -- 被邀请人
    referral_code text, 
    status text DEFAULT 'success', -- pending / success / failed
    created_at timestamptz DEFAULT now()
);
```

---

### subscriptions（订阅表）

```sql
CREATE TABLE subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    plan text NOT NULL, -- 'free' / 'lite' / 'pro'
    status text DEFAULT 'active',
    start_date timestamptz DEFAULT now(),
    end_date timestamptz
);
```

---

### payments（支付流水表）

```sql
CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id),
    amount_usd numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD',
    plan text, -- 'lite' / 'pro'
    status text DEFAULT 'pending', -- pending / success / failed
    stripe_session_id text,
    created_at timestamptz DEFAULT now()
);
```

---

### ai\_usage\_logs（AI 使用日志）

```sql
CREATE TABLE ai_usage_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id),
    action_type text,     -- 'generate' / 'fix'
    prompt text,          -- 输入的 prompt
    output_tokens int,
    json_valid boolean,
    render_success boolean,
    error_message text,
    created_at timestamptz DEFAULT now()
);
```

---

## 3️⃣ 用户路径追踪与收入贡献

一条 SQL 就能看清楚 **用户完整路径 + 裂变情况 + 收入贡献**：

```sql
SELECT 
  u.id, u.email,
  COALESCE(SUM(c.change_amount),0) AS credits_balance,
  COUNT(DISTINCT r.invitee_id) AS referrals_count,
  COALESCE(SUM(p.amount_usd),0) AS total_revenue,
  MAX(s.plan) FILTER (WHERE s.status='active') AS current_plan
FROM users u
LEFT JOIN user_credits c ON u.id = c.user_id
LEFT JOIN referral_logs r ON u.id = r.inviter_id AND r.status='success'
LEFT JOIN payments p ON u.id = p.user_id AND p.status='success'
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status='active'
GROUP BY u.id, u.email;
```

---

## ✅ 关键优化点

1. **推荐奖励规则明确**：即时 + 里程碑，不冲突。
2. **积分统一管理**：通过 `user_credits` 追踪所有变化，余额实时可算。
3. **裂变与付费路径清晰**：推荐裂变推动轻量使用，积分不足推动付费升级。
4. **数据可追溯性强**：日志、订阅、支付、推荐关系全面覆盖，方便后续做增长分析。

---


---

## 1️⃣ 积分余额的计算方式

**不能**在前端直接加减余额。
👉 前端只显示余额，但实际加减 **必须在后端处理**，否则用户可能通过改请求、改 localStorage 来“刷积分”。

正确做法：

* **每次发生积分变动（注册赠送 / 使用消耗 / 推荐奖励 / 里程碑奖励 / 购买奖励）**，后端写一条记录到 `user_credits` 表。
* 余额通过 **SQL 聚合计算**：

  ```sql
  SELECT COALESCE(SUM(change_amount),0) AS credits_balance 
  FROM user_credits WHERE user_id='xxx';
  ```
* 前端仅调用 API 获取这个结果，保证安全。

---

## 2️⃣ 第 5、10 个推荐奖励的计算逻辑

你的规则是 **即时奖励 + 里程碑额外奖励**。
比如：

* 每邀请 1 人 → +3
* 每满 5 人 → 额外 +10

所以推荐人数累积时：

| 推荐人数 | 即时奖励 | 里程碑奖励 | 总奖励 |
| ---- | ---- | ----- | --- |
| 1    | +3   | 0     | +3  |
| 5    | +15  | +10   | +25 |
| 6    | +18  | +10   | +28 |
| 10   | +30  | +20   | +50 |
| 11   | +33  | +20   | +53 |

---

### 实现方式

**在写入 referral\_logs 的时候**，后端逻辑要做 2 步：

1. **即时奖励**：

   ```sql
   INSERT INTO user_credits (user_id, change_type, change_amount, related_user_id)
   VALUES (:inviter_id, 'referral', 3, :invitee_id);
   ```

2. **检查是否达成里程碑**：

   ```sql
   SELECT COUNT(*) 
   FROM referral_logs 
   WHERE inviter_id = :inviter_id AND status='success';
   ```

   * 如果 `count % 5 = 0` → 说明刚好达到一个 5 的倍数，发放 +10 奖励。

   ```sql
   INSERT INTO user_credits (user_id, change_type, change_amount)
   VALUES (:inviter_id, 'milestone', 10);
   ```

---

✅ 这样一来，所有奖励都走 `user_credits` 流水表，安全、可审计、可回溯，余额计算也完全自动。

---

[MODE: RESEARCH]

我正在分析现有数据结构和需求，让我深入理解当前状态和需要实现的功能。

## 现有数据结构分析

### 已存在的表结构
- **users**: 已有 `referral_code` 字段，支持推荐码
- **user_credits**: 完整的积分流水表结构
- **referral_logs**: 推荐关系追踪表
- **subscriptions**: 订阅管理表
- **payments**: 支付流水表
- **ai_usage_logs**: AI使用日志，已有 `is_json_valid` 字段用于积分消耗判断

### 数据结构完整性
✅ 所有必需的表和字段都已存在，无需数据库迁移
✅ 字段类型和约束符合需求设计
✅ 外键关系正确设置

## 需要实现的功能模块

### 前端界面需求
1. **积分显示系统**
   - 用户积分余额展示
   - 积分变动历史记录
   - 积分不足时的提示界面

2. **推荐码分享系统**
   - 个人推荐码展示
   - 推荐链接生成和分享
   - 推荐统计（邀请人数、获得积分）
   - 推荐奖励里程碑展示

3. **订阅管理界面**
   - 当前订阅状态显示
   - 订阅计划选择（Lite $5/20Credits, Pro $20/月）
   - 订阅升级/降级操作
   - 订阅到期提醒

### 后端API扩展需求
1. **积分管理API**
   - 积分余额查询
   - 积分变动记录查询
   - 积分消耗验证（AI调用时）

2. **推荐追踪API**
   - 推荐码生成和验证
   - 推荐关系建立
   - 推荐奖励发放（即时+里程碑）
   - 推荐统计查询

3. **订阅管理API**
   - 订阅状态查询
   - 订阅计划变更
   - 订阅到期检查

### 业务逻辑需求
1. **积分消耗机制**
   - 每次成功AI调用（`is_json_valid=true`）消耗1积分
   - 积分不足时阻止AI调用
   - 订阅用户（Pro）不受积分限制

2. **推荐奖励机制**
   - 注册时自动生成nanoid推荐码
   - 每邀请1人获得3积分
   - 每邀请5人获得额外10积分里程碑奖励

3. **订阅权限控制**
   - Lite用户：20积分限制
   - Pro用户：无限使用
   - 订阅到期自动降级

## 技术实现考虑

### 前端技术栈
- 使用现有React + Next.js架构
- 集成到现有的用户认证系统
- 响应式设计，支持移动端

### 后端技术栈
- 扩展现有Express.js API
- 集成到现有Supabase数据库
- 使用nanoid生成推荐码

### 集成点
- 用户注册流程需要添加推荐码生成
- AI调用接口需要添加积分验证
- 用户仪表板需要显示积分和推荐信息

