# Learn 页 vs short_id 页：监听逻辑与实际业务差异

## 一、监听方式对比

| 维度 | Learn 页 (`/learn`) | short_id 页（内容页，用 `AIGuidedLearning`） |
|------|----------------------|-----------------------------------------------|
| **监听挂载** | `window.addEventListener('message', handleMessage)` | 同上 |
| **消息类型** | `EDUNEST_EVENT`（仅处理 `stage_change`）、`EDUNEST_UI_STATE_RESPONSE` | `EDUNEST_EVENT`（stage_change）、`EDUNEST_UI_STATE_RESPONSE`、`EDUNEST_AI_GUIDE_REQUEST` |
| **stage_change 条件** | 有 `stageIndex` 或 `totalStages` 或 `currentStage` 即更新 | **必须**同时有 `stageId` 且 `stageIndex > 0` 才更新 `currentStage` |
| **状态存储** | 扁平对象：`{ stageIndex, totalStages, currentStage }` | 结构化：`currentStage: { stageId, stageIndex }` + 完整 `currentUIState: Record` |
| **发消息前拉状态** | 调用 `refreshUIState()`：post `EDUNEST_GET_UI_STATE`，等 400ms 超时则用缓存 | 调用 `refreshUIState()`：post `EDUNEST_GET_UI_STATE`，等 **800ms** 超时则用缓存 |
| **iframe 引用** | `iframeRef.current` 或 `document.querySelector('main iframe')` | `iframe[srcdoc], iframe[src*="full-html"]` 或 `iframe` |

## 二、实际业务差异

### 1. 场景不同

- **Learn 页**：入口级「学习工作台」，iframe 默认是**按语言切换的 intro**（如 edunest-intro），内容相对固定（学生/家长/老师三个 Tab），对话围绕「当前 iframe 对应的 content」和**当前 Tab（阶段）**。
- **short_id 页**：具体**某一条内容**的详情页（`/c/[short_id]`），iframe 是这条内容的 **full_html**（可能是多步骤、多 Tab 的互动题/课件），阶段和 UI 状态更复杂，且需要和 Realtime 同步。

### 2. stage_change 的严格程度

- **Learn**：intro 只有 3 个 Tab，且后来已给 payload 带上 `stageId`（student/parent/teacher），所以即使用「有 stageIndex 就更新」的宽松规则也能工作；收到 `EDUNEST_UI_STATE_RESPONSE` 时同样会合并进状态。
- **short_id**：内容页的步骤可能是「题目 1 / 题目 2 / 小结」等，需要**阶段标识 + 序号**一起用，所以要求 `stageId && stageIndex > 0` 才更新，避免只收到一个不完整 payload 时误更新。

### 3. 是否对接 Realtime

- **Learn**：只把阶段信息带给 **aiGuide 对话**（发消息时拼进 `ui_state`），不做 Realtime 上下文同步。
- **short_id**：在 `stage_change` 时除了更新本地状态，还会 **`realtimeRef.current.sendContextUpdate({ meta, currentStage, uiState })`**，把当前步骤、metadata 推到 Realtime，供多端/协作等能力使用。

### 4. 对 EDUNEST_AI_GUIDE_REQUEST 的处理

- **Learn**：不处理；intro 内一般不触发「请求 AI 引导」的交互。
- **short_id**：监听该类型，预留了「自动打开抽屉、预填问题」等（当前为 TODO），和内容页上的「问 AI」按钮等联动。

### 5. 发消息时 ui_state 的用法

- **Learn**：用 `refreshUIState()` 拿到的（或缓存的）`state` 拼成 aiGuide 要求的 `{ currentStage: { stageId, stageIndex }, uiState }`，**只为了 aiGuide 的 buildTeachingSnapshot**，让回复和当前 Tab/阶段一致。
- **short_id**：同样在发消息前 `await refreshUIState()`，得到 `{ currentStage, uiState }` 后原样传给 aiGuide；此外 `currentUIState` 会存完整 getUIState 结果（表单项、滑块等），供 Realtime 和后续扩展用。

### 6. iframe 是否支持 EDUNEST_GET_UI_STATE

- **Learn**：iframe 多为 `/standalone/{short_id}` 的 standalone 页（如 intro）。若该页**没有**注入「监听 EDUNEST_GET_UI_STATE 并回 EDUNEST_UI_STATE_RESPONSE」的逻辑，则 `refreshUIState()` 会超时，用**仅由 stage_change 积累的缓存**作为 ui_state，行为仍正确。
- **short_id**：iframe 由 **FullHTMLRenderer** 渲染，会注入包含 `getUIState` 和「EDUNEST_GET_UI_STATE → EDUNEST_UI_STATE_RESPONSE」的 runtime，所以发消息前能拿到**最新一次**的完整 UI 状态。

## 三、总结

- **相同点**：都监听 `EDUNEST_EVENT`（stage_change）和 `EDUNEST_UI_STATE_RESPONSE`，都在发消息前通过 post `EDUNEST_GET_UI_STATE` 尝试拉一次最新状态，超时则用缓存；最终都把 currentStage + uiState 带给 aiGuide。
- **差异点**：short_id 页多出 Realtime 同步、EDUNEST_AI_GUIDE_REQUEST 处理、更严格的 stage_change 条件、更长的拉取超时（800ms）以及依赖 FullHTMLRenderer 注入的 getUIState；Learn 页只关心「当前阶段 + 带给 aiGuide」，且能兼容不实现 getUIState 的 standalone iframe。
