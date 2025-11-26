# 🟦 **PRD for AI Guided Learning System — eduNest**

## 📌 **1. 产品目标（Product Overview）**

eduNest 的 "AI Guided Learning" 模块旨在：

* 让 AI 理解 iframe 内部的互动页面内容（文字 / 2D / 3D / 动画 / 实验）
* 对学生进行提问式、对话式、引导式学习辅导
* 提供基于页面内容的解释、活动建议、探索路径
* 支持持续对话、记忆当前页面理解

每个 HTML 页面内容不同，因此问题核心是：

> ❗如何让 AI **理解页面内容**，并且**持续跟用户互动**
> 而不用每轮发 HTML？

解决方案：**Metadata + UI State + Dialogue Context**。

---

# 🟦 **2. 数据库结构**

## 2.1 content 表新增字段

在现有 `content` 表中添加 metadata 相关字段：

```sql
ALTER TABLE content ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE content ADD COLUMN IF NOT EXISTS metadata_created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE content ADD COLUMN IF NOT EXISTS metadata_updated_at TIMESTAMP WITH TIME ZONE;
```

| 字段 | 类型 | 说明 |
|------|------|------|
| metadata_json | jsonb | 页面结构化描述（AI 生成） |
| metadata_created_at | timestamp | metadata 首次生成时间 |
| metadata_updated_at | timestamp | metadata 更新时间 |

## 2.2 复用 ai_usage_logs 表

对话历史复用现有 `ai_usage_logs` 表，无需新建表：

| 字段 | 用途 |
|------|------|
| request_id | 作为会话 ID（同一会话用同一个） |
| user_id | 用户 ID |
| content_id | 关联的内容 ID |
| action_type | 设为 `"ai_guide"` 标识导学对话 |
| user_query | 用户消息 |
| response_metadata | 存储 `{ reply: "AI回复", ui_state: {...} }` |
| created_at | 消息时间戳 |

### 查询示例

```sql
-- 获取某用户对某内容的所有会话
SELECT DISTINCT request_id, MIN(created_at) as started_at
FROM ai_usage_logs
WHERE user_id = $1 
  AND content_id = $2 
  AND action_type = 'ai_guide'
GROUP BY request_id
ORDER BY started_at DESC;

-- 获取某个会话的所有消息
SELECT user_query, response_metadata, created_at
FROM ai_usage_logs
WHERE request_id = $1 AND action_type = 'ai_guide'
ORDER BY created_at ASC;
```

---

# 🟦 **3. Metadata 提取体系**

## 3.1 Why Metadata?

* HTML 明细太大，不适合每轮发送
* AI 只需要 "结构化理解"
* Metadata 是每个页面固定的 "知识结构"
* 同一页面对话中 Metadata 不变
* 只在首次载入时生成一次

## 3.2 Metadata 提取流程

### ✔ Step 1 — 检查数据库

* 如果 `content.metadata_json` 不为空 → 直接使用
* 如果为空 → 把 `full_html` 发送给 LLM → 生成 metadata → 存入 content 表

### ✔ Step 2 — 存储 metadata

```typescript
await supabase
  .from('content')
  .update({
    metadata_json: generatedMetadata,
    metadata_created_at: new Date().toISOString(),
    metadata_updated_at: new Date().toISOString()
  })
  .eq('id', contentId);
```

---

# 🟦 **4. Flexible JSON Metadata Schema**

⚠ **核心原则：**  
这里只提供一个**通用参考 JSON 模板**，帮助 AI 思考「可以从 HTML 里抽什么信息」，**不是固定 schema**。  
AI 在真正生成 metadata 时，必须根据当前 HTML 的真实内容和结构，**选用/删减/调整字段，甚至新增更合适的字段**，而不是机械照抄整个模板。

```json
{
  "meta": {
    "title": "string",                 // 页面主标题
    "topic": "string",                 // 主题/知识点概述
    "gradeLevel": "string|null",       // 适用学段：小学/初中/高中/大学/成人
    "domain": "string|null",           // math / physics / chemistry / business / ...
    "contentType": "string",           // math-3d-visualization / physics-experiment / business-case / quiz 等
    "difficulty": "beginner|intermediate|advanced|null",
    "language": "zh-CN|en-US|null",
    "tags": ["string"]                 // 关键词标签
  },

  "objectives": ["string"],            // 学习目标列表（可为空）

  "sections": [                        // 按页面逻辑分段（tab / 步骤 / 大段落）
    {
      "id": "string",
      "title": "string",
      "type": "intro | theory | example | exercise | visualization | summary | other",
      "concepts": ["string"],          // 本段涉及的关键概念
      "linksTo": ["section-id"]        // 可选：关联/依赖的其他段落
    }
  ],

  "conceptMap": {                      // 概念 -> 说明/关联
    "概念A": ["要点1", "要点2"],
    "概念B": ["要点1", "要点2"]
  },

  "visualElements": [                  // 主要可视化/图形模块
    {
      "id": "string",
      "kind": "3d-scene | 2d-canvas | svg-diagram | chart | image | video | text-block",
      "description": "string",
      "techStack": ["three.js", "konva", "chart.js"],  // 实际检测到的库（如有）
      "role": "explain-concept | show-example | let-user-explore | background-decoration"
    }
  ],

  "interactions": [                    // 关键交互入口（按钮、滑块、手势、滚动等）
    {
      "id": "string",
      "type": "click | drag | hover | input | slider | toggle | gesture | scroll",
      "label": "string",               // UI 文案或大致含义
      "effect": "string"               // 交互结果：播放动画/切换步骤/修改参数等
    }
  ],

  "actions": {                         // AI 可建议的高层动作（基于 interactions / visualElements 抽象）
    "playAnimation": "string|null",    // 例如："播放主动画"
    "highlightObject": "string|null",  // 例如："高亮 BN 向量"
    "goToSection": "string|null",      // 例如："跳转到 part3-angle"
    "resetScene": "string|null"        // 例如："重置三维视图"
  },

  "pageStateSchema": {                 // 建议的 ui_state 结构（前端可按需实现/调整键名）
    "currentSectionId": "string",
    "highlightedId": "string|null",
    "cameraState": "object|null",
    "animationStatus": "playing|paused|stopped|null",
    "userAnswer": "string|number|object|null"
  },

  "keywords": ["string"]               // 方便检索/过滤的关键词
}
```

> **使用约定（非常重要）：**
> - 上面 JSON 只是一个「参考模版」和「字段命名风格」示例。
> - **所有字段都是可选的**：如果页面没有动画，就不要生成 `actions.playAnimation`；如果没有 3D，就不要生成 `pageStateSchema.cameraState`。
> - 如果某个页面有更特殊的结构（比如很多题目小问、多个实验场景），**可以在这个基础上新增更合适的字段或嵌套结构**，但整体风格尽量与本模版保持一致（易读、语义清晰）。
> - 在实现时，AI 需要先理解 HTML 实际内容，再决定「用哪些字段」「是否增减字段」，而不是让页面去适配 JSON。

### 📌 广泛场景示例：

#### A. 科学实验 (Experiment/Simulation)
*   **Visuals**: WebGL/Canvas 渲染的实验台、仪器、粒子效果。
*   **Interactions**: 拖动滑块改变参数（温度/速度）、点击按钮开始/暂停、拖拽物体移动。
*   **State**: `temperature`, `reaction_rate`, `is_running`.
*   **Pedagogy**: 探究式 (Exploratory)，鼓励用户尝试不同参数组合。

#### B. 数学解题 (Math/Geometry)
*   **Visuals**: SVG 或 Canvas 绘制的几何图形、函数曲线。
*   **Interactions**: 拖动顶点改变形状、输入框填写证明步骤、点击显示辅助线。
*   **State**: `vertex_coordinates`, `step_index`, `is_correct`.
*   **Pedagogy**: 分步引导 (Step-by-step)，在用户卡住时提供提示。

#### C. 商业/社科图表 (Data Visualization)
*   **Visuals**: ECharts/Chart.js 渲染的柱状图、饼图、雷达图。
*   **Interactions**: 悬停查看数据详情、点击图例筛选数据、切换年份视图。
*   **State**: `selected_year`, `highlighted_category`.
*   **Pedagogy**: 苏格拉底式 (Socratic)，提问用户从数据中观察到了什么趋势。

#### D. 互动课件/科普 (Courseware/Article)
*   **Visuals**: 图文混排、嵌入式视频、简单的 CSS 动画。
*   **Interactions**: 滚动触发动画 (Scroll-trigger)、翻页、展开/收起详情。
*   **State**: `scroll_position`, `current_slide`.
*   **Pedagogy**: 讲授式，解释概念并确认理解。

---

# 🟦 **5. Metadata Extraction Prompt**

工程师给 LLM 的 prompt（用于生成 metadata）：

```
You are an advanced educational content analyzer. Your task is to extract comprehensive structured metadata from the provided HTML content to power an AI Learning Guide.

The content could be ANYTHING: a 3D experiment, a math problem, a business case chart, a game, a slide deck, or a simple interactive article.

RULES:
1. **Analyze Deeply**: Look at HTML structure, CSS styles, and JavaScript logic to understand what the page DOES, not just what it looks like.
2. **Identify Technology**: Recognize libraries like Three.js, PixiJS, D3, ECharts, Vue, React, etc., to better describe visual elements.
3. **Capture Interactivity**: Identify HOW a user interacts (clicks, drags, gestures, scrolls, inputs). What changes when they interact?
4. **Extract Pedagogy**: What is the learning goal? Is it exploring, solving, or reading?
5. **No Hallucinations**: Only describe features actually present in the code.

OUTPUT FORMAT:
- Return ONLY a valid JSON object.
- The structure MUST be tailored to the current HTML page.
- You may:
  - Use the recommended grouping keys: "meta", "pedagogy", "structure", "visual_elements", "interactive_elements", "state_variables", "guidance_strategy", **or**
  - Design a more page-specific schema (e.g. "title", "topic", "gradeLevel", "sections", "conceptMap", "actions", "pageStateSchema", "keywords") if that matches the content better.
- Field names should be meaningful and consistent within the JSON.
- Do NOT include fields that do not make sense for this page.

Now analyze the provided HTML code and generate the metadata JSON that best fits it.
```

---

# 🟦 **6. AI Guided Learning System Prompt**

放在系统角色中，用于多轮辅导：

```
You are an AI Learning Guide inside eduNest. You are "pair-learning" with a student who is looking at an interactive web page.

CONTEXT:
- **Metadata**: JSON describing the page's content, structure, and capabilities.
- **UI State**: Real-time values from the page (e.g., current slider value, selected object).
- **Conversation**: History of your chat.

YOUR ROLE:
Adapt your teaching style to the `content_type` and `domain` defined in metadata:
- **Experiment/Simulation**: Act as a Lab Partner. Encourage "What if?" questions. Suggest trying specific interactions defined in `interactive_elements`.
- **Math/Problem**: Act as a Tutor. Don't give answers. Ask guiding questions to check understanding of `key_concepts`.
- **Data/Chart**: Act as an Analyst. Ask the user to interpret trends or outliers in the `visual_elements`.
- **Game/Quiz**: Act as a Coach. Cheer them on and offer hints from `guidance_strategy` if they fail.
- **Article/Lecture**: Act as a Discussion Partner. Summarize sections and ask reflection questions.

INTERACTION RULES:
1. **Context Aware**: If the user asks "What is this?", use `visual_elements` to explain what they are likely pointing at or looking at.
2. **Action Oriented**: If `state_variables` show the user hasn't interacted yet, gently suggest using a specific control (e.g., "Try dragging the blue slider...").
3. **Concise**: Keep replies short and focused on the content.

Start by welcoming the student. If `learning_objectives` are present, briefly mention what they can learn here.
```

---

# 🟦 **7. API 接口设计**

## 7.1 初始化对话 — POST /api/ai-guide/init

```typescript
// 请求
{
  content_id: string
}

// 响应
{
  conversation_id: string,  // 新生成的 request_id
  initial_message: string,  // AI 初始问候
  metadata: object          // 页面 metadata（可选返回）
}
```

**后端逻辑：**
1. 查询 `content.metadata_json`
   - 如果为空 → 调用 LLM 生成 metadata → 存入 content 表
   - 如果存在 → 直接使用
2. 生成新的 `request_id` 作为 conversation_id
3. 调用 LLM（system prompt + metadata）获取初始问候
4. 保存到 `ai_usage_logs`（action_type = 'ai_guide'）
5. 返回结果

## 7.2 发送消息 — POST /api/ai-guide/chat

```typescript
// 请求
{
  conversation_id: string,
  message: string,
  ui_state?: object  // 可选，用户当前交互状态
}

// 响应
{
  reply: string
}
```

**后端逻辑：**
1. 保存用户消息到 `ai_usage_logs`
2. 查询该 conversation 的历史消息（最近 N 条）
3. 查询关联 content 的 `metadata_json`
4. 组装 messages[] 调用 LLM
5. 保存 AI 回复到 `ai_usage_logs`
6. 返回结果

## 7.3 获取会话列表 — GET /api/ai-guide/conversations

```typescript
// 请求参数
content_id: string

// 响应
{
  conversations: [
    {
      conversation_id: string,
      started_at: string,
      message_count: number
    }
  ]
}
```

## 7.4 获取会话历史 — GET /api/ai-guide/messages

```typescript
// 请求参数
conversation_id: string

// 响应
{
  messages: [
    {
      role: 'user' | 'assistant',
      content: string,
      created_at: string
    }
  ]
}
```

---

# 🟦 **8. 前端组件设计**

## 8.1 交互设计

```
┌────────────────────────────────────────────────────────────┐
│  iframe 渲染区域                                            │
│                                                            │
│                                                            │
│                                                            │
│                                              ┌──────────┐  │
│                                              │ 💬 AI导学 │  │  ← 浮动按钮
│                                              └──────────┘  │
└────────────────────────────────────────────────────────────┘

点击后：

┌────────────────────────────────────────────────────────────┐
│  iframe 渲染区域                          │ AI 导学对话框  │
│                                          │ ┌────────────┐ │
│                                          │ │ 🤖 AI:     │ │
│                                          │ │ 这是一道... │ │
│                                          │ │            │ │
│                                          │ │ 👤 你:     │ │
│                                          │ │ 怎么理解...│ │
│                                          │ │            │ │
│                                          │ ├────────────┤ │
│                                          │ │ [输入框]   │ │
│                                          │ └────────────┘ │
└────────────────────────────────────────────────────────────┘
```

## 8.2 组件结构

```
components/
├── AIGuidedLearning/
│   ├── AIGuideButton.tsx        # 浮动按钮
│   ├── AIGuideDrawer.tsx        # 侧边抽屉对话框
│   ├── AIGuideMessageList.tsx   # 消息列表
│   ├── AIGuideInput.tsx         # 输入框
│   └── index.tsx                # 主组件
```

## 8.3 组件功能

### AIGuideButton（浮动按钮）
- 位置：右下角固定
- 状态：正常 / 有新消息 / 加载中
- 点击展开对话框

### AIGuideDrawer（侧边抽屉）
- 从右侧滑出
- 可拖拽调整宽度
- 可最小化回按钮状态
- 对话历史保持

### AIGuideMessageList（消息列表）
- 显示对话历史
- 支持 Markdown 渲染
- 自动滚动到底部

### AIGuideInput（输入框）
- 多行输入
- Enter 发送 / Shift+Enter 换行
- 发送中禁用

## 8.4 使用示例

```tsx
import { AIGuidedLearning } from '@/components/AIGuidedLearning';

function ContentViewer({ contentId, fullHTML }) {
  return (
    <div className="relative">
      <FullHTMLRenderer fullHTML={fullHTML} />
      
      {/* AI 导学浮动按钮 + 对话框 */}
      <AIGuidedLearning 
        contentId={contentId}
        onUIStateChange={(state) => {
          // 可选：监听 iframe 内的用户交互
        }}
      />
    </div>
  );
}
```

---

# 🟦 **9. 多轮记忆策略**

## 9.1 需要维持的状态

### A. metadata（from content 表）
* 每个页面固定
* 多轮对话中不变化
* 只在初始化时获取一次

### B. Conversation History（from ai_usage_logs）
* 按 `request_id` 分组
* 用 messages[] 方式发送给 LLM

### C. ui_state（前端每次变化推给后端）
* 结构示例：

```json
{
  "last_interaction": {
    "element": "slider-angle",
    "value": 40
  },
  "current_tab": "step-2"
}
```

## 9.2 上下文窗口管理

为避免 token 超限，采用滑动窗口策略：

```typescript
// 获取最近 N 条消息
const recentMessages = await getRecentMessages(conversationId, 10);

// 组装请求
const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: `METADATA:\n${JSON.stringify(metadata)}` },
  ...recentMessages,
  { role: 'user', content: userMessage }
];
```

---

# 🟦 **10. 实现重点**

1. **每个 content 唯一 metadata** — 存在 `content.metadata_json`
2. **metadata 不随对话变化** — 只在首次生成
3. **对话历史复用 ai_usage_logs** — 用 `action_type = 'ai_guide'` 标识
4. **request_id 作为会话 ID** — 同一会话用同一个
5. **可选字段多，不能用固定 schema** — AI 灵活解析
6. **前端浮动按钮 + 侧边抽屉** — 不遮挡内容，可最小化
