
## �� 渐进式实施计划

### 第一阶段：积分系统基础（优先级：最高）
**目标**：实现积分显示和消耗机制，让用户能看到积分状态

#### 1.1 后端积分管理API
- **文件路径**：`edu/backend/src/api/credits.js`（新建）
- **功能**：
  - [x] `GET /credits/balance` - 查询用户积分余额
  - [x] `GET /credits/history` - 查询积分变动历史
  - [x] `POST /credits/consume` - 消耗积分（AI调用时）

#### 1.2 前端积分显示组件
- **文件路径**：`edu/frontend/src/components/CreditDisplay.tsx`（新建）
- **功能**：
  - [x] 显示当前积分余额（已集成至 Sidebar 用户信息区）
  - [x] 显示积分变动历史（`CreditsHistoryDialog` 弹窗）
  - [x] 集成到页面（`Sidebar` 内刷新/明细按钮）

#### 1.3 AI调用积分验证
- **修改文件**：`edu/backend/src/api/ai.js`
- **功能**：在AI生成接口中添加积分验证（成功才扣减；Pro 订阅免扣）
  - [x] `/api/ai/generate` 已接入
  - [ ] 其它入口（如修复/修改）后续统一接入

### 第二阶段：推荐码系统（优先级：高）
**目标**：实现推荐码生成和分享功能

#### 2.1 后端推荐系统API
- **文件路径**：`edu/backend/src/api/referrals.js`（新建）
- **功能**：
  - [x] `GET /referrals/code` - 获取用户已有邀请码（不生成）
  - [x] `POST /referrals/code` - 显式生成并返回邀请码
  - [x] `GET /referrals/stats` - 获取推荐统计（邀请人数）
  - [x] `POST /referrals/validate` - 验证推荐码（注册前校验）

#### 2.2 前端推荐码组件
- **文件路径**：`edu/frontend/src/components/ReferralCode.tsx`（新建）
- **功能**：
  - [x] 侧边栏展示已有邀请码；点击分享时再生成并分享 `signup?ref=CODE`
  - [ ] 显示推荐统计（下一步增强）

#### 2.3 用户注册推荐码集成
- **修改文件**：`edu/backend/src/api/auth.js`
- **功能**：注册时自动生成推荐码

### 第三阶段：推荐奖励机制（优先级：中）
**目标**：实现推荐奖励的发放和里程碑系统

#### 3.1 推荐奖励逻辑
- **修改文件**：`edu/backend/src/api/referrals.js`
- **功能**：
  - [x] 推荐关系建立（`POST /referrals/reward`）
  - [x] 即时奖励发放：新用户 +3、邀请人 +3
  - [x] 里程碑奖励检查（每5人+10积分）

#### 3.2 前端推荐奖励展示
- **修改文件**：`edu/frontend/src/components/ReferralCode.tsx`
- **功能**：
  - 显示推荐奖励历史
  - 里程碑进度展示

### 注册页对接（附加）
- **修改文件**：`edu/frontend/src/app/signup/page.tsx`
  - [x] 读取 `?ref=` 参数并用 `POST /referrals/validate` 预校验
  - [x] 将验证码缓存在 `localStorage.pending_ref_code`
  - [x] 改为“首次有效登录”时发放奖励（而非注册即发放）

### 首次有效登录奖励发放（附加）
- **修改文件**：`edu/frontend/src/hooks/useAuth.tsx`
  - [x] 登录校验成功后检查 `localStorage.pending_ref_code`
  - [x] 调用 `POST /referrals/reward` 发放奖励，仅一次（用 `ref_rewarded_<userId>` 作为去重标记）

### 第四阶段：订阅管理（优先级：中）
**目标**：实现订阅状态管理和界面

#### 4.1 后端订阅管理API
- **文件路径**：`edu/backend/src/api/subscriptions.js`（新建）
- **功能**：
  - `GET /subscriptions/status` - 查询订阅状态
  - `POST /subscriptions/upgrade` - 升级订阅计划

#### 4.2 前端订阅管理组件
- **文件路径**：`edu/frontend/src/components/SubscriptionManager.tsx`（新建）
- **功能**：
  - 显示当前订阅状态
  - 订阅计划选择界面
  - 订阅升级操作

### 第五阶段：权限控制集成（优先级：中）
**目标**：将积分、推荐、订阅系统整合到权限控制中

#### 5.1 权限验证中间件
- **文件路径**：`edu/backend/src/middleware/credits.js`（新建）
- **功能**：
  - 积分余额验证
  - 订阅状态验证
  - AI调用权限控制

#### 5.2 前端权限提示
- **修改文件**：相关前端组件
- **功能**：
  - 积分不足提示
  - 订阅升级引导
  - 推荐邀请引导

## �� 技术实现细节

### 数据库操作
- 使用现有Supabase连接
- 通过`user_credits`表计算积分余额
- 通过`referral_logs`表追踪推荐关系

### 推荐码生成
- 使用nanoid生成8位推荐码
- 确保唯一性（数据库约束）

### 积分安全
- 所有积分操作在后端进行
- 使用数据库事务确保一致性
- API调用频率限制防止刷积分

### 前端集成
- 使用现有React组件架构
- 集成到现有用户认证系统
- 响应式设计支持移动端

## �� 测试策略

### 第一阶段测试
1. 测试积分余额查询API
2. 测试积分显示组件
3. 测试AI调用积分消耗

### 第二阶段测试
1. 测试推荐码生成
2. 测试推荐码验证
3. 测试推荐统计显示

### 第三阶段测试
1. 测试推荐奖励发放
2. 测试里程碑奖励触发
3. 测试推荐关系建立

## �� 部署策略

### 渐进式部署
- 每个阶段完成后独立部署
- 不影响现有功能
- 用户可逐步体验新功能

### 回滚计划
- 每个阶段都有回滚方案
- 数据库操作可逆
- 前端组件可独立禁用

---

## 📝 实施检查清单

**第一阶段：积分系统基础**
1. 创建 `edu/backend/src/api/credits.js`
2. 实现积分余额查询API
3. 实现积分历史查询API
4. 创建 `edu/frontend/src/components/CreditDisplay.tsx`
5. 集成积分显示到用户仪表板
6. 修改AI调用接口添加积分验证
7. 测试积分显示和消耗功能

**第二阶段：推荐码系统**
8. 创建 `edu/backend/src/api/referrals.js`
9. 实现推荐码生成和查询API
10. 创建 `edu/frontend/src/components/ReferralCode.tsx`
11. 集成推荐码到用户界面
12. 修改用户注册流程生成推荐码
13. 测试推荐码生成和显示

**第三阶段：推荐奖励机制**
14. 实现推荐关系建立API
15. 实现即时奖励发放逻辑
16. 实现里程碑奖励检查逻辑
17. 扩展前端推荐统计显示
18. 测试推荐奖励发放流程

**第四阶段：订阅管理**
19. 创建 `edu/backend/src/api/subscriptions.js`
20. 实现订阅状态查询API
21. 创建 `edu/frontend/src/components/SubscriptionManager.tsx`
22. 集成订阅管理到用户界面
23. 测试订阅状态管理

**第五阶段：权限控制集成**
24. 创建 `edu/backend/src/middleware/credits.js`
25. 集成权限验证到AI调用
26. 完善前端权限提示和引导
27. 全面测试权限控制流程

