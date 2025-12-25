# Visitor ID 解决方案分析

## 1. 数据结构分析

### 1.1 需要支持 visitor_id 的表

根据 PRD 文档和业务需求，以下表需要支持 visitor_id：

1. **`ai_usage_logs`** - `user_id` (uuid)
   - 用途：记录 AI 使用日志（包括 AI Guide 对话）
   - 需要支持：✅ 是（未登录用户可以免费使用一次 AI Guide）

2. **`content`** - `created_by` (uuid)
   - 用途：记录内容创建者
   - 需要支持：✅ 是（未登录用户可以免费生成一次内容）

### 1.2 不需要支持 visitor_id 的表

以下表只需要已登录用户，不需要支持 visitor_id：

- `collection_lists` - `user_id` (uuid) - 只有登录用户才能创建集合
- `content_likes` - `user_id` (uuid) - 只有登录用户才能点赞
- `content_versions` - `created_by` (uuid) - 只有登录用户才能创建版本
- `list_purchases` - `user_id` (uuid) - 只有登录用户才能购买
- `payments` - `user_id` (uuid) - 只有登录用户才能支付
- `referral_logs` - `inviter_id`, `invitee_id` (uuid) - 只有登录用户才能推荐
- `subscriptions` - `user_id` (uuid) - 只有登录用户才能订阅
- `user_collections` - `user_id` (uuid) - 只有登录用户才能收藏
- `user_credits` - `user_id`, `related_user_id` (uuid) - 只有登录用户才有积分

## 2. 方案对比

### 方案 1：将 `user_id`/`created_by` 改为 TEXT 类型

**适用范围**：仅修改需要支持 visitor_id 的表（`ai_usage_logs.user_id` 和 `content.created_by`）

**优点**：
- ✅ 实现简单，直接修改字段类型
- ✅ 不需要新增字段
- ✅ 查询逻辑统一（都使用同一个字段）

**缺点**：
- ❌ 破坏类型一致性（UUID → TEXT）
- ❌ 失去外键约束（无法 `REFERENCES auth.users(id)`）
- ❌ 影响 RLS 策略（需要修改策略以支持 TEXT 类型）
- ❌ 可能影响其他依赖 UUID 类型的查询和索引
- ❌ 数据迁移风险（需要转换现有数据）

**影响范围**：
- `ai_usage_logs` 表：1 个字段
- `content` 表：1 个字段
- 相关查询逻辑：需要修改所有使用这些字段的查询
- RLS 策略：需要更新

---

### 方案 2：添加 `visitor_id` 字段（推荐）

**适用范围**：仅修改需要支持 visitor_id 的表（`ai_usage_logs` 和 `content`）

**优点**：
- ✅ **保持类型一致性**：`user_id`/`created_by` 保持 UUID 类型
- ✅ **保持外键约束**：`user_id` 仍然可以 `REFERENCES auth.users(id)`
- ✅ **保持 RLS 策略**：不需要大幅修改 RLS 策略
- ✅ **向后兼容**：现有查询逻辑仍然有效
- ✅ **数据迁移风险低**：只是添加新字段，不修改现有数据
- ✅ **影响范围小**：只影响需要支持 visitor_id 的表

**缺点**：
- ⚠️ 需要新增字段（存储开销小）
- ⚠️ 查询逻辑需要判断是 `user_id` 还是 `visitor_id`（代码复杂度略增）

**影响范围**：
- `ai_usage_logs` 表：添加 `visitor_id` TEXT 字段
- `content` 表：添加 `visitor_id` TEXT 字段（或使用 `created_by` 存储 visitor_id，但需要改为 TEXT）
- 相关查询逻辑：需要修改查询以支持 `visitor_id` 或 `user_id`

---

### 方案 3：统一将所有 `user_id` 改为 TEXT

**适用范围**：所有使用 `user_id` 或 `created_by` 的表

**优点**：
- ✅ 统一处理，所有表都支持 visitor_id
- ✅ 查询逻辑统一

**缺点**：
- ❌ **影响范围巨大**：需要修改 11+ 个表
- ❌ **破坏所有外键约束**：所有 `REFERENCES auth.users(id)` 都需要删除
- ❌ **破坏所有 RLS 策略**：需要重写所有 RLS 策略
- ❌ **数据迁移风险极高**：需要转换大量现有数据
- ❌ **不符合业务需求**：很多表不需要支持 visitor_id（如支付、订阅等）
- ❌ **性能影响**：TEXT 类型索引性能可能略低于 UUID

**影响范围**：
- 所有使用 `user_id` 或 `created_by` 的表（11+ 个表）
- 所有相关查询逻辑
- 所有 RLS 策略
- 所有外键约束

---

### 方案 4：使用映射表

**适用范围**：所有需要支持 visitor_id 的表

**实现方式**：
- 创建一个 `visitor_user_mapping` 表
- `visitor_id` → `mapped_user_id` (UUID)
- 在需要支持 visitor_id 的表中，使用 `mapped_user_id` 作为 `user_id`

**优点**：
- ✅ 保持 `user_id` 为 UUID 类型
- ✅ 保持外键约束

**缺点**：
- ❌ **查询复杂度高**：每次查询都需要 JOIN 映射表
- ❌ **性能影响**：额外的 JOIN 操作
- ❌ **实现复杂**：需要维护映射表
- ❌ **不符合业务需求**：visitor_id 和 user_id 是互斥的，不需要映射

---

## 3. 推荐方案：方案 2（添加 `visitor_id` 字段）

### 3.1 具体实现

#### 对于 `ai_usage_logs` 表：
```sql
-- 添加 visitor_id 字段
ALTER TABLE ai_usage_logs 
  ADD COLUMN IF NOT EXISTS visitor_id TEXT;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_visitor_id ON ai_usage_logs(visitor_id);
```

**数据存储逻辑**：
- 已登录用户：`user_id` 有值（UUID），`visitor_id` 为 NULL
- 未登录用户：`user_id` 为 NULL，`visitor_id` 有值（`visitor-{uuid}`）

#### 对于 `content` 表：
**根据 PRD 文档，`created_by` 应该直接存储 `visitor_id`（格式：`visitor-{uuid}`）**

**选项 A**：将 `created_by` 改为 TEXT（符合 PRD）
```sql
-- 删除外键约束（如果存在）
ALTER TABLE content 
  DROP CONSTRAINT IF EXISTS content_created_by_fkey;

-- 将 created_by 改为 TEXT
ALTER TABLE content 
  ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
```

**数据存储逻辑**：
- 已登录用户：`created_by` 存储纯 UUID（`550e8400-e29b-41d4-a716-446655440000`）
- 未登录用户：`created_by` 存储 visitor_id（`visitor-550e8400-e29b-41d4-a716-446655440000`）
- 通过格式前缀区分：`isVisitorId(created_by)` 判断

**选项 B**：添加 `visitor_id` 字段（不推荐，不符合 PRD）
- 原因：PRD 明确要求 `created_by` 直接存储 visitor_id

### 3.2 查询逻辑

```javascript
// 判断是 visitor_id 还是 user_id
const { isVisitorId } = require('../utils/visitorId');
const isVisitor = isVisitorId(userId);

// 查询时根据类型选择字段
if (isVisitor) {
  query = query.eq('visitor_id', userId);
} else {
  query = query.eq('user_id', userId);
}
```

### 3.3 数据合并逻辑

当用户注册后，将 `visitor_id` 的数据合并到 `user_id`：

```javascript
// 更新 ai_usage_logs
UPDATE ai_usage_logs 
SET user_id = :userId, visitor_id = NULL 
WHERE visitor_id = :visitorId;

// 更新 content
UPDATE content 
SET created_by = :userId, visitor_id = NULL 
WHERE visitor_id = :visitorId;
```

## 4. 方案对比总结

| 方案 | 影响范围 | 类型一致性 | 外键约束 | RLS 策略 | 数据迁移风险 | 代码复杂度 | 推荐度 |
|------|---------|-----------|---------|---------|------------|-----------|--------|
| 方案1：改为 TEXT | 2 个表 | ❌ | ❌ | ⚠️ | ⚠️ | ✅ | ⭐⭐ |
| **方案2：添加字段** | **2 个表** | **✅** | **✅** | **✅** | **✅** | **⚠️** | **⭐⭐⭐⭐⭐** |
| 方案3：全部改为 TEXT | 11+ 个表 | ❌ | ❌ | ❌ | ❌ | ✅ | ⭐ |
| 方案4：映射表 | 2 个表 | ✅ | ✅ | ✅ | ✅ | ❌ | ⭐⭐⭐ |

## 5. 最终推荐：混合方案

**根据 PRD 文档和实际需求，推荐使用混合方案**：

### 5.1 `ai_usage_logs` 表：添加 `visitor_id` 字段（方案 2）

**理由**：
- `user_id` 有外键约束 `REFERENCES auth.users(id)`
- 保持 `user_id` 为 UUID 类型，保持外键约束
- 添加 `visitor_id` TEXT 字段存储未登录用户的数据

**实施**：
```sql
ALTER TABLE ai_usage_logs 
  ADD COLUMN IF NOT EXISTS visitor_id TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_visitor_id ON ai_usage_logs(visitor_id);
```

### 5.2 `content` 表：将 `created_by` 改为 TEXT（方案 1）

**理由**：
- PRD 文档明确要求 `created_by` 直接存储 `visitor_id`（格式：`visitor-{uuid}`）
- `created_by` 通常没有外键约束（或约束较松）
- 通过格式前缀区分 visitor_id 和 user_id

**实施**：
```sql
-- 删除外键约束（如果存在）
ALTER TABLE content 
  DROP CONSTRAINT IF EXISTS content_created_by_fkey;

-- 将 created_by 改为 TEXT
ALTER TABLE content 
  ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
```

### 5.3 总结

| 表名 | 方案 | 字段 | 类型 | 理由 |
|------|------|------|------|------|
| `ai_usage_logs` | 添加字段 | `user_id` | UUID（保持） | 保持外键约束 |
| `ai_usage_logs` | 添加字段 | `visitor_id` | TEXT（新增） | 存储未登录用户数据 |
| `content` | 修改类型 | `created_by` | TEXT（修改） | 符合 PRD 要求，直接存储 visitor_id |

**优点**：
1. ✅ **符合 PRD 要求**：`content.created_by` 直接存储 visitor_id
2. ✅ **保持 `ai_usage_logs.user_id` 外键约束**：不影响数据库完整性
3. ✅ **影响范围最小**：只修改 2 个表
4. ✅ **向后兼容**：现有查询逻辑可以通过格式判断适配

**实施步骤**：
1. 为 `ai_usage_logs` 表添加 `visitor_id` 字段
2. 将 `content.created_by` 改为 TEXT 类型
3. 更新相关查询逻辑：
   - `ai_usage_logs`：根据 `isVisitorId()` 判断使用 `user_id` 还是 `visitor_id`
   - `content`：`created_by` 直接存储 visitor_id 或 user_id，通过格式判断
4. 更新数据合并逻辑

