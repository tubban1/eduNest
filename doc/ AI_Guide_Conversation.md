# AI Guide 对话数据模型重构方案（方案 2）

## 📋 文档说明

本文档描述将 AI Guide 对话从 `ai_usage_logs` 表重构为独立 `ai_conversations` + `ai_messages` 表的方案。

**当前状态（方案 1）**：使用 `ai_usage_logs` 表存储对话历史  
**目标状态（方案 2）**：使用专用表存储对话数据，`ai_usage_logs` 仅用于技术日志和计费

---

# 一、当前实现分析（方案 1）

## 1.1 现有数据模型

当前使用 `ai_usage_logs` 表存储 AI Guide 对话：

| 字段 | 用途 |
|------|------|
| `request_id` | 作为 conversation_id（同一会话用同一个 UUID） |
| `user_id` / `visitor_id` | 用户标识（支持登录和未登录用户） |
| `content_id` | 关联的内容 ID |
| `action_type` | 设为 `"ai_guide"` 标识导学对话 |
| `user_query` | 用户消息 |
| `response_metadata.reply` | AI 回复（存储在 JSONB 中） |
| `response_metadata.ui_state` | UI 状态（可选） |
| `created_at` | 消息时间戳 |
| `model_name`, `input_tokens`, `output_tokens` | 技术指标（用于计费） |

## 1.2 当前实现的优缺点

### ✅ 优点
- **零迁移成本**：无需修改数据库结构
- **已有实现**：代码已实现并运行中
- **技术日志整合**：对话和技术指标在同一表中，便于审计

### ❌ 缺点
- **语义混乱**：对话数据和技术日志混在一起
- **查询复杂**：需要从 JSONB 字段中提取消息
- **扩展性差**：
  - 无法直接关联 message → conversation
  - 无法存储 `rendered_content`（渲染后的 HTML）
  - 难以实现消息级别的权限控制
- **分析困难**：无法直接统计“某个知识点被问了多少次”
- **前端状态管理复杂**：需要从 logs 中重建 conversation 结构

---

# 二、方案 2 设计目标

## 2.1 核心设计原则

1. **语义清晰**：对话是“学习层”，日志是“系统层”
2. **可扩展性**：支持未来功能（消息编辑、删除、回放等）
3. **可分析性**：支持学习轨迹分析、知识点关联分析
4. **向后兼容**：迁移期间保持 API 兼容

## 2.2 要解决的问题

| 问题 | 方案 1 | 方案 2 |
|------|--------|--------|
| 对话的最小单位 | `request_id`（隐式） | `conversation`（显式） |
| 对话里的最小单位 | `user_query + response_metadata.reply`（混合） | `message`（独立表） |
| 谁在说话 | 需要从 `user_query` 和 `response_metadata.reply` 推断 | `role` 字段明确标识 |
| 对话发生在哪里 | `content_id`（间接） | `content_id`（通过 JOIN 查询 `content.tags[]`） |
| 系统日志 | 与对话混合 | 独立 `ai_usage_logs`，通过外键关联 |

---

# 三、方案 2 数据模型设计

## 3.1 ai_conversations 表（会话表）

### 语义
> 用户 **一次打开 AI Guide 并开始问问题** = 一条 conversation

### 表结构

```sql
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 用户标识（支持登录和未登录用户）
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visitor_id TEXT, -- 格式：visitor-{uuid}，当 user_id 为 NULL 时使用
  
  -- 对话上下文
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  -- 注意：knowledge_points 字段已移除，直接通过 JOIN content.tags 查询
  
  -- 对话元数据
  entry_point TEXT NOT NULL DEFAULT 'ai_guide', -- ai_guide / homework / tutor / explain_button
  language_code TEXT NOT NULL DEFAULT 'zh-CN', -- 保证多语言一致性
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- 可选：对话摘要（未来功能）
  title TEXT, -- 自动生成的对话标题
  summary TEXT -- 对话摘要
);

-- 索引
CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_visitor_id ON ai_conversations(visitor_id);
CREATE INDEX idx_ai_conversations_content_id ON ai_conversations(content_id);
-- 注意：knowledge_points 字段已移除，无需创建索引
CREATE INDEX idx_ai_conversations_created_at ON ai_conversations(created_at DESC);

-- RLS 策略
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_conversations_select_policy" ON ai_conversations
  FOR SELECT USING (
    auth.uid() = user_id 
    OR user_id IS NULL 
    OR visitor_id LIKE 'visitor-%'
  );

CREATE POLICY "ai_conversations_insert_policy" ON ai_conversations
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR user_id IS NULL
  );
```

### 字段说明

| 字段 | 必要性 | 说明 |
|------|--------|------|
| `user_id` / `visitor_id` | ✅ 必需 | 支持登录和未登录用户（与当前实现一致） |
| `content_id` | ✅ 必需 | 关联到具体的教学内容 |
| ~~`knowledge_points`~~ | ❌ 已移除 | **已移除**：直接通过 `JOIN content` 表查询 `tags[]` 字段，避免数据冗余。详见下方说明 |
| `entry_point` | ⚠️ 推荐 | 产品增长分析（当前可设为固定值 'ai_guide'） |
| `language_code` | ✅ 必需 | 保证多语言一致性（从 `content.language_code` 或用户设置获取） |
| `title` / `summary` | ❌ 可选 | 未来功能，初始可设为 NULL |

### ~~`knowledge_points` 字段说明~~（已移除）

#### 为什么移除这个字段？

**原因**：如果 `knowledge_points` 只是 `content.tags[]` 的拷贝，会造成数据冗余，违反数据库规范化原则。

**替代方案**：直接通过 `JOIN content` 表查询 `tags[]` 字段：

```sql
-- 学习轨迹分析：统计用户最常问哪些知识点
SELECT 
  unnest(c.tags) as knowledge_point, 
  COUNT(*) as conversation_count
FROM ai_conversations conv
JOIN content c ON c.id = conv.content_id
WHERE conv.user_id = $1
GROUP BY knowledge_point
ORDER BY conversation_count DESC;

-- 统计包含特定知识点的对话数
SELECT COUNT(*) as conversation_count
FROM ai_conversations conv
JOIN content c ON c.id = conv.content_id
WHERE conv.user_id = $1
AND c.tags @> ARRAY['鸡兔同笼'];
```

**优势**：
1. ✅ **避免数据冗余**：不重复存储相同的数据
2. ✅ **数据一致性**：tags 修改后，所有查询自动反映最新值
3. ✅ **维护简单**：不需要同步更新
4. ✅ **存储节省**：减少存储空间

**性能考虑**：
- PostgreSQL 的 JOIN 性能对于这种一对一的关联关系非常高效
- 如果 `content_id` 有索引（已有外键索引），JOIN 性能不是问题
- 如果未来有性能需求，可以考虑添加物化视图或缓存层

2. **个性化推荐**：
   - "你之前学过鸡兔同笼，这里还有相关的题目"
   - 基于历史 conversation 推荐相关内容

3. **学习报告生成**：
   - "你最近在学习：鸡兔同笼（3次对话）、一元一次方程（2次对话）"

4. **数据分析**：
   - 分析哪些知识点最受欢迎
   - 哪些知识点问题最多
   - 用户的薄弱知识点

#### 应该保存什么内容？

**✅ 好的例子**（可聚合的分类标签）：
- `"鸡兔同笼"` - 可以聚合所有关于鸡兔同笼的对话
- `"一元一次方程"` - 可以聚合所有关于一元一次方程的对话
- `"函数图像"` - 可以聚合所有关于函数图像的对话
- `"勾股定理"` - 可以聚合所有关于勾股定理的对话

**❌ 不好的例子**（太具体，难以聚合）：
- `"鸡兔同笼：互换数量的奥秘"` - 太具体，只是一个具体题目的标题
- `"数学小课堂：鸡兔互换之谜"` - 包含修饰词，不够简洁

#### 提取策略（基于实际数据结构）

基于你提供的数据示例：
```json
{
  "title": "鸡兔同笼：互换数量的奥秘",
  "tags": ["小学数学","鸡兔同笼","逻辑推理","和差问题","代数思维"],
  "description": "通过动态演示和逻辑拆解，学习如何利用"和差法"解决复杂的鸡兔同笼变体问题。",
  "metadata_json": {
    "meta": {
      "topic": "鸡兔同笼 (互换问题)"
    }
  }
}
```

**推荐提取为**：`["鸡兔同笼", "和差问题"]` 或 `["鸡兔同笼"]`

**提取策略（按优先级）**：
1. **`tags[]` 数组** - 直接使用或过滤后使用
   - 优点：tags 是专门用于分类的字段，包含多个标签，可以直接使用
   - 策略：
     - **方案 A（推荐）**：直接使用 `content.tags`（如果 tags 都是知识点相关的）
     - **方案 B**：过滤掉过于通用的标签（如 "小学数学"、"逻辑推理"），只保留具体的知识点标签
   - 示例：`tags: ["小学数学","鸡兔同笼","逻辑推理","和差问题"]` → `["鸡兔同笼", "和差问题"]`

2. **`metadata_json.meta.topic`** - 从 metadata 中提取主题
   - 优点：AI 分析后生成的，更准确（如 "鸡兔同笼 (互换问题)"）
   - 缺点：不是所有内容都有 metadata_json（需要 analyze_html 之后才有）
   - 处理：如果 topic 是单个字符串，转换为数组 `[topic]`

3. **`title`** - 使用标题作为备选
   - 优点：所有内容都有 title
   - 缺点：可能包含修饰词，需要简化（如 "鸡兔同笼：互换数量的奥秘" → `["鸡兔同笼"]`）

---

## 3.2 ai_messages 表（消息表）

### 语义
> Conversation 是容器，Message 是时间序列

### 表结构

```sql
CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联到会话
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE NOT NULL,
  
  -- 消息内容
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL, -- 原始内容（markdown / text）
  rendered_content TEXT, -- 可选：前端渲染后的 HTML（katex / highlight）
  
  -- 可选：UI 状态（仅 user 消息需要）
  ui_state JSONB, -- 存储发送消息时的页面状态
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- 可选：消息元数据
  metadata JSONB -- 存储额外信息（如流式传输状态、错误信息等）
);

-- 索引
CREATE INDEX idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX idx_ai_messages_created_at ON ai_messages(created_at);
CREATE INDEX idx_ai_messages_role ON ai_messages(role);

-- RLS 策略（通过 conversation 的 user_id/visitor_id 控制）
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_messages_select_policy" ON ai_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_conversations
      WHERE ai_conversations.id = ai_messages.conversation_id
      AND (
        ai_conversations.user_id = auth.uid()
        OR ai_conversations.user_id IS NULL
        OR ai_conversations.visitor_id LIKE 'visitor-%'
      )
    )
  );

CREATE POLICY "ai_messages_insert_policy" ON ai_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_conversations
      WHERE ai_conversations.id = ai_messages.conversation_id
      AND (
        ai_conversations.user_id = auth.uid()
        OR ai_conversations.user_id IS NULL
      )
    )
  );
```

### 字段说明

| 字段 | 必要性 | 说明 |
|------|--------|------|
| `conversation_id` | ✅ 必需 | 外键关联到 conversation |
| `role` | ✅ 必需 | 'user' | 'assistant' | 'system' |
| `content` | ✅ 必需 | 原始消息内容（markdown 格式） |
| `rendered_content` | ❌ 可选 | 渲染后的 HTML（未来功能，避免重复渲染） |
| `ui_state` | ⚠️ 推荐 | 仅 user 消息需要，存储页面状态快照 |
| `metadata` | ❌ 可选 | 扩展字段，存储额外信息 |

---

## 3.3 ai_usage_logs 表（保持不变，但定位清晰）

### 定位
```text
ai_usage_logs = 技术日志 & 计费 & 审计
ai_conversations + ai_messages = 用户学习行为数据
```

### 关联关系

```sql
-- 为 ai_usage_logs 添加关联字段（迁移时添加）
ALTER TABLE ai_usage_logs 
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message_id UUID REFERENCES ai_messages(id) ON DELETE SET NULL;

CREATE INDEX idx_ai_usage_logs_conversation_id ON ai_usage_logs(conversation_id);
CREATE INDEX idx_ai_usage_logs_message_id ON ai_usage_logs(message_id);
```

### 使用场景

- **计费**：记录每次 LLM 调用的 tokens 消耗
- **审计**：记录 API 调用详情
- **调试**：记录错误信息和请求详情
- **关联**：通过 `conversation_id` 和 `message_id` 关联到对话和消息

---

# 四、可行性分析

## 4.1 技术可行性：✅ **完全可行**

### 数据库层面
- ✅ Supabase/PostgreSQL 完全支持
- ✅ 外键约束、RLS 策略均可实现
- ✅ 性能：索引设计合理，查询效率高

### 代码层面
- ✅ 后端：需要重构 `aiGuideService.js`，但逻辑清晰
- ✅ 前端：需要调整 API 调用，但状态管理更简单
- ⚠️ 迁移：需要数据迁移脚本

---

## 4.2 迁移成本评估

### 数据迁移（必需）

需要将现有 `ai_usage_logs` 中的对话数据迁移到新表：

```sql
-- 迁移脚本（完整版，处理 request_payload 中的历史消息）
-- 注意：此脚本需要在应用层执行，因为需要解析 JSONB 中的 messages 数组

-- ============================================
-- 步骤 1: 创建 conversations（从 ai_usage_logs 提取）
-- ============================================
INSERT INTO ai_conversations (id, user_id, visitor_id, content_id, language_code, created_at)
SELECT DISTINCT ON (request_id)
  request_id::uuid as id,
  user_id,
  visitor_id,
  content_id,
  COALESCE(
    (SELECT language_code FROM content WHERE id = ai_usage_logs.content_id),
    'zh-CN'
  ) as language_code,
  MIN(created_at) as created_at
FROM ai_usage_logs
WHERE action_type = 'ai_guide' AND request_id IS NOT NULL
GROUP BY request_id, user_id, visitor_id, content_id
ON CONFLICT (id) DO NOTHING;

-- 注意：knowledge_points 字段已移除，直接通过 JOIN content.tags 查询

-- ============================================
-- 步骤 2: 提取 messages（需要处理 request_payload.messages）
-- ============================================
-- 注意：由于 PostgreSQL 的 JSONB 处理限制，建议使用应用层脚本
-- 以下是 SQL 版本（可能需要在应用层优化）

-- 方法 A: 从 request_payload.messages 提取（推荐，包含完整历史）
-- 这需要解析 JSONB 数组，建议使用应用层脚本（见下方 JavaScript 版本）

-- 方法 B: 从 user_query 和 response_metadata.reply 提取（简单但可能丢失历史）
INSERT INTO ai_messages (conversation_id, role, content, ui_state, created_at)
SELECT 
  request_id::uuid as conversation_id,
  'user' as role,
  user_query as content,
  CASE 
    WHEN request_payload->>'ui_state' IS NOT NULL 
    THEN request_payload->'ui_state'
    ELSE NULL
  END as ui_state,
  created_at
FROM ai_usage_logs
WHERE action_type = 'ai_guide' 
  AND user_query IS NOT NULL 
  AND user_query != 'Start the session.' -- 排除初始消息（已在 request_payload 中）
  AND request_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO ai_messages (conversation_id, role, content, created_at)
SELECT 
  request_id::uuid as conversation_id,
  'assistant' as role,
  response_metadata->>'reply' as content,
  created_at
FROM ai_usage_logs
WHERE action_type = 'ai_guide' 
  AND response_metadata->>'reply' IS NOT NULL
  AND request_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

**⚠️ 重要：由于 `request_payload.messages` 包含完整对话历史，建议使用应用层脚本进行迁移：**

```javascript
// 迁移脚本（Node.js / JavaScript）
// 文件：edu/backend/migrations/migrate_ai_guide_to_conversations.js

const { supabase } = require('../src/services/database');

async function migrateConversations() {
  // 1. 获取所有 ai_guide 类型的 logs
  const { data: logs, error } = await supabase
    .from('ai_usage_logs')
    .select('*')
    .eq('action_type', 'ai_guide')
    .order('created_at', { ascending: true });

  if (error) throw error;

  const conversationMap = new Map(); // conversation_id -> { conversation, messages }

  for (const log of logs) {
    if (!log.request_id) continue;

    // 2. 创建或获取 conversation
    if (!conversationMap.has(log.request_id)) {
      // 获取 content 信息
      const { data: content } = await supabase
        .from('content')
        .select('language_code, tags, metadata_json, title')
        .eq('id', log.content_id)
        .single();

      // 提取知识点数组（优先级：tags[] > metadata_json.meta.topic > title）
      // knowledge_points 应该是可以用于分类分析的标签数组，如 ["鸡兔同笼", "和差问题"]
      let knowledgePoints = null;
      if (content?.tags && content.tags.length > 0) {
        // 方案 A：直接使用 tags 数组（推荐）
        knowledgePoints = content.tags;
        
        // 方案 B：过滤掉过于通用的标签（可选）
        // const genericTags = ['小学数学', '中学数学', '逻辑推理', '代数思维'];
        // knowledgePoints = content.tags.filter(tag => !genericTags.includes(tag));
        // if (knowledgePoints.length === 0) {
        //   knowledgePoints = content.tags; // 如果过滤后为空，使用原始 tags
        // }
      } else if (content?.metadata_json?.meta?.topic) {
        // 从 metadata 提取主题（转换为数组）
        knowledgePoints = [content.metadata_json.meta.topic];
      } else if (content?.title) {
        // 使用标题作为备选（简化标题，转换为数组）
        const simplifiedTitle = content.title.split('：')[0].split(':')[0].trim();
        knowledgePoints = [simplifiedTitle];
      }

      const { data: conversation, error: convError } = await supabase
        .from('ai_conversations')
        .insert({
          id: log.request_id,
          user_id: log.user_id,
          visitor_id: log.visitor_id,
          content_id: log.content_id,
          // 注意：knowledge_points 字段已移除，直接通过 JOIN content.tags 查询
          language_code: content?.language_code || 'zh-CN',
          created_at: log.created_at
        })
        .select()
        .single();

      if (convError && convError.code !== '23505') throw convError; // 忽略重复键错误

      conversationMap.set(log.request_id, {
        conversation: conversation || { id: log.request_id },
        messages: new Set() // 用于去重
      });
    }

    const conv = conversationMap.get(log.request_id);

    // 3. 从 request_payload.messages 提取历史消息（如果存在）
    if (log.request_payload?.messages && Array.isArray(log.request_payload.messages)) {
      for (const msg of log.request_payload.messages) {
        // 跳过 system 消息（不需要存储）
        if (msg.role === 'system') continue;

        // 创建消息的唯一标识（用于去重）
        const msgKey = `${msg.role}:${msg.content?.substring(0, 50)}`;

        if (!conv.messages.has(msgKey)) {
          conv.messages.add(msgKey);

          // 插入消息
          await supabase
            .from('ai_messages')
            .insert({
              conversation_id: log.request_id,
              role: msg.role,
              content: msg.content,
              ui_state: log.request_payload.ui_state || null,
              created_at: log.created_at // 使用 log 的时间戳
            });
        }
      }
    }

    // 4. 从 user_query 和 response_metadata.reply 提取当前消息（如果不在 request_payload 中）
    if (log.user_query && log.user_query !== 'Start the session.') {
      const msgKey = `user:${log.user_query.substring(0, 50)}`;
      if (!conv.messages.has(msgKey)) {
        conv.messages.add(msgKey);
        await supabase
          .from('ai_messages')
          .insert({
            conversation_id: log.request_id,
            role: 'user',
            content: log.user_query,
            ui_state: log.request_payload?.ui_state || null,
            created_at: log.created_at
          });
      }
    }

    if (log.response_metadata?.reply) {
      const msgKey = `assistant:${log.response_metadata.reply.substring(0, 50)}`;
      if (!conv.messages.has(msgKey)) {
        conv.messages.add(msgKey);
        await supabase
          .from('ai_messages')
          .insert({
            conversation_id: log.request_id,
            role: 'assistant',
            content: log.response_metadata.reply,
            created_at: log.created_at
          });
      }
    }
  }

  console.log(`迁移完成：${conversationMap.size} 个会话`);
}

// 执行迁移
migrateConversations().catch(console.error);
```

### 代码迁移（必需）

| 模块 | 工作量 | 风险 |
|------|--------|------|
| `aiGuideService.js` | 中等（2-3天） | 低（逻辑清晰） |
| `api/ai_guide.js` | 小（1天） | 低（主要是调用方式变化） |
| 前端组件 | 小（1-2天） | 低（API 接口保持兼容） |
| 数据迁移脚本 | 小（1天） | 中（需要测试） |

### 总工作量估算
- **开发时间**：5-7 个工作日
- **测试时间**：2-3 个工作日
- **总计**：1-2 周

---

## 4.3 收益分析

### 短期收益（1-3个月）
- ✅ 代码可维护性提升
- ✅ 查询性能优化（不需要从 JSONB 提取）
- ✅ 前端状态管理简化

### 长期收益（3个月+）
- ✅ **学习分析**：可以分析“某个知识点被问了多少次”
- ✅ **个性化推荐**：基于历史 conversation 推荐内容
- ✅ **用户价值沉淀**：用户可以回顾历史对话
- ✅ **商业化**：可以基于 conversation 数量限制免费用户
- ✅ **产品迭代**：可以分析 entry_point 的使用情况

---

## 4.4 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 数据迁移失败 | 中 | 1. 先在测试环境验证<br>2. 保留原表作为备份<br>3. 编写回滚脚本 |
| API 兼容性 | 低 | 1. 保持 API 接口兼容<br>2. 双写策略（迁移期间） |
| 性能问题 | 低 | 1. 合理设计索引<br>2. 测试查询性能 |
| 开发时间超期 | 中 | 1. 分阶段迁移<br>2. 优先级排序 |

---

# 五、迁移策略（推荐）

## 5.1 分阶段迁移（推荐）

### 阶段 1：准备（1-2天）
1. ✅ 创建新表结构
2. ✅ 编写数据迁移脚本（测试环境验证）
3. ✅ 编写回滚脚本

### 阶段 2：双写（3-5天）
1. ✅ 后端同时写入新表和旧表
2. ✅ 前端优先读取新表，失败时回退到旧表
3. ✅ 数据迁移脚本执行（在低峰期）

### 阶段 3：切换（1-2天）
1. ✅ 前端完全切换到新表
2. ✅ 验证数据一致性
3. ✅ 停止写入旧表（但保留数据作为备份）

### 阶段 4：清理（可选，1天）
1. ⚠️ 清理旧表数据（建议保留 1-3 个月作为备份）
2. ✅ 更新文档

---

## 5.2 向后兼容策略

### API 兼容

保持现有 API 接口不变，内部实现切换到新表：

```javascript
// 现有 API（保持不变）
POST /api/ai/guide/init
POST /api/ai/guide/chat
GET /api/ai/guide/messages?conversation_id=...

// 内部实现切换到新表
// aiGuideService.js 内部使用 ai_conversations 和 ai_messages
```

### 数据兼容

迁移期间，`ai_usage_logs` 表继续保留对话数据，作为备份。

---

# 六、API 设计（与现有 API 兼容）

## 6.1 现有 API（保持不变）

```http
# 初始化对话
POST /api/ai/guide/init
{
  "content_id": "uuid"
}
Response: {
  "success": true,
  "data": {
    "conversation_id": "uuid",
    "initial_message": "...",
    "metadata": {...}
  }
}

# 发送消息（流式）
POST /api/ai/guide/chat
{
  "conversation_id": "uuid",
  "message": "...",
  "ui_state": {...}
}
Response: SSE stream

# 获取消息列表
GET /api/ai/guide/messages?conversation_id=uuid
Response: {
  "success": true,
  "data": {
    "messages": [
      {
        "role": "user",
        "content": "...",
        "created_at": "..."
      },
      {
        "role": "assistant",
        "content": "...",
        "created_at": "..."
      }
    ]
  }
}
```

## 6.2 内部实现变化

```javascript
// aiGuideService.js (新实现)

// 初始化对话（支持恢复历史对话）
const initConversation = async (contentId, userId) => {
  const { isVisitorId } = require('../utils/visitorId');
  const isVisitor = isVisitorId(userId);
  
  // 1. 检查是否已有该 content_id 和 user_id 的 conversation
  let query = supabase
    .from('ai_conversations')
    .select('id, created_at, updated_at')
    .eq('content_id', contentId)
    .order('updated_at', { ascending: false })
    .limit(1);
  
  if (isVisitor) {
    query = query.eq('visitor_id', userId).is('user_id', null);
  } else {
    query = query.eq('user_id', userId).is('visitor_id', null);
  }
  
  const { data: existingConversations, error: queryError } = await query;
  
  if (queryError) {
    console.error('Error querying existing conversations:', queryError);
  }
  
  // 如果已有 conversation，恢复历史对话
  if (existingConversations && existingConversations.length > 0) {
    const existingConversation = existingConversations[0];
    
    // 获取历史消息
    const { data: messages, error: messagesError } = await supabase
      .from('ai_messages')
      .select('role, content, created_at')
      .eq('conversation_id', existingConversation.id)
      .order('created_at', { ascending: true });
    
    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    }
    
    // 构建历史消息列表（排除 system 消息）
    const historyMessages = (messages || [])
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    
    // 更新 conversation 的 updated_at
    await supabase
      .from('ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', existingConversation.id);
    
    return {
      conversation_id: existingConversation.id,
      initial_message: historyMessages.length > 0 ? null : undefined, // 如果有历史消息，不返回初始消息
      messages: historyMessages, // 返回历史消息列表
      metadata: await getOrGenerateMetadata(contentId),
      is_resumed: true // 标记为恢复的对话
    };
  }
  
  // 2. 如果没有历史 conversation，创建新的 conversation
  const { data: conversation, error: insertError } = await supabase
    .from('ai_conversations')
    .insert({
      user_id: !isVisitor ? userId : null,
      visitor_id: isVisitor ? userId : null,
      content_id: contentId,
      // 注意：knowledge_points 字段已移除，直接通过 JOIN content.tags 查询
      language_code: await getLanguageCode(contentId) // 从 content.language_code 获取
    })
    .select()
    .single();
  
  if (insertError) throw insertError;
  
  // 3. 生成初始消息
  const initialMessage = await generateInitialMessage(contentId);
  
  // 4. 保存 system message（可选）
  await supabase
    .from('ai_messages')
    .insert({
      conversation_id: conversation.id,
      role: 'system',
      content: 'Session started'
    });
  
  // 5. 保存 assistant message
  const { data: assistantMessage, error: messageError } = await supabase
    .from('ai_messages')
    .insert({
      conversation_id: conversation.id,
      role: 'assistant',
      content: initialMessage
    })
    .select()
    .single();
  
  if (messageError) throw messageError;
  
  // 6. 记录到 ai_usage_logs（用于计费）
  await logAIUsage({
    conversation_id: conversation.id,
    message_id: assistantMessage.id,
    // ... 其他计费字段
  });
  
  return {
    conversation_id: conversation.id,
    initial_message: initialMessage,
    messages: [], // 新对话没有历史消息
    metadata: await getOrGenerateMetadata(contentId),
    is_resumed: false // 标记为新对话
  };
};
```

---

# 七、前端状态管理（简化）

## 7.1 状态模型

```typescript
// 更清晰的类型定义
type AIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  rendered_content?: string; // 未来支持
  ui_state?: any; // 仅 user 消息
  created_at: string;
};

type AIConversation = {
  id: string;
  content_id: string;
  content?: {
    tags?: string[]; // 通过 JOIN 获取
  };
  messages: AIMessage[];
  created_at: string;
  updated_at: string;
};
```

## 7.2 状态管理简化

```typescript
// 之前：需要从 logs 中重建 conversation
const messages = logs.map(log => ({
  role: 'user',
  content: log.user_query,
  // ... 需要处理 JSONB 字段
}));

// 现在：直接获取 messages
const { data } = await api.getMessages(conversationId);
const messages = data.messages; // 已经是正确的格式
```

---

# 八、扩展能力（方案 2 的价值）

## 8.1 学习轨迹分析

```sql
-- 某个知识点被问了多少次？（通过 JOIN content.tags 查询）
SELECT 
  unnest(c.tags) as knowledge_point, 
  COUNT(*) as conversation_count
FROM ai_conversations conv
JOIN content c ON c.id = conv.content_id
WHERE conv.user_id = $1
GROUP BY knowledge_point
ORDER BY conversation_count DESC;

-- 或者：统计包含特定知识点的对话数（使用数组操作符）
SELECT COUNT(*) as conversation_count
FROM ai_conversations conv
JOIN content c ON c.id = conv.content_id
WHERE conv.user_id = $1
AND c.tags @> ARRAY['鸡兔同笼'];

-- 某个知识点的平均对话长度
SELECT 
  unnest(c.tags) as knowledge_point,
  AVG(message_count) as avg_message_count
FROM ai_conversations conv
JOIN content c ON c.id = conv.content_id
LEFT JOIN LATERAL (
  SELECT COUNT(*) as message_count
  FROM ai_messages m
  WHERE m.conversation_id = conv.id
) msg ON true
WHERE conv.user_id = $1
GROUP BY knowledge_point;
```

## 8.2 个性化推荐

```javascript
// 基于历史 conversation 推荐相关内容
const getUserLearningHistory = async (userId) => {
  const { data } = await supabase
    .from('ai_conversations')
    .select('content_id, created_at, content(tags)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  // 分析用户的学习轨迹，推荐相关内容
  // 从 content.tags 获取知识点标签
  return analyzeLearningPath(data);
};
```

## 8.3 用户价值沉淀

```typescript
// 用户可以看到历史对话
const ConversationsList = () => {
  const conversations = useConversations(userId);
  
  return (
    <div>
      {conversations.map(conv => (
        <ConversationCard
          key={conv.id}
          title={conv.title || `关于 ${conv.content?.tags?.join('、') || '未知知识点'} 的对话`}
          messageCount={conv.message_count}
          lastActive={conv.updated_at}
          onClick={() => navigate(`/conversations/${conv.id}`)}
        />
      ))}
    </div>
  );
};
```

## 8.4 商业化

```sql
-- 免费用户：限制 conversation 数量
SELECT COUNT(*) as conversation_count
FROM ai_conversations
WHERE user_id = $1
AND created_at > NOW() - INTERVAL '30 days';

-- 如果超过 10 个，提示升级
```

---

# 九、常见问题（FAQ）

## Q1: 是否需要立即迁移？

**A**: 不是必须立即迁移。当前方案 1 可以继续使用，但建议在以下情况考虑迁移：
- 需要实现学习分析功能
- 需要实现对话回放功能
- 代码维护成本增加
- 准备商业化功能（对话数量限制）

## Q2: 迁移期间如何保证数据一致性？

**A**: 使用双写策略：
1. 迁移期间，同时写入新表和旧表
2. 前端优先读取新表，失败时回退到旧表
3. 数据迁移脚本在低峰期执行
4. 验证数据一致性后，停止写入旧表

## Q3: 为什么不需要 `knowledge_points` 字段？

**A**: 如果 `knowledge_points` 只是 `content.tags[]` 的拷贝，会造成数据冗余，违反数据库规范化原则。

**替代方案**：直接通过 `JOIN content` 表查询 `tags[]` 字段。

**优势**：
1. ✅ **避免数据冗余**：不重复存储相同的数据
2. ✅ **数据一致性**：tags 修改后，所有查询自动反映最新值
3. ✅ **维护简单**：不需要同步更新
4. ✅ **存储节省**：减少存储空间

**性能考虑**：
- PostgreSQL 的 JOIN 性能对于这种一对一的关联关系非常高效
- 如果 `content_id` 有索引（已有外键索引），JOIN 性能不是问题
- 如果未来有性能需求，可以考虑添加物化视图或缓存层

**查询示例**：
```sql
-- 统计用户最常问哪些知识点
SELECT 
  unnest(c.tags) as knowledge_point, 
  COUNT(*) as conversation_count
FROM ai_conversations conv
JOIN content c ON c.id = conv.content_id
WHERE conv.user_id = $1
GROUP BY knowledge_point
ORDER BY conversation_count DESC;
```

## Q4: `rendered_content` 字段是否需要立即实现？

**A**: 不是必须。可以：
1. 初始阶段设为 NULL
2. 前端继续实时渲染
3. 未来需要性能优化时，再实现缓存渲染结果

## Q5: 如何与现有的 `visitor_id` 机制兼容？

**A**: 完全兼容。新表的 `user_id` 和 `visitor_id` 字段设计与原表一致：
- 登录用户：`user_id` 有值，`visitor_id` 为 NULL
- 未登录用户：`user_id` 为 NULL，`visitor_id` 有值（格式：`visitor-{uuid}`）

## Q6: 使用过 AI Guide 之后，下次点开会不会自动读取历史对话？

**A**: **是的，方案 2 支持自动恢复历史对话**。

### 实现逻辑

当用户点击打开 AI Guide 时，`initConversation` 函数会：

1. **检查是否存在历史对话**：
   - 查询 `ai_conversations` 表，查找是否有该 `content_id` 和 `user_id`（或 `visitor_id`）的 conversation
   - 按 `updated_at` 降序排列，获取最近一次对话

2. **如果存在历史对话**：
   - 返回已有的 `conversation_id`
   - 从 `ai_messages` 表获取所有历史消息（排除 `system` 消息）
   - 返回历史消息列表给前端
   - 设置 `is_resumed: true` 标记为恢复的对话
   - 更新 conversation 的 `updated_at` 时间戳

3. **如果不存在历史对话**：
   - 创建新的 conversation
   - 生成初始问候消息
   - 返回新对话信息
   - 设置 `is_resumed: false` 标记为新对话

### API 响应格式

```json
{
  "success": true,
  "data": {
    "conversation_id": "uuid",
    "initial_message": "...", // 仅新对话有初始消息，恢复的对话为 null
    "messages": [ // 历史消息列表
      {
        "role": "user",
        "content": "..."
      },
      {
        "role": "assistant",
        "content": "..."
      }
    ],
    "metadata": {...},
    "is_resumed": true // 是否为恢复的对话
  }
}
```

### 前端处理

前端收到响应后：

- 如果 `is_resumed: true`：使用 `messages` 数组恢复历史对话界面
- 如果 `is_resumed: false`：显示 `initial_message` 作为新对话的开始

这样用户可以无缝继续之前的对话，提升用户体验。

---

# 十、总结与建议

## 10.1 方案对比

| 维度 | 方案 1（当前） | 方案 2（推荐） |
|------|----------------|----------------|
| **实现复杂度** | 低（已实现） | 中（需要迁移） |
| **代码可维护性** | 中 | 高 |
| **查询性能** | 中（需要从 JSONB 提取） | 高（直接查询） |
| **扩展性** | 低 | 高 |
| **数据分析能力** | 低 | 高 |
| **迁移成本** | 无 | 中（1-2周） |

## 10.2 推荐决策

### ✅ 建议迁移，如果：
- 计划在 3 个月内实现学习分析功能
- 计划实现对话回放功能
- 代码维护成本增加
- 准备商业化功能

### ⚠️ 可以暂缓，如果：
- 当前功能满足需求
- 开发资源紧张
- 短期内不计划新功能

## 10.3 迁移时间建议

- **最佳时机**：功能稳定期，用户量适中时
- **避免时机**：新功能开发高峰期、用户增长期

---

# 十一、实时对话功能

## 11.1 概述

支持基于 WebSocket 的实时语音/文字对话，采用 OpenAI Realtime API 兼容协议（如 hrqdapi.cn）。

**技术栈**：
- 后端：Node.js + `ws` 库
- 前端：React + 原生 `WebSocket` 或 `useSWR` 等
- API Key：从 `.env` 的 `GPT_REALTIME_API_KEY` 读取，**切勿写入代码或文档**

## 11.2 环境配置

在 `.env` 或 `env.example` 中添加：

```bash
# 实时对话 API（OpenAI Realtime 兼容）
GPT_REALTIME_API_KEY=your-realtime-api-key-here
GPT_REALTIME_WS_URL=wss://hrqdapi.cn/v1/realtime
```

> ⚠️ **安全**：API Key 仅存于服务端 env，前端通过后端代理建立 WebSocket，不直接暴露 Key。

## 11.3 协议要点

- **URL**：`wss://hrqdapi.cn/v1/realtime?model=gpt-4o-realtime-preview`（`ws://` 用于非 HTTPS 环境）
- **Headers**：`Authorization: Bearer <API_KEY>`，`OpenAI-Beta: realtime=v1`
- **首条事件**：连接后发送 `response.create`，指定 `modalities: ["text"]` 和 `instructions`

## 11.4 后端示例（Node.js）

```javascript
// backend/src/services/realtimeService.js
const WebSocket = require('ws');

const REALTIME_WS_URL = process.env.GPT_REALTIME_WS_URL || 'wss://hrqdapi.cn/v1/realtime';
const API_KEY = process.env.GPT_REALTIME_API_KEY;

function createRealtimeConnection(conversationId, contentId, onMessage, onError, onClose) {
  const url = `${REALTIME_WS_URL}?model=gpt-4o-realtime-preview`;
  const ws = new WebSocket(url, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });

  ws.on('open', () => {
    ws.send(JSON.stringify({
      type: 'response.create',
      response: {
        modalities: ['text'],
        instructions: 'Please assist the user with learning.'
      }
    }));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'error') {
        onError?.(msg.error);
      } else {
        onMessage?.(msg);
      }
    } catch (e) {
      onError?.(e);
    }
  });

  ws.on('error', onError);
  ws.on('close', onClose);
  return ws;
}

module.exports = { createRealtimeConnection };
```

## 11.5 前端示例（React）

```tsx
// 通过后端代理建立 WebSocket，避免暴露 API Key
useEffect(() => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/api/ai-guide/realtime?conversation_id=${conversationId}`;
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    if (data.type === 'response.done' && data.response?.output) {
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response.output.join('') }]);
    }
  };

  ws.onerror = (e) => console.error('Realtime WS error:', e);
  return () => ws.close();
}, [conversationId]);
```

## 11.6 Python 参考（调试/本地测试）

```python
# pip install websocket-client
import os
import json
import websocket

url = os.getenv("GPT_REALTIME_WS_URL", "wss://hrqdapi.cn/v1/realtime") + "?model=gpt-4o-realtime-preview"
api_key = os.getenv("GPT_REALTIME_API_KEY")

def on_open(ws):
    ws.send(json.dumps({
        "type": "response.create",
        "response": {
            "modalities": ["text"],
            "instructions": "Please assist the user."
        }
    }))

def on_message(ws, message):
    data = json.loads(message)
    print(json.dumps(data, ensure_ascii=False, indent=2))

ws = websocket.WebSocketApp(
    url,
    header={"Authorization": f"Bearer {api_key}", "OpenAI-Beta": "realtime=v1"},
    on_open=on_open,
    on_message=on_message
)
ws.run_forever()
```

## 11.7 集成建议

| 模块 | 说明 |
|------|------|
| 后端代理 | WebSocket 端点 `/api/ai-guide/realtime`，转发到 Realtime API |
| `ai_conversations` | 新增 `conversation_type` 区分 text / realtime |
| 计费 | 实时对话计入 `ai_usage_logs` |

---

## 11.8 数据库优化（实时对话）

### 11.8.1 ai_conversations 新增字段

```sql
-- 对话类型：text（文字）| realtime（实时语音）
ALTER TABLE ai_conversations 
  ADD COLUMN IF NOT EXISTS conversation_type TEXT NOT NULL DEFAULT 'text';

CREATE INDEX IF NOT EXISTS idx_ai_conversations_type ON ai_conversations(conversation_type);
```

### 11.8.2 ai_messages 记录对话内容

实时对话的用户语音与助手回复均写入 `ai_messages`：

| 来源 | role | content 说明 |
|------|------|-------------|
| 用户语音 | user | 语音转文字结果，或占位 `[语音]` |
| 助手回复 | assistant | `response.audio_transcript` 或 `response.text` |
| 系统 | system | 可选，如 instructions |

写入时机：收到 `response.done` / `response.audio_transcript.done` 后，通过后端 WebSocket 代理或单独 API 写入 `ai_messages`。

### 11.8.3 ai_usage_logs 记录用量

实时对话每次请求需记录：

```sql
-- 示例字段
action_type = 'ai_guide_realtime'
request_id = conversation_id（或 realtime_session_id）
user_id / visitor_id
content_id
input_tokens, output_tokens -- 若有
response_metadata: { duration_ms, audio_chunks, ... }
```

后端在转发 Realtime API 响应时，根据 `response.output_audio_done` 或 `response.done` 的 usage 信息写入 `ai_usage_logs`。

### 11.8.4 实现顺序建议

1. 先支持前端实时对话（不落库）
2. 再增加 `conversation_type` 与 `ai_messages` 写入
3. 最后补充 `ai_usage_logs` 计费

---

# 附录：完整 SQL 脚本

见 `edu/backend/migrations/create_ai_conversations_tables.sql`（需要创建）

---

# 附录：辅助函数实现示例

## 查询知识点标签（通过 JOIN）

```javascript
// 注意：knowledge_points 字段已移除，直接通过 JOIN content.tags 查询

// 示例：获取用户的对话历史（包含知识点标签）
const getConversationsWithTags = async (userId) => {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select(`
      id,
      content_id,
      created_at,
      updated_at,
      content:content_id (
        tags
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  return { data, error };
};

// 示例：统计用户最常问的知识点
const getUserKnowledgePointStats = async (userId) => {
  // 使用 PostgreSQL 查询（通过 RPC 或直接 SQL）
  // SELECT unnest(c.tags) as knowledge_point, COUNT(*) as conversation_count
  // FROM ai_conversations conv
  // JOIN content c ON c.id = conv.content_id
  // WHERE conv.user_id = $1
  // GROUP BY knowledge_point
  // ORDER BY conversation_count DESC;
};
```

## getLanguageCode 函数

```javascript
// 从 content 表获取语言代码
async function getLanguageCode(contentId) {
  const { data: content } = await supabase
    .from('content')
    .select('language_code')
    .eq('id', contentId)
    .single();
  
  return content?.language_code || 'zh-CN';
}
```
