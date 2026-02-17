# uiState 前后端一致性检查

## 约定：uiState 形状

- **唯一约定**：内容通过 `window.__eduNestUIStateProvider()` 返回一个对象，即 **uiState**。
- **必须字段**（后端 / teaching_snapshot 依赖）：
  - `stageIndex`: number，当前步骤序号，**从 1 开始**
  - `totalStages`: number，总步骤数
  - `currentStage`: string，当前步骤标题

## 链路一致性

| 环节 | 位置 | 约定 | 状态 |
|-----|------|------|------|
| 生成 prompt | aiService.js `runtime_ui_state` | 返回 uiState，形状与骨架一致 (stageIndex, totalStages, currentStage) | ✓ |
| 代码骨架 | aiService.js `INTERACTIVE_CODE_FRAMEWORK` | __eduNestUIStateProvider 返回 `{ stageIndex, totalStages, currentStage }` | ✓ |
| Runtime 注入 | standalone/route.ts, FullHTMLRenderer.tsx | getUIState() 先调 __eduNestUIStateProvider()，合并到 state；兼容 currentStageIndex→stageIndex | ✓ |
| Runtime 读取 | learn/page.tsx | postMessage EDUNEST_GET_UI_STATE → 收 EDUNEST_UI_STATE_RESPONSE，data 即 uiState | ✓ |
| 前端发送 | api.ts | body 使用 `ui_state: uiState` | ✓ |
| 后端接收 | api/ai_guide.js | `req.body.ui_state ?? req.body.uiState` | ✓ |
| 存储 / 使用 | aiGuideService.js | actualUIState = uiState.uiState \|\| uiState；规范化为 canonicalUiState (uiState + currentStage 对象)；teachingSnapshot 用 currentStage.stageIndex / stageId、uiState | ✓ |

## 已发现的轻微不一致与修改

1. **Learn 页注释**：原为「监听 iframe 的 stageIndex / uiState」，已改为只提 uiState。
2. **骨架与 prompt**：在骨架上方增加一行注释，明确写出 uiState 三字段，与 runtime_ui_state 完全一致，避免 AI 自创字段名。

## 兼容逻辑（保留）

- 后端：若收到 `currentStageIndex`（0-based）且无 `stageIndex`，则 `stageIndex = currentStageIndex + 1`。
- Runtime getUIState：若 provider 返回 `currentStageIndex` 且无 `stageIndex`，则 `stageIndex = currentStageIndex + 1`。
- 后端：支持嵌套 `{ uiState: {...}, currentStage }` 与平铺 `{ stageIndex, totalStages, currentStage }`。
