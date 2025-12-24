# 免费试用与注册引导功能改版 PRD

## 1. 产品概述

### 1.1 背景
为了降低用户使用门槛，提升产品转化率，允许未登录用户免费体验一次内容生成和一次AI Guide对话，体验后引导用户注册以继续使用。

### 1.2 目标
- **降低使用门槛**：无需注册即可体验核心功能
- **提升转化率**：通过免费体验引导用户注册
- **优化用户体验**：流畅的试用→注册流程
- **数据持久化**：匿名用户数据在登录后自动合并，不丢失

## 2. 功能需求

### 2.1 首页内容生成功能（无需登录）

#### 2.1.1 功能描述
- 未登录用户可以在首页生成一次内容
- 通过匿名持久身份（Anon ID）控制试用次数
- 生成的内容保存到 `content` 表
- 生成完成后立即要求用户注册
- 登录后自动合并匿名数据到用户账号

#### 2.1.2 技术实现方案

**匿名持久身份（Anon ID）方案（推荐）：**

**前端实现：**
- 使用 `localSte 作为兜底（防止 localStorage 被清除）
- Anon ID 格式：orage` 存储 `anon_user_id`（主要存储）
- 同时写入 CookiUUID（`crypto.randomUUID()`）
- 生命周期：永久有效，直到用户登录后合并

**后端实现：**
- 创建 `anon_usage` 表记录匿名用户使用情况
- 通过 `anon_id` 查询和更新使用记录
- 登录时合并 `anon_id` 关联的数据到 `user_id`

**Content 表 user_id 处理方案：**

**推荐方案：使用 Anon ID**
- 未登录用户生成的内容 `created_by` 存储 `anon_id`（格式：`anon-{uuid}`）
- 用户注册后，通过 `anon_id` 查找所有关联数据，更新 `created_by` 为真实 `user_id`
- 优点：
  - 数据完整性好，便于后续关联
  - 跨浏览器会话保持
  - 登录后自动合并，用户体验好
  - 可以说"我们已经帮你保存了刚才的学习进度"

**数据库修改：**
```sql
-- 创建匿名使用记录表
CREATE TABLE IF NOT EXISTS anon_usage (
  anon_id TEXT PRIMARY KEY,
  content_generated BOOLEAN DEFAULT false,
  ai_guide_used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE -- 可选：设置过期时间
);

CREATE INDEX IF NOT EXISTS idx_anon_usage_created_at ON anon_usage(created_at);

-- content 表无需修改，created_by 支持存储 anon_id
-- ai_usage_logs 表无需修改，user_id 支持存储 anon_id
```

#### 2.1.3 业务流程

```
1. 用户访问首页（未登录）
   ↓
2. 前端获取或创建 anon_id：
   - 从 localStorage 读取 anon_user_id
   - 如果不存在，生成新的 UUID 并保存到 localStorage 和 Cookie
   ↓
3. 前端调用后端检查免费试用状态（携带 anon_id）
   ↓
4. 后端查询 anon_usage 表：
   - 如果 content_generated = true → 返回 403，要求注册
   - 如果 content_generated = false → 允许生成
   ↓
5. 用户提交生成请求（携带 anon_id）
   ↓
6. 后端执行生成：
   - 保存 content 记录（created_by = anon_id）
   - 更新 anon_usage 表：content_generated = true
   ↓
7. 生成成功后：
   - 前端显示生成结果 + 注册弹窗/跳转
   - 提示："我们已经帮你保存了刚才的学习进度"
   ↓
8. 用户注册后：
   - 前端发送 anon_id 到后端
   - 后端查找所有 anon_id 关联的数据：
     * content 表：更新 created_by 为真实 user_id
     * ai_usage_logs 表：更新 user_id 为真实 user_id
   - 删除 anon_usage 记录（可选）
   - 清除前端 localStorage 和 Cookie 中的 anon_id
```

#### 2.1.4 API 修改

**新增接口：**
- `POST /api/ai/generate-free` - 免费生成接口（无需认证，需要 anon_id）
- `GET /api/anon/check-trial` - 检查免费试用状态（需要 anon_id）
- `POST /api/anon/merge-on-login` - 注册后合并匿名数据（需要认证 + anon_id）

**修改接口：**
- `POST /api/ai/generate` - 保持原有逻辑（需要认证）

### 2.2 AI Guide 首次对话功能（无需登录）

#### 2.2.1 功能描述
- 未登录用户可以启动一次 AI Guide 会话
- 可以发送一次对话消息
- 通过 Anon ID 控制试用次数
- 对话完成后立即要求用户注册
- 登录后自动合并对话记录

#### 2.2.2 技术实现方案

**Anon ID 管理：**
- 使用相同的 Anon ID 机制（localStorage + Cookie）
- `anon_usage` 表中存储 `ai_guide_used: true` 标记

**Conversation 关联：**
- `ai_usage_logs` 表的 `user_id` 字段：
  - 未登录用户：存储 `anon_id`（格式：`anon-{uuid}`）
  - 登录用户：存储真实 `user_id`
- 注册后通过 `anon_id` 查找并更新所有相关记录

#### 2.2.3 业务流程

```
1. 用户打开内容页面，点击 AI Guide 按钮（未登录）
   ↓
2. 前端获取或创建 anon_id（从 localStorage）
   ↓
3. 调用后端检查免费试用状态（携带 anon_id）
   ↓
4. 后端查询 anon_usage 表：
   - 如果 ai_guide_used = true → 返回 403，要求注册
   - 如果 ai_guide_used = false → 允许启动会话
   ↓
5. 调用 /api/ai-guide/init-free（无需认证，需要 anon_id）
   - 使用 anon_id 作为 user_id
   - 创建 conversation_id
   - 生成初始欢迎消息
   ↓
6. 用户发送第一条消息
   ↓
7. 调用 /api/ai-guide/chat-free（无需认证，需要 anon_id）
   - 检查 anon_usage 表中是否已使用免费对话
   - 如果未使用，处理对话并更新 anon_usage.ai_guide_used = true
   - 如果已使用，返回 403，要求注册
   ↓
8. 对话完成后：
   - 显示注册提示："我们已经帮你保存了刚才的对话记录"
   ↓
9. 用户注册后：
   - 前端发送 anon_id 到后端
   - 后端查找所有 anon_id 关联的对话记录
   - 更新 ai_usage_logs.user_id 为真实 user_id
   - 删除 anon_usage 记录（可选）
```

#### 2.2.4 API 修改

**新增接口：**
- `POST /api/ai-guide/init-free` - 免费初始化会话（无需认证，需要 anon_id）
- `POST /api/ai-guide/chat-free` - 免费对话接口（无需认证，需要 anon_id）

**修改接口：**
- `POST /api/ai-guide/init` - 保持原有逻辑（需要认证）
- `POST /api/ai-guide/chat` - 保持原有逻辑（需要认证）

### 2.3 注册引导流程

#### 2.3.1 触发时机
1. **内容生成后**：生成成功，立即显示注册弹窗
2. **AI Guide 对话后**：第一次对话完成，立即显示注册弹窗
3. **再次尝试使用**：如果已使用免费试用，再次尝试时要求注册

#### 2.3.2 注册弹窗设计

**内容生成场景：**
```
┌─────────────────────────────────────┐
│  🎉 内容生成成功！                    │
│                                      │
│  您已使用免费试用机会                 │
│  注册账号以继续生成更多内容           │
│                                      │
│  [立即注册]  [稍后再说]              │
└─────────────────────────────────────┘
```

**AI Guide 场景：**
```
┌─────────────────────────────────────┐
│  💬 对话完成！                       │
│                                      │
│  您已使用免费试用机会                 │
│  注册账号以继续使用 AI Guide          │
│                                      │
│  [立即注册]  [稍后再说]              │
└─────────────────────────────────────┘
```

**再次尝试使用场景：**
```
┌─────────────────────────────────────┐
│  ⚠️ 免费试用已用完                    │
│                                      │
│  注册账号以继续使用功能               │
│                                      │
│  [立即注册]  [取消]                  │
└─────────────────────────────────────┘
```

#### 2.3.3 注册后数据关联

**流程：**
1. 用户完成注册，获得真实 `user_id`
2. 前端获取 localStorage 中的 `anon_id`
3. 调用 `/api/anon/merge-on-login` 接口（需要认证 + anon_id）
4. 后端查找所有 `anon_id` 关联的记录：
   - `content` 表：更新 `created_by` 为真实 `user_id`（WHERE created_by = anon_id）
   - `ai_usage_logs` 表：更新 `user_id` 为真实 `user_id`（WHERE user_id = anon_id）
5. 删除 `anon_usage` 记录（可选，建议保留用于统计）
6. 前端清除 localStorage 和 Cookie 中的 `anon_id`
7. 显示提示："我们已经帮你保存了刚才的学习进度"

## 3. 数据库修改

### 3.1 Content 表修改

**无需修改**
- `created_by` 字段支持存储 `anon_id`（格式：`anon-{uuid}`）
- 注册后通过 `anon_id` 查找并更新为真实 `user_id`

### 3.2 AI Usage Logs 表修改

**无需修改**
- `user_id` 字段支持存储 `anon_id`（格式：`anon-{uuid}`）
- 注册后通过 `anon_id` 查找并更新为真实 `user_id`

### 3.3 新增匿名使用记录表

**创建 anon_usage 表：**
```sql
CREATE TABLE IF NOT EXISTS anon_usage (
  anon_id TEXT PRIMARY KEY,
  content_generated BOOLEAN DEFAULT false,
  ai_guide_used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE -- 可选：设置过期时间（如 90 天后）
);

CREATE INDEX IF NOT EXISTS idx_anon_usage_created_at ON anon_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_anon_usage_expires_at ON anon_usage(expires_at);
```

**说明：**
- `anon_id`：匿名用户唯一标识（格式：`anon-{uuid}`）
- `content_generated`：是否已使用免费内容生成
- `ai_guide_used`：是否已使用免费 AI Guide 对话
- `expires_at`：可选，用于定期清理过期记录

## 4. 后端实现细节

### 4.1 Anon ID 验证中间件

```javascript
// backend/src/middleware/anonId.js
const validateAnonId = (req, res, next) => {
  const anonId = req.headers['x-anon-id'] || req.body.anon_id || req.query.anon_id;
  
  if (!anonId) {
    return res.status(400).json({
      success: false,
      error: 'ANON_ID_REQUIRED',
      message: '匿名用户ID缺失'
    });
  }
  
  // 验证格式：anon-{uuid}
  if (!/^anon-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(anonId)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_ANON_ID',
      message: '无效的匿名用户ID格式'
    });
  }
  
  req.anonId = anonId;
  next();
};

module.exports = { validateAnonId };
```

### 4.2 免费试用检查服务

```javascript
// backend/src/services/anonUsageService.js
const { supabase } = require('./database');

// 获取或创建匿名使用记录
const getOrCreateAnonUsage = async (anonId) => {
  const { data, error } = await supabase
    .from('anon_usage')
    .select('*')
    .eq('anon_id', anonId)
    .single();
  
  if (error && error.code === 'PGRST116') {
    // 记录不存在，创建新记录
    const { data: newRecord, error: createError } = await supabase
      .from('anon_usage')
      .insert({
        anon_id: anonId,
        content_generated: false,
        ai_guide_used: false
      })
      .select()
      .single();
    
    if (createError) throw createError;
    return newRecord;
  }
  
  if (error) throw error;
  return data;
};

// 检查是否可以生成内容
const canGenerateContent = async (anonId) => {
  const usage = await getOrCreateAnonUsage(anonId);
  return !usage.content_generated;
};

// 标记内容已生成
const markContentGenerated = async (anonId) => {
  const { error } = await supabase
    .from('anon_usage')
    .update({ 
      content_generated: true,
      updated_at: new Date().toISOString()
    })
    .eq('anon_id', anonId);
  
  if (error) throw error;
};

// 检查是否可以使用 AI Guide
const canUseAiGuide = async (anonId) => {
  const usage = await getOrCreateAnonUsage(anonId);
  return !usage.ai_guide_used;
};

// 标记 AI Guide 已使用
const markAiGuideUsed = async (anonId) => {
  const { error } = await supabase
    .from('anon_usage')
    .update({ 
      ai_guide_used: true,
      updated_at: new Date().toISOString()
    })
    .eq('anon_id', anonId);
  
  if (error) throw error;
};

// 合并匿名数据到用户账号
const mergeAnonDataToUser = async (anonId, userId) => {
  // 更新 content 表
  const { error: contentError } = await supabase
    .from('content')
    .update({ created_by: userId })
    .eq('created_by', anonId);
  
  // 更新 ai_usage_logs 表
  const { error: logsError } = await supabase
    .from('ai_usage_logs')
    .update({ user_id: userId })
    .eq('user_id', anonId);
  
  // 可选：删除 anon_usage 记录（建议保留用于统计）
  // const { error: deleteError } = await supabase
  //   .from('anon_usage')
  //   .delete()
  //   .eq('anon_id', anonId);
  
  if (contentError || logsError) {
    throw new Error('合并匿名数据失败');
  }
  
  return { 
    success: true,
    contentCount: contentError ? 0 : 1, // 实际应该查询数量
    conversationCount: logsError ? 0 : 1 // 实际应该查询数量
  };
};

module.exports = {
  getOrCreateAnonUsage,
  canGenerateContent,
  markContentGenerated,
  canUseAiGuide,
  markAiGuideUsed,
  mergeAnonDataToUser
};
```

### 4.3 Anon ID 格式工具

```javascript
// backend/src/utils/anonId.js
const { v4: uuidv4 } = require('uuid');

// 生成 Anon ID（前端使用）
const generateAnonId = () => {
  return `anon-${uuidv4()}`;
};

// 验证 Anon ID 格式
const isValidAnonId = (anonId) => {
  return /^anon-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(anonId);
};

// 从 user_id 中提取 anon_id（如果是 anon_id 格式）
const extractAnonId = (userId) => {
  if (isValidAnonId(userId)) {
    return userId;
  }
  return null;
};

module.exports = { generateAnonId, isValidAnonId, extractAnonId };
```

## 5. 前端实现细节

### 5.1 Anon ID 管理

```typescript
// frontend/src/utils/anonId.ts
export function getAnonId(): string {
  // 优先从 localStorage 读取
  let anonId = localStorage.getItem('anon_user_id');
  
  if (!anonId) {
    // 生成新的 Anon ID
    anonId = `anon-${crypto.randomUUID()}`;
    localStorage.setItem('anon_user_id', anonId);
    
    // 同时写入 Cookie 作为兜底（防止 localStorage 被清除）
    document.cookie = `anon_user_id=${anonId}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
  } else {
    // 如果 localStorage 存在，确保 Cookie 也存在（同步）
    if (!document.cookie.includes('anon_user_id')) {
      document.cookie = `anon_user_id=${anonId}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
    }
  }
  
  return anonId;
}

// 从 Cookie 读取（兜底方案）
export function getAnonIdFromCookie(): string | null {
  const match = document.cookie.match(/anon_user_id=([^;]+)/);
  return match ? match[1] : null;
}

// 清除 Anon ID（登录后调用）
export function clearAnonId() {
  localStorage.removeItem('anon_user_id');
  document.cookie = 'anon_user_id=; path=/; max-age=0';
}
```

### 5.2 API 请求中携带 Anon ID

```typescript
// frontend/src/lib/api.ts
// 在 API 客户端中添加 anon_id 头
const getAnonId = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('anon_user_id') || null;
  }
  return null;
};

// 在请求拦截器中添加
api.interceptors.request.use((config) => {
  // 如果未登录，添加 anon_id 头
  if (!config.headers['Authorization']) {
    const anonId = getAnonId();
    if (anonId) {
      config.headers['X-Anon-Id'] = anonId;
    }
  }
  return config;
});
```

### 5.3 注册弹窗组件

```typescript
// frontend/src/components/RegistrationPrompt.tsx
interface RegistrationPromptProps {
  type: 'generation' | 'aiGuide' | 'trialUsed';
  onRegister: () => void;
  onDismiss?: () => void;
}

export const RegistrationPrompt: React.FC<RegistrationPromptProps> = ({
  type,
  onRegister,
  onDismiss
}) => {
  // 实现注册弹窗UI
};
```

### 5.3 错误处理

```typescript
// 处理 403 FREE_TRIAL_USED 错误
if (error.response?.status === 403 && 
    error.response?.data?.error === 'FREE_TRIAL_USED') {
  // 显示注册弹窗
  setShowRegistrationPrompt(true);
}
```

### 5.4 注册后数据关联

```typescript
// 用户注册成功后
const handleRegistrationSuccess = async (userId: string) => {
  try {
    const anonId = getAnonId();
    if (anonId) {
      // 调用合并接口
      const result = await api.post('/anon/merge-on-login', { anon_id: anonId });
      
      if (result.success) {
        // 清除 Anon ID
        clearAnonId();
        
        // 显示提示
        showNotification('我们已经帮你保存了刚才的学习进度！', 'success');
      }
    }
    
    // 刷新页面或更新状态
    window.location.reload();
  } catch (error) {
    console.error('合并匿名数据失败:', error);
    // 即使失败也清除 Anon ID，避免重复合并
    clearAnonId();
  }
};
```

## 6. API 接口设计

### 6.1 免费内容生成接口

**POST /api/ai/generate-free**
- **认证**：无需认证，但需要 `anon_id`（通过 `X-Anon-Id` 头或请求体）
- **请求头**：
```
X-Anon-Id: anon-{uuid}
```
- **请求体**：
```json
{
  "anon_id": "anon-{uuid}", // 可选，如果头中已提供
  "knowledgePoint": "一元一次方程",
  "learningStage": "understanding",
  "description": "可选描述",
  "language_code": "zh-CN"
}
```
- **响应**：
```json
{
  "success": true,
  "data": {
    "id": "content-uuid",
    "title": "...",
    "full_html": "..."
  },
  "freeTrialUsed": true
}
```
- **错误响应（已使用）**：
```json
{
  "success": false,
  "error": "FREE_TRIAL_USED",
  "message": "免费试用已用完，请注册后继续使用",
  "requiresRegistration": true
}
```

### 6.2 免费 AI Guide 初始化接口

**POST /api/ai-guide/init-free**
- **认证**：无需认证，但需要 `anon_id`
- **请求头**：
```
X-Anon-Id: anon-{uuid}
```
- **请求体**：
```json
{
  "anon_id": "anon-{uuid}", // 可选
  "content_id": "content-uuid"
}
```
- **响应**：
```json
{
  "success": true,
  "data": {
    "conversation_id": "conv-uuid",
    "initial_message": "欢迎消息..."
  }
}
```

### 6.3 免费 AI Guide 对话接口

**POST /api/ai-guide/chat-free**
- **认证**：无需认证，但需要 `anon_id`
- **请求头**：
```
X-Anon-Id: anon-{uuid}
```
- **请求体**：
```json
{
  "anon_id": "anon-{uuid}", // 可选
  "conversation_id": "conv-uuid",
  "message": "用户消息"
}
```
- **响应**：SSE 流式响应（与原有接口相同）
- **第一次对话完成后**：在响应头或最后一条消息中包含 `freeTrialUsed: true`

### 6.4 检查免费试用状态接口

**GET /api/anon/check-trial**
- **认证**：无需认证，但需要 `anon_id`
- **请求头**：
```
X-Anon-Id: anon-{uuid}
```
- **或查询参数**：
```
GET /api/anon/check-trial?anon_id=anon-{uuid}
```
- **响应**：
```json
{
  "success": true,
  "data": {
    "content_generated": false,
    "ai_guide_used": false
  }
}
```

### 6.5 注册后合并匿名数据接口

**POST /api/anon/merge-on-login**
- **认证**：需要认证（用户已注册）
- **请求体**：
```json
{
  "anon_id": "anon-{uuid}"
}
```
- **响应**：
```json
{
  "success": true,
  "data": {
    "contentCount": 1,
    "conversationCount": 1,
    "message": "我们已经帮你保存了刚才的学习进度"
  }
}
```

## 7. 安全考虑

### 7.1 Anon ID 安全
- 使用 HTTPS（生产环境）
- Anon ID 格式验证：`anon-{uuid}`
- 防止 Anon ID 伪造：后端验证格式
- Cookie 设置 `SameSite: 'Lax'`（防止 CSRF）

### 7.2 防滥用
- 限制每个 `anon_id` 的免费试用次数（数据库约束）
- 使用 Rate Limiting 防止频繁请求
- IP 限制（可选）：限制同一 IP 的免费试用次数
- Anon ID 生成使用 `crypto.randomUUID()`，确保唯一性

### 7.3 数据隔离
- Anon ID 格式明确（`anon-{uuid}`），便于识别和清理
- 定期清理过期的匿名用户数据（可选，通过 `expires_at` 字段）
- 登录后立即合并数据，减少数据碎片

### 7.4 隐私保护
- Anon ID 不包含任何个人信息
- 登录后合并数据时，确保数据所有权转移
- 可选：设置 `expires_at`，自动清理长期未登录的匿名数据

## 8. 用户体验优化

### 8.1 状态提示
- 生成/对话过程中显示进度
- 完成后明确提示"免费试用已使用"
- 注册按钮突出显示

### 8.2 注册流程
- 注册后自动关联内容，无需用户操作
- 注册成功后跳转到内容列表或对话页面
- 提供"稍后再说"选项，但再次使用时强制注册

### 8.3 数据保留
- 未注册用户生成的内容保留 90 天（通过 `expires_at` 字段）
- 90 天后自动清理（可选，通过定时任务）
- 注册后永久保留
- 登录后立即合并，确保数据不丢失

## 9. 测试场景

### 9.1 内容生成测试
1. ✅ 未登录用户首次生成成功
2. ✅ 未登录用户第二次生成被拒绝
3. ✅ 生成后注册，内容正确关联
4. ✅ 已登录用户不受影响

### 9.2 AI Guide 测试
1. ✅ 未登录用户首次对话成功
2. ✅ 未登录用户第二次对话被拒绝
3. ✅ 对话后注册，对话记录正确关联
4. ✅ 已登录用户不受影响

### 9.3 Anon ID 测试
1. ✅ Anon ID 跨浏览器会话保持（localStorage）
2. ✅ 清除 localStorage 后从 Cookie 恢复
3. ✅ 清除所有存储后重新生成 Anon ID（防滥用）
4. ✅ 登录后正确合并数据
5. ✅ 登录后清除 Anon ID

## 10. 实施计划

### 10.1 开发阶段
1. **Phase 1：Anon ID 管理**
   - 实现前端 Anon ID 生成和存储（localStorage + Cookie）
   - 创建 `anon_usage` 数据库表
   - 实现后端 Anon ID 验证中间件

2. **Phase 2：免费内容生成**
   - 实现 `/api/ai/generate-free` 接口
   - 实现 `anonUsageService` 服务
   - 修改前端生成组件（添加 Anon ID）
   - 实现注册弹窗

3. **Phase 3：免费 AI Guide**
   - 实现 `/api/ai-guide/init-free` 和 `/chat-free` 接口
   - 修改前端 AI Guide 组件（添加 Anon ID）
   - 实现注册弹窗

4. **Phase 4：数据合并**
   - 实现 `/api/anon/merge-on-login` 接口
   - 实现注册后数据合并逻辑
   - 测试数据迁移

5. **Phase 5：测试与优化**
   - 完整测试流程
   - 性能优化
   - 用户体验优化
   - 添加数据清理定时任务（可选）

### 10.2 部署注意事项
- 确保数据库 `anon_usage` 表已创建
- 配置定期清理任务（可选，清理过期的 `anon_usage` 记录）
- 确保 HTTPS 启用（Cookie 安全）
- 监控 `anon_usage` 表大小

## 11. 后续优化方向

### 11.1 功能扩展
- 支持更多免费试用次数（如 3 次）
- 支持分享链接，邀请好友注册
- 支持社交媒体登录快速注册

### 11.2 数据分析
- 统计免费试用转化率
- 分析用户行为路径
- 优化注册流程

### 11.3 用户体验
- 个性化欢迎消息
- 注册奖励机制
- 新手引导教程

## 12. 风险评估

### 12.1 技术风险
- **Session 存储压力**：使用 Redis 可解决
- **数据关联失败**：实现重试机制和手动关联接口
- **临时用户数据清理**：定期清理任务

### 12.2 业务风险
- **滥用风险**：通过 IP 限制和 Rate Limiting 缓解
- **转化率低**：通过 A/B 测试优化注册流程
- **数据丢失**：确保注册后数据正确关联

## 13. 附录

### 13.1 数据库迁移脚本

```sql
-- 创建匿名使用记录表
CREATE TABLE IF NOT EXISTS anon_usage (
  anon_id TEXT PRIMARY KEY,
  content_generated BOOLEAN DEFAULT false,
  ai_guide_used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE -- 可选：设置过期时间（如 NOW() + INTERVAL '90 days'）
);

CREATE INDEX IF NOT EXISTS idx_anon_usage_created_at ON anon_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_anon_usage_expires_at ON anon_usage(expires_at);

-- content 表和 ai_usage_logs 表无需修改
-- created_by 和 user_id 字段支持存储 anon_id（格式：anon-{uuid}）
```

### 13.2 环境变量配置

```bash
# 无需新增环境变量
# Anon ID 由前端生成，无需后端配置
```

### 13.3 依赖包安装

```bash
# 后端
# 无需新增依赖（使用现有的 uuid 包）

# 前端
# 无需新增依赖（使用浏览器原生 crypto.randomUUID()）
```

### 13.4 定期清理任务（可选）

```javascript
// backend/src/services/anonUsageCleanup.js
// 定期清理过期的匿名使用记录
const cleanupExpiredAnonUsage = async () => {
  const { error } = await supabase
    .from('anon_usage')
    .delete()
    .lt('expires_at', new Date().toISOString());
  
  if (error) {
    console.error('清理过期匿名使用记录失败:', error);
  } else {
    console.log('已清理过期的匿名使用记录');
  }
};

// 每天执行一次（通过 cron 或定时任务）
// 例如：每天凌晨 2 点执行
```

### 13.5 Anon ID 格式说明

- **格式**：`anon-{uuid}`
- **示例**：`anon-550e8400-e29b-41d4-a716-446655440000`
- **生成方式**：前端使用 `crypto.randomUUID()` 生成 UUID，然后添加 `anon-` 前缀
- **验证**：后端使用正则表达式验证格式：`/^anon-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`

