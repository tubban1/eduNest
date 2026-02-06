# AI Guided Learning 总体文档（AIGuidedLearning 一站式说明）

本文件是 **AIGuidedLearning 的唯一权威说明文档**，从产品、架构、系统分层、Runtime API 命名、数据结构到任务清单全部集中在这里。  
参考文档：`ARCHITECTURE.md`（系统架构）、`DataStructure.md`（数据库结构）、`Interactive_Learning.md`（学习分析与时间感知架构）。

---

## 1. 核心概念：AI 输出 vs AIGuide 模块

| 维度 | AI 输出（内容） | AIGuide（平台模块） |
|------|----------------|---------------------|
| **是什么** | AI 生成的 `full_html`（HTML+Vue 交互页面） | 平台的「AI 导学」功能：浮动按钮 + 对话抽屉 |
| **运行位置** | iframe 内（由 FullHTMLRenderer 通过 srcdoc 渲染） | 父页面内（与 FullHTMLRenderer 为兄弟组件） |
| **代码归属** | 由 `aiService` 的 prompt 约束，AI 生成 | 平台手写，`AIGuidedLearning` + `aiGuideService` |
| **职责** | 教学内容展示、交互、**调用** `window.eduNestRuntime` | 监听 runtime 消息、维护 UI 状态、调用后端 AI Guide API |
| **是否在 AI 输出里** | 是（即 full_html） | **否**，独立模块 |

> **要点**：AIGuide 不在 AI 输出的代码里面，而是平台独立实现的模块。AI 只负责生成教学内容，并在其中**调用**平台注入的 `window.eduNestRuntime`。

---

## 2. 系统架构中的位置（参考 ARCHITECTURE.md）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 内容页 (/c/[short_id])                                                       │
│   ┌─────────────────────────────────────┐  ┌──────────────────────────────┐  │
│   │ FullHTMLRenderer                    │  │ AIGuidedLearning（平台模块）  │  │
│   │  - 用 srcdoc 渲染 content.full_html │  │  - 浮动按钮 + 对话抽屉        │  │
│   │  - 未来：注入 eduNestRuntime 脚本   │  │  - 监听 postMessage           │  │
│   │  - iframe ← 内容运行于此            │  │  - 调用 api.aiGuide.*         │  │
│   └──────────────┬──────────────────────┘  └──────────────┬───────────────┘  │
│                  │ postMessage                             │                  │
│                  └─────────────────────────────────────────┘                  │
│                                          │                                   │
└──────────────────────────────────────────┼───────────────────────────────────┘
                                           ▼
                                    Backend API
                                    /api/ai-guide/*
                                    aiGuideService
                                           │
                                           ▼
                                    Supabase
                                    ai_conversations, ai_messages, ai_usage_logs
```

---

## 3. 全链路一致性：Prompt → 输出 API → 注入 Runtime → 前端交互 → 后端 → 数据库

### 3.1 Prompt（aiService.js）

文件：`edu/backend/src/services/aiService.js`  
位置：`TYPE_SPECIFIC_PROMPTS.interactive.technical_constraints.runtime_api`

约束 AI 生成的 HTML+Vue 代码**只调用**以下 API，不实现、不覆盖：

- `window.eduNestRuntime.dispatchLearningEvent(eventType, data)`
- `window.eduNestRuntime.requestAIGuideHelp(payload)`（可选，如「需要帮助」按钮）
- 状态暴露：`data-*`（如 `data-stage-index`, `data-current-stage`, `data-score`） + 可选 `window.__eduNestUIStateProvider = () => ({ ... })`

### 3.2 AI 输出（full_html）

AI 输出的内容中应包含的调用示例：

```js
// 阶段切换
window.eduNestRuntime?.dispatchLearningEvent('stage_change', { stage: stageId, stageIndex });

// 参数变化
window.eduNestRuntime?.dispatchLearningEvent('parameter_change', { score, ... });

// 请求帮助（可选）
window.eduNestRuntime?.requestAIGuideHelp({ question: '...', currentStage: '...' });
```

- `stageIndex`：1-based 整数（1, 2, 3…）
- `stageId`：稳定字符串（如 `'LEARN'`, `'QUIZ'`, `'RESULT'`）

### 3.3 注入的 Runtime API（平台实现）

平台在 iframe 内注入的 `window.eduNestRuntime` 需实现以下接口（**命名与 Prompt 完全一致**，无 `trackEvent` 等别名）：

| 方法 | 说明 | postMessage 行为 |
|------|------|------------------|
| `dispatchLearningEvent(eventType, data)` | 学习事件上报 | 向父窗口发送 `{ type: 'EDUNEST_EVENT', data: { eventType, data, timestamp } }` |
| `requestAIGuideHelp(payload)` | 请求 AI 导学 | 向父窗口发送 `{ type: 'EDUNEST_AI_GUIDE_REQUEST', data: payload }` |
| `getUIState()` | 获取 UI 状态（由平台调用，内容不实现） | 汇总表单、data-*、`__eduNestUIStateProvider()`；父窗口请求时回复 `{ type: 'EDUNEST_UI_STATE_RESPONSE', data: state }` |

父窗口与 iframe 的 postMessage 协议：

| 方向 | 消息 type | 说明 |
|------|-----------|------|
| iframe → 父 | `EDUNEST_EVENT` | 内容调用了 `dispatchLearningEvent` |
| iframe → 父 | `EDUNEST_AI_GUIDE_REQUEST` | 内容调用了 `requestAIGuideHelp` |
| iframe → 父 | `EDUNEST_UI_STATE_RESPONSE` | 响应父窗口的 `EDUNEST_GET_UI_STATE` 请求 |
| 父 → iframe | `EDUNEST_GET_UI_STATE` | 父窗口请求 iframe 内的 UI 状态 |

### 3.4 前端 AIGuidedLearning（平台模块）

- 监听 `EDUNEST_EVENT`、`EDUNEST_AI_GUIDE_REQUEST`、`EDUNEST_UI_STATE_RESPONSE`
- 维护 `currentStage`、`currentUIState`
- 实现 `refreshUIState()`：向 iframe 发 `EDUNEST_GET_UI_STATE`，等待 `EDUNEST_UI_STATE_RESPONSE`
- 调用 `api.aiGuide.init`、`api.aiGuide.chatStream(conversationId, message, ui_state)` 等

### 3.5 后端 API

| 路由 | 说明 | 入参 |
|------|------|------|
| `POST /api/ai-guide/init` | 初始化会话 | `content_id` |
| `POST /api/ai-guide/chat` | 文字对话（流式） | `conversation_id`, `message`, `ui_state` |
| `POST /api/ai-guide/init-free` | 访客初始化 | `content_id` |
| `POST /api/ai-guide/chat-free` | 访客对话 | `conversation_id`, `message`, `ui_state` |

服务：`edu/backend/src/services/aiGuideService.js`  
使用 `metadata_json.canonical` + `ui_state` + 历史消息构造 LLM 请求。

### 3.6 数据库存储（参考 DataStructure.md）

| 表 | 用途 |
|----|------|
| `ai_conversations` | 会话（entry_point = `'ai_guide'`，content_id 关联内容） |
| `ai_messages` | 消息（role, content, ui_state, metadata） |
| `ai_usage_logs` | 使用日志（action_type = `'ai_guide'`，request_payload 含 ui_state） |

---

## 4. 相关数据结构（DataStructure 摘要）

### 4.1 ai_conversations

- `id`, `user_id`, `visitor_id`, `content_id`, `entry_point`（`'ai_guide'`）, `language_code`, `title`, `summary`, `created_at`, `updated_at`

### 4.2 ai_messages

- `id`, `conversation_id`, `role`, `content`, `rendered_content`, `ui_state`（由 AIGuidedLearning 传入）, `metadata`, `created_at`

### 4.3 ai_usage_logs

- `id`, `user_id`, `content_id`, `action_type`（`'ai_guide'`）, `user_query`, `request_payload`, `response_metadata`, `request_id`, `status`, `created_at` 等

---

## 5. AIGuidedLearning 组件现状

组件位置：`edu/frontend/src/components/AIGuidedLearning/index.tsx`  
使用位置：`edu/frontend/src/app/c/[short_id]/page.tsx`（与 FullHTMLRenderer 为兄弟组件）

### 已实现

- 浮动按钮 + 抽屉 UI
- 会话初始化（init / initFree）
- 文本对话（chatStream / chatStreamFree）
- 免费试用逻辑（visitor / 已登录）

### 缺口

- 未监听 `EDUNEST_EVENT` / `EDUNEST_UI_STATE_RESPONSE` / `EDUNEST_AI_GUIDE_REQUEST`
- `chatStream` 调用时 `ui_state` 传 `null`
- 语音 Realtime 未与 AIGuidedLearning 共享 `currentStage` / `ui_state`

---

## 6. 任务清单（统一跟踪）

### 6.1 必做：文字对话接入 runtime_api ✅

1. [x] 在 AIGuidedLearning 中添加 postMessage 监听，处理 `EDUNEST_EVENT`、`EDUNEST_UI_STATE_RESPONSE`、`EDUNEST_AI_GUIDE_REQUEST`
2. [x] 实现 `refreshUIState()`，在 `handleSendMessage` 前调用，将 `{ currentStage, uiState }` 传入 `chatStream` / `chatStreamFree`

### 6.2 必做：平台注入 eduNestRuntime ✅

3. [x] 在 FullHTMLRenderer 中注入 `window.eduNestRuntime` 脚本，实现 `dispatchLearningEvent`、`requestAIGuideHelp`、`getUIState` 及 postMessage 协议
   - ✅ 始终注入 runtime 脚本（移除跳过条件）
   - ✅ `getUIState()` 支持从 `__eduNestUIStateProvider` 和 `data-*` 属性提取状态
   - ✅ 增强：从 `currentStage` 推断 `stageIndex`（当缺少 `data-stage-index` 时）

### 6.3 中期：TeachingSnapshot 与 Realtime

4. [x] **实现 `buildTeachingSnapshot(meta, currentStage, uiState)` 模块** ✅
   - ✅ 位置：`edu/backend/src/services/teachingSnapshot.js`（新建模块）
   - ✅ 输入：`metadata_json.canonical`、`currentStage`（`{ stageId, stageIndex }`）、`uiState`（`Record<string, unknown>`）
   - ✅ 输出：`TeachingSnapshot` 对象（包含当前阶段、关键参数、学习进度等）
   - ✅ 集成：已在 `handleChat` 中调用，将 TeachingSnapshot 注入到 system prompt
   - ⏳ 测试：在 short_id 页面发送消息，检查后端日志中的 TeachingSnapshot（开发环境会打印）

5. [x] **Realtime Proxy 支持 `edu.context.update`，将 TeachingSnapshot 注入 Realtime 模型** ✅
   - ✅ 位置：`edu/backend/src/services/realtimeProxy.js`
   - ✅ 监听 `edu.context.update` 消息类型
   - ✅ 将 `TeachingSnapshot` 注入到 Realtime 模型的 instructions/system prompt 中
   - ✅ 防抖机制：3 秒内最多更新一次（阶段变化时立即更新）
   - ✅ 前端集成：在 AIGuidedLearning 中发送 `edu.context.update`（连接时 + 阶段变化时）
   - ⏳ 测试：发送语音消息时，检查 Realtime 请求的 instructions 是否包含 TeachingSnapshot

### 6.4 后续：可观测与学习分析

6. [x] **在 `ai_usage_logs` / `ai_messages.metadata` 中记录 `ui_state`、TeachingSnapshot** ✅
   - ✅ 位置：`edu/backend/src/services/aiGuideService.js`
   - ✅ `ai_usage_logs.request_payload` 中记录 `ui_state`、`teaching_snapshot`
   - ✅ `ai_messages` 插入时写入 `metadata: { ui_state, teaching_snapshot }`（user 与 assistant 消息）
   - ⏳ 测试：发送消息后，查询数据库确认 `request_payload.ui_state`、`request_payload.teaching_snapshot` 及 `ai_messages.metadata` 已保存

7. [x] **与 `Interactive_Learning.md`、`Learning_Analysis_Report_Example.md` 对齐，补充学习分析报表** ✅
   - ✅ 数据来源：`ai_messages.metadata`（ui_state、teaching_snapshot）、`ai_usage_logs.request_payload`
   - ✅ 表：`learning_analysis_reports`（迁移见 `edu/backend/migrations/learning_analysis_reports.sql`）
   - ✅ 服务：`edu/backend/src/services/learningAnalysisService.js`（生成/列表/详情）
   - ✅ API：`POST /api/ai-guide/learning-reports/generate`，`GET /api/ai-guide/learning-reports`，`GET /api/ai-guide/learning-reports/:id`
   - ⏳ 测试：执行迁移后登录调用生成接口，查询报告验证 summary、ai_guide_usage 等字段

---

## 9. 下一步开发建议（按优先级）

### 优先级 1：TeachingSnapshot（任务 4）
**目标**：让 AI Guide 知道用户当前在哪个阶段、参数是什么，提供上下文感知的回复。

**步骤**：
1. 定义 `TeachingSnapshot` 数据结构（参考文档中的定义）
2. 实现 `buildTeachingSnapshot(meta, currentStage, uiState)`
3. 在 `chat` / `chatFree` 中调用，传入 LLM 的 system prompt
4. **测试**：在 short_id 页面打开 AI Guide，发送消息，检查后端日志中的 TeachingSnapshot

### 优先级 2：Realtime 集成（任务 5）
**目标**：语音对话也能感知当前阶段和 UI 状态。

**步骤**：
1. 在 Realtime Proxy 中添加 `edu.context.update` 消息处理
2. 将 TeachingSnapshot 注入到 Realtime 模型的 instructions
3. **测试**：发送语音消息，检查 Realtime 请求的 instructions

### 优先级 3：数据记录（任务 6）
**目标**：记录所有交互的上下文，用于后续分析。

**步骤**：
1. 在 `aiGuideService.chat` / `chatFree` 中保存 `ui_state` 到 `ai_usage_logs`
2. 在保存消息时，将 `ui_state` 和 `teachingSnapshot` 写入 `ai_messages.metadata`
3. **测试**：发送消息后查询数据库，确认字段已保存

### 优先级 4：学习分析（任务 7）✅
**目标**：基于记录的数据生成学习分析报表。

**已实现**：
1. 报表数据来自 `ai_messages.metadata`、`ai_usage_logs.request_payload`（ui_state、teaching_snapshot）
2. `learningAnalysisService` 聚合会话/消息/日志，按 content 统计 topic、stages_used、message_count
3. **测试**：执行 `migrations/learning_analysis_reports.sql` 后，调用 `POST /api/ai-guide/learning-reports/generate` 生成报表，`GET /api/ai-guide/learning-reports` 查看列表

---

## 7. Runtime API 命名规范（唯一标准）

全链路统一使用以下命名，无别名、无历史兼容：

| 用途 | 方法/约定 | 说明 |
|------|-----------|------|
| 事件上报 | `dispatchLearningEvent(eventType, data)` | 内容调用，平台注入实现 |
| 请求帮助 | `requestAIGuideHelp(payload)` | 内容调用，平台注入实现 |
| 获取状态 | `getUIState()` | 平台实现，内容不实现；内容通过 data-* 和 `__eduNestUIStateProvider` 暴露 |
| 状态扩展 | `window.__eduNestUIStateProvider = () => ({...})` | 内容可选设置，`getUIState` 内部会合并 |

---

## 8. 总结

- **AI 输出** = full_html，仅包含教学内容，通过调用 `window.eduNestRuntime` 与平台通信。
- **AIGuidedLearning** = 平台独立模块，运行在父页面，监听 iframe 消息、调用后端、管理会话。
- **命名一致**：Prompt、AI 输出、注入脚本、前端监听、后端存储全链路统一使用 `dispatchLearningEvent`、`requestAIGuideHelp`、`getUIState`，无 `trackEvent` 等旧名。
- 后续开发与变更以本文档为准。
