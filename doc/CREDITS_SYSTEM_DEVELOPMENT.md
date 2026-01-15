# 积分系统优化开发文档

## 📋 文档说明

本文档详细列出了积分系统优化的开发任务清单，按照优先级和依赖关系组织，便于开发团队按步骤实施。

**目标**：从"口碑推荐"转向"内容裂变"，通过流量驱动实现快速用户增长

**核心策略**：
- 注册红利：+100 积分（从 +3 提升）
- 页面点击奖励：+1 积分/点击（24小时内同一IP仅计1次）
- 取消推荐码机制
- Pro 订阅用户完全豁免积分消耗

---

## ✅ 已完成功能

### 1. 积分消耗功能 ✅
- ✅ AI 内容生成：-10 积分（同步/异步）
- ✅ 内容修复：-10 积分
- ✅ AI Guide 对话：-2 积分
- ✅ Pro 订阅豁免逻辑（所有消耗点）

### 2. 页面点击统计系统 ✅
- ✅ `page_views` 表已创建
- ✅ `pageViewService.js` 服务已实现
- ✅ `POST /api/page-views/record` API 已实现
- ✅ 防刷检测逻辑（24小时内同一IP仅计1次）
- ✅ 积分自动发放逻辑

### 3. 数据库结构 ✅
- ✅ `page_views` 表结构完整
- ✅ `user_credits` 表支持 `page_view` 类型

---

## 🔧 待开发任务

### 任务 1：注册奖励提升（优先级：高）

**目标**：将新用户注册奖励从 +3 提升至 +100 积分

#### 1.1 修改注册奖励逻辑

**文件**：`edu/backend/src/api/referrals.js`

**需要修改的位置**：

1. **第 60 行**：无邀请码时的初始积分
   ```javascript
   // 当前：await DatabaseService.addCreditChange(inviteeId, 'initial', 3);
   // 修改为：
   await DatabaseService.addCreditChange(inviteeId, 'initial', 100);
   ```

2. **第 74 行**：邀请码无效时的初始积分
   ```javascript
   // 当前：await DatabaseService.addCreditChange(inviteeId, 'initial', 3);
   // 修改为：
   await DatabaseService.addCreditChange(inviteeId, 'initial', 100);
   ```

3. **第 82 行**：有邀请码时的初始积分
   ```javascript
   // 当前：await DatabaseService.addCreditChange(inviteeId, 'initial', 3);
   // 修改为：
   await DatabaseService.addCreditChange(inviteeId, 'initial', 100);
   ```

4. **删除推荐奖励和里程碑奖励**（第 83-89 行）：
   ```javascript
   // 删除以下代码：
   // await DatabaseService.addCreditChange(inviter.id, 'referral', 3, inviteeId);
   // const { data: count } = await DatabaseService.countSuccessfulReferrals(inviter.id);
   // if (count % 5 === 0) {
   //   await DatabaseService.addCreditChange(inviter.id, 'milestone', 10);
   // }
   ```

**预期结果**：
- 所有新用户注册时获得 +100 积分
- 不再发放推荐奖励和里程碑奖励
- 仍然记录推荐关系（`referral_logs` 表）

#### 1.2 游客注册后发放初始积分

**文件**：`edu/backend/src/services/visitorUsageService.js`

**需要检查的位置**：`mergeVisitorDataToUser` 函数

**需要添加的逻辑**：
```javascript
// 在合并数据后，检查并发放初始积分
const { data: existingCredits } = await DatabaseService.getCreditsHistory(userId, 1, 0);
const hasInitialCredits = existingCredits && existingCredits.some(credit => credit.change_type === 'initial');

if (!hasInitialCredits) {
  const INITIAL_CREDITS = 100;
  await DatabaseService.addCreditChange(userId, 'initial', INITIAL_CREDITS);
  logger.info(`游客注册后发放初始积分: user_id=${userId}, credits=${INITIAL_CREDITS}`);
}
```

**预期结果**：
- 游客注册后自动获得 +100 积分
- 避免重复发放（检查是否已有 `initial` 类型记录）

---

### 任务 2：数据库字段优化（优先级：中）

**目标**：为 `user_credits` 表添加 `related_content_id` 字段，便于审计和防刷检测

#### 2.1 检查字段是否存在

**SQL 查询**：
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_credits' 
AND column_name = 'related_content_id';
```

#### 2.2 如果字段不存在，添加字段

**SQL 迁移脚本**：
```sql
-- 添加 related_content_id 字段
ALTER TABLE user_credits 
ADD COLUMN IF NOT EXISTS related_content_id UUID REFERENCES content(id) ON DELETE SET NULL;

-- 添加索引（用于查询特定内容的积分记录）
CREATE INDEX IF NOT EXISTS idx_user_credits_related_content_id 
ON user_credits(related_content_id) 
WHERE related_content_id IS NOT NULL;
```

#### 2.3 修改 `addCreditChange` 函数支持 `related_content_id`

**文件**：`edu/backend/src/services/database.js`

**当前函数签名**（第 428 行）：
```javascript
const addCreditChange = async (userId, changeType, changeAmount, relatedUserId = null) => {
  // ...
  .insert({
    user_id: userId,
    change_type: changeType,
    change_amount: changeAmount,
    related_user_id: relatedUserId,
    created_at: new Date().toISOString(),
  })
}
```

**需要修改为**：
```javascript
const addCreditChange = async (userId, changeType, changeAmount, relatedUserId = null, relatedContentId = null) => {
  // ...
  .insert({
    user_id: userId,
    change_type: changeType,
    change_amount: changeAmount,
    related_user_id: relatedUserId,
    related_content_id: relatedContentId, // 新增字段
    created_at: new Date().toISOString(),
  })
}
```

**预期结果**：
- `addCreditChange` 函数支持 `related_content_id` 参数
- 向后兼容：现有调用不传 `related_content_id` 时默认为 `null`

#### 2.4 更新页面点击积分发放逻辑

**文件**：`edu/backend/src/services/pageViewService.js`

**需要修改的位置**：`awardCreditsForPageView` 函数（约第 181 行）

**当前代码**：
```javascript
// 当前版本不支持 related_content_id，后续可以扩展
const { error: creditError } = await DatabaseService.addCreditChange(
  content.created_by,
  'page_view',
  1,
  null // related_user_id（页面点击奖励不需要关联用户）
);
```

**修改为**（在任务 2.3 完成后）：
```javascript
const { error: creditError } = await DatabaseService.addCreditChange(
  content.created_by,
  'page_view',
  1,
  null, // related_user_id（页面点击奖励不需要关联用户）
  contentId // related_content_id（关联到具体内容）
);
```

**预期结果**：
- `user_credits` 表记录页面点击奖励时，关联到具体的内容ID
- 便于后续审计和防刷检测
- 可以查询特定内容获得的积分奖励

---

### 任务 3：推荐码相关代码清理（优先级：低）

**目标**：清理不再使用的推荐码相关代码（可选，不影响功能）

#### 3.1 后端清理

**文件**：`edu/backend/src/api/referrals.js`

**可选清理**：
- 保留 `/code` 和 `/validate` 端点（可能仍用于记录推荐关系）
- 保留 `referral_logs` 表的记录逻辑
- 删除推荐奖励和里程碑奖励的发放逻辑（已在任务 1 中完成）

#### 3.2 前端清理

**状态**：✅ 已完成
- ✅ `Sidebar.tsx` 中的推荐码 UI 已删除
- ✅ `signup/page.tsx` 中的推荐码逻辑已删除
- ✅ `useAuth.tsx` 中的推荐码处理已删除

---

### 任务 4：文档和注释更新（优先级：低）

**目标**：更新代码注释和文档，反映新的积分系统

#### 4.1 更新代码注释

**需要更新的文件**：
- `edu/backend/src/api/referrals.js` - 更新注释说明注册奖励为 +100
- `edu/backend/src/services/pageViewService.js` - 更新注释说明 `related_content_id` 的使用

#### 4.2 更新 API 文档

**需要说明的变更**：
- 注册奖励从 +3 提升至 +100
- 取消推荐奖励和里程碑奖励
- 页面点击奖励机制

---

## 📊 开发检查清单

### 阶段 1：注册奖励提升（必须完成）

- [ ] 修改 `referrals.js` 中所有 `initial` 类型积分为 100
- [ ] 删除推荐奖励和里程碑奖励逻辑
- [ ] 在 `visitorUsageService.js` 中添加游客注册后的初始积分发放
- [ ] 测试：新用户注册后获得 100 积分
- [ ] 测试：游客注册后获得 100 积分
- [ ] 测试：避免重复发放初始积分

### 阶段 2：数据库优化（建议完成）

- [ ] 检查 `user_credits.related_content_id` 字段是否存在
- [ ] 如果不存在，执行 SQL 迁移脚本添加字段
- [ ] 修改 `database.js` 中的 `addCreditChange` 函数，支持 `related_content_id` 参数
- [ ] 更新 `pageViewService.js` 中的积分发放逻辑，包含 `related_content_id`
- [ ] 测试：页面点击积分记录包含 `related_content_id`
- [ ] 测试：可以查询特定内容的积分奖励记录

### 阶段 3：代码清理（可选）

- [ ] 清理不再使用的推荐码相关代码
- [ ] 更新代码注释
- [ ] 更新 API 文档

---

## 🧪 测试用例

### 测试 1：新用户注册奖励

**步骤**：
1. 新用户注册账号
2. 检查 `user_credits` 表是否有 `change_type = 'initial'` 且 `change_amount = 100` 的记录
3. 检查用户积分余额是否为 100

**预期结果**：✅ 用户获得 100 积分

### 测试 2：游客注册后奖励

**步骤**：
1. 游客生成内容或使用 AI Guide
2. 游客注册账号
3. 检查 `user_credits` 表是否有 `change_type = 'initial'` 且 `change_amount = 100` 的记录
4. 检查用户积分余额是否为 100

**预期结果**：✅ 游客注册后获得 100 积分，数据已合并

### 测试 3：页面点击奖励

**步骤**：
1. 用户 A 创建内容
2. 用户 B 访问该内容页面
3. 检查 `page_views` 表是否有记录，`is_unique = true`
4. 检查 `user_credits` 表是否有 `change_type = 'page_view'` 且 `change_amount = 1` 的记录
5. 检查 `related_content_id` 是否正确关联到内容ID
6. 检查用户 A 的积分余额是否增加 1

**预期结果**：✅ 内容创建者获得 1 积分，记录包含 `related_content_id`

### 测试 4：防刷检测

**步骤**：
1. 同一 IP 在 24 小时内多次访问同一内容
2. 检查 `page_views` 表中只有第一条记录 `is_unique = true`
3. 检查 `user_credits` 表中只有一条 `page_view` 记录

**预期结果**：✅ 24 小时内同一 IP 仅计 1 次积分

### 测试 5：Pro 订阅豁免

**步骤**：
1. Pro 订阅用户生成内容
2. 检查是否扣除积分（应该不扣除）
3. Pro 订阅用户使用 AI Guide
4. 检查是否扣除积分（应该不扣除）

**预期结果**：✅ Pro 用户不消耗积分

---

## 📝 代码修改示例

### 示例 1：修改注册奖励

```javascript
// edu/backend/src/api/referrals.js

// 修改前：
await DatabaseService.addCreditChange(inviteeId, 'initial', 3);

// 修改后：
const INITIAL_CREDITS = 100;
await DatabaseService.addCreditChange(inviteeId, 'initial', INITIAL_CREDITS);
```

### 示例 2：游客注册后发放积分

```javascript
// edu/backend/src/services/visitorUsageService.js

// 在 mergeVisitorDataToUser 函数中，合并数据后添加：
const { data: existingCredits } = await DatabaseService.getCreditsHistory(userId, 1, 0);
const hasInitialCredits = existingCredits && existingCredits.some(
  credit => credit.change_type === 'initial'
);

if (!hasInitialCredits) {
  const INITIAL_CREDITS = 100;
  await DatabaseService.addCreditChange(userId, 'initial', INITIAL_CREDITS);
  logger.info(`游客注册后发放初始积分: user_id=${userId}, credits=${INITIAL_CREDITS}`);
}
```

### 示例 3：修改 addCreditChange 函数

```javascript
// edu/backend/src/services/database.js

// 修改前：
const addCreditChange = async (userId, changeType, changeAmount, relatedUserId = null) => {
  // ...
  .insert({
    user_id: userId,
    change_type: changeType,
    change_amount: changeAmount,
    related_user_id: relatedUserId,
    created_at: new Date().toISOString(),
  })
}

// 修改后：
const addCreditChange = async (userId, changeType, changeAmount, relatedUserId = null, relatedContentId = null) => {
  // ...
  .insert({
    user_id: userId,
    change_type: changeType,
    change_amount: changeAmount,
    related_user_id: relatedUserId,
    related_content_id: relatedContentId, // 新增
    created_at: new Date().toISOString(),
  })
}
```

### 示例 4：页面点击积分关联内容ID

```javascript
// edu/backend/src/services/pageViewService.js

// 修改后：
await DatabaseService.addCreditChange(
  content.created_by,
  'page_view',
  1,
  null, // related_user_id
  contentId // related_content_id
);
```

---

## 🔍 相关文件清单

### 后端文件

1. **积分相关 API**：
   - `edu/backend/src/api/credits.js` - 积分查询、消耗、历史
   - `edu/backend/src/api/referrals.js` - 注册奖励（需要修改）
   - `edu/backend/src/api/subscriptions.js` - 订阅管理

2. **积分消耗点**：
   - `edu/backend/src/api/ai.js` - AI 内容生成（-10积分）✅
   - `edu/backend/src/api/content_fix.js` - 内容修复（-10积分）✅
   - `edu/backend/src/api/ai_guide.js` - AI Guide 对话（-2积分）✅

3. **数据库服务**：
   - `edu/backend/src/services/database.js` - 积分相关函数
   - `edu/backend/src/services/visitorUsageService.js` - 游客数据合并（需要修改）
   - `edu/backend/src/services/pageViewService.js` - 页面点击统计（需要优化）

4. **页面点击统计**：
   - `edu/backend/src/api/page_views.js` - 页面点击 API ✅
   - `edu/backend/src/services/pageViewService.js` - 点击统计服务 ✅

### 数据库表

1. **`user_credits`** - 积分变更记录
   - 需要添加 `related_content_id` 字段（如果不存在）

2. **`page_views`** - 页面访问记录 ✅

3. **`subscriptions`** - 订阅信息 ✅

4. **`visitor_usage`** - 游客试用状态 ✅

---

## 📈 预期效果

### 业务指标

1. **注册转化率提升**：
   - 注册奖励从 +3 提升至 +100，降低用户心理门槛
   - 预期注册转化率提升 20-30%

2. **内容分享活跃度提升**：
   - 页面点击奖励机制激励用户分享内容
   - 预期内容分享量提升 50-100%

3. **用户留存提升**：
   - 100 积分足够用户使用 50 次 AI Guide 或 10 次内容生成
   - 预期新用户 7 日留存率提升 15-25%

### 技术指标

1. **数据库性能**：
   - `page_views` 表索引优化，查询性能良好
   - 预计每天新增 10,000 条记录，存储约 2-3 MB

2. **API 性能**：
   - 页面点击记录 API 响应时间 < 100ms
   - 积分发放异步处理，不影响用户体验

---

## 🚨 注意事项

1. **数据迁移**：
   - 如果 `user_credits` 表已有数据，添加 `related_content_id` 字段不会影响现有数据
   - 新字段为 NULL 不影响现有查询

2. **向后兼容**：
   - 修改注册奖励不影响已注册用户
   - 只影响新注册用户

3. **防刷机制**：
   - 页面点击奖励已实现 24 小时 IP 去重
   - 建议后续增加更严格的风控（如 UA 检测、Referer 分析）

4. **监控告警**：
   - 建议监控积分发放异常（如短时间内大量积分发放）
   - 建议监控页面点击异常（如同 IP 大量访问）

---

## 📅 开发时间估算

- **任务 1（注册奖励提升）**：1-2 小时
- **任务 2（数据库优化）**：2 小时
  - 添加字段：0.5 小时
  - 修改函数：0.5 小时
  - 更新调用：0.5 小时
  - 测试：0.5 小时
- **任务 3（代码清理）**：0.5 小时
- **任务 4（文档更新）**：0.5 小时
- **测试**：2-3 小时

**总计**：6-8 小时

---

*最后更新：2025-01-XX*
*文档版本：v1.0*
