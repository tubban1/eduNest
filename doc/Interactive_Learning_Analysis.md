 **可直接落地、可扩展、不过度设计** 的 `learning_events` schema，专门为 **eduNest 的学习路径 + 交互 + AI Guide 分析**服务。

我会分为 6 个部分：

1. 设计原则（为什么这样设计）
2. 核心事件模型（统一抽象）
3. learning_events 表结构（推荐）
4. event_type 枚举与语义
5. payload 设计规范（最重要）
6. 实际事件示例（帮助 Cursor / 后端实现）

---

## 一、设计原则（请务必坚持）

### ✅ 1. 原始行为 ≠ 分析结果

* `learning_events` **只记录事实**
* 不记录「掌握 / 困惑」这种结论
* 结论由 **分析层** 生成

### ✅ 2. 统一事件模型，避免碎表

* 所有学习行为都进一张表
* 用 `event_type + payload` 表达差异

### ✅ 3. 面向“时间序列 + 重放”

* 可以完整回放一个学生的学习过程
* 支持路径分析、卡点分析

---

## 二、核心事件抽象（统一模型）

所有学习行为都抽象为：

> **某个用户，在某个上下文中，于某个时间点，做了某个学习相关行为**

```text
WHO     + WHERE           + WHEN        + WHAT        + DETAILS
user    content / stage   timestamp     event_type   payload
```

---

## 三、learning_events 表结构（推荐）

### PostgreSQL / Supabase 版本

```sql
create table learning_events (
  id uuid primary key default gen_random_uuid(),

  -- 身份
  user_id uuid,                 -- 登录用户（可为空）
  visitor_id text,              -- 匿名用户（可为空）
  session_id text not null,     -- 一次学习会话

  -- 上下文
  content_id uuid,              -- 当前内容
  knowledge_point text,         -- 当前知识点（可选但很有用）
  stage_id text,                -- 多阶段教学中的 stage

  -- 行为
  event_type text not null,     -- 行为类型（见下）
  payload jsonb,                -- 行为细节（强烈建议保留）

  -- 时间
  occurred_at timestamptz not null default now(),

  -- 技术辅助字段
  client_ts timestamptz,        -- 前端事件时间（防网络延迟）
  source text default 'web',    -- web / mobile / iframe

  -- 索引友好
  created_at timestamptz default now()
);
```

### 推荐索引

```sql
create index idx_learning_events_user_time
  on learning_events (user_id, occurred_at);

create index idx_learning_events_content
  on learning_events (content_id);

create index idx_learning_events_type
  on learning_events (event_type);

create index idx_learning_events_payload
  on learning_events using gin (payload);
```

---

## 四、event_type 设计（非常重要）

> event_type **必须稳定、语义清晰、数量可控**

### 1️⃣ 学习路径类

| event_type       | 含义        |
| ---------------- | --------- |
| content_enter    | 进入某个学习内容  |
| content_exit     | 离开内容      |
| stage_enter      | 进入某个教学阶段  |
| stage_exit       | 离开某阶段     |
| content_complete | 主动或系统判定完成 |

---

### 2️⃣ AI Guide 对话类

| event_type           | 含义         |
| -------------------- | ---------- |
| ai_question          | 学生向 AI 提问  |
| ai_followup          | 追问 / 澄清    |
| ai_hint_request      | 请求提示       |
| ai_explanation_shown | AI 给出解释    |
| ai_example_shown     | AI 给出示例    |
| ai_feedback          | AI 评价 / 纠错 |

👉 **AI 回复也要记录（否则你看不到教学策略）**

---

### 3️⃣ 交互 / 动画 / Canvas 类

| event_type          | 含义        |
| ------------------- | --------- |
| interaction_start   | 开始交互      |
| interaction_change  | 参数变化 / 拖动 |
| interaction_submit  | 提交尝试      |
| interaction_success | 成功        |
| interaction_failure | 失败        |
| interaction_reset   | 重置        |

---

### 4️⃣ 行为信号类（轻量）

| event_type        | 含义          |
| ----------------- | ----------- |
| idle_detected     | 长时间无操作      |
| rapid_retry       | 快速多次尝试      |
| focus_lost        | 切换 tab / 页面 |
| return_after_exit | 离开后回访       |

---

### 5️⃣ 媒体 / 辅助

| event_type         | 含义     |
| ------------------ | ------ |
| voice_play_clicked | 点击语音讲解 |
| animation_played   | 播放动画   |
| animation_replayed | 重播动画   |

---

## 五、payload 设计规范（⚠️ 核心）

### 原则

* **payload 是未来的金矿**
* 宁可多存，不要乱存
* 结构稳定，字段可选

---

### 通用 payload 模板

```json
{
  "ui": {
    "component": "CanvasArea",
    "version": "v1"
  },
  "intent": "explore | verify | guess | ask_help",
  "duration_ms": 3200
}
```

---

### 示例 1：进入内容

```json
{
  "event_type": "content_enter",
  "payload": {
    "entry_source": "recommended | search | direct",
    "previous_content_id": "..."
  }
}
```

---

### 示例 2：AI 提问

```json
{
  "event_type": "ai_question",
  "payload": {
    "text": "为什么这里要平方？",
    "language": "zh-CN",
    "confidence": "low",
    "related_knowledge": "平方函数"
  }
}
```

---

### 示例 3：交互失败

```json
{
  "event_type": "interaction_failure",
  "payload": {
    "attempt": 3,
    "error_type": "wrong_angle",
    "current_state": {
      "angle": 45,
      "length": 7
    }
  }
}
```

---

## 六、你立刻能用它做什么？

只靠 `learning_events`，你就能：

* 🔍 找出 **卡点知识**
* 🔁 发现 **反复尝试但失败的学生**
* 🧠 推断 **学习风格（探索 vs 指令依赖）**
* 🧭 重建 **真实学习路径（而不是你设计的路径）**

---

这一步已经进入 eduNest 的“学习智能中枢”层了。
下面给你的是 可以直接给 Cursor / 后端 / 数据同事使用的设计文档级输出，不是泛泛而谈。

我会严格分成两份文档：

📘 Document 1: dialogue_signals

目标：
从 AI Guide 对话中，提炼「可分析、可累积、可对比」的学习信号
👉 这是“从语言到认知”的桥梁

1. 为什么不能只存对话文本？

原始对话（ai_question / ai_explanation）存在几个问题：

太自由（语言噪声大）

无法直接聚合（统计困难）

无法跨语言对齐

不利于长期画像

👉 所以我们引入 dialogue_signals = 结构化对话认知信号

2. dialogue_signals 在体系中的位置
AI 对话原文 (ai_question / ai_answer)
        ↓
dialogue_signals（结构化、可分析）
        ↓
student_learning_state（长期画像）

3. dialogue_signals 表结构（推荐）
create table dialogue_signals (
  id uuid primary key default gen_random_uuid(),

  -- 关联
  user_id uuid,
  visitor_id text,
  session_id text not null,

  content_id uuid,
  knowledge_point text,

  -- 信号核心
  signal_type text not null,
  signal_value text not null,

  confidence float,          -- 0~1，AI 判断置信度
  evidence text,             -- 对应的原始文本片段（可选）

  -- 来源
  source_event_id uuid,      -- 对应 learning_events.id
  source text default 'ai',  -- ai / system / rule

  occurred_at timestamptz not null default now(),
  created_at timestamptz default now()
);

推荐索引
create index idx_dialogue_signals_user
  on dialogue_signals (user_id);

create index idx_dialogue_signals_knowledge
  on dialogue_signals (knowledge_point);

create index idx_dialogue_signals_type
  on dialogue_signals (signal_type);

4. signal_type 设计（核心）
4.1 认知状态类（最重要）
signal_type	signal_value 示例
understanding_level	low / medium / high
confusion_detected	definition / formula / concept
misconception	specific_misconception_key
reasoning_gap	step_missing / logic_jump
4.2 行为意图类
signal_type	signal_value
learning_intent	explore / verify / memorize
help_seeking	hint / example / explanation
dependency_pattern	ai_dependent / self_driven
4.3 情绪 & 信心（轻量）
signal_type	signal_value
confidence_level	low / neutral / high
frustration_signal	mild / strong
motivation_signal	curious / bored

⚠️ 注意：
不是心理诊断，只是学习信号

5. 示例（非常重要）
示例 1：检测到概念性困惑
{
  "signal_type": "confusion_detected",
  "signal_value": "concept",
  "confidence": 0.82,
  "evidence": "为什么平方以后函数反而变大？"
}

示例 2：AI 依赖模式
{
  "signal_type": "dependency_pattern",
  "signal_value": "ai_dependent",
  "confidence": 0.75
}

示例 3：理解水平提升
{
  "signal_type": "understanding_level",
  "signal_value": "medium",
  "confidence": 0.9
}

6. dialogue_signals 由谁生成？

推荐混合策略：

🤖 AI 在回答后生成（主力）

📐 规则引擎（例如：连续 3 次追问）

🧪 后处理批量分析（夜间任务）

📘 Document 2: student_learning_state

目标：
为每个学生维护一个 “可更新、可解释、可推荐”的学习画像快照

1. student_learning_state 是什么？

不是日志

不是事件

是 “当前认知状态的最佳估计”

👉 它是一个 慢变表（Slow-changing state）

2. 核心设计原则

可解释（能告诉老师 / 家长为什么）

可回溯（知道基于哪些信号）

可推荐（直接用于下一步教学）

3. 表结构（推荐）
create table student_learning_state (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,
  knowledge_point text not null,

  -- 核心状态
  mastery_level text,        -- unknown / emerging / proficient / mastered
  confidence_level text,     -- low / medium / high
  misconception_tags text[],-- 常见误区 key

  -- 行为画像
  learning_style text,       -- exploratory / guided / mixed
  ai_dependency text,        -- low / medium / high
  persistence_level text,    -- low / medium / high

  -- 量化指标（可选但强烈推荐）
  interaction_success_rate float,
  avg_attempts_before_success float,
  avg_time_on_task_seconds float,

  -- 更新信息
  last_event_at timestamptz,
  last_updated_at timestamptz default now(),
  updated_by text default 'system'
);

推荐唯一约束
create unique index uniq_student_knowledge
  on student_learning_state (user_id, knowledge_point);

4. mastery_level 计算示例（规则示意）
条件	结果
多次失败 + 困惑信号	emerging
成功率 > 70%	proficient
成功 + 能解释给 AI	mastered

⚠️ 不是考试分数，而是学习行为综合

5. student_learning_state 更新机制（推荐）
方式一（推荐）：异步聚合
learning_events
 + dialogue_signals
        ↓
aggregation job (rules + AI)
        ↓
student_learning_state


每 5–15 分钟

或每完成一个 content

6. 示例状态记录
{
  "knowledge_point": "linear_equation_1",
  "mastery_level": "emerging",
  "confidence_level": "low",
  "learning_style": "exploratory",
  "ai_dependency": "medium",
  "misconception_tags": ["sign_error", "inverse_operation"]
}

7. 你立刻可以用它做的产品功能

🎯 个性化学习路径推荐

🧠 AI Guide 调整讲解方式

📊 学习报告 / 家长视图

🚨 早期预警（“快卡住了”）

8. 强烈建议的下一步（真的关键）

如果你愿意，我下一步可以直接帮你做其中之一：

1️⃣ learning_events → dialogue_signals 的规则 & prompt
2️⃣ student_learning_state 的更新策略（SQL + 伪代码）
3️⃣ 如何把这些状态喂回 AI Guide 做自适应教学

--------------------------------------

1️⃣ learning_events → dialogue_signals
规则体系 & AI Prompt 设计
1.1 设计目标

把原始学习事件 + 对话文本，稳定转化为：

可枚举

可统计

可跨语言

可长期累计

的 dialogue_signals

1.2 输入数据（来自 learning_events）
{
  "event_type": "ai_message",
  "user_role": "student",
  "content_id": "uuid",
  "knowledge_point": "linear_equation",
  "payload": {
    "text": "我不明白为什么要把 3 移到右边"
  },
  "context": {
    "stage": "practice",
    "attempt": 2
  }
}

1.3 规则优先，AI 兜底（非常重要）
为什么？

规则 = 稳定、便宜、可解释

AI = 覆盖复杂语义

推荐策略
Step 1: 规则匹配（强信号）
Step 2: AI 语义分析（弱 / 复杂信号）
Step 3: 合并 & 去重

1.4 规则示例（直接可实现）
规则 A：连续追问 = 困惑
if (
  same_knowledge_point &&
  last_3_events.event_type == "ai_message" &&
  user_role == "student"
) {
  emit signal:
    signal_type = "confusion_detected"
    signal_value = "general"
    confidence = 0.7
}

规则 B：请求答案而非过程
if text contains ["直接告诉我", "答案是多少", "给结果"] {
  emit signal:
    signal_type = "learning_intent"
    signal_value = "answer_seeking"
}

规则 C：成功后主动解释
if user explains concept in own words {
  emit signal:
    signal_type = "understanding_level"
    signal_value = "high"
}

1.5 AI Prompt（核心）

⚠️ 这个 prompt 是 “分析型 Prompt”，不是教学 Prompt

System Prompt（示例）
You are an educational analyst.

Your task is to extract structured learning signals from a student–AI dialogue.

Rules:
- Do NOT teach.
- Do NOT explain concepts.
- Only output structured signals.
- Be conservative. If unsure, lower confidence.
- Use predefined signal types and values only.

User Prompt（模板）
{
  "knowledge_point": "linear_equation",
  "dialogue": [
    { "role": "student", "text": "我不明白为什么要把 3 移到右边" },
    { "role": "assistant", "text": "我们可以通过减法来保持等式平衡" }
  ]
}

AI 输出（必须是结构化）
[
  {
    "signal_type": "confusion_detected",
    "signal_value": "operation_reasoning",
    "confidence": 0.85,
    "evidence": "不明白为什么要把 3 移到右边"
  }
]

2️⃣ student_learning_state 更新策略
SQL + 伪代码（可直接实现）
2.1 更新原则（非常重要）

dialogue_signals 是瞬时

student_learning_state 是累积

👉 永远不要直接覆盖，必须“聚合 + 衰减”

2.2 推荐更新频率

每完成一个 content

或每 5–10 分钟异步任务

或 session 结束时

2.3 聚合 SQL 示例
统计最近信号（示例）
select
  knowledge_point,
  count(*) filter (where signal_type = 'confusion_detected') as confusion_count,
  count(*) filter (where signal_type = 'understanding_level' and signal_value = 'high') as high_understanding,
  avg(confidence) as avg_confidence
from dialogue_signals
where user_id = :user_id
  and occurred_at > now() - interval '7 days'
group by knowledge_point;

2.4 mastery_level 更新规则（示意）
if confusion_count >= 3:
  mastery_level = "emerging"

else if high_understanding >= 2:
  mastery_level = "proficient"

if high_understanding >= 3 AND success_rate > 0.8:
  mastery_level = "mastered"

2.5 UPSERT 示例
insert into student_learning_state (
  user_id,
  knowledge_point,
  mastery_level,
  confidence_level,
  ai_dependency,
  last_event_at
)
values (...)
on conflict (user_id, knowledge_point)
do update set
  mastery_level = excluded.mastery_level,
  confidence_level = excluded.confidence_level,
  ai_dependency = excluded.ai_dependency,
  last_event_at = excluded.last_event_at,
  last_updated_at = now();

2.6 衰减机制（强烈建议）
effective_score = recent_score * 0.7 + historical_score * 0.3


防止：

一次好表现直接“满级”

很久以前的错误永久影响

3️⃣ 如何把状态喂回 AI Guide
实现真正「自适应教学」
3.1 核心思想

AI Guide 不再是“通用老师”
而是“知道你现在卡在哪的老师”

3.2 注入位置（非常关键）
❌ 不要

把状态直接展示给用户

让 AI 明说「你 mastery_level 是 emerging」

✅ 要

作为 system context

作为 教学策略约束

3.3 AI Guide System Prompt（示例）
You are an AI learning guide.

The student is currently learning:
- Knowledge point: linear_equation
- Mastery level: emerging
- Confidence: low
- Common misconceptions: inverse_operation, sign_error

Teaching strategy:
- Use concrete examples before formulas
- Ask guiding questions instead of giving answers
- Avoid abstract terminology unless necessary

3.4 动态教学策略映射表（推荐）
mastery_level	教学方式
unknown	探索式、引导提问
emerging	具体示例 + 可视化
proficient	变式练习
mastered	迁移、反例、挑战
3.5 实时自适应示例
用户问：

为什么要移项？

AI 实际内部状态：
{
  "mastery_level": "emerging",
  "misconception": "inverse_operation"
}

AI 输出风格：

不直接给公式

用“天平”“平衡”比喻

提问式推进

3.6 进阶玩法（你后面一定会用到）

根据 ai_dependency 调整提示强度

confidence 低 → 更多正反馈

persistence 高 → 给挑战题

结语（很重要）

你现在已经具备：

✅ 数据闭环

✅ 教学闭环

✅ AI 自适应闭环

这套设计 已经是「真正的 AI 教育产品」而不是 AI Demo。

下一步我强烈推荐你选一个：

1️⃣ 直接帮你写 dialogue_signals 生成用的 Prompt + JSON Schema
2️⃣ 设计 学习报告 / 家长视图的数据结构
3️⃣ 把这套体系整理成 投资人能听懂的“学习智能架构图”