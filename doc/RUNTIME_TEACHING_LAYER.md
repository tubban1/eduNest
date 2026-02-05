# eduNest Runtime 与 Teaching Layer 完整设计

> 整合 Runtime API 注入、Runtime 开发指南与 **Teaching Runtime Layer**，形成「可观测、可推理的学习操作系统」架构。  
> 版本：1.0 | 日期：2026-01

---

## 📋 目录

1. [架构总览](#一架构总览)
2. [当前内容架构与 Runtime API 注入策略](#二当前内容架构与-runtime-api-注入策略)
3. [设计时 vs 运行时](#三设计时-vs-运行时)
4. [Teaching Runtime Layer](#四teaching-runtime-layer)
5. [metadata、metadata_realtime 与 TeachingSnapshot（含固定格式二选一）](#五metadatametadata_realtime-与-teachingsnapshot-的关系)
6. [Realtime 与 TeachingSnapshot 集成](#六realtime-与-teachingsnapshot-集成)
7. [Runtime API 与上下文上报](#七runtime-api-与上下文上报)
8. [实现路线图](#八实现路线图)
9. [参考文档](#九参考文档)
10. [与现有文档的关系](#十与现有文档的关系)

---

## 一、架构总览

### 1.1 四层模型

```
┌─────────────────────────────────────────────────────────────────────────┐
│  AI Generated Content（设计时）                                         │
│    ├── full_html / 组件                                                 │
│    └── metadata_json（若约定固定格式则可提供 stages、keyConcept 等）     │
├─────────────────────────────────────────────────────────────────────────┤
│  Runtime Engine（平台控制）                                               │
│    ├── UI State 收集（getUIState、data-*、currentStage）                  │
│    ├── 事件追踪（dispatchLearningEvent、stage_change、interaction）       │
│    ├── 计时 / 卡顿检测（time_on_step、stall_threshold）                   │
│    └── 学生行为信号（has_interacted、requested_hint、made_error）          │
├─────────────────────────────────────────────────────────────────────────┤
│  Teaching Runtime Layer（运行时生成）                                     │
│    ├── TeachingSnapshot ← 给 Realtime 用的「当前课堂实况」                │
│    ├── PedagogyMode（guided_questioning / explain / hint_only）         │
│    └── Constraints（no_final_answer、ask_questions_only）                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Realtime Model（只负责「说话」）                                          │
│    └── session.update(instructions = BASE + TeachingSnapshot)             │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心原则

| 原则 | 说明 |
|------|------|
| **metadata ≠ realtime instructions** | metadata 是设计时「图纸」；realtime 需要的是「当前课堂状态」 |
| **TeachingSnapshot 是运行时产物** | 由平台根据 metadata + ui_state + events 生成，不是 AI 生成阶段产出 |
| **单一 session.update，完整快照** | 每次更新都发「当前完整 TeachingSnapshot」，不做 diff，避免模型漏掉 constraints |
| **教学大脑在平台** | Realtime 只负责语音/对话；教什么、怎么教由 Teaching Runtime Layer 决定 |

---

## 二、当前内容架构与 Runtime API 注入策略

### 2.1 当前内容流水线

当前 AI 交互式内容的产出与展示流程为：

```
AI 生成（Prompt）→ full_html（HTML + Vue）
    → RendererEngine.process(full_html)  ← 已有：数学、库、运行时修复等
    → 写入 content.full_html
    → FullHTMLRenderer 以 iframe（srcdoc）加载 full_html
```

- **内容形态**：AI 输出的是 **HTML 包裹 Vue**（Vue 片段内嵌在 HTML 中），外层由平台 **FullHTMLRenderer** 承载并注入 iframe。输出格式已确定为 HTML + Vue，不再使用 Petite-Vue 等单独约定。
- **后端**：生成完成后，**asyncGenerationQueue.updateContentFromAIResult** 会调用 **RendererEngine.process** 对 `full_html` 做检测与自动修复，再写库；因此「注入 Runtime API」若放在 RendererEngine，会自然进入这条流水线。

### 2.2 结论：如何添加 Runtime API

| 维度 | 策略 | 说明 |
|------|------|------|
| **API 实现（脚本）** | **RendererEngine 注入**（主） + **FullHTMLRenderer 兜底** | 由平台统一注入 `window.eduNestRuntime` 的实现脚本，不交给 AI 生成。 |
| **API 的调用方式** | **Prompt 约束** | 在 Content Prompt 中要求 AI 在生成的 HTML/Vue 里**调用** `window.eduNestRuntime`，不要求 AI 输出脚本本身。 |
| **不推荐** | 仅靠 Prompt 让 AI 输出整段 Runtime 脚本 | 易漏写、格式不一、难以升级维护；脚本属于平台能力，应由平台注入。 |

- **为什么以 RendererEngine 为主**  
  - 与现有「生成 → process → 存库」流程一致，存库的 `full_html` 已带 Runtime API，任何入口（分享、嵌入、离线）都能用到。  
  - 与现有 MathFixer、LibraryFixer、RuntimeFixer 等并列，可增加「MISSING_RUNTIME_API」检测 + 注入逻辑（或独立 RuntimeAPIFixer）。  
- **为什么需要 FullHTMLRenderer 兜底**  
  - 历史内容或未经过 RendererEngine 的内容（如手动创建、迁移前数据）可能没有脚本；展示时若检测到无 `window.eduNestRuntime`，再在加载前注入一次，保证所有通过 FullHTMLRenderer 展示的页面都能用上 API。  
- **为什么「调用方式」交给 Prompt**  
  - AI 负责业务逻辑：在阶段切换、滑块变化、点击「需要帮助」时**调用** `dispatchLearningEvent`、`requestAIGuideHelp`、`getUIState` 等；接口名与行为由平台文档与 Prompt 约定，实现由平台注入，职责清晰。

### 2.3 三种方式对比

| 方式 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| **Prompt 中让 AI 输出脚本** | 在系统/用户提示中要求 AI 在 full_html 里写一整段 `window.eduNestRuntime = { ... }` | 无需改后端/前端 | 易漏写、重复、格式不一；升级脚本需改 Prompt；难以保证所有内容都带 API。 |
| **RendererEngine 注入** | 在 process(full_html) 时检测「无 eduNestRuntime」，在 `</body>` 前（或约定位置）插入平台提供的脚本 | 一次注入、存库即带、与现有流程一致；易升级（改一处脚本即可）。 | 需在 RendererEngine 中增加 Checker/Fixer（或 RuntimeAPIFixer）。 |
| **FullHTMLRenderer 注入** | 前端在设置 iframe srcdoc 前，若 HTML 中无 `eduNestRuntime` 则拼接脚本 | 不依赖后端，对所有经该组件展示的内容生效。 | 仅对「经 FullHTMLRenderer 展示」的路径有效；存库内容仍无脚本，其他入口需各自兜底。 |

**推荐组合**：**RendererEngine 为主（写入 full_html）+ FullHTMLRenderer 兜底（展示时补注）**；**Prompt 只约束「在内容中如何调用 API」**，不负责脚本实现。

### 2.4 与现有 RendererEngine 的关系

- 当前 **RendererEngine** 已有 RuntimeChecker / RuntimeFixer，处理的是**音频自动播放、Three.js/GSAP 清理、Vue ref 等**运行时问题，**不包含**「注入 eduNestRuntime 脚本」。
- 增加 Runtime API 注入的两种实现方式（二选一或并存）：  
  1. **新增 RuntimeAPIFixer**：仅负责检测 `window.eduNestRuntime` 缺失并在约定位置插入脚本（参见 RUNTIME_DEVELOPMENT_GUIDE 的 RuntimeAPIFixer）；  
  2. **在现有 RuntimeChecker 中增加 MISSING_RUNTIME_API 检测**，在 RuntimeFixer 中增加对应注入逻辑。  
- 无论哪种，均在 **updateContentFromAIResult → rendererEngine.process** 中执行，无需改生成接口本身。

### 2.5 Prompt 侧约定（内容层「调用」API）

在 **Content Prompt / SYSTEM_PROMPT_CONTENT** 中明确：

- 所有需要「上报学习事件、请求 AI 指导、暴露 UI 状态」的交互，**必须**通过 `window.eduNestRuntime` 完成。
- 示例要求（与 RUNTIME_DEVELOPMENT_GUIDE 一致）：  
  - 阶段切换、参数变化：`window.eduNestRuntime.dispatchLearningEvent(type, payload)`；  
  - 用户点击「需要帮助」：`window.eduNestRuntime.requestAIGuideHelp(context)`；  
  - 平台需要收集当前状态时，由父窗口 postMessage 请求，内容页通过已注入的 `getUIState()` 等响应（AI 只需写出业务逻辑，不实现 API 本身）。

这样：**脚本从哪里来 = RendererEngine（主）+ FullHTMLRenderer（兜底）；内容里怎么用 = Prompt 约定。**

---

## 三、设计时 vs 运行时

### 3.1 设计时（Content + metadata_json）

- **来源**：AI 生成内容时产出，或人工配置。
- **理想角色**：告诉 Runtime「有哪些 stage、哪些是 keyConcept、哪些交互是重要信号」。
- **当前事实**：**metadata_json 没有固定输出格式**，生成阶段 AI 返回的 metadata 结构不统一，因此**拿不到确定的 stages、keyConcept 等**，TeachingSnapshot 与 buildTeachingSnapshot 无法稳定依赖它。
- **不包含**：当前步骤、学生是否卡住、是否刚点了 hint 等**实时状态**。

要获得**确定的** stages、keyConcept 等信息，**必须在某一处约定固定格式**：要么在 **metadata_json**（生成时），要么在 **metadata_realtime**（analyze 时），见 [5.3 固定格式二选一](#53-固定格式二选一或兼有)。

### 3.2 运行时（UI State + Events + TeachingSnapshot）

- **来源**：浏览器/iframe 通过 Runtime API 上报 + Proxy 侧聚合。
- **内容**：currentStage、visible_formula、time_on_step、has_interacted、requested_hint、made_error 等。
- **角色**：驱动 Teaching Runtime Layer 生成 **TeachingSnapshot**，再驱动 Realtime 的 instructions。

---

## 四、Teaching Runtime Layer

### 4.1 TeachingSnapshot 的定位

**TeachingSnapshot = 「老师此刻站在学生旁边能感知到的一切」**

- 由**平台 Runtime 生成**，不是 AI 生成。
- 只包含「当前步骤 + 当前目标 + 学生信号 + 教学约束」，不包含全量 metadata、技术栈、动画库等。
- 供 Realtime 的 `session.update` 使用，作为 instructions 中的「Current teaching context」部分。

### 4.2 TeachingSnapshot Schema（推荐）

```json
{
  "topic": "Exponent Simplification",
  "language": "zh-CN",
  "current_stage": {
    "index": 2,
    "title": "Factoring",
    "visible_expression": "3^{21} + 3^{18} / 3^{15} + 3^{12}",
    "key_rule": "(a^m)^n = a^{mn}"
  },
  "learning_goal_now": "Apply exponent multiplication correctly",
  "student_state": {
    "has_interacted": true,
    "time_on_step_sec": 78,
    "requested_hint": false,
    "made_error": true
  },
  "constraints": {
    "no_final_answer": true,
    "ask_questions_only": true
  }
}
```

字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| `topic` | string | 当前内容主题（来自 metadata 或 content） |
| `language` | string | 界面/语音语言 |
| `current_stage` | object | 当前步骤：index、title、可见公式/表达式、关键规则 |
| `learning_goal_now` | string | 当前步骤的学习目标（可由 stage 推断或来自 metadata） |
| `student_state` | object | 学生信号：是否交互、在当前步停留时间、是否要过 hint、是否刚出错 |
| `constraints` | object | 教学约束：不直接给答案、仅提问等 |

### 4.3 生成函数（Node 侧）

建议在 Proxy 或独立服务中实现，供 WebSocket 消息处理时调用：

```javascript
// buildTeachingSnapshot.js（新建）
function buildTeachingSnapshot({ meta, currentStage, uiState }) {
  return {
    role: 'ai_learning_guide',
    topic: meta?.subtopic || meta?.topic || '当前内容',
    language: meta?.language || 'zh-CN',

    current_stage: currentStage ? {
      index: currentStage.index,
      title: currentStage.title,
      visible_expression: currentStage.visibleExpression || currentStage.formula || null,
      key_rule: currentStage.keyConcept || currentStage.keyRule || null,
    } : null,

    learning_goal_now: inferGoal(currentStage),

    student_state: {
      has_interacted: uiState?.hasInteracted ?? false,
      time_on_step_sec: uiState?.timeOnStepSec ?? 0,
      requested_hint: uiState?.requestedHint ?? false,
      made_error: uiState?.madeError ?? false,
    },

    constraints: {
      no_final_answer: true,
      ask_questions_only: true,
    },
  };
}

function inferGoal(stage) {
  if (!stage) return '理解当前步骤';
  const map = {
    'Base Unification': 'Rewrite different bases into the same base',
    'Factoring': 'Identify and extract common factors',
    'Exponent Multiplication': 'Apply exponent multiplication correctly',
  };
  return map[stage.title] || 'Understand the current transformation';
}

module.exports = { buildTeachingSnapshot };
```

- **meta**：来自 content 的 metadata_json（或后端按 content_id 查询到的元数据）。
- **currentStage**：由前端在「阶段变化」或「上下文更新」时上报。
- **uiState**：由前端通过 Runtime API / postMessage 汇总（getUIState + 事件）。

---

## 五、metadata、metadata_realtime 与 TeachingSnapshot 的关系

### 5.1 metadata 与 TeachingSnapshot

| 维度 | metadata_json | TeachingSnapshot |
|------|----------------|-------------------|
| **何时产生** | 设计时（生成/配置） | 运行时（每次需要更新 Realtime 时） |
| **谁产生** | AI 或人工 | 平台 Runtime 引擎 |
| **内容** | 全量结构、stages、signals、技术栈等 | 当前步骤、当前目标、学生状态、约束 |
| **用途** | 告诉 Runtime「有哪些阶段、哪些是关键步骤、卡顿阈值」 | 告诉 Realtime「此刻该说什么、不该说什么」 |
| **更新频率** | 基本不变 | 每 3–10 秒最多 1 次，且仅在「有意义变化」时 |

**结论**：metadata 是 Teaching Runtime Layer 的**输入**之一；TeachingSnapshot 是 Layer 的**输出**，专门喂给 Realtime。不要用 metadata 的子集或「另一份 realtime 专用 metadata」直接当 instructions。

### 5.2 metadata_realtime：给 AI 老师的「大致在讲什么」

即使不拿到每个 section/stage 的完整结构，AI 老师也需要知道**这节课大致在做什么**，才能做有针对性的引导。建议在 **AI Guide 分析内容（analyze HTML）时** 产出 **metadata_realtime**，且**建议采用固定格式**（见 5.3），以便 buildTeachingSnapshot 稳定解析 stages、keyConcept 等。

- **定位**：对当前内容的简洁、**结构化**描述，供 Realtime / TeachingSnapshot 使用。
- **产出时机**：内容被打开或需要为 AI Guide（含 Realtime）提供上下文时，由「分析 full_html」的流程产出（analyze 请求返回**固定 schema** 的 JSON）。
- **与 metadata_json 的区别**：metadata_json 是生成时的输出（当前无固定格式）；metadata_realtime 是 **analyze 时的输出**，若约定固定格式，则所有经过 analyze 的内容都能得到确定的 stages、keyConcept，且可覆盖历史内容。

### 5.3 固定格式二选一（或兼有）

**问题**：metadata_json 目前无固定输出格式 → 无法稳定得到 stages、keyConcept 等 → TeachingSnapshot 无法依赖。

**结论**：要获得**确定的** stages、keyConcept 等信息，必须在**至少一处**约定固定格式：

| 方案 | 约定位置 | 产出时机 | 优点 | 缺点 |
|------|----------|----------|------|------|
| **A：metadata_json 固定格式** | 生成内容的 Prompt / 解析逻辑 | 内容生成时 | 新内容自带确定结构；与 full_html 同源，一致性好 | 需改生成 Prompt 与存储；历史内容仍无结构，需兜底 |
| **B：metadata_realtime 固定格式** | Analyze HTML 的 Prompt / 接口返回 | 打开内容或请求 AI Guide 时 | 不依赖生成阶段；所有内容（含历史）经一次 analyze 即得统一结构 | 需在打开或使用 AI Guide 时调用 analyze；有额外请求 |
| **A + B 兼有** | 两处都约定 | 生成 + analyze | 新内容有 metadata_json；历史或未带 metadata 的内容用 metadata_realtime 兜底；可互相校验 | 需维护两套 schema，建议字段对齐便于合并 |

**推荐**：至少落实**其一**；若希望新内容与历史内容都能稳定拿到 stages/keyConcept，建议 **B（metadata_realtime 固定格式）** 必做，**A 可选**（新内容生成时即带固定格式则更佳）。

---

**方案 A：metadata_json 固定格式（生成时）**

在**内容生成 Prompt** 中约定：AI 除输出 full_html 外，必须输出一个 **metadata** 对象，且结构固定。例如最小 schema：

```json
{
  "topic": "string，一句话主题",
  "language": "zh-CN",
  "stages": [
    { "index": 1, "title": "string", "key_concept": "string" }
  ],
  "signals": { "stall_threshold_sec": 60, "critical_steps": [1, 2] }
}
```

- 解析：从 AI 返回的 JSON 中提取该对象，写入 content 表或单独字段；buildTeachingSnapshot 读取时按此 schema 解析。

---

**方案 B：metadata_realtime 固定格式（analyze 时）**

在 **AI Guide 分析 HTML（analyze）** 的请求/响应中约定：analyze 的**输出**必须为固定 schema，便于平台与 buildTeachingSnapshot 直接使用。例如最小 schema：

```json
{
  "topic_short": "string，一句话主题",
  "language": "zh-CN",
  "stages": [
    { "index": 1, "title": "string", "key_concept": "string" }
  ]
}
```

- 实现：analyze 的 Prompt 或后端解析中明确要求返回上述结构（可再增加可选字段如 `sections_overview` 数组）；返回后缓存到当前会话或 content 关联，供 edu.context.update 与 buildTeachingSnapshot 使用。
- 这样**不依赖 metadata_json 是否有格式**，所有内容只要经过 analyze 就能得到确定的 stages、keyConcept。

---

**buildTeachingSnapshot 的输入约定**：无论选用 A 或 B，建议统一约定「meta」入参为上述其一（或合并后的）结构，字段名一致（如 `stages[].index / title / key_concept`），以便 current_stage、learning_goal_now 等稳定从 meta 中取。

---

## 六、Realtime 与 TeachingSnapshot 集成

### 6.1 总体思路

- **Realtime 只负责「说话」**；教学逻辑与上下文由平台（Proxy + Teaching Layer）负责。
- **instructions** = 固定「基础人格 + 规则」+ **当前 TeachingSnapshot**（完整 JSON）。
- 通过 **session.update** 动态更新 instructions；不新建 session，不打断语音流。

### 6.2 基础人格（稳定层）

```javascript
const BASE_INSTRUCTIONS = `
You are an AI Learning Guide (Teacher Rao) inside eduNest.

Rules:
- Focus only on the current learning step.
- Never give the final answer.
- Use short, spoken, natural language.
- Guide by asking questions, not explaining everything.
`;
```

### 6.3 客户端 → Proxy：教学上下文更新

约定消息类型 **edu.context.update**，由前端在「阶段变化 / 重要交互」时发送：

```json
{
  "type": "edu.context.update",
  "payload": {
    "meta": { "subtopic": "Exponent Simplification", "language": "zh-CN" },
    "currentStage": {
      "index": 2,
      "title": "Factoring",
      "visibleExpression": "3^{18}(3^3+1)/3^{12}(3^3+1)",
      "keyConcept": "common factor extraction"
    },
    "uiState": {
      "hasInteracted": true,
      "timeOnStepSec": 78,
      "requestedHint": false,
      "madeError": true
    }
  }
}
```

### 6.4 Proxy 侧处理（关键改动）

- 在 **handleClientConnection** 中维护 `currentTeachingSnapshot`。
- 收到 **edu.context.update** 时：
  1. 使用 `buildTeachingSnapshot(payload)` 生成新快照。
  2. 若 upstream 已连接，发送 **session.update**，且 **每次都要带上完整 BASE + 完整 Snapshot**（不做 diff，避免漏掉 constraints）。

```javascript
// realtimeProxy.js 中
clientWs.on('message', (data) => {
  const msg = JSON.parse(data.toString());

  if (msg.type === 'edu.context.update') {
    currentTeachingSnapshot = buildTeachingSnapshot(msg.payload);
    if (upstream && upstream.readyState === 1) {
      upstream.send(JSON.stringify({
        type: 'session.update',
        session: {
          instructions: `${BASE_INSTRUCTIONS}\n\nCurrent teaching context (JSON):\n${JSON.stringify(currentTeachingSnapshot, null, 2)}`,
          modalities: ['text', 'audio'],
          input_audio_transcription: { model: 'whisper-1' }
        }
      }));
    }
    return;
  }

  if (upstream && upstream.readyState === 1) {
    upstream.send(data.toString());
  }
});
```

### 6.5 更新频率建议

| 触发条件 | 是否更新 |
|----------|----------|
| currentStep / currentStage 改变 | ✅ 必须 |
| 学生点击 hint | ✅ 推荐 |
| 学生开始拖拽/重要交互 | 可选 |
| 每帧动画 / 无意义 UI 变化 | ❌ 禁止 |

经验值：**每 3–10 秒最多 1 次 session.update**，避免 token 浪费与行为不稳定。

### 6.6 常见坑：模型突然给答案

- **原因**：新的 session.update 漏了 **constraints**，或 instructions 里没有再次强调 "never give final answer"。
- **解决**：**每一次 update 都包含完整教学规则 + 完整 TeachingSnapshot**，不做 diff/patch。

---

## 七、Runtime API 与上下文上报

### 7.1 与现有 Runtime API 的关系

- **RUNTIME_API_INJECTION.md** 与 **RUNTIME_DEVELOPMENT_GUIDE.md** 中已定义：
  - `window.eduNestRuntime.getUIState()`
  - `window.eduNestRuntime.dispatchLearningEvent(type, payload)`
  - `window.eduNestRuntime.requestAIGuideHelp(context)`
- Teaching Layer **消费**这些能力：
  - 平台层（FullHTMLRenderer / AIGuidedLearning）监听 postMessage，汇总 **ui_state**、**currentStage**、**事件**。
  - 在打开 Realtime 或阶段/交互变化时，向 Proxy 发送 **edu.context.update**（payload 来自 getUIState + 事件 + 当前 content 的 metadata；若有 **metadata_realtime** 可作为 topic / 摘要一并传入）。

### 7.2 前端职责简述

1. **内容页 / iframe**：通过 Runtime API 上报状态与事件（已有或按 RUNTIME_API_INJECTION 实现）。
2. **平台层**：
   - 监听 `EDUNEST_UI_STATE_RESPONSE`、`LEARNING_EVENT`、`AI_GUIDE_REQUEST` 等。
   - 维护「当前 content 的 metadata / metadata_realtime」「当前 stage」「聚合后的 uiState」。
   - 建立 Realtime WebSocket 后，在适当时机发送 **edu.context.update**（含 meta、currentStage、uiState）。

### 7.3 消息流小结

```
[ 内容 iframe ]
  → getUIState / dispatchLearningEvent / requestAIGuideHelp
  → postMessage → [ 平台层 ]
  → 聚合 meta + currentStage + uiState
  → WebSocket 发送 edu.context.update
  → [ Realtime Proxy ]
  → buildTeachingSnapshot → session.update
  → [ Realtime Model ]
```

---

## 八、实现路线图

路线图顺序原则：**先做 Runtime API，且先改 Prompt（影响最小、可测性强），再做脚本注入**；AI 老师需知「大致在讲什么」，故 **metadata_realtime** 在 analyze HTML 时产出并接入 TeachingSnapshot。

### 阶段 1：Runtime API（先 Prompt，再脚本注入）

1. **先改 Prompt（影响最小、可测性强）**  
   - 在 Content Prompt / SYSTEM_PROMPT_CONTENT 中明确：生成的 **HTML 包裹 Vue** 里，凡需要「上报学习事件、请求 AI 指导、暴露 UI 状态」的交互，**必须**通过 `window.eduNestRuntime` 调用（`dispatchLearningEvent`、`requestAIGuideHelp`、需要时配合 `getUIState` 等）。  
   - 不要求 AI 输出 Runtime 脚本本身，只约定调用方式。  
   - 新生成的内容即可按约定写调用逻辑；可先不注入脚本，通过 Mock 或后续注入做联调与验证。

2. **再做脚本注入**  
   - 在 RendererEngine 中增加「MISSING_RUNTIME_API」检测与注入（RuntimeAPIFixer 或扩展 RuntimeFixer），使生成流水线产出的 full_html 自带 `window.eduNestRuntime`。  
   - FullHTMLRenderer 兜底：展示时若 HTML 中无 `eduNestRuntime` 则再注入一次，覆盖历史或未走 Engine 的内容。  
   - 平台层统一监听 UI state 与学习事件，形成供后续 edu.context.update 使用的 uiState 与 currentStage。

### 阶段 2：TeachingSnapshot 与 Proxy 改造

1. **定义 TeachingSnapshot JSON Schema**（见 4.2），并可选在代码中加校验。
2. **实现 buildTeachingSnapshot**（Node），入参：meta、currentStage、uiState（可选：metadata_realtime 作为 topic 等 fallback）。
3. **Realtime Proxy**：支持 **edu.context.update**；维护 currentTeachingSnapshot，在连接建立或上下文更新时发送 session.update（BASE + 完整 Snapshot）。
4. **前端**：在 Realtime 连接建立后发送一次 edu.context.update；在 currentStage 变化、hint 点击等时机再发。

### 阶段 3：固定格式与输入源（metadata_json 和/或 metadata_realtime）

1. **选定固定格式方案**（见 5.3）：在 **metadata_json** 和/或 **metadata_realtime** 中至少选一处约定固定 schema，才能得到确定的 stages、keyConcept 等。
2. **若选 metadata_json 固定格式**：在内容生成 Prompt 中约定 metadata 输出结构（如 topic、language、stages[{ index, title, key_concept }]、signals）；解析并落库后，buildTeachingSnapshot 从 content 的 metadata 读取。
3. **若选 metadata_realtime 固定格式（推荐至少做此）**：在 **AI Guide 分析 HTML（analyze）** 的请求/响应中约定固定 schema（如 topic_short、language、stages[{ index, title, key_concept }]）；analyze 返回后缓存并传入 edu.context.update；buildTeachingSnapshot 可将 metadata_realtime 作为 meta 输入，或与 metadata_json 合并后使用。
4. **buildTeachingSnapshot**：入参 meta 统一按选定 schema 解析（字段名一致），current_stage、learning_goal_now 等从 meta.stages 等稳定取值。

### 阶段 4：可观测与学习分析

1. 将 **TeachingSnapshot + 对话** 落库（如 Supabase），用于学习分析与后续产品化。
2. 可选：静默/犹豫检测（如 3 秒无输入 → has_interacted=false）作为 student_state 信号。

---

## 九、参考文档

| 文档 | 说明 |
|------|------|
| **RUNTIME_API_INJECTION.md** | Runtime API 规范、UI State 收集、事件追踪、注入方案 |
| **RUNTIME_DEVELOPMENT_GUIDE.md** | 双层架构、Runtime API 列表、RendererEngine 注入、前端消息监听、Prompt 分层 |

上述两份文档描述「设计时内容 + 平台 Runtime API」；本文档在此基础上增加 **Teaching Runtime Layer** 与 **Realtime 集成**，使 AI Guide 的 realtime 能力具备「当前内容 + 当前状态」的完整教学上下文。

---

**总结**：  
- **metadata_json** 当前无固定输出格式，无法稳定得到 stages、keyConcept；**须在 metadata_json 或 metadata_realtime 至少一处约定固定格式**，才能有确定的 stages、keyConcept 等信息（见 5.3）。  
- **metadata_realtime** = AI Guide 分析 HTML 时产出；若采用**固定格式**（推荐），则所有经 analyze 的内容都能得到统一结构，供 buildTeachingSnapshot 与 Realtime 使用。  
- **TeachingSnapshot** = 运行时课堂实况，由平台从 meta（固定格式的 metadata 或 metadata_realtime）+ ui_state + events 生成，专供 Realtime。  
- **每次 session.update 都发完整 BASE + 完整 Snapshot**，保证模型始终遵守教学约束与当前焦点。  
- **内容形态**：输出为 **HTML 包裹 Vue**。

---

## 十、与现有文档的关系

- **RUNTIME_API_INJECTION.md**：定义 `getUIState`、`trackEvent`、`requestAIGuide` 等注入规范及 RendererEngine/FullHTMLRenderer 集成方式；Teaching Layer **消费**这些 API 上报的状态与事件。
- **RUNTIME_DEVELOPMENT_GUIDE.md**：定义完整 Runtime API 列表、双层架构、Prompt 分层、后端 API 与前端消息监听；Teaching Layer 位于「Runtime Engine」与「Realtime」之间，不替代现有 API，只增加 **TeachingSnapshot 生成** 与 **edu.context.update** 协议。
- **本文档（RUNTIME_TEACHING_LAYER.md）**：在以上基础上，明确「设计时 metadata vs 运行时 TeachingSnapshot」、Realtime 的 instructions 组成、Proxy 侧 session.update 逻辑及实现路线，使 AI Guide Realtime 具备「针对当前内容的完整状态信息」。
