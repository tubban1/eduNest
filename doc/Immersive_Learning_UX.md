[4 tools called]


查看 standalone 路由和内容结构，以便更准确分析：


[3 tools called]


基于当前 Learn 页（iframe + AI 对话）和 standalone 内容结构，整理了一版「Learn 做首页时，iframe 在不同情况下该放什么」的思考，便于你拍板或再细化。

---

# Learn 做首页时：iframe 内容策略

## 当前状态

- **Learn 页**：上方 iframe 固定 `src="/standalone/os63jxo9"`（某一篇内容的 standalone HTML），下方是 AI 对话。
- **Standalone**：`/standalone/[short_id]` 按 `short_id` 拉取内容并返回 `full_html`，iframe 里展示的就是「一篇具体学习内容」。

因此问题等价于：**在不同用户/状态下，iframe 的 `src`（或等价展示）应该指向什么？**

---

## 维度拆分

| 维度 | 取值 | 说明 |
|------|------|------|
| **登录** | 未登录 / 已登录 | 访客 vs 有账号 |
| **角色** | 未选 / student / parent / teacher | 来自 `user.role` 或 onboarding |
| **Init 上下文** | 无 / 有 | region、subjects、age/teachingAgeRanges 等 |
| **行为/状态** | 首次 / 有上次记录 / 有收藏等 | 是否可做「接着学」 |

---

## Visitor 何时填写身份（role + 偏好）

- **可选时机**只有两种：  
  1. **注册前**：访客在未登录状态下主动填写（需产品提供入口，如首页/Learn 页的「选身份」入口）；提交时带 `X-Visitor-Id` 调 `POST /api/onboard/visitor-context`，写入 `visitor_init_context`；注册后 merge-on-login 并入 `user_init_context` 并写 `user.role`。  
  2. **注册后、首次进入**：用户已登录但 `user.role` 仍为空或默认时，由 RoleGuard 引导至 `/onboard/role`，填写后调 `POST /api/onboard/context`，写入 `user_init_context` 并更新 `user.role`。

- **当前约定**：  
  - **身份仅在「注册后、首次进入」时填写**。不提供未登录时的身份填写入口，故不写入 `visitor_init_context`。  
  - 若后续增加「注册前可选填」入口，再启用 visitor-context 接口与 `visitor_init_context`，并在本文档中更新为「可选：注册前填写」或「推荐：注册前轻量填写」。

---

## Visitor 无 role/年龄/科目时如何感知价值

**客观限制**：没有角色、年龄、科目时，无法做「精准」个性化——不能推「初二数学题」或「家长学习报告」或「小学老师出题」，只能做**尽量贴合多数人的通用呈现**。要「准确」感知价值，本质上需要至少一点用户信号（角色或学段/科目之一）。

**两条路径**：

---

### 路径 A：不收集任何信号，接受「大致感知」

- **做法**：首屏用一篇**跨角色都能看懂**的通用 demo（如一道经典题或一个小实验），AI 欢迎语与快捷提示**并列多场景**（「从一道题开始 / 安排学习计划 / 帮孩子或学生」），再加一句平台级价值主张（「学生自测、家长陪伴、老师备课都适用」）。
- **能达成**：访客能感知「这里可以互动学习 + 有 AI 对话」，建立大致印象；**不能达成**：与「我」强相关的价值感（例如家长看不到「我家孩子」、老师看不到「我教的年级」）。
- **适用**：优先降低门槛、接受首屏转化略泛时采用。

---

### 路径 B：首屏轻量一问，用最少信号拉高「准确感知」

- **思路**：在**不打断主流程**的前提下，只问一道极简题（一次点击），用结果仅做**当次会话**的展示与推荐，可选是否落库（见下）。
- **示例交互**：  
  - 进入首页后，在 iframe 上方或对话区上方出现**一条可关闭的横条**：「你主要是？ [ 学生 ] [ 家长 ] [ 老师 ]」；选一项后横条收起，**不跳转、不弹表单**。  
  - 根据选择：**iframe** 可切换为对应倾向的一篇内容（学生→一道可做的题，家长→简短「如何陪学」示例，老师→出题/备课示例）；**AI 欢迎语/快捷提示**改为该角色的典型话术。  
  - 年龄/科目**首屏不问**，留到注册后 onboard 再填；仅用「角色」这一维即可明显提升「和我相关」的感受。
- **数据**：  
  - **仅前端/session**：选了什么只存在内存或 sessionStorage，用于当次首屏展示；不调后端、不写表。  
  - **可选落库**：若希望注册后合并，选完后带 `X-Visitor-Id` 调 `POST /api/onboard/visitor-context`，body 仅含 `{ context: { role: "student"|"parent"|"teacher", region: "CN" } }`（region 可用默认或从语言推断），不包含年龄/科目；注册后 merge 到 `user_init_context` 并写 `user.role`。
- **能达成**：访客在**几乎零成本**下看到「和我身份相关」的内容与话术，价值感知明显更准确；仍不要求填年龄/科目，注册后再补。

---

### 建议

- 若产品希望**未登录即能较准确感知价值**，推荐采用**路径 B**：首屏仅「角色」轻量一问，用结果驱动当次 iframe 与 AI 文案；年龄/科目留在注册后填写。  
- 若坚持**完全不问**，则采用路径 A，并明确接受：无角色/年龄/科目时，价值感知只能是「大致」而非「准确」。
---

## Visitor 进入系统后：何时判断「需要确认 role」

- **未登录访客（visitor）**  
  - **不强制**在进入时确认 role；可正常浏览首页/体验内容与 AI 对话。  
  - 判断「需要选角色」的时机：**注册完成、首次以已登录状态进入系统时**。若此时 `user.role` 仍为空或为默认（如 `user`），则视为需确认 role，跳转 `/onboard/role`。  
  - 可选：在 Learn 首页对未登录用户做轻量提示（如「选一下身份，我会为你推荐更合适的内容」），点击再进 onboard，不阻塞使用。

- **已登录用户**  
  - 判断时机：**每次鉴权/拉取会话时**（如 `getSession` 后查 `users.role`）。  
  - 若 `user.role` 不在 `['student','parent','teacher','admin']`，则 `needChooseRole = true`；进入受保护路由（如 `/`、`/learn`）时由 RoleGuard 重定向到 `/onboard/role`。  
  - 即：**进入系统后第一次加载到「已登录且无有效 role」即判定需要确认 role**，不依赖访问次数或时长。

- **小结**  
  - Visitor（未登录）：进入时不判断，**注册成功后首次加载**若仍无 role 则要求确认。  
  - 已登录：**每次会话检查**即判断；无有效 role 则在本轮访问中引导至 role 页。

### visitor_init_context 表的作用与前提

- **设计意图**：仅在采用「注册前填写身份」时才写入。访客在注册前提交的身份/偏好按 `visitor_id` 存于此表；注册后 merge-on-login 并入 `user_init_context` 并写 `user.role`，再删除该 visitor 行。
- **与「Visitor 何时填写身份」一致**：当前约定为**仅注册后填写**，故本表暂不写入，保留作扩展；若日后开放注册前可选填，再接入 `POST /api/onboard/visitor-context` 与合并逻辑。

---

## 按场景的 iframe 建议

### 1. 未登录（访客）

- **目标**：展示产品价值、可立即体验、引导注册。
- **iframe 建议**：
  - **方案 A（推荐）**：固定一篇「欢迎/体验」内容，例如当前的 `os63jxo9` 或单独做一个 `short_id`（如 `welcome` / `demo`），专门做首屏试玩。  
    - 优点：体验一致、可针对首屏优化这一篇。
  - **方案 B**：从运营/推荐接口取「一条默认体验内容」的 `short_id`，未登录时用这条。  
    - 优点：可随时换稿，不绑死一篇。
- **不推荐**：空白或纯文案；首屏没有可交互内容会弱化「学习工作台」的感知。

---

### 2. 已登录但未选角色（needChooseRole）

- **目标**：尽快完成 onboarding，同时不让 iframe 显得「错位」。
- **iframe 建议**：
  - **与未登录相同**：继续用同一篇欢迎/体验内容（如 `os63jxo9` 或 `welcome`）。  
  - 角色未定前不做个性化，避免 iframe 和下方 AI 提示（按角色）不一致。
- **可选**：在 iframe 上方加一条轻量提示：「选一下身份，我会为你推荐更合适的内容」，点击跳 onboard。

---

### 3. 已登录且已选角色（student / parent / teacher）

这里按「有没有可用的个性化/行为数据」来分。

**3.1 无 init 或无「上次/推荐」数据（冷启动）**

- **iframe 建议**：
  - **按角色给一篇默认**：  
    - student → 一篇通用学习/导览内容（固定 short_id 或运营配置的「学生首页内容」）；  
    - parent → 一篇家长向（如「如何用好 AI 学习」）；  
    - teacher → 一篇老师向（如「出题/备课示例」）。  
  - 若暂时不做角色区分，可**全角色共用一篇**「学习工作台导览」内容（和未登录那篇可以不同，更偏「已注册用户」）。

**3.2 有 init_context（region、subjects、年龄等）**

- **iframe 建议**：
  - **方案 A**：根据 init 从推荐接口取「一条最匹配」内容，iframe `src="/standalone/{recommended_short_id}"`。  
    - 例如：数学 + 初中 → 推一篇初中数学；老师 + 小学 → 推一篇小学教学示例。
  - **方案 B**：先不做推荐，仍用 3.1 的「按角色默认一篇」，后续再接推荐接口。

**3.3 有「上次学习」或「进行中」**

- **目标**：「接着学」、减少流失。
- **iframe 建议**：
  - 若后端能提供「用户最近一次打开/学习的 content short_id」：  
    - iframe 直接 `src="/standalone/{last_short_id}"`。  
  - 若没有「上次」但有「收藏/在学列表」：  
    - 取列表第一条的 short_id 作为首页 iframe；或「最近编辑/最近打开」的第一条。

**3.4 按角色再细化（可选）**

- **Student**：优先「上次学习」→ 再按 init 推荐 → 再默认一篇学生向。
- **Parent**：可优先「孩子相关」或「学习报告/建议」类内容的一篇（若有专门 short_id）；否则同 student 的降级逻辑。
- **Teacher**：可优先「备课/出题/班级」相关的一篇（若有）；否则通用老师默认篇。

---

## 汇总表（可直接对应到 iframe src 逻辑）

| 情况 | iframe 建议 |
|------|--------------|
| 未登录 | 固定欢迎/体验内容（如当前 `os63jxo9` 或单独 `welcome`） |
| 已登录未选角色 | 同未登录（同一篇欢迎/体验） |
| 已登录 + 有「上次学习」 | `/standalone/{last_content_short_id}` |
| 已登录 + 有 init，无上次 | `/standalone/{recommended_short_id}`（推荐接口）或按角色默认一篇 |
| 已登录 + 无 init、无上次 | 按角色默认一篇，或全角色共用一篇导览 |

---

## 实现上的建议

1. **配置化 short_id**  
   - 在配置或环境变量里定义：  
     - `LEARN_HOME_DEFAULT_SHORT_ID`（未登录/未选角色/冷启动默认）  
     - 可选：`LEARN_HOME_STUDENT_DEFAULT`、`LEARN_HOME_PARENT_DEFAULT`、`LEARN_HOME_TEACHER_DEFAULT`。  
   - 前端根据 `user`、`needChooseRole`、`role`、以及「上次/推荐」接口结果，决定 iframe 的 `src`。

2. **后端接口（按需加）**  
   - `GET /api/learn/home-content`（或类似）：  
     - 入参：可选 `visitor_id` / `user_id`，或由鉴权带出。  
     - 返回：`{ short_id: string }` 或 `{ url: string }`。  
     - 逻辑顺序：上次学习 → 推荐（按 init/role）→ 按角色默认 → 全局默认。  
   - 这样前端只需「调这个接口拿一个 short_id」，然后 `src="/standalone/" + short_id`。

3. **无内容时的 fallback**  
   - 若接口失败或 short_id 无效：iframe 用默认欢迎篇（如 `os63jxo9`），避免白屏。

4. **与 AI 对话的配合**  
   - 当前 Learn 的 hints/placeholder 已按 role 区分，和「按角色选默认/推荐内容」一致即可；若将来 AI 能根据「当前 iframe 内容」做上下文，可以再传 `current_short_id` 给后端。

如果你愿意，下一步可以基于现有路由和 API 设计一版具体的「首页 iframe src 选择逻辑」（伪代码或直接写进 `learn/page.tsx` 的决策顺序）。