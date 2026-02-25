## 📘 产品 PRD：AI 辅助少儿游戏规则编程（Coding Lab） · v2 精炼版

> 目标：作为 EduNest 下的「游戏规则工坊」子产品落地  

### 一、产品定位

**一句话**：  
面向 6–12 岁儿童的「游戏规则设计式编程平台」，通过设计游戏规则来训练系统思维和编程抽象，而不是单纯闯关。

- 孩子从“玩游戏的人”升级为“设计游戏规则的人”；
- 不强调写代码，而是强调理解 **规则—状态—调试**。

### 二、目标用户与分层

| 年龄     | 认知阶段       | 产品策略                   |
|----------|----------------|----------------------------|
| 6–8 岁   | 具体形象思维   | 模板 / 填空式规则设计      |
| 9–12 岁  | 开始抽象思维   | 半开放规则系统 + AI 抽象   |
| 12+ 岁   | 抽象建模能力强 | 完全开放规则设计 + 调试为主 |

### 三、教学目标：六大抽象

通过做一款小游戏，孩子自然掌握：

- **命令**：玩家能做什么（跑、跳、攻击等）  
- **条件**：在什么情况下发生什么（碰怪扣血、掉坑失败）  
- **循环**：哪些事情会一直发生（怪物刷新、时间流逝）  
- **变量**：游戏状态如何记录（分数、生命、宝石数）  
- **事件**：操作如何触发反应（按键、点击、碰撞）  
- **调试**：游戏“坏掉”时如何查找和修正规则  

> 目标是系统思维，不是语法记忆。

### 四、产品形态：游戏规则工坊

- 左：规则树（命令 / 条件 / 循环 / 变量 / 事件）
- 中：游戏预览 + 调试视图
- 右：AI 对话区（提问引导 + 调试建议）

孩子可以：

- 设定角色、目标、胜负条件、世界规则；
- 自己试玩、同伴试玩；
- 看 AI 试玩并给出调试建议。

### 五、核心交互结构

统一模式：

> AI 提问 → 孩子自然语言回答 → AI 抽象为规则 → 展示为规则卡片 / 规则树 → 孩子确认 / 修改

这一结构贯穿：命令、条件、循环、变量、事件、调试 六个阶段。

### 六、一次完整「设计游戏」流程（MVP）

1. **设定目标**  
   - AI：你想做什么样的游戏？更像收集宝石、打败怪物，还是跑到终点？  
   - 输出：游戏名、类型（一句话描述）。

2. **设计命令（玩家能力）**  
   - AI：玩家可以做哪些动作？  
   - 孩子：跑、跳、攻击……  
   - 输出：`move() / jump() / attack()` 等命令卡片。

3. **设计条件（胜负与触发）**  
   - AI：什么时候会失败？什么时候会得分？  
   - 孩子：碰怪扣血、掉坑失败、吃金币加分……  
   - 输出：IF/THEN 条件卡片。

4. **设计循环（世界机制）**  
   - AI：怪物会一直出现吗？多久出现一次？  
   - 孩子：每 5 秒出现一个怪物。  
   - 输出：`EVERY 5 秒 → spawnMonster()`。

5. **设计变量（游戏状态）**  
   - AI：游戏怎么知道你已经赢了？  
   - 孩子：收集 10 个宝石。  
   - 输出：`gemCount` 变量与 `IF gemCount >= 10 THEN WIN`。

6. **设计事件（操作与反馈）**  
   - AI：按键 / 点击时要发生什么？  
   - 孩子：按空格跳、长按攻击……  
   - 输出：`ON KeyPress("Space") → jump()` 等事件卡片。

7. **试玩与调试（核心学习场）**  
   - 运行游戏：高亮触发的规则、展示变量变化；  
   - AI 提问式调试：
     - 怪物太多了，你觉得是哪条规则导致的？  
     - 分数不增加，可能是哪一步没执行？  
   - 孩子在提示下修改规则，再次运行验证。

#### 补充：语音优先的交互方式（ASR + TTS）

- **原则**：以语音为主、文字为辅，尽量避免儿童大量打字。
- **系统输出**：  
  - 所有 AI 问题与总结默认通过 TTS 朗读；  
  - 同时在对话区显示简短文本字幕，方便家长 / 老师查看。
- **孩子输入**：  
  - 页面底部是一个大号「按住说话」按钮，按下开始录音、松开发送；  
  - 语音通过 ASR 转成文字实时显示在对话区；  
  - 只有在识别明显错误或家长模式下，才提供小范围文本编辑框。
- **单轮交互示例（设计命令阶段）**：  
  1. 系统 TTS：  
     > “玩家在游戏里可以做什么？比如跑、跳、攻击。”  
  2. 孩子按住「说话」按钮回答：“我想要跑、跳，还有射击。”  
  3. ASR 实时转文字并显示；  
  4. 大模型根据文本抽象出 `move() / jump() / shoot()` 命令卡片；  
  5. 系统用 TTS 简短播报：“好的，我帮你加了三个能力：跑、跳、射击。”  
  6. 左侧规则树出现对应命令卡片，孩子如有需要，可用点击 / 滑块微调参数。

### 七、六大抽象在界面上的映射

| 抽象   | UI 形式                          |
|--------|----------------------------------|
| 命令   | 玩家能力卡片                     |
| 条件   | IF/THEN 规则卡片 + 触发链路      |
| 循环   | 定时器 / 循环节点                |
| 变量   | 变量列表 + 当前值 + 变化曲线     |
| 事件   | 按键 / 点击 / 碰撞绑定卡片       |
| 调试   | 规则高亮 + 变量时间轴 + AI 诊断 |

### 八、核心模块

1. **规则构建器**  
   - 对话 + 表单混合；  
   - 规则树可视化、可拖拽、可折叠。

2. **AI 引导系统**  
   - 阶段化提问；  
   - 自然语言 → 规则 JSON；  
   - 冲突检测 + 调试提示；  
   - 只负责“问”和“建议”，不越权帮你“全写好”。

3. **规则可视化面板**  
   - 按类别展示所有规则结构；  
   - 支持点击某条规则，查看“在哪一帧被触发”。

4. **调试系统**  
   - 单步 / 慢速；  
   - 变量时间轴；  
   - 规则触发高亮与回放。  

> 这是产品成败的关键：调试做不好，整个产品价值会大打折扣。

### 九、认知层级

- **Level 1 填空式**：给骨架，孩子填参数，适合 6–8 岁；
- **Level 2 半开放式**：孩子自由描述，AI 帮抽象成规则树；
- **Level 3 开放式**：孩子完全掌控规则设计，AI 主要做调试教练。

### 十、MVP 范围

只做：

- 单场景、单类型模板（如横版收集跑酷）；
- 固定角色和美术资源（可换皮但不做编辑器）；
- 六大抽象的基础子集 + 规则树；  
- 基础调试（规则高亮 + 变量曲线）；  
- AI 提问 / 抽象 / 调试引导。

不做：

- 多世界 / 多关卡编辑；  
- 社交 / 作品广场；  
- 深度地图 / 皮肤编辑器。

### 十一、下一步可拆文档

- 规则树 JSON Schema 与存储结构；  
- AI 提问逻辑树（按年龄和阶段分层）；  
- 调试事件日志与可视化架构；  
- 与 EduNest 的入口 / 权限 / 数据分析集成方案。

---

### 十二、语音引擎与环境变量（实现约定）

本项目的语音输入 / 输出基于 **VectorEngine Chat Completions（文本 + 音频）** 接口，统一约定以下环境变量（在 `edu/.env` 中配置）：

- `VECTORENGINE_URL=https://api.vectorengine.ai`  
- `VECTORENGINE_API_KEY=...`（后端读取，绝不在前端暴露）  
- `VECTORENGINE_MODEL=gpt-4o-audio-preview-2024-10-01`（可按需要调整）  

后端调用约定（伪代码）：

```js
POST ${VECTORENGINE_URL}/v1/chat/completions
Authorization: Bearer ${VECTORENGINE_API_KEY}
Content-Type: application/json

{
  "model": VECTORENGINE_MODEL,
  "modalities": ["text", "audio"],
  "audio": {
    "voice": "alloy",
    "format": "wav"
  },
  "messages": [
    { "role": "user", "content": "<孩子或系统的文本内容>" }
  ]
}
```

约束：

- 只有 **后端** 可以直接调用 `VECTORENGINE_URL`，前端一律通过自家 API（如 `/api/coding-game/tts`、`/api/coding-game/asr-chat`）；  
- 返回结果中音频部分（`wav`）由后端转发给前端，前端通过 `<audio>` 或 Web Audio 播放；  
- 所有 AI 提问与总结文案均通过该模型生成，确保「文本 + 语音」一致。

---

### 十三、规则代码如何输出与修改（代码表现方案）

本项目中存在两层“代码”：

1. **内部运行代码**：供引擎执行的真实规则（可以是 JSON + 生成的 JS/Lua 等）；  
2. **儿童可见的代码表现**：用于教学的规则表达形式（卡片 / 伪代码）。

设计上采用「结构化为主，字符串为辅」的思路。

#### 13.1 方案 A：规则卡片 + 伪代码视图（MVP 采用）

- 内部存储：  
  - 所有规则以 `rules_json` 结构化保存（命令 / 条件 / 循环 / 变量 / 事件）；  
  - 示例：
    ```json
    {
      "type": "condition",
      "if": "touch(monster)",
      "then": ["health -= 1"]
    }
    ```
- 对外展示：  
  - UI 用「规则卡片」形式展示；  
  - 卡片上方显示一行接近自然语言的伪代码，例如：  
    `如果碰到怪物，就让生命 -1。`
- 修改方式：  
  - 孩子通过点击卡片，使用下拉框、滑块、数量输入等控件修改参数（时间、次数、对象等）；  
  - 增删卡片 = 增删规则节点；  
  - 前端改的是结构（JSON），不是直接编辑字符串代码。

> 这是默认模式，也是 MVP 推荐方案，适合 6–10 岁儿童。

#### 13.2 方案 B：受控伪代码编辑（进阶视图）

在方案 A 的基础上，为大龄儿童提供一个「代码视图」：

- 每条规则多一个 `display_code` 字段，例如：
  ```json
  {
    "id": "rule_1",
    "type": "condition",
    "if": "touch(monster)",
    "then": ["health -= 1"],
    "display_code": "IF 碰到怪物 THEN 生命 - 1"
  }
  ```
- UI 提供「代码模式」切换：  
  - 显示 `IF [条件] THEN [动作]` 这样的模板；  
  - `[条件]` 与 `[动作]` 通过受控下拉框 / 自动补全选择（例如：`玩家`, `怪物`, `金币`，以及 `增加`, `减少` 等），而非任意输入任意字符串。
- 修改流程：  
  1. 孩子在代码视图中调整条件或动作的文字选项；  
  2. 前端解析修改，更新 `rules_json` 中对应字段；  
  3. 引擎仍仅依赖结构化 JSON 运行。

> 用于 9–12 岁或「进阶模式」，既保留“看代码”的感觉，又保证安全可解析。

#### 13.3 方案 C：生成内部引擎代码（对孩子隐藏）

- 引擎实现细节：  
  - 在运行时，将 `rules_json` 转译为内部脚本（如 JS 函数或 Lua 脚本），方便高性能执行与调试；  
  - 示例（仅供引擎使用，不暴露给儿童）：
    ```js
    function onTick(dt) {
      // 根据 rules_json 自动生成的逻辑
    }
    ```
- 儿童与教师 UI：  
  - 正常使用方案 A/B 的规则卡片和伪代码视图；  
  - 不直接看到内部脚本，只看到抽象层。
- 开发 / 调试模式：  
  - 可以为内部团队或高级教师提供一个只读「脚本视图」，用于排查引擎级问题。

> 最终引擎以「JSON → 内部脚本 → 运行」的链路工作，儿童永远面对的是可视化规则与受控伪代码。

---

### 十四、实现任务清单（Roadmap）

> 以 3–6 个月 MVP 为目标的任务拆分，持续迭代。

#### 14.1 基础架构与入口

- [x] 在 EduNest 前端新增入口路由 `/coding-lab`（或 `/game-studio`），接入现有导航与 `useAuth`。  
- [x] 设计 Coding Lab 页面整体布局（左规则树 / 中游戏画布 / 右 AI 对话区）的线框图与组件划分（已落地为页面结构 + 右侧抽屉「我的游戏项目」面板）。  
- [x] 在后端创建 `game_projects` 表（`id, user_id, title, rules_json, engine_preset, created_at, updated_at, age_level, tags...`）。  
- [x] 实现基础 API：
  - [x] `POST /api/coding-game/projects`（创建 / 更新项目）  
  - [x] `GET /api/coding-game/projects/:id`（获取项目）  
  - [x] `GET /api/coding-game/projects`（列出当前用户的项目简要信息）

#### 14.2 规则树与数据结构

- [x] 定义 `rules_json` 的正式 Schema（命令 / 条件 / 循环 / 变量 / 事件）并写入文档。  
- [x] 实现前端规则树组件：
  - [x] 支持增删规则卡片（目前支持命令 / 变量，两类为 MVP）；  
  - [x] 支持按类别（命令 / 变量 / 其余只读统计）分组展示；  
- [x] 实现规则卡片的参数编辑（下拉、滑块、数字输入等），直接修改 `rules_json`（目前支持命令速度 `speed` / 跳跃高度 `height`、变量初始值 `initial`）。

#### 14.3 极简游戏引擎与调试视图

- [x] 选定一个 MVP 模板（如「横版收集跑酷」）并固定基础资源（角色、怪物、道具）——当前实现为横版 Runner + 简单方块障碍。  
- [x] 在前端实现一个极简 2D 引擎（基于 Canvas，纯前端）：
  - [x] 支持玩家移动与跳跃（自动向右跑，←/→ 微调速度，Space 跳跃）；  
  - [x] 支持简单障碍物与碰撞检测（撞到障碍物 / 冲过终点给出不同提示）；  
- [x] 实现 `rules_json → 运行逻辑` 的解释层（不暴露给儿童）：
  - [x] 依据 `commands` 中的 `move.speed` / `jump.height` 参数动态调整移动速度与跳跃高度；  
  - [x] 依据 `conditions` 中的简单表达式（如 `touch(monster)` / `touch(gem)` / `fallInto(hole)`）在碰撞时自动执行 `then` 中的变量更新与 `gameOver()`；  
  - [x] 将变量（如 `score` / `health` / `gemCount`）与最近一次触发的规则描述在画面 UI 中以调试信息形式展示。  
- [ ] 实现调试视图：
  - [x] 记录最近触发的规则描述与关键变量（score / health / gemCount）的快照，在画布下方以列表形式展示调试日志（最近若干条）；  
  - [x] 在左侧规则树中高亮当前帧触发规则（MVP：高亮最近一次触发的条件规则）；  
  - [x] 在下方显示关键变量的时间轴（MVP：右侧以“变量时间线（最近变化）”列表展示变化记录）。

#### 14.4 AI 引导与提示系统

- [ ] 设计面向 6–12 岁的提问文案库（按阶段：目标 / 命令 / 条件 / 循环 / 变量 / 事件 / 调试）。  
- [x] 为大模型封装统一的「引导接口」：
  - [x] `POST /api/coding-game/ai/guide`：根据当前阶段、孩子语音转文本、已有 `rules_json`，返回规则 diff + 面向孩子的简短说明（当前为启发式规则，后续可替换为真正大模型）。  
  - [x] `POST /api/coding-game/ai/debug`：根据运行日志与现有规则，返回调试提问与修改建议（当前先返回简单建议文案）。  
- [x] 在 `ai_usage_logs` 中新增 `action_type = 'coding-game'`，记录每轮引导 / 调试调用（复用 `logAIUsage`，已落盘日志）。

#### 14.5 语音链路（ASR + TTS）

- [ ] 在 `edu/.env` 中配置并验证：
  - [ ] `VECTORENGINE_URL=https://api.vectorengine.ai`  
  - [ ] `VECTORENGINE_API_KEY`  
  - [ ] `VECTORENGINE_MODEL=gpt-4o-audio-preview-2024-10-01`  
- [x] 封装后端 VectorEngine 客户端：
  - [x] 统一方法 `chatWithAudio(messages)` 调用 `/v1/chat/completions`，返回文本 + 音频（wav），被 TTS / ASR 路由复用。  
  - [x] 支持通过环境变量 `DISABLE_VECTOR_TTS=1` 在开发环境下关闭真实 TTS 调用，仅回传文本，避免外部额度不足导致体验中断。
- [x] 实现前端 TTS 播放器：
  - [ ] 调用自家 API，拿到音频 Blob/URL；  
  - [ ] 用 `<audio>` 或 Web Audio 自动播放，同时展示字幕。  
- [ ] 实现前端语音输入组件：
  - [x] 大号「按住说话」按钮（优先 WebSpeech，回退录音上传）；  
  - [ ] 使用 `getUserMedia` 采集音频并发送到后端 ASR 接口（或 VectorEngine 的文本能力）；  
  - [ ] 实时显示 ASR 字幕，可一键「再说一遍」。

#### 14.6 交互流程与场景包装

- [ ] 实现第一次进入 Coding Lab 的新手引导（1–2 步动画 + 简短说明）。  
- [ ] 实现「选择年龄段 / 难度」的入口，以便控制提问方式与规则复杂度。  
- [ ] 实现「我的作品」列表页，展示每个游戏项目的缩略图和基础信息。  
- [ ] 为教师 / 家长增加一个简化报告视图：展示每个孩子在一次游戏设计中使用了哪些抽象（条件 / 循环 / 变量等）。

#### 14.8 已打通的开发里程碑（持续勾选）

- [x] `/coding-lab` 页面：项目列表 + 新建项目 + 选择项目。  
- [x] 内置画板：导出 PNG → 后端上传 freeimage.host → 保存到 `game_drawings`。  
- [x] 最小 TTS 链路：`POST /api/coding-game/voice/tts` → 前端播放 wav。  
- [x] 最小 ASR 链路：WebSpeech 语音转文字；不支持时回退到 `POST /api/coding-game/voice/asr`。  
- [x] 下一步：把对话内容接入 AI guide，生成规则卡片并更新规则树。  

#### 14.7 进阶与后续迭代（非 MVP）

- [ ] 开启受控伪代码视图（方案 B）：为大龄用户提供 `IF ... THEN ...` 模式编辑。  
- [ ] 扩展更多游戏模板（塔防、小型解谜等），重用同一套规则引擎。  
- [ ] 设计安全的作品分享 / 教师课堂展示模式（仅在需要时开启）。  

---

### 十五、数据库设计（SQL 草案）

> 目标：在不动现有 `content` / `collection_lists` 结构的前提下，为 Coding Lab 增加最小必要的几张表。

#### 15.1 游戏项目表 `game_projects`

```sql
CREATE TABLE IF NOT EXISTS game_projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  age_level     text,           -- '6-8', '9-12', '12+' 等
  engine_preset text NOT NULL DEFAULT 'runner', -- 模板类型，如 runner / puzzle
  rules_json    jsonb NOT NULL DEFAULT '{}'::jsonb,   -- 六大抽象规则
  display_code  jsonb,          -- 可选：每条规则的伪代码 / 多语言展示
  thumbnail_url text,           -- 作品缩略图（可来自孩子画的封面）
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_projects_user_id
  ON game_projects(user_id);

CREATE INDEX IF NOT EXISTS idx_game_projects_age_level
  ON game_projects(age_level);
```

#### 15.2 绘画素材表 `game_drawings`

```sql
CREATE TABLE IF NOT EXISTS game_drawings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES game_projects(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         text NOT NULL,  -- 'character', 'monster', 'item', 'background' 等
  label        text,           -- 孩子起的名字，比如“小龙龙”
  image_url    text NOT NULL,  -- 存在 freeimage.host / Supabase Storage 等
  meta         jsonb,          -- 颜色、图层、画板设置等
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_drawings_project_id
  ON game_drawings(project_id);
```

#### 15.3 可选：运行 / 调试日志表 `game_run_logs`

```sql
CREATE TABLE IF NOT EXISTS game_run_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES game_projects(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at   timestamptz NOT NULL DEFAULT now(),
  duration_ms  integer,
  summary      text,        -- 简短总结，可由 AI 生成
  trace        jsonb,       -- 规则触发 / 变量变化等调试数据
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_run_logs_project_id
  ON game_run_logs(project_id);
```

> 说明：`game_run_logs` 不是 MVP 硬需求，初期可以只在 `ai_usage_logs` 里记录 AI 调用；等需要课堂复盘 / 回放时再补。

---

### 十六、绘画交互与图像托管方案

目标：**孩子可以一边画图一边和 AI 对话，用画出来的角色 / 场景直接进入游戏。**

#### 15.1 画板工具（前端）

- 在 Coding Lab 中提供内置画板组件（Canvas）：
  - 支持基本笔刷、颜色、橡皮擦、撤销 / 重做；
  - 模式切换：画角色 / 画怪物 / 画道具 / 画背景；
  - 画完后，一键「用这幅画创建角色 / 场景」。
- 与语音交互结合：
  - 孩子可以语音说：「我画了一个会飞的龙，当作 Boss」；
  - 系统在上传图片后，连同语音 ASR 文本一起发给大模型，生成对应规则建议（如初始化生命、攻击方式等）。

#### 15.2 图像上传与 freeimage.host

- 画板导出 PNG 后，由前端上传到 `freeimage.host`：
  - 上传前在本地压缩 / 降采样，控制分辨率与体积；
  - 成功后拿到公开可访问的图片 URL。
- 后端只保存 URL 与元数据，不直接存二进制：

```sql
-- 见上文 game_drawings 表
INSERT INTO game_drawings (project_id, user_id, kind, label, image_url, meta)
VALUES (..., 'character', '小龙龙', 'https://i.freeimage.host/xxx.png', '{"palette":["#ff0000","#00ff00"]}');
```

> 说明：`freeimage.host` 作为轻量托管，后续如需切换到自有存储，可在后端做代理与迁移。

#### 15.3 绘画与 AI 的协同流程（示例）

1. 孩子在画板中画好一个角色，点击「完成」。  
2. 系统上传图片到 `freeimage.host`，保存 URL 到 `game_drawings`。  
3. 同时开启 TTS 提问：  
   > “你画的是谁？在游戏里它有什么本领？”  
4. 孩子语音回答：「这是小龙龙，它会喷火和飞。」  
5. 后端将：
   - 图片 URL；  
   - ASR 文本；  
   - 当前 `rules_json`；  
   一起发给大模型，请求生成：
   - 一条或多条规则建议（命令 / 条件 / 变量等）；  
   - 面向孩子的说明语句（用于 TTS）；  
6. 前端展示新的规则卡片（例如：`command: fly()`, `attack: fireBreath()`），并用语音总结：  
   > “我帮你把小龙龙做成了会飞、会喷火的 Boss，等会儿我们再加它的血量和攻击力。”

#### 15.4 需要额外考虑的点

- 隐私与合规：
  - 明确写在产品协议中：上传的是儿童自制画作，不包含真人照片；  
  - 如以后自建存储，可逐步迁移历史图片，减少对第三方依赖。
- 网络与超时：
  - 上传或请求 freeimage.host 超时时，提示「当前网络不稳定，可以稍后再试」；  
  - 支持本地缓存最近一张画，避免重画；  
  - 如上传失败，仍允许孩子继续画与思考，只是暂时不能进游戏。
- 性能：
  - Canvas 导出前先做缩放，控制在合理尺寸（例如 512x512）；  
  - 多次使用同一角色时直接复用 URL，不重复上传。

> 总体原则：绘画是儿童表达想象力的主要入口，AI 负责「读懂画」并把它转成可玩的规则和对象。

---

### 十七、规则 JSON Schema（`rules_json`）

> 作为 `game_projects.rules_json` 的数据结构规范，前后端与 AI guide 都以此为准。

#### 17.1 总体结构

```json
{
  "commands": [ /* CommandRule[] */ ],
  "conditions": [ /* ConditionRule[] */ ],
  "loops": [ /* LoopRule[] */ ],
  "variables": [ /* VariableRule[] */ ],
  "events": [ /* EventRule[] */ ]
}
```

#### 17.2 命令（CommandRule）

```ts
{
  id: string;          // 规则ID，例如 "cmd_move"
  name: string;        // 内部名称，例如 "move" / "jump"
  displayName: string; // 给孩子看的名称，例如 "移动" / "跳跃"
  category: 'movement' | 'attack' | 'interaction' | 'other';
  params?: {
    [key: string]: number | string | boolean; // 如 speed: 1, height: 2 等
  };
}
```

示例：

```json
{
  "id": "cmd_jump",
  "name": "jump",
  "displayName": "跳跃",
  "category": "movement",
  "params": { "height": 1.5 }
}
```

#### 17.3 条件（ConditionRule）

```ts
{
  id: string;          // 规则ID，例如 "cond_hitMonster"
  description: string; // 自然语言说明，例如 "碰到怪物就扣一滴血"
  if: string;          // 简单条件表达式，例如 "touch(monster)"
  then: string[];      // 动作表达式数组，例如 ["health -= 1", "shakeScreen()"]
}
```

示例：

```json
{
  "id": "cond_collectGem",
  "description": "吃到宝石得分",
  "if": "touch(gem)",
  "then": ["gemCount += 1", "score += 10"]
}
```

#### 17.4 循环（LoopRule）

```ts
{
  id: string;           // 规则ID，例如 "loop_spawnMonster"
  description: string;  // 自然语言说明
  everySeconds: number; // 间隔秒数，大于 0
  actions: string[];    // 每次触发时执行的动作，例如 ["spawnMonster()"]
}
```

示例：

```json
{
  "id": "loop_spawnMonster",
  "description": "每 5 秒生成一只怪物",
  "everySeconds": 5,
  "actions": ["spawnMonster()"]
}
```

#### 17.5 变量（VariableRule）

```ts
{
  name: string;                 // 变量名，例如 "score" / "health"
  type: 'int' | 'float' | 'bool';
  initial: number | boolean;    // 初始值
  description?: string;         // 可选说明，例如 "得分" / "生命值"
}
```

示例：

```json
{
  "name": "health",
  "type": "int",
  "initial": 3,
  "description": "生命值"
}
```

#### 17.6 事件（EventRule）

```ts
{
  id: string;              // 规则ID，例如 "evt_spaceJump"
  description: string;     // 说明，例如 "按空格键跳跃"
  on:
    | { type: 'key_press'; key: string }
    | { type: 'pointer_tap' }
    | { type: 'collision'; with: 'monster' | 'item' | 'ground' | string };
  actions: string[];       // 动作表达式，例如 ["jump()"]
}
```

示例：

```json
{
  "id": "evt_spaceJump",
  "description": "按空格键跳跃",
  "on": { "type": "key_press", "key": "Space" },
  "actions": ["jump()"]
}
```

#### 17.7 默认规则模板（runner 模板）

前端使用一个默认模板 `createDefaultRunnerRules()` 初始化新建项目的 `rules_json`，包含：

- 命令：`move`（移动）、`jump`（跳跃）；
- 变量：`score`、`health`、`gemCount`；
- 条件：碰到怪物扣血、掉坑游戏结束、吃宝石得分；
- 循环：每 5 秒生成一个怪物；
- 事件：按空格键跳跃。

AI guide 可以在此基础上增删规则或调整参数，从而让孩子在熟悉的基础模板上迭代自己的游戏规则。
