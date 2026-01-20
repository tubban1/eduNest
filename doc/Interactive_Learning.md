# 学生长期学习分析与个性化建议系统（时间感知型学习智能架构）

> **核心理念**：
> **学习不是状态，而是轨迹（Trajectory）。**
> 
> eduNest 不判断学生「此刻行不行」，而是持续建模学生如何随着时间学习、卡住、修复与进步。这是一个真正具备时间感知能力的学习智能系统。

## 📋 目录

1. [系统目标与核心架构](#系统目标与核心架构)
2. [时间感知型四层架构](#时间感知型四层架构)
3. [数据采集方案](#数据采集方案)
4. [AI Guide对话分析（核心）](#ai-guide对话分析核心)
5. [基础交互分析（简化）](#基础交互分析简化)
6. [数据表结构（时间感知增强）](#数据表结构时间感知增强)
7. [数据整合分析（综合多数据源）](#数据整合分析综合多数据源)
8. [时间感知分析算法](#时间感知分析算法)
9. [预测型学习报告生成](#预测型学习报告生成)
10. [AI Guide动态调整机制](#ai-guide动态调整机制)
11. [实现路线图](#实现路线图)

> **增强功能**：如果需要更详细的交互追踪（如阶段切换、知识点关联等），请参考 [`Interactive_Learning_Enhance.md`](./Interactive_Learning_Enhance.md) 文档。

---

## 一、系统目标与核心架构

### 1.1 为什么必须是长期时间线？

**传统静态分析的问题：**

❌ **只看当下**：两个学生都答对同一道题，但：
- A：第一次就答对（自然掌握）
- B：错了5次，问了3次AI才答对（勉强通过）

**当下结果相同，但教育意义完全不同。**

✅ **时间感知型分析**：eduNest 关心的不是「此刻是否正确」，而是：
- 是**自然掌握**还是**勉强通过**
- 是**稳定进步**还是**短期波动**
- 是**理解增强**还是**记忆性通过**

### 1.2 核心架构：时间感知型四层模型

```
原始学习事件（Learning Events，带时间戳和序列）
        ↓
时间感知信号（Time-aware Signals，趋势、频率、变化率）
        ↓
可演化学习状态（Evolving Learning State，velocity、acceleration）
        ↓
轨迹级洞察与预测（Trajectory-based Insights，预测风险与优化建议）
```

### 1.3 核心优势

**对外（用户/投资人）可以这样说：**

> "eduNest 不判断学生'此刻行不行'，
> 而是持续建模学生如何随着时间学习、卡住、修复与进步。
> 这是一个真正具备时间感知能力的学习智能系统。"

**对内（开发团队）的目标：**

1. **轨迹分析**：识别学习轨迹模式（上升、停滞、下降）
2. **长期理解**：区分短期记忆与深度理解
3. **越用越懂**：系统随着数据积累越来越智能
4. **预测干预**：提前识别风险，在最佳时机介入

---

## 二、时间感知型四层架构

### 2.1 第一层：原始学习事件（Learning Events）

> **事实级，不做判断，但必须包含时间序列信息**

#### 关键时间字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `event_time` | 事件发生时间（精确到秒） | `2026-01-20T10:32:00Z` |
| `session_id` | 学习会话ID（关联同一时间段的学习） | `sess_abc123` |
| `sequence_index` | 序列索引（事件在会话中的顺序） | `12` |
| `time_since_last` | 距离上一个事件的时间（秒） | `45` |
| `time_in_session` | 会话内累计时间（秒） | `3600` |

**为什么 `sequence_index` 很重要？**

> 它让你能分析「发生顺序」，而不只是时间点。
> 例如：是先困惑后理解，还是先理解后困惑？

#### 事件示例

```json
{
  "event_id": "evt_xyz789",
  "user_id": "user_123",
  "content_id": "content_456",
  "knowledge_point": "linear_equation",
  "event_type": "ai_dialogue | interaction | assessment",
  "event_time": "2026-01-20T10:32:00Z",
  "session_id": "sess_abc123",
  "sequence_index": 12,
  "time_since_last": 45,
  "time_in_session": 3600,
  "payload": {
    "dialogue_signal_type": "confusion_detected",
    "message_count": 3,
    "conversation_duration_seconds": 120
  }
}
```

### 2.2 第二层：时间感知信号（Time-aware Signals）

> **从事件中抽取"认知信号"，并计算时间属性**

#### 信号不再是一个值，而是一个时间序列函数

**传统静态信号** ❌：

```json
{
  "knowledge_point": "linear_equation",
  "confusion_detected": true
}
```

**时间感知信号** ✅：

```json
{
  "knowledge_point": "linear_equation",
  "time_window": "last_7_days",
  "signal_type": "confusion_frequency",
  "current_value": 0.42,
  "trend": "decreasing",  // rising | stable | decreasing
  "velocity": -0.08,      // 变化速度（每7天）
  "volatility": "medium", // low | medium | high
  "stability": 0.75,      // 0-1，稳定性评分
  "last_occurrence": "2026-01-19T14:20:00Z",
  "frequency_history": [0.6, 0.55, 0.48, 0.42],
  "time_intervals": ["7d_ago", "5d_ago", "3d_ago", "1d_ago"]
}
```

#### 每个信号都包含的时间属性

| 属性 | 含义 | 计算方法 |
|------|------|----------|
| `current_value` | 当前水平 | 最近时间窗口的平均/总和 |
| `trend` | 趋势 | 线性回归斜率：上升/稳定/下降 |
| `velocity` | 变化速度 | `(当前值 - 上次值) / 时间间隔` |
| `volatility` | 波动性 | 标准差 / 平均值 |
| `stability` | 稳定性 | `1 - volatility`，0-1评分 |
| `frequency_history` | 历史序列 | 时间窗口序列值 |
| `time_intervals` | 时间区间 | 对应的历史时间窗口 |

#### 信号类型（时间感知增强）

**1. 理解与认知信号（Cognitive Signals）**

| Signal | 时间属性示例 |
|--------|-------------|
| `confusion_frequency` | `{trend: "decreasing", velocity: -0.05, volatility: "low"}` |
| `clarification_depth` | `{trend: "stable", velocity: 0.02, volatility: "medium"}` |
| `concept_misuse` | `{trend: "decreasing", velocity: -0.03, stability: 0.8}` |
| `reasoning_gap` | `{trend: "rising", velocity: 0.1, volatility: "high"}` |
| `partial_understanding` | `{trend: "stable", velocity: 0, stability: 0.9}` |

**2. 学习行为信号（Behavioral Signals）**

| Signal | 时间属性示例 |
|--------|-------------|
| `persistence` | `{trend: "rising", velocity: 0.05, stability: 0.7}` |
| `trial_and_error` | `{trend: "decreasing", velocity: -0.04, volatility: "medium"}` |
| `help_dependency` | `{trend: "decreasing", velocity: -0.06, stability: 0.85}` |
| `exploration` | `{trend: "rising", velocity: 0.08, volatility: "low"}` |
| `task_abandonment` | `{trend: "decreasing", velocity: -0.02, stability: 0.9}` |

**3. 元认知信号（Metacognitive Signals）**

| Signal | 时间属性示例 |
|--------|-------------|
| `self_explanation` | `{trend: "rising", velocity: 0.06, stability: 0.75}` |
| `reflection` | `{trend: "stable", velocity: 0.01, volatility: "low"}` |
| `error_awareness` | `{trend: "rising", velocity: 0.04, stability: 0.8}` |
| `strategy_shift` | `{trend: "rising", velocity: 0.05, volatility: "medium"}` |

**4. 情绪与动机信号（Affective Signals）**

| Signal | 时间属性示例 |
|--------|-------------|
| `frustration` | `{trend: "decreasing", velocity: -0.05, volatility: "medium"}` |
| `confidence` | `{trend: "rising", velocity: 0.07, stability: 0.8}` |
| `anxiety` | `{trend: "decreasing", velocity: -0.04, stability: 0.85}` |
| `motivation_drop` | `{trend: "decreasing", velocity: -0.03, volatility: "low"}` |
| `positive_engagement` | `{trend: "rising", velocity: 0.06, stability: 0.9}` |

### 2.3 第三层：可演化学习状态（Evolving Learning State）

> **跨时间、可累计、可回溯，包含速度与加速度**

#### 传统静态状态 ❌

```json
{
  "knowledge_point": "fractions",
  "mastery_level": 0.7
}
```

#### 时间感知动态状态 ✅

```json
{
  "knowledge_point": "fractions",
  "mastery": {
    "current": 0.72,
    "velocity": 0.05,      // 掌握度变化速度（每周）
    "acceleration": -0.01, // 掌握度变化加速度（增速放缓）
    "trend": "rising_slow", // rising_fast | rising_slow | stable | declining
    "stability": 0.85,
    "history": [
      {"date": "2026-01-01", "value": 0.4},
      {"date": "2026-01-08", "value": 0.55},
      {"date": "2026-01-15", "value": 0.68},
      {"date": "2026-01-22", "value": 0.72}
    ]
  },
  "confidence_trend": "rising",
  "misconception_decay": {
    "rate": 0.08,  // 每周减少8%
    "trend": "decreasing"
  },
  "learning_velocity": {
    "avg_time_to_understand": 15.5,  // 分钟
    "trend": "decreasing",  // 理解时间在缩短
    "efficiency_improvement": 0.12
  },
  "last_intervention_effect": "positive",
  "plateau_detected": false,
  "plateau_risk": 0.3
}
```

#### 状态维度（时间感知增强）

**1. 知识掌握状态（Per Knowledge Point）**

| 指标 | 说明 | 时间属性 |
|------|------|----------|
| `mastery.current` | 当前掌握度（0-1） | 当前值 |
| `mastery.velocity` | 掌握度变化速度 | `(当前 - 上周) / 7天` |
| `mastery.acceleration` | 掌握度变化加速度 | `(velocity - 上周velocity) / 7天` |
| `mastery.trend` | 趋势 | rising_fast/rising_slow/stable/declining |
| `mastery.stability` | 稳定性（0-1） | 基于历史波动计算 |
| `misconception_decay.rate` | 错误减少速率 | 每周减少百分比 |
| `last_progress_time` | 最近进步时间 | 最后一次提升的时间 |

**2. 学习节奏与效率**

| 指标 | 说明 | 时间属性 |
|------|------|----------|
| `avg_time_to_understand` | 平均理解时间（分钟） | 当前值 |
| `learning_velocity.trend` | 理解时间趋势 | 缩短/稳定/延长 |
| `retry_efficiency` | 重试效率 | 随时间提升/下降 |
| `learning_speed` | 学习速度 | 知识点/周 |
| `plateau_detected` | 是否进入平台期 | 基于趋势判断 |
| `plateau_risk` | 平台期风险（0-1） | 预测值 |

**3. 学习方式画像（概率分布 + 时间演化）**

```json
{
  "learning_style_profile": {
    "visual_preference": {
      "current": 0.7,
      "trend": "stable",
      "stability": 0.85
    },
    "verbal_preference": {
      "current": 0.4,
      "trend": "rising",
      "stability": 0.75
    },
    "logical_preference": {
      "current": 0.8,
      "trend": "stable",
      "stability": 0.9
    },
    "example_driven": {
      "current": 0.6,
      "trend": "rising",
      "stability": 0.8
    },
    "exploratory": {
      "current": 0.5,
      "trend": "decreasing",
      "stability": 0.7
    }
  }
}
```

**4. 情绪与心理状态（趋势级）**

| 指标 | 说明 | 时间属性 |
|------|------|----------|
| `emotional_baseline` | 情绪基线 | 稳定/波动 |
| `stress_trend` | 压力趋势 | 上升/稳定/下降 |
| `resilience` | 抗挫力（0-1） | 随时间增强/减弱 |
| `confidence_trend` | 信心趋势 | rising/stable/declining |
| `motivation_trend` | 动机趋势 | rising/stable/declining |

### 2.4 第四层：轨迹级洞察与预测（Trajectory-based Insights）

> **从"判断"升级到"预测"，回答未来问题**

#### 传统静态判断 ❌

```json
{
  "knowledge_point": "quadratic_function",
  "mastery_level": 0.65,
  "status": "needs_improvement"
}
```

#### 时间感知预测 ✅

```json
{
  "knowledge_point": "quadratic_function",
  "current_mastery": 0.65,
  "trajectory_analysis": {
    "pattern": "plateau_risk",
    "predicted_mastery_7d": 0.67,
    "predicted_mastery_30d": 0.70,
    "confidence": 0.75
  },
  "risk_prediction": {
    "risk_level": "high",
    "risk_reasons": [
      "mastery_velocity < threshold (0.65 < 0.1)",
      "confusion_trend increasing",
      "previous similar collapse pattern detected",
      "plateau_detected = true"
    ],
    "recommended_intervention_window": "next_3_sessions",
    "intervention_urgency": "high",
    "predicted_outcome_if_no_intervention": "stagnation_or_decline"
  },
  "intervention_recommendations": [
    {
      "type": "step_back_and_rebuild",
      "reason": "concept_fragility_detected",
      "priority": "high",
      "estimated_effectiveness": 0.85
    },
    {
      "type": "visual_reinforcement",
      "reason": "visual_preference_high",
      "priority": "medium",
      "estimated_effectiveness": 0.70
    }
  ]
}
```

#### 预测型问题升级

| 普通系统的问题 | eduNest 可以回答 |
|--------------|----------------|
| 他现在会不会？ | 他是否正在稳定学会？掌握度是上升还是下降？ |
| 哪里错了？ | 哪些错误会反复出现？错误频率是上升还是下降？ |
| 需要补什么？ | 什么时候介入效果最好？如果不介入，3周后会怎样？ |
| 现在状态如何？ | 三周后风险在哪里？可能的轨迹是什么？ |

---

## 一、系统目标（原有内容保留）

### 1.1 核心目标

**重点：通过AI Guide的长期对话分析，深入了解学生的学习情况**

#### 1.1.1 认知维度分析

- ✅ **理解水平评估**：当前理解程度（low/medium/high），理解趋势（上升/稳定/下降）
- ✅ **困惑检测**：困惑频率、困惑类型（general/concept/formula/calculation）、困惑趋势
- ✅ **概念掌握**：概念误用检测、概念混淆识别、概念理解深度
- ✅ **推理能力**：推理断裂识别、逻辑错误模式、推理能力趋势
- ✅ **部分理解识别**：哪些部分理解好，哪些部分理解不足

#### 1.1.2 行为维度分析

- ✅ **坚持度分析**：遇到困难时的坚持程度、坚持度变化趋势
- ✅ **试错倾向**：是否愿意尝试错误、试错效率、试错模式
- ✅ **求助依赖**：对AI Guide的依赖程度、依赖趋势（增强/减弱）
- ✅ **主动探索**：主动探索行为、探索深度、探索效果
- ✅ **任务放弃**：放弃倾向、放弃频率、放弃原因

#### 1.1.3 元认知维度分析

- ✅ **自我解释能力**：能否用自己的话解释概念、自我解释质量
- ✅ **反思能力**：是否主动反思错误、反思深度、反思频率
- ✅ **错误意识**：能否识别自己的错误、错误意识增强趋势
- ✅ **学习策略变化**：是否调整学习策略、策略调整效果

#### 1.1.4 情绪与动机维度分析

- ✅ **挫败感检测**：挫败频率、挫败程度、挫败趋势
- ✅ **信心水平**：当前信心水平、信心变化趋势（上升/下降）
- ✅ **焦虑程度**：焦虑检测、焦虑类型、焦虑缓解趋势
- ✅ **动机变化**：动机水平、动机下降检测、动机恢复能力
- ✅ **正向投入**：积极投入行为、投入频率、投入质量

#### 1.1.5 掌握度与效率维度分析

- ✅ **知识点掌握度**：每个知识点的掌握水平（0-1）、掌握度变化速度（velocity）、掌握度变化加速度（acceleration）
- ✅ **掌握度趋势**：上升/稳定/下降，上升速度（快/慢）
- ✅ **错误减少速率**：错误是否减少、减少速度、错误模式演化
- ✅ **学习速度**：理解时间趋势（缩短/稳定/延长）、学习效率提升
- ✅ **平台期检测**：是否进入平台期、平台期风险预测

#### 1.1.6 学习方式维度分析

- ✅ **学习风格画像**：视觉/文本/逻辑偏好（概率分布），偏好稳定性，偏好演化趋势
- ✅ **学习方式偏好**：探索型 vs 指导型，主动型 vs 被动型
- ✅ **示例驱动倾向**：是否需要大量示例、示例依赖程度
- ✅ **交互方式偏好**：偏好哪种类型的交互（视觉化/文本/实践）

#### 1.1.7 情绪与心理状态维度分析

- ✅ **情绪基线**：情绪稳定性（稳定/波动）、情绪波动频率
- ✅ **压力趋势**：学习压力水平、压力变化趋势（上升/稳定/下降）
- ✅ **抗挫力**：面对困难的恢复能力、抗挫力变化趋势
- ✅ **信心趋势**：信心水平变化（上升/稳定/下降）
- ✅ **动机趋势**：学习动机变化（上升/稳定/下降）

#### 1.1.8 预测与干预维度分析

- ✅ **学习轨迹预测**：未来7天/30天的掌握度预测、学习风险预测
- ✅ **平台期风险**：识别可能的学习停滞、提前预警
- ✅ **干预时机**：最佳干预窗口预测、干预紧迫性评估
- ✅ **干预效果预测**：不同干预策略的预期效果评估

#### 1.1.9 知识结构维度分析

- ✅ **前置知识缺失**：识别前置知识缺失（structural_gap）
- ✅ **表面掌握检测**：识别表面掌握、深层理解不足（fragile_mastery）
- ✅ **误区集中分析**：识别误区集中的知识点（misconception_cluster）
- ✅ **知识关联强度**：知识点之间的关联理解强度

#### 1.1.10 学习健康度综合评估

- ✅ **学习健康指数**：综合理解速度、困惑频率、情绪稳定性、学习连续性
- ✅ **风险等级**：🟢 稳定 / 🟡 有风险 / 🔴 需要干预
- ✅ **优势识别**：哪些知识点是学生的强项、优势稳定性
- ✅ **薄弱点识别**：哪些知识点薄弱、薄弱程度、薄弱原因

### 1.2 分析重点

**核心数据源：AI Guide对话**
- 对话内容反映学生的理解程度
- 提问方式反映学习风格
- 错误频率反映薄弱点
- 对话轮次和时长反映学习速度

**辅助数据源：基础交互事件**
- 内容进入/离开时间
- 阶段切换
- 完成状态

### 1.2 分析输出

为每个学生生成：

1. **学习画像**（Learning Profile）
   - 学习风格、认知特点、行为模式

2. **知识点掌握地图**（Knowledge Mastery Map）
   - 每个知识点的掌握程度、学习时间、错误模式

3. **学习效率报告**（Learning Efficiency Report）
   - 快速掌握 vs 缓慢掌握的知识点对比

4. **个性化建议**（Personalized Recommendations）
   - 下一步学习内容、学习方式建议、薄弱点强化

---

## 二、数据采集方案

### 2.1 采集原则

> **只记录事实，不记录结论**
> 
> 结论由分析层生成，而非采集层

### 2.2 数据源优先级

1. **AI Guide对话**（核心数据源，重点分析）
   - 对话内容、提问方式、错误频率
   - 对话时长、轮次、知识点关联

2. **基础交互事件**（辅助数据源，简化采集）
   - 内容进入/离开
   - 阶段切换
   - 完成状态

---

## 三、AI Guide对话分析（核心）

### 3.1 对话数据结构

**当前使用 `ai_conversations` + `ai_messages` 表：**

```sql
-- 对话表
ai_conversations (
  id, user_id, visitor_id, content_id, 
  entry_point, language_code, created_at, updated_at
)

-- 消息表
ai_messages (
  id, conversation_id, role, content, 
  ui_state, created_at
)
```

### 3.2 从对话中提取的学习信号

#### 3.2.1 认知状态信号

**从学生提问中识别：**

| 信号类型 | 识别方法 | 示例 |
|---------|---------|------|
| **理解困惑** | 连续追问、澄清请求 | "为什么？"、"我不明白"、"能再解释一下吗？" |
| **概念混淆** | 错误理解、概念混用 | "共价键和离子键有什么区别？"（在讲共价键时问） |
| **理解提升** | 主动解释、举一反三 | "所以如果...那么..."、"我明白了，就像..." |
| **知识盲区** | 基础概念缺失 | "什么是电子？"、"原子是什么？" |

#### 3.2.2 学习行为信号

**从提问方式识别：**

| 信号类型 | 识别方法 | 示例 |
|---------|---------|------|
| **主动探索** | 主动提问、深入思考 | "如果改变参数会怎样？"、"还有其他方法吗？" |
| **被动依赖** | 直接要答案、缺乏思考 | "答案是多少？"、"直接告诉我" |
| **学习毅力** | 多次尝试、不放弃 | 连续追问同一个问题、反复确认 |
| **学习速度** | 快速理解 vs 需要多次解释 | 一次解释就懂 vs 需要3-5轮对话 |

#### 3.2.3 错误模式信号

**从错误提问中识别：**

| 错误类型 | 识别方法 | 示例 |
|---------|---------|------|
| **概念错误** | 对概念的错误理解 | "共价键就是原子共享电子，所以没有电荷" |
| **计算错误** | 计算过程中的错误 | "2+2=5"、"角度算错了" |
| **逻辑错误** | 推理过程的错误 | "因为A所以B"（但A不能推出B） |
| **记忆错误** | 记忆不准确 | "键角是90度"（实际是104.5度） |

### 3.3 对话分析算法

#### 3.3.1 提取对话信号（dialogue_signals）

**直接使用AI分析所有对话，提取学习信号：**

```javascript
// 从对话中提取学习信号（完全基于AI分析）
async function extractDialogueSignals(conversationId, userId, contentId) {
  // 1. 获取对话的所有消息
  const { data: messages } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  
  // 2. 获取内容的知识点（从tags字段获取）
  const { data: content } = await supabase
    .from('content')
    .select('tags')
    .eq('id', contentId)
    .single();
  
  const knowledgePoints = content.tags || [];
  
  // 3. 使用AI分析整个对话，提取所有学习信号
  const signals = await analyzeDialogueWithAI(messages, knowledgePoints, conversationId, userId, contentId);
  
  // 4. 保存所有信号到数据库
  await saveDialogueSignals(signals);
  
  return signals;
}

// 保存信号到数据库
async function saveDialogueSignals(signals) {
  if (signals.length === 0) return;
  
  const { error } = await supabase
    .from('dialogue_signals')
    .insert(signals);
  
  if (error) {
    console.error('Failed to save dialogue signals:', error);
    throw error;
  }
}
```

#### 3.3.2 AI语义分析（完整对话分析）

**使用AI分析整个对话，提取所有学习信号：**

```javascript
// 使用AI分析对话，提取所有学习信号
async function analyzeDialogueWithAI(messages, knowledgePoints, conversationId, userId, contentId) {
  const conversationText = messages
    .map(m => `${m.role === 'user' ? '学生' : 'AI'}: ${m.content}`)
    .join('\n\n');
  
  const prompt = `你是一个教育分析师。请分析以下学生与AI的对话，提取所有学习信号。

对话内容：
${conversationText}

相关知识点：${knowledgePoints.length > 0 ? knowledgePoints.join(', ') : '未指定'}

请仔细分析对话，提取所有可能的学习信号，覆盖以下10个维度：

【1. 认知维度】
- understanding_level: low / medium / high（理解水平）
- confusion_detected: general / concept / formula / calculation / reasoning（困惑类型）
- concept_misuse: concept_misunderstanding / concept_confusion / concept_depth_insufficient（概念误用）
- reasoning_gap: logic_error / inference_error / causal_error（推理断裂）
- partial_understanding: partial_good / partial_poor / fragmented（部分理解）
- knowledge_gap: basic_concept / prerequisite / advanced_concept / structural_gap（知识盲区）

【2. 行为维度】
- persistence: high / medium / low（坚持度）
- trial_and_error: active / passive / none（试错倾向）
- help_dependency: high / medium / low（求助依赖）
- exploration: active / moderate / passive（主动探索）
- task_abandonment: frequent / occasional / rare（任务放弃）

【3. 元认知维度】
- self_explanation: high_quality / medium_quality / low_quality / none（自我解释能力）
- reflection: deep / moderate / shallow / none（反思能力）
- error_awareness: high / medium / low（错误意识）
- strategy_shift: adaptive / rigid / none（学习策略变化）

【4. 情绪与动机维度】
- frustration: high / medium / low / none（挫败感）
- confidence: high / medium / low（信心水平）
- anxiety: high / medium / low / none（焦虑程度）
- motivation: high / medium / low / dropping（动机水平）
- positive_engagement: high / medium / low（正向投入）

【5. 掌握度与效率维度】
- mastery_level: mastered / proficient / emerging / unknown（掌握度水平）
- mastery_velocity: fast_rising / slow_rising / stable / declining（掌握度变化速度）
- error_reduction_rate: fast / moderate / slow / none（错误减少速率）
- learning_speed: fast / normal / slow（学习速度）
- plateau_detected: yes / no / at_risk（平台期检测）

【6. 学习方式维度】
- learning_style_preference: visual / verbal / logical / kinesthetic / mixed（学习风格偏好）
- learning_approach: exploratory / guided / mixed（学习方式偏好）
- example_dependency: high / medium / low（示例驱动倾向）
- interaction_preference: visualization / text / practice / mixed（交互方式偏好）

【7. 情绪与心理状态维度】
- emotional_baseline: stable / volatile（情绪基线）
- stress_level: high / medium / low（压力水平）
- resilience: high / medium / low（抗挫力）
- confidence_trend: rising / stable / declining（信心趋势）
- motivation_trend: rising / stable / declining（动机趋势）

【8. 预测与干预维度】
- trajectory_prediction: positive / neutral / negative（学习轨迹预测）
- plateau_risk: high / medium / low（平台期风险）
- intervention_urgency: high / medium / low（干预紧迫性）
- intervention_effectiveness: high / medium / low（干预效果预测）

【9. 知识结构维度】
- structural_gap: prerequisite_missing / concept_fragile / none（前置知识缺失）
- fragile_mastery: detected / not_detected（表面掌握检测）
- misconception_cluster: high / medium / low / none（误区集中分析）
- knowledge_connection: strong / moderate / weak（知识关联强度）

【10. 学习健康度维度】
- learning_health_index: stable / at_risk / needs_intervention（学习健康指数）
- strength_identified: knowledge_point_list（优势识别，值为知识点列表）
- weakness_identified: knowledge_point_list（薄弱点识别，值为知识点列表）
- risk_level: green / yellow / red（风险等级）

请输出JSON格式的学习信号数组，每个信号必须包含：
- signal_type: 信号类型（必须从上述预定义类型中选择）
- signal_value: 信号值（必须从上述预定义值中选择）
- confidence: 置信度（0-1之间的浮点数）
- evidence: 证据（对应的原始文本片段，尽量精确）
- knowledge_point: 关联的知识点（从提供的知识点列表中选择，如果没有匹配的则使用第一个，或null）

请尽可能提取所有信号，覆盖所有10个维度，不要遗漏。只输出JSON数组，不要其他文字。`;

  const response = await aiProviderFactory.createChatCompletion({
    provider: 'qenda',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 4000  // 增加token限制，以支持更多信号
  });
  
  try {
    // 清理响应文本，提取JSON
    let jsonText = response.content.trim();
    // 移除可能的markdown代码块标记
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
    }
    
    const signals = JSON.parse(jsonText);
    
    // 验证并补充必要字段
    if (!Array.isArray(signals)) {
      console.warn('AI returned non-array response, wrapping in array');
      return [];
    }
    
    // 为每个信号添加元数据
    return signals.map(signal => ({
      user_id: userId,
      conversation_id: conversationId,
      message_id: null,  // 可以后续关联到具体消息
      content_id: contentId,
      knowledge_point: signal.knowledge_point || knowledgePoints[0] || null,
      signal_type: signal.signal_type,
      signal_value: signal.signal_value,
      confidence: signal.confidence || 0.5,
      evidence: signal.evidence || '',
      source: 'ai',
      extraction_method: 'ai_analysis',
      occurred_at: new Date().toISOString()
    })).filter(signal => {
      // 验证必要字段
      return signal.signal_type && signal.signal_value;
    });
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    console.error('Raw response:', response.content);
    return [];
  }
}
```

### 3.4 从对话分析优劣势

#### 3.4.1 优势识别（从对话中）

**指标**：
- 主动解释概念（理解水平高）
- 一次解释就懂（学习速度快）
- 能举一反三（掌握程度高）
- 提问深入（探索能力强）

**算法**：
```sql
-- 识别优势知识点（基于对话信号）
WITH dialogue_analysis AS (
  SELECT 
    ds.knowledge_point,
    COUNT(DISTINCT ds.id) FILTER (WHERE ds.signal_type = 'understanding_level' AND ds.signal_value = 'high') as high_understanding_count,
    COUNT(DISTINCT ds.id) FILTER (WHERE ds.signal_type = 'learning_intent' AND ds.signal_value = 'explore') as explore_count,
    AVG(am_count.messages_count) as avg_messages_per_conversation,
    COUNT(DISTINCT ds.conversation_id) as conversations_count
  FROM dialogue_signals ds
  JOIN (
    SELECT conversation_id, COUNT(*) as messages_count
    FROM ai_messages
    WHERE role = 'user'
    GROUP BY conversation_id
  ) am_count ON ds.source_event_id IN (
    SELECT id FROM ai_messages WHERE conversation_id = am_count.conversation_id
  )
  WHERE ds.user_id = :user_id
    AND ds.knowledge_point IS NOT NULL
  GROUP BY ds.knowledge_point
)
SELECT 
  knowledge_point,
  CASE 
    WHEN high_understanding_count >= 2 
      AND explore_count >= 1 
      AND avg_messages_per_conversation < 5
    THEN 'strength'
    ELSE NULL
  END as strength_level,
  high_understanding_count,
  explore_count,
  avg_messages_per_conversation
FROM dialogue_analysis;
```

#### 3.4.2 劣势识别（从对话中）

**指标**：
- 频繁困惑信号（理解困难）
- 多次追问同一问题（学习慢）
- 概念错误重复出现（薄弱点）
- 需要大量AI解释（依赖度高）

**算法**：
```sql
-- 识别劣势知识点（基于对话信号）
WITH dialogue_weaknesses AS (
  SELECT 
    ds.knowledge_point,
    COUNT(DISTINCT ds.id) FILTER (WHERE ds.signal_type = 'confusion_detected') as confusion_count,
    COUNT(DISTINCT ds.id) FILTER (WHERE ds.signal_type = 'misconception') as misconception_count,
    COUNT(DISTINCT ds.id) FILTER (WHERE ds.signal_type = 'knowledge_gap') as knowledge_gap_count,
    AVG(am_count.messages_count) as avg_messages_per_conversation,
    COUNT(DISTINCT ds.conversation_id) as conversations_count
  FROM dialogue_signals ds
  JOIN (
    SELECT conversation_id, COUNT(*) as messages_count
    FROM ai_messages
    WHERE role = 'user'
    GROUP BY conversation_id
  ) am_count ON ds.source_event_id IN (
    SELECT id FROM ai_messages WHERE conversation_id = am_count.conversation_id
  )
  WHERE ds.user_id = :user_id
    AND ds.knowledge_point IS NOT NULL
  GROUP BY ds.knowledge_point
)
SELECT 
  knowledge_point,
  CASE 
    WHEN confusion_count >= 3 
      OR misconception_count >= 2 
      OR (knowledge_gap_count >= 2 AND avg_messages_per_conversation > 8)
    THEN 'weakness'
    ELSE NULL
  END as weakness_level,
  confusion_count,
  misconception_count,
  knowledge_gap_count,
  avg_messages_per_conversation
FROM dialogue_weaknesses;
```

### 3.5 从对话分析学习速度

#### 3.5.1 学习速度指标（基于对话）

**定义**：
- **快速掌握**：平均对话轮次 < 3，一次解释就懂
- **正常掌握**：平均对话轮次 3-6，需要少量解释
- **缓慢掌握**：平均对话轮次 > 6，需要大量解释

**算法**：
```sql
-- 计算每个知识点的学习速度（基于对话）
WITH knowledge_speed AS (
  SELECT 
    ds.knowledge_point,
    AVG(am_count.messages_count) as avg_messages_per_conversation,
    AVG(EXTRACT(EPOCH FROM (conv.updated_at - conv.created_at)) / 60) as avg_conversation_minutes,
    COUNT(DISTINCT conv.id) as conversations_count
  FROM dialogue_signals ds
  JOIN ai_conversations conv ON ds.conversation_id = conv.id
  JOIN (
    SELECT conversation_id, COUNT(*) as messages_count
    FROM ai_messages
    WHERE role = 'user'
    GROUP BY conversation_id
  ) am_count ON conv.id = am_count.conversation_id
  WHERE ds.user_id = :user_id
    AND ds.knowledge_point IS NOT NULL
  GROUP BY ds.knowledge_point
)
SELECT 
  knowledge_point,
  avg_messages_per_conversation,
  avg_conversation_minutes,
  CASE 
    WHEN avg_messages_per_conversation < 3 THEN 'fast'
    WHEN avg_messages_per_conversation > 6 THEN 'slow'
    ELSE 'normal'
  END as speed_category
FROM knowledge_speed;
```

### 3.6 从对话分析学习方式

#### 3.6.1 学习风格识别（基于提问方式）

**维度**：

1. **主动型 vs 被动型**
   - 主动型：主动提问、主动探索、深入思考
   - 被动型：直接要答案、等待解释、缺乏思考

2. **探索型 vs 指导型**
   - 探索型：问"如果...会怎样？"、"还有其他方法吗？"
   - 指导型：问"怎么做？"、"步骤是什么？"

**算法**：
```sql
-- 识别学习风格（基于对话）
WITH learning_style_metrics AS (
  SELECT 
    user_id,
    -- 主动提问比例
    COUNT(DISTINCT CASE 
      WHEN ds.signal_type = 'learning_intent' 
        AND ds.signal_value IN ('explore', 'verify', 'understand')
      THEN ds.id 
    END)::float /
    NULLIF(COUNT(DISTINCT CASE WHEN ds.signal_type = 'learning_intent' THEN ds.id END), 0) as active_ratio,
    
    -- 被动依赖比例
    COUNT(DISTINCT CASE 
      WHEN ds.signal_type = 'learning_intent' 
        AND ds.signal_value = 'answer_seeking'
      THEN ds.id 
    END)::float /
    NULLIF(COUNT(DISTINCT CASE WHEN ds.signal_type = 'learning_intent' THEN ds.id END), 0) as passive_ratio,
    
    -- 探索行为比例
    COUNT(DISTINCT CASE 
      WHEN ds.signal_type = 'learning_intent' 
        AND ds.signal_value = 'explore'
      THEN ds.id 
    END)::float /
    NULLIF(COUNT(DISTINCT CASE WHEN ds.signal_type = 'learning_intent' THEN ds.id END), 0) as exploration_ratio,
    
    -- AI依赖度（平均对话轮次）
    AVG(am_count.messages_count) as avg_messages_per_conversation
  FROM dialogue_signals ds
  JOIN (
    SELECT conversation_id, COUNT(*) as messages_count
    FROM ai_messages
    WHERE role = 'user'
    GROUP BY conversation_id
  ) am_count ON ds.conversation_id = am_count.conversation_id
  WHERE ds.user_id = :user_id
  GROUP BY ds.user_id
)
SELECT 
  user_id,
  CASE 
    WHEN active_ratio > 0.6 THEN 'active'
    WHEN passive_ratio > 0.5 THEN 'passive'
    ELSE 'balanced'
  END as engagement_style,
  
  CASE 
    WHEN exploration_ratio > 0.4 THEN 'exploratory'
    WHEN avg_messages_per_conversation > 8 THEN 'guided'
    ELSE 'mixed'
  END as learning_style,
  
  CASE 
    WHEN avg_messages_per_conversation < 3 THEN 'low'
    WHEN avg_messages_per_conversation > 8 THEN 'high'
    ELSE 'medium'
  END as ai_dependency_level
FROM learning_style_metrics;
```

### 3.7 错误模式分析

#### 3.7.1 常见错误识别

**从对话中识别错误模式：**

```sql
-- 识别常见错误模式
SELECT 
  ds.knowledge_point,
  ds.signal_value as error_type,
  COUNT(*) as error_count,
  array_agg(DISTINCT ds.evidence) as error_examples
FROM dialogue_signals ds
WHERE ds.user_id = :user_id
  AND ds.signal_type = 'misconception'
GROUP BY ds.knowledge_point, ds.signal_value
ORDER BY error_count DESC
LIMIT 10;
```

**错误类型分类**：
- `concept_misunderstanding`：概念理解错误
- `formula_misuse`：公式使用错误
- `calculation_error`：计算错误
- `logic_error`：逻辑推理错误
- `memory_error`：记忆错误

---

## 四、基础交互分析（简化）

### 4.1 可追踪的事件（无需HTML标记）

**说明：以下事件都可以通过通用的浏览器事件API追踪，不需要在AI生成的HTML中添加任何标记**

| 事件类型 | 追踪方式 | 采集内容 | 用途 |
|---------|---------|---------|------|
| **`content_enter`** | `DOMContentLoaded` / `document.readyState` | 进入内容、时间、来源 | 学习路径重建 |
| **`content_exit`** | `beforeunload` / `visibilitychange` | 离开内容、停留时长 | 学习效率分析 |
| **`page_visibility`** | `visibilitychange` | 页面可见性变化（切换标签页） | 专注度评估 |
| **`scroll_depth`** | `scroll` | 滚动深度（百分比） | 内容阅读深度 |
| **`time_on_page`** | `setInterval` | 页面停留时间（定期记录） | 学习时长统计 |
| **`click_count`** | `click`（事件委托） | 总点击次数 | 互动活跃度 |
| **`input_interaction`** | `input` / `change` | 是否有输入行为、输入框数量 | 参与度分析 |
| **`focus_lost`** | `blur` | 失去焦点次数、时长 | 专注度分析 |
| **`keyboard_activity`** | `keydown` | 键盘使用频率 | 互动方式识别 |
| **`window_resize`** | `resize` | 窗口大小变化 | 设备/环境信息 |
| **`mouse_movement`** | `mousemove` | 鼠标移动频率（可选） | 活跃度检测 |

**需要HTML标记才能追踪的事件（如果不在AI生成时添加标记，则无法追踪）**：
- ❌ `stage_enter` / `stage_exit` - 需要 `data-stage` 属性或URL hash
- ❌ `content_complete` - 需要自定义事件触发（`window.dispatchEvent`）
- ❌ 特定元素的交互（如特定按钮点击、Canvas交互等）

### 4.2 推荐采集的事件列表

**如果不在AI生成时添加标记，建议采集以下事件：**

1. **核心事件**（必须有）
   - `content_enter` - 进入内容
   - `content_exit` - 离开内容
   - `time_on_page` - 页面停留时间

2. **活跃度事件**（推荐）
   - `click_count` - 点击次数
   - `input_interaction` - 输入行为
   - `scroll_depth` - 滚动深度

3. **专注度事件**（可选）
   - `page_visibility` - 页面可见性
   - `focus_lost` - 失去焦点

### 4.3 无标记事件追踪脚本（完整版）

**如果不在AI生成时添加标记，可以使用以下脚本追踪所有通用事件：**

```javascript
(function() {
  'use strict';
  
  const TRACKING_CONFIG = {
    contentId: '{{CONTENT_ID}}',
    sessionId: '{{SESSION_ID}}',
    userId: '{{USER_ID}}',
    visitorId: '{{VISITOR_ID}}',
    apiEndpoint: '{{API_ENDPOINT}}',
    knowledgePoints: {{KNOWLEDGE_POINTS}}
  };
  
  let contentEnterTime = null;
  let clickCount = 0;
  let inputCount = 0;
  let maxScrollDepth = 0;
  let timeTrackingInterval = null;
  let lastActivityTime = Date.now();
  
  // ========== 1. 内容进入 ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      contentEnterTime = Date.now();
      sendEvent('content_enter', {
        entry_source: 'direct',
        timestamp: contentEnterTime
      });
      startTracking();
    });
  } else {
    contentEnterTime = Date.now();
    sendEvent('content_enter', {
      entry_source: 'direct',
      timestamp: contentEnterTime
    });
    startTracking();
  }
  
  function startTracking() {
    // ========== 2. 页面停留时间（定期记录） ==========
    timeTrackingInterval = setInterval(() => {
      if (contentEnterTime) {
        const timeOnPage = Date.now() - contentEnterTime;
        sendEvent('time_on_page', {
          time_ms: timeOnPage,
          timestamp: Date.now()
        });
      }
    }, 30000); // 每30秒记录一次
    
    // ========== 3. 滚动深度追踪 ==========
    let scrollCheckTimer = null;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollCheckTimer);
      scrollCheckTimer = setTimeout(() => {
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const clientHeight = document.documentElement.clientHeight;
        const scrollDepth = Math.round(((scrollTop + clientHeight) / scrollHeight) * 100);
        
        if (scrollDepth > maxScrollDepth) {
          maxScrollDepth = scrollDepth;
          sendEvent('scroll_depth', {
            depth_percent: scrollDepth,
            timestamp: Date.now()
          });
        }
      }, 500); // 防抖500ms
    }, { passive: true });
    
    // ========== 4. 点击次数追踪（事件委托） ==========
    document.addEventListener('click', (e) => {
      clickCount++;
      lastActivityTime = Date.now();
      
      // 每10次点击记录一次
      if (clickCount % 10 === 0) {
        sendEvent('click_count', {
          total_clicks: clickCount,
          timestamp: Date.now()
        });
      }
    }, true);
    
    // ========== 5. 输入行为追踪 ==========
    document.addEventListener('input', (e) => {
      const target = e.target;
      if (target.tagName && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        inputCount++;
        lastActivityTime = Date.now();
        sendEvent('input_interaction', {
          input_type: target.type || 'text',
          total_inputs: inputCount,
          has_value: !!target.value,
          timestamp: Date.now()
        });
      }
    }, true);
    
    // ========== 6. 页面可见性追踪（切换标签页） ==========
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        sendEvent('page_visibility', {
          visible: false,
          timestamp: Date.now()
        });
      } else {
        sendEvent('page_visibility', {
          visible: true,
          timestamp: Date.now()
        });
        lastActivityTime = Date.now();
      }
    });
    
    // ========== 7. 窗口失去焦点追踪 ==========
    window.addEventListener('blur', () => {
      sendEvent('focus_lost', {
        timestamp: Date.now()
      });
    });
    
    window.addEventListener('focus', () => {
      sendEvent('focus_gained', {
        timestamp: Date.now()
      });
      lastActivityTime = Date.now();
    });
    
    // ========== 8. 键盘活动追踪（可选，减少频率） ==========
    let keydownCount = 0;
    document.addEventListener('keydown', () => {
      keydownCount++;
      lastActivityTime = Date.now();
      
      // 每20次按键记录一次
      if (keydownCount % 20 === 0) {
        sendEvent('keyboard_activity', {
          total_keys: keydownCount,
          timestamp: Date.now()
        });
      }
    }, true);
    
    // ========== 9. 窗口大小变化（记录设备/环境信息） ==========
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        sendEvent('window_resize', {
          width: window.innerWidth,
          height: window.innerHeight,
          timestamp: Date.now()
        });
      }, 500);
    });
    
    // ========== 10. 鼠标移动活跃度（可选，降低频率） ==========
    let mousemoveCount = 0;
    let mousemoveTimer = null;
    document.addEventListener('mousemove', () => {
      mousemoveCount++;
      clearTimeout(mousemoveTimer);
      mousemoveTimer = setTimeout(() => {
        // 每30秒记录一次鼠标活动频率
        if (mousemoveCount > 100) {
          sendEvent('mouse_activity', {
            movements: mousemoveCount,
            timestamp: Date.now()
          });
          mousemoveCount = 0;
        }
      }, 30000);
    }, { passive: true });
  }
  
  // ========== 11. 内容离开 ==========
  window.addEventListener('beforeunload', () => {
    if (contentEnterTime) {
      const duration = Date.now() - contentEnterTime;
      
      // 发送最终统计
      sendEvent('content_exit', {
        duration_ms: duration,
        total_clicks: clickCount,
        total_inputs: inputCount,
        max_scroll_depth: maxScrollDepth,
        timestamp: Date.now()
      });
      
      // 清理定时器
      if (timeTrackingInterval) {
        clearInterval(timeTrackingInterval);
      }
      
      flushEvents();
    }
  });
  
  // ========== 12. 可选：自定义事件监听（如果AI生成的内容触发） ==========
  window.addEventListener('content_complete', (e) => {
    sendEvent('content_complete', {
      completion_type: e.detail?.type || 'manual',
      ...e.detail
    });
  });
  
  // 发送事件函数（简化版）
  function sendEvent(eventType, payload) {
    const knowledgePoint = TRACKING_CONFIG.knowledgePoints?.[0] || null;
    
    fetch(TRACKING_CONFIG.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [{
          event_type: eventType,
          payload: payload,
          content_id: TRACKING_CONFIG.contentId,
          knowledge_point: knowledgePoint,
          session_id: TRACKING_CONFIG.sessionId,
          user_id: TRACKING_CONFIG.userId,
          visitor_id: TRACKING_CONFIG.visitorId,
          occurred_at: new Date().toISOString()
        }]
      })
    }).catch(console.error);
  }
  
  function flushEvents() {
    // 简化版：事件立即发送，不批量
  }
})();
```

---

## 五、数据表结构

> **注意**：如果需要更详细的交互追踪（如阶段切换、知识点关联等），请参考 [`Interactive_Learning_Enhance.md`](./Interactive_Learning_Enhance.md) 文档，该文档描述了需要在AI生成HTML时添加标记的增强方案。

---

### 5.1 dialogue_signals 表（核心：对话信号表，时间感知增强）

**这是最重要的表，存储从AI Guide对话中提取的学习信号。**
**时间感知增强：添加序列索引和时间间隔字段，支持轨迹分析。**

```sql
CREATE TABLE dialogue_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联
  user_id uuid REFERENCES users(id),
  visitor_id text,
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES ai_messages(id) ON DELETE SET NULL,
  
  -- 知识点关联（核心）
  content_id uuid REFERENCES content(id),
  knowledge_point text,  -- 关联的知识点
  session_id text,       -- 学习会话ID（时间感知增强）
  
  -- 信号核心
  signal_type text NOT NULL,     -- 信号类型（见下方）
  signal_value text NOT NULL,    -- 信号值（见下方）
  
  confidence float,              -- 0~1，AI判断置信度
  evidence text,                 -- 对应的原始文本片段
  
  -- 来源
  source text DEFAULT 'ai',      -- ai / rule / system
  extraction_method text,       -- 提取方法：rule_based / ai_analysis
  
  -- 时间（时间感知增强）
  occurred_at timestamptz NOT NULL DEFAULT now(),
  sequence_index int,            -- 信号在会话中的序列索引（新增）
  time_since_last_seconds int,   -- 距离上一个信号的时间（秒，新增）
  time_in_session_seconds int,   -- 会话内累计时间（秒，新增）
  created_at timestamptz DEFAULT now()
);

-- 索引
CREATE INDEX idx_dialogue_signals_user 
  ON dialogue_signals (user_id, occurred_at DESC);

CREATE INDEX idx_dialogue_signals_knowledge 
  ON dialogue_signals (knowledge_point) 
  WHERE knowledge_point IS NOT NULL;

CREATE INDEX idx_dialogue_signals_type 
  ON dialogue_signals (signal_type);

CREATE INDEX idx_dialogue_signals_conversation 
  ON dialogue_signals (conversation_id);
```

#### 5.1.1 signal_type 和 signal_value 定义（完整10维度体系）

**1. 认知维度信号（Cognitive Signals）**

| signal_type | signal_value 可选值 | 说明 |
|------------|-------------------|------|
| `understanding_level` | `low` / `medium` / `high` | 当前理解程度 |
| `confusion_detected` | `general` / `concept` / `formula` / `calculation` / `reasoning` | 困惑类型 |
| `concept_misuse` | `concept_misunderstanding` / `concept_confusion` / `concept_depth_insufficient` | 概念误用/混淆 |
| `reasoning_gap` | `logic_error` / `inference_error` / `causal_error` | 推理断裂 |
| `partial_understanding` | `partial_good` / `partial_poor` / `fragmented` | 部分理解识别 |
| `knowledge_gap` | `basic_concept` / `prerequisite` / `advanced_concept` / `structural_gap` | 知识盲区 |

**2. 行为维度信号（Behavioral Signals）**

| signal_type | signal_value 可选值 | 说明 |
|------------|-------------------|------|
| `persistence` | `high` / `medium` / `low` | 坚持度 |
| `trial_and_error` | `active` / `passive` / `none` | 试错倾向 |
| `help_dependency` | `high` / `medium` / `low` | 求助依赖 |
| `exploration` | `active` / `moderate` / `passive` | 主动探索 |
| `task_abandonment` | `frequent` / `occasional` / `rare` | 任务放弃 |

**3. 元认知维度信号（Metacognitive Signals）**

| signal_type | signal_value 可选值 | 说明 |
|------------|-------------------|------|
| `self_explanation` | `high_quality` / `medium_quality` / `low_quality` / `none` | 自我解释能力 |
| `reflection` | `deep` / `moderate` / `shallow` / `none` | 反思能力 |
| `error_awareness` | `high` / `medium` / `low` | 错误意识 |
| `strategy_shift` | `adaptive` / `rigid` / `none` | 学习策略变化 |

**4. 情绪与动机维度信号（Affective Signals）**

| signal_type | signal_value 可选值 | 说明 |
|------------|-------------------|------|
| `frustration` | `high` / `medium` / `low` / `none` | 挫败感 |
| `confidence` | `high` / `medium` / `low` | 信心水平 |
| `anxiety` | `high` / `medium` / `low` / `none` | 焦虑程度 |
| `motivation` | `high` / `medium` / `low` / `dropping` | 动机水平 |
| `positive_engagement` | `high` / `medium` / `low` | 正向投入 |

**5. 掌握度与效率维度信号（Mastery & Efficiency Signals）**

| signal_type | signal_value 可选值 | 说明 |
|------------|-------------------|------|
| `mastery_level` | `mastered` / `proficient` / `emerging` / `unknown` | 掌握度水平 |
| `mastery_velocity` | `fast_rising` / `slow_rising` / `stable` / `declining` | 掌握度变化速度 |
| `error_reduction_rate` | `fast` / `moderate` / `slow` / `none` | 错误减少速率 |
| `learning_speed` | `fast` / `normal` / `slow` | 学习速度 |
| `plateau_detected` | `yes` / `no` / `at_risk` | 平台期检测 |

**6. 学习方式维度信号（Learning Style Signals）**

| signal_type | signal_value 可选值 | 说明 |
|------------|-------------------|------|
| `learning_style_preference` | `visual` / `verbal` / `logical` / `kinesthetic` / `mixed` | 学习风格偏好 |
| `learning_approach` | `exploratory` / `guided` / `mixed` | 学习方式偏好 |
| `example_dependency` | `high` / `medium` / `low` | 示例驱动倾向 |
| `interaction_preference` | `visualization` / `text` / `practice` / `mixed` | 交互方式偏好 |

**7. 情绪与心理状态维度信号（Emotional & Psychological Signals）**

| signal_type | signal_value 可选值 | 说明 |
|------------|-------------------|------|
| `emotional_baseline` | `stable` / `volatile` | 情绪基线 |
| `stress_level` | `high` / `medium` / `low` | 压力水平 |
| `resilience` | `high` / `medium` / `low` | 抗挫力 |
| `confidence_trend` | `rising` / `stable` / `declining` | 信心趋势 |
| `motivation_trend` | `rising` / `stable` / `declining` | 动机趋势 |

**8. 预测与干预维度信号（Prediction & Intervention Signals）**

| signal_type | signal_value 可选值 | 说明 |
|------------|-------------------|------|
| `trajectory_prediction` | `positive` / `neutral` / `negative` | 学习轨迹预测 |
| `plateau_risk` | `high` / `medium` / `low` | 平台期风险 |
| `intervention_urgency` | `high` / `medium` / `low` | 干预紧迫性 |
| `intervention_effectiveness` | `high` / `medium` / `low` | 干预效果预测 |

**9. 知识结构维度信号（Knowledge Structure Signals）**

| signal_type | signal_value 可选值 | 说明 |
|------------|-------------------|------|
| `structural_gap` | `prerequisite_missing` / `concept_fragile` / `none` | 前置知识缺失 |
| `fragile_mastery` | `detected` / `not_detected` | 表面掌握检测 |
| `misconception_cluster` | `high` / `medium` / `low` / `none` | 误区集中分析 |
| `knowledge_connection` | `strong` / `moderate` / `weak` | 知识关联强度 |

**10. 学习健康度维度信号（Learning Health Signals）**

| signal_type | signal_value 可选值 | 说明 |
|------------|-------------------|------|
| `learning_health_index` | `stable` / `at_risk` / `needs_intervention` | 学习健康指数 |
| `strength_identified` | `knowledge_point_list` | 优势识别 |
| `weakness_identified` | `knowledge_point_list` | 薄弱点识别 |
| `risk_level` | `green` / `yellow` / `red` | 风险等级 |

### 5.2 learning_events 表（简化：基础事件表）

**只存储基础的学习路径事件，不存储详细交互。**

```sql
CREATE TABLE learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 身份
  user_id uuid,
  visitor_id text,
  session_id text NOT NULL,
  
  -- 上下文
  content_id uuid REFERENCES content(id),
  knowledge_point text,  -- 从content表的tags字段获取
  
  -- 行为（简化）
  event_type text NOT NULL,  -- content_enter / content_exit / stage_enter / content_complete
  payload jsonb,
  
  -- 时间
  occurred_at timestamptz NOT NULL DEFAULT now(),
  client_ts timestamptz,
  source text DEFAULT 'web',
  created_at timestamptz DEFAULT now()
);

-- 索引
CREATE INDEX idx_learning_events_user_time 
  ON learning_events (user_id, occurred_at DESC);

CREATE INDEX idx_learning_events_knowledge 
  ON learning_events (knowledge_point) 
  WHERE knowledge_point IS NOT NULL;
```

```sql
CREATE TABLE learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 身份
  user_id uuid,                    -- 登录用户
  visitor_id text,                  -- 匿名用户
  session_id text NOT NULL,         -- 学习会话ID
  
  -- 上下文
  content_id uuid REFERENCES content(id),
  knowledge_point text,             -- 知识点（如：linear_equation_1）
  stage_id text,                    -- 阶段ID（如：introduction, practice）
  
  -- 行为
  event_type text NOT NULL,         -- 事件类型
  payload jsonb,                    -- 事件详情（见下方）
  
  -- 时间（时间感知增强）
  occurred_at timestamptz NOT NULL DEFAULT now(),
  client_ts timestamptz,           -- 客户端时间（防网络延迟）
  sequence_index int,              -- 事件在会话中的序列索引（新增）
  time_since_last_seconds int,     -- 距离上一个事件的时间（秒，新增）
  time_in_session_seconds int,     -- 会话内累计时间（秒，新增）
  
  -- 元数据
  source text DEFAULT 'web',        -- web / mobile / iframe
  created_at timestamptz DEFAULT now()
);

-- 索引
CREATE INDEX idx_learning_events_user_time 
  ON learning_events (user_id, occurred_at DESC);

CREATE INDEX idx_learning_events_knowledge 
  ON learning_events (knowledge_point) 
  WHERE knowledge_point IS NOT NULL;

CREATE INDEX idx_learning_events_type 
  ON learning_events (event_type);

CREATE INDEX idx_learning_events_payload_gin 
  ON learning_events USING gin (payload);
```

### 4.2 student_learning_profile 表（学习画像，时间感知增强）

**时间感知增强：添加趋势和稳定性指标。**

```sql
CREATE TABLE student_learning_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  
  -- 学习风格（静态）
  learning_style text,              -- exploratory / guided / mixed
  modality_preference text,          -- visual / textual / mixed
  engagement_style text,             -- active / passive / balanced
  
  -- 学习风格动态指标（时间感知增强）
  learning_style_profile jsonb,     -- {visual_preference: {current, trend, stability}, ...}（新增）
  
  -- 行为特征
  ai_dependency_level text,         -- low / medium / high
  ai_dependency_trend text,         -- 趋势：decreasing/stable/increasing（新增）
  persistence_level text,            -- low / medium / high
  attention_span_minutes float,      -- 平均专注时长
  attention_span_trend text,         -- 专注时长趋势（新增）
  
  -- 学习效率
  avg_learning_speed_ratio float,   -- 平均学习速度（实际/预期）
  learning_efficiency_trend text,   -- 效率趋势：improving/stable/declining（新增）
  fast_learning_topics text[],      -- 快速掌握的知识点
  slow_learning_topics text[],      -- 缓慢掌握的知识点
  
  -- 情绪与心理状态（时间感知增强）
  emotional_baseline text,          -- 情绪基线：stable/volatile（新增）
  stress_trend text,                -- 压力趋势：rising/stable/decreasing（新增）
  resilience float,                 -- 抗挫力（0-1，新增）
  confidence_trend text,            -- 信心趋势：rising/stable/declining（新增）
  motivation_trend text,            -- 动机趋势（新增）
  
  -- 更新时间
  last_updated_at timestamptz DEFAULT now(),
  updated_by text DEFAULT 'system',
  
  UNIQUE(user_id)
);

CREATE INDEX idx_student_learning_profile_user 
  ON student_learning_profile (user_id);
```

### 4.3 knowledge_mastery 表（知识点掌握度，时间感知增强）

**时间感知增强：添加 velocity、acceleration、trend 等动态指标。**

```sql
CREATE TABLE knowledge_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  knowledge_point text NOT NULL,
  
  -- 掌握程度（静态）
  mastery_level text,               -- unknown / emerging / proficient / mastered
  confidence_level text,             -- low / medium / high
  
  -- 掌握度动态指标（时间感知增强）
  mastery_current float,            -- 当前掌握度（0-1，新增）
  mastery_velocity float,           -- 掌握度变化速度（每周，新增）
  mastery_acceleration float,       -- 掌握度变化加速度（新增）
  mastery_trend text,               -- 趋势：rising_fast/rising_slow/stable/declining（新增）
  mastery_stability float,          -- 稳定性（0-1，新增）
  
  -- 学习数据
  first_attempt_success_rate float, -- 首次尝试成功率
  avg_attempts_before_success float,-- 平均尝试次数
  avg_learning_time_minutes float, -- 平均学习时间
  total_learning_time_minutes float,-- 总学习时间
  
  -- 学习速度（时间感知增强）
  learning_velocity_trend text,     -- 理解时间趋势：decreasing/stable/increasing（新增）
  plateau_detected boolean,         -- 是否进入平台期（新增）
  plateau_risk float,               -- 平台期风险（0-1，新增）
  
  -- 错误分析
  common_errors text[],              -- 常见错误类型
  misconception_tags text[],        -- 误区标签
  misconception_decay_rate float,   -- 错误减少速率（每周百分比，新增）
  
  -- 学习速度
  learning_speed_category text,     -- fast / normal / slow
  speed_ratio float,                -- 学习速度比（实际/预期）
  
  -- 优势/劣势标记
  is_strength boolean DEFAULT false,
  is_weakness boolean DEFAULT false,
  
  -- 更新时间
  last_event_at timestamptz,
  last_updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, knowledge_point)
);

CREATE INDEX idx_knowledge_mastery_user 
  ON knowledge_mastery (user_id, mastery_level);

CREATE INDEX idx_knowledge_mastery_weakness 
  ON knowledge_mastery (user_id, is_weakness) 
  WHERE is_weakness = true;

CREATE INDEX idx_knowledge_mastery_trend 
  ON knowledge_mastery (user_id, mastery_trend) 
  WHERE mastery_trend IS NOT NULL;
```

### 5.4 signal_time_series 表（时间感知信号聚合表，新增）

**存储时间窗口内的信号聚合数据，支持趋势分析。**

```sql
CREATE TABLE signal_time_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联
  user_id uuid NOT NULL REFERENCES users(id),
  knowledge_point text NOT NULL,
  signal_type text NOT NULL,  -- confusion_frequency / clarification_depth / ...
  
  -- 时间窗口
  time_window text NOT NULL,  -- last_7_days / last_30_days / last_90_days
  window_start_date date NOT NULL,
  window_end_date date NOT NULL,
  
  -- 信号值（时间感知）
  current_value float,        -- 当前值
  trend text,                 -- rising | stable | decreasing
  velocity float,             -- 变化速度（每时间窗口单位）
  volatility text,            -- low | medium | high
  stability float,            -- 稳定性（0-1）
  
  -- 历史序列
  value_history jsonb,        -- [{"date": "2026-01-01", "value": 0.6}, ...]
  frequency_history jsonb,    -- [0.6, 0.55, 0.48, 0.42]
  time_intervals jsonb,       -- ["7d_ago", "5d_ago", "3d_ago", "1d_ago"]
  
  -- 时间
  last_occurrence timestamptz,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, knowledge_point, signal_type, time_window, window_start_date)
);

CREATE INDEX idx_signal_time_series_user_knowledge 
  ON signal_time_series (user_id, knowledge_point, calculated_at DESC);

CREATE INDEX idx_signal_time_series_trend 
  ON signal_time_series (user_id, signal_type, trend) 
  WHERE trend IS NOT NULL;
```

### 4.4 learning_analysis_reports 表（学习分析报告）

```sql
CREATE TABLE learning_analysis_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  
  -- 报告类型
  report_type text NOT NULL,        -- weekly / monthly / semester / custom
  report_period_start timestamptz,
  report_period_end timestamptz,
  
  -- 报告内容（JSONB）
  report_data jsonb NOT NULL,       -- 见下方结构
  
  -- 生成信息
  generated_at timestamptz DEFAULT now(),
  generated_by text DEFAULT 'system',
  
  UNIQUE(user_id, report_type, report_period_start)
);

CREATE INDEX idx_learning_analysis_reports_user 
  ON learning_analysis_reports (user_id, generated_at DESC);
```

---

## 六、数据整合分析（综合多数据源）

### 6.1 数据源整合

**可以整合以下数据源进行综合分析：**

| 数据源 | 表/字段 | 包含信息 | 用途 |
|--------|---------|---------|------|
| **对话记录** | `dialogue_signals` | 学习信号、认知状态、错误模式 | 理解程度、薄弱点 |
| **交互记录** | `learning_events` | 学习路径、停留时间、活跃度 | 学习效率、行为模式 |
| **对话内容** | `ai_conversations` + `ai_messages` | 对话全文、对话时长、轮次 | 学习风格、AI依赖度 |
| **内容信息** | `content` | 知识点（tags）、内容类型 | 知识点关联、内容偏好 |
| **内容元数据** | `content.metadata_json` | 学习目标、阶段结构 | 学习进度、完成度 |

### 6.2 综合分析场景

#### 6.2.1 场景1：学习效果综合评估

**整合对话信号 + 交互记录 + 内容信息**

```sql
-- 综合评估某个知识点的学习效果
WITH dialogue_analysis AS (
  -- 从对话中提取学习信号
  SELECT 
    ds.knowledge_point,
    ds.content_id,
    COUNT(DISTINCT CASE WHEN ds.signal_type = 'understanding_level' AND ds.signal_value = 'high' THEN ds.id END) as high_understanding_count,
    COUNT(DISTINCT CASE WHEN ds.signal_type = 'confusion_detected' THEN ds.id END) as confusion_count,
    COUNT(DISTINCT CASE WHEN ds.signal_type = 'misconception' THEN ds.id END) as misconception_count,
    AVG(ds.confidence) as avg_confidence
  FROM dialogue_signals ds
  WHERE ds.user_id = :user_id
    AND ds.knowledge_point = :knowledge_point
  GROUP BY ds.knowledge_point, ds.content_id
),
interaction_analysis AS (
  -- 从交互记录中提取行为数据
  SELECT 
    le.knowledge_point,
    le.content_id,
    AVG((le.payload->>'duration_ms')::float / 1000 / 60) as avg_time_minutes,
    MAX((le.payload->>'max_scroll_depth')::float) as max_scroll_depth,
    SUM((le.payload->>'total_clicks')::int) as total_clicks,
    SUM((le.payload->>'total_inputs')::int) as total_inputs
  FROM learning_events le
  WHERE le.user_id = :user_id
    AND le.knowledge_point = :knowledge_point
    AND le.event_type = 'content_exit'
  GROUP BY le.knowledge_point, le.content_id
),
conversation_analysis AS (
  -- 从对话记录中提取对话时长和轮次
  SELECT 
    c.content_id,
    COUNT(DISTINCT c.id) as conversation_count,
    AVG(message_counts.message_count) as avg_messages_per_conversation,
    AVG(EXTRACT(EPOCH FROM (c.updated_at - c.created_at)) / 60) as avg_conversation_minutes
  FROM ai_conversations c
  JOIN (
    SELECT conversation_id, COUNT(*) as message_count
    FROM ai_messages
    WHERE role = 'user'
    GROUP BY conversation_id
  ) message_counts ON c.id = message_counts.conversation_id
  WHERE c.user_id = :user_id
    AND c.content_id IN (SELECT DISTINCT content_id FROM dialogue_analysis)
  GROUP BY c.content_id
)
SELECT 
  COALESCE(d.knowledge_point, i.knowledge_point) as knowledge_point,
  COALESCE(d.content_id, i.content_id) as content_id,
  
  -- 对话分析结果
  d.high_understanding_count,
  d.confusion_count,
  d.misconception_count,
  d.avg_confidence,
  
  -- 交互分析结果
  i.avg_time_minutes,
  i.max_scroll_depth,
  i.total_clicks,
  i.total_inputs,
  
  -- 对话分析结果
  c.conversation_count,
  c.avg_messages_per_conversation,
  c.avg_conversation_minutes,
  
  -- 综合评分（示例）
  CASE 
    WHEN d.high_understanding_count >= 2 
      AND d.confusion_count = 0 
      AND i.avg_time_minutes < 10
      AND c.avg_messages_per_conversation < 5
    THEN 'excellent'
    WHEN d.high_understanding_count >= 1 
      AND d.confusion_count <= 1 
      AND i.avg_time_minutes < 15
      AND c.avg_messages_per_conversation < 8
    THEN 'good'
    WHEN d.confusion_count >= 3 
      OR c.avg_messages_per_conversation > 10
    THEN 'needs_improvement'
    ELSE 'average'
  END as overall_rating
  
FROM dialogue_analysis d
FULL OUTER JOIN interaction_analysis i 
  ON d.knowledge_point = i.knowledge_point 
  AND d.content_id = i.content_id
LEFT JOIN conversation_analysis c 
  ON COALESCE(d.content_id, i.content_id) = c.content_id
ORDER BY overall_rating, d.avg_confidence DESC;
```

#### 6.2.2 场景2：学习路径与对话关联分析

**整合交互记录 + 对话记录，分析学习路径与AI求助的关系**

```sql
-- 分析：学习路径中何时会求助AI
WITH learning_path AS (
  SELECT 
    le.content_id,
    le.occurred_at,
    le.event_type,
    le.knowledge_point,
    LAG(le.event_type) OVER (PARTITION BY le.content_id ORDER BY le.occurred_at) as prev_event_type,
    LEAD(le.event_type) OVER (PARTITION BY le.content_id ORDER BY le.occurred_at) as next_event_type,
    EXTRACT(EPOCH FROM (le.occurred_at - LAG(le.occurred_at) OVER (PARTITION BY le.content_id ORDER BY le.occurred_at))) / 60 as minutes_since_prev
  FROM learning_events le
  WHERE le.user_id = :user_id
    AND le.content_id = :content_id
),
ai_help_moments AS (
  SELECT 
    c.content_id,
    c.created_at as conversation_start,
    COUNT(DISTINCT m.id) as message_count,
    MIN(m.created_at) as first_question_time
  FROM ai_conversations c
  JOIN ai_messages m ON c.id = m.conversation_id
  WHERE c.user_id = :user_id
    AND c.content_id = :content_id
    AND m.role = 'user'
  GROUP BY c.id, c.content_id, c.created_at
)
SELECT 
  lp.event_type,
  lp.knowledge_point,
  lp.minutes_since_prev,
  COUNT(DISTINCT CASE 
    WHEN ahm.conversation_start BETWEEN lp.occurred_at - INTERVAL '5 minutes' 
      AND lp.occurred_at + INTERVAL '5 minutes'
    THEN ahm.conversation_start
  END) as ai_help_count_nearby,
  
  -- 分析：哪些事件后更容易求助AI
  AVG(CASE 
    WHEN ahm.conversation_start BETWEEN lp.occurred_at AND lp.occurred_at + INTERVAL '10 minutes'
    THEN 1 ELSE 0
  END) as help_probability_after_event
  
FROM learning_path lp
LEFT JOIN ai_help_moments ahm ON lp.content_id = ahm.content_id
WHERE lp.event_type IN ('content_enter', 'stage_enter', 'scroll_depth', 'input_interaction')
GROUP BY lp.event_type, lp.knowledge_point, lp.minutes_since_prev
ORDER BY help_probability_after_event DESC;
```

#### 6.2.3 场景3：内容类型与学习方式匹配度分析

**整合内容Metadata + 对话记录 + 交互记录**

```sql
-- 分析：不同内容类型（视觉/文本/交互）的学习效果
WITH content_metadata AS (
  SELECT 
    c.id as content_id,
    c.tags[1] as knowledge_point,
    c.metadata_json->>'visualElements'->>'canvasType' as canvas_type,
    c.metadata_json->>'contentStructure'->>'totalStages' as total_stages,
    c.metadata_json->>'interactions' as interactions
  FROM content c
  WHERE c.id IN (
    SELECT DISTINCT content_id FROM dialogue_signals WHERE user_id = :user_id
  )
),
learning_effectiveness AS (
  SELECT 
    ds.content_id,
    ds.knowledge_point,
    -- 对话效果
    AVG(CASE WHEN ds.signal_type = 'understanding_level' AND ds.signal_value = 'high' THEN 1.0 ELSE 0.0 END) as dialogue_understanding_rate,
    COUNT(DISTINCT CASE WHEN ds.signal_type = 'misconception' THEN ds.id END) as misconception_count,
    -- 交互效果
    AVG((le.payload->>'max_scroll_depth')::float) as avg_scroll_depth,
    AVG((le.payload->>'total_clicks')::int) as avg_clicks,
    -- 对话时长
    AVG(cv.avg_messages_per_conversation) as avg_dialogue_turns
  FROM dialogue_signals ds
  LEFT JOIN learning_events le 
    ON ds.content_id = le.content_id 
    AND le.event_type = 'content_exit'
    AND le.user_id = :user_id
  LEFT JOIN (
    SELECT 
      conversation_id,
      content_id,
      COUNT(*) as avg_messages_per_conversation
    FROM ai_messages
    WHERE role = 'user'
    GROUP BY conversation_id, content_id
  ) cv ON ds.content_id = cv.content_id
  WHERE ds.user_id = :user_id
  GROUP BY ds.content_id, ds.knowledge_point
)
SELECT 
  cm.canvas_type,
  cm.total_stages,
  COUNT(DISTINCT le.content_id) as content_count,
  
  -- 学习效果指标
  AVG(le.dialogue_understanding_rate) as avg_understanding_rate,
  AVG(le.misconception_count) as avg_misconception_count,
  AVG(le.avg_scroll_depth) as avg_scroll_depth,
  AVG(le.avg_clicks) as avg_clicks,
  AVG(le.avg_dialogue_turns) as avg_dialogue_turns,
  
  -- 内容类型与学习效果的关系
  CASE 
    WHEN cm.canvas_type = 'Canvas' AND le.avg_clicks > 20 AND le.dialogue_understanding_rate > 0.7
    THEN 'good_match'
    WHEN cm.canvas_type = 'SVG' AND le.avg_clicks > 15 AND le.dialogue_understanding_rate > 0.6
    THEN 'good_match'
    WHEN cm.canvas_type IS NULL AND le.avg_scroll_depth > 80 AND le.dialogue_understanding_rate > 0.6
    THEN 'good_match'
    ELSE 'needs_optimization'
  END as content_style_match
  
FROM content_metadata cm
JOIN learning_effectiveness le ON cm.content_id = le.content_id
GROUP BY cm.canvas_type, cm.total_stages
ORDER BY avg_understanding_rate DESC;
```

#### 6.2.4 场景4：学习目标达成度分析

**整合Metadata中的学习目标 + 对话记录 + 交互记录**

```sql
-- 分析：学习目标是否达成
WITH learning_objectives AS (
  SELECT 
    c.id as content_id,
    c.tags[1] as knowledge_point,
    jsonb_array_elements_text(c.metadata_json->'learningObjectives') as objective
  FROM content c
  WHERE c.id = :content_id
),
objective_check AS (
  SELECT 
    lo.content_id,
    lo.knowledge_point,
    lo.objective,
    
    -- 检查对话中是否提到理解了这个目标
    COUNT(DISTINCT CASE 
      WHEN ds.signal_type = 'understanding_level' 
        AND ds.signal_value = 'high'
        AND ds.evidence ILIKE '%' || lo.objective || '%'
      THEN ds.id
    END) as understanding_mentions,
    
    -- 检查交互中是否完成了相关操作
    COUNT(DISTINCT CASE 
      WHEN le.event_type = 'input_interaction'
        AND le.payload->>'input_type' IS NOT NULL
      THEN le.id
    END) as interaction_attempts,
    
    -- 检查是否有相关错误
    COUNT(DISTINCT CASE 
      WHEN ds.signal_type = 'misconception'
        AND ds.evidence ILIKE '%' || lo.objective || '%'
      THEN ds.id
    END) as related_errors
    
  FROM learning_objectives lo
  LEFT JOIN dialogue_signals ds 
    ON lo.content_id = ds.content_id
    AND lo.knowledge_point = ds.knowledge_point
    AND ds.user_id = :user_id
  LEFT JOIN learning_events le
    ON lo.content_id = le.content_id
    AND le.user_id = :user_id
  GROUP BY lo.content_id, lo.knowledge_point, lo.objective
)
SELECT 
  content_id,
  knowledge_point,
  objective,
  understanding_mentions,
  interaction_attempts,
  related_errors,
  
  -- 目标达成度评分
  CASE 
    WHEN understanding_mentions >= 1 AND interaction_attempts >= 1 AND related_errors = 0
    THEN 'achieved'
    WHEN understanding_mentions >= 1 AND related_errors <= 1
    THEN 'mostly_achieved'
    WHEN related_errors >= 2
    THEN 'struggling'
    ELSE 'not_achieved'
  END as objective_status
  
FROM objective_check
ORDER BY 
  CASE objective_status
    WHEN 'achieved' THEN 1
    WHEN 'mostly_achieved' THEN 2
    WHEN 'struggling' THEN 3
    WHEN 'not_achieved' THEN 4
  END;
```

### 6.3 整合分析示例：完整学习画像

**整合所有数据源，生成完整的学习画像：**

```javascript
// 综合学习画像生成
async function generateComprehensiveLearningProfile(userId, knowledgePoint) {
  // 1. 从对话记录中提取学习信号
  const dialogueSignals = await supabase
    .from('dialogue_signals')
    .select('*')
    .eq('user_id', userId)
    .eq('knowledge_point', knowledgePoint);
  
  // 2. 从交互记录中提取行为数据
  const interactionEvents = await supabase
    .from('learning_events')
    .select('*')
    .eq('user_id', userId)
    .eq('knowledge_point', knowledgePoint);
  
  // 3. 从对话记录中提取对话统计
  const conversations = await supabase
    .from('ai_conversations')
    .select('id, content_id, created_at, updated_at')
    .eq('user_id', userId)
    .in('content_id', [...new Set(dialogueSignals.data.map(s => s.content_id))]);
  
  const messages = await supabase
    .from('ai_messages')
    .select('conversation_id, role, content, created_at')
    .in('conversation_id', conversations.data.map(c => c.id));
  
  // 4. 从内容表获取知识点和metadata
  const contents = await supabase
    .from('content')
    .select('id, tags, metadata_json')
    .in('id', [...new Set(conversations.data.map(c => c.content_id))]);
  
  // 5. 整合分析
  const profile = {
    knowledge_point: knowledgePoint,
    
    // 认知状态（来自对话）
    understanding_level: calculateUnderstandingLevel(dialogueSignals.data),
    confusion_points: extractConfusionPoints(dialogueSignals.data),
    misconceptions: extractMisconceptions(dialogueSignals.data),
    
    // 学习行为（来自交互）
    learning_pattern: analyzeLearningPattern(interactionEvents.data),
    engagement_level: calculateEngagementLevel(interactionEvents.data),
    time_distribution: analyzeTimeDistribution(interactionEvents.data),
    
    // 学习风格（来自对话+交互）
    learning_style: determineLearningStyle(
      dialogueSignals.data,
      messages.data,
      interactionEvents.data
    ),
    
    // 学习效果（综合）
    mastery_level: calculateMasteryLevel(
      dialogueSignals.data,
      interactionEvents.data,
      conversations.data
    ),
    
    // 内容偏好（来自Metadata+学习效果）
    content_preferences: analyzeContentPreferences(
      contents.data,
      dialogueSignals.data,
      interactionEvents.data
    ),
    
    // 学习目标达成度（来自Metadata+对话+交互）
    objective_achievement: analyzeObjectiveAchievement(
      contents.data,
      dialogueSignals.data,
      interactionEvents.data,
      messages.data
    )
  };
  
  return profile;
}

// 辅助函数：计算理解水平
function calculateUnderstandingLevel(signals) {
  const highCount = signals.filter(
    s => s.signal_type === 'understanding_level' && s.signal_value === 'high'
  ).length;
  const confusionCount = signals.filter(
    s => s.signal_type === 'confusion_detected'
  ).length;
  
  if (highCount >= 2 && confusionCount === 0) return 'high';
  if (highCount >= 1 && confusionCount <= 1) return 'medium';
  return 'low';
}

// 辅助函数：分析学习模式
function analyzeLearningPattern(events) {
  const timeOnPage = events
    .filter(e => e.event_type === 'content_exit')
    .map(e => e.payload?.duration_ms / 1000 / 60)
    .reduce((sum, t) => sum + t, 0) / events.length;
  
  const avgClicks = events
    .filter(e => e.event_type === 'content_exit')
    .map(e => e.payload?.total_clicks || 0)
    .reduce((sum, c) => sum + c, 0) / events.length;
  
  const scrollDepth = events
    .filter(e => e.event_type === 'scroll_depth')
    .map(e => e.payload?.depth_percent || 0)
    .reduce((max, d) => Math.max(max, d), 0);
  
  return {
    time_on_page: timeOnPage,
    engagement_level: avgClicks > 20 ? 'high' : avgClicks > 10 ? 'medium' : 'low',
    content_exploration: scrollDepth > 80 ? 'thorough' : scrollDepth > 50 ? 'moderate' : 'superficial'
  };
}

// 辅助函数：确定学习风格（综合对话和交互）
function determineLearningStyle(dialogueSignals, messages, interactionEvents) {
  // 从对话中判断
  const activeQuestions = messages.filter(
    m => m.role === 'user' && 
    (m.content.includes('为什么') || m.content.includes('如何') || m.content.includes('能否'))
  ).length;
  
  const answerSeeking = dialogueSignals.filter(
    s => s.signal_type === 'learning_intent' && s.signal_value === 'answer_seeking'
  ).length;
  
  // 从交互中判断
  const explorationActions = interactionEvents.filter(
    e => e.event_type === 'input_interaction' || 
    (e.event_type === 'content_exit' && (e.payload?.total_clicks || 0) > 15)
  ).length;
  
  const totalQuestions = messages.filter(m => m.role === 'user').length;
  
  return {
    engagement_style: activeQuestions > totalQuestions * 0.4 ? 'active' : 'passive',
    learning_approach: explorationActions > interactionEvents.length * 0.3 ? 'exploratory' : 'guided',
    ai_dependency: answerSeeking > totalQuestions * 0.5 ? 'high' : 'low'
  };
}

// 辅助函数：分析内容偏好
function analyzeContentPreferences(contents, dialogueSignals, interactionEvents) {
  const contentTypes = contents.map(c => {
    const metadata = c.metadata_json;
    const canvasType = metadata?.visualElements?.canvasType || 'none';
    const hasInteractions = !!metadata?.interactions;
    
    // 计算该内容类型的学习效果
    const contentId = c.id;
    const signals = dialogueSignals.filter(s => s.content_id === contentId);
    const events = interactionEvents.filter(e => e.content_id === contentId);
    
    const understandingRate = signals.filter(
      s => s.signal_type === 'understanding_level' && s.signal_value === 'high'
    ).length / (signals.length || 1);
    
    const engagementScore = events
      .filter(e => e.event_type === 'content_exit')
      .map(e => (e.payload?.total_clicks || 0) + (e.payload?.total_inputs || 0))
      .reduce((sum, s) => sum + s, 0) / (events.length || 1);
    
    return {
      type: canvasType,
      has_interactions: hasInteractions,
      understanding_rate: understandingRate,
      engagement_score: engagementScore,
      preference_score: understandingRate * 0.6 + (engagementScore / 50) * 0.4
    };
  });
  
  // 找出最适合的内容类型
  const preferredType = contentTypes.reduce((best, current) => 
    current.preference_score > (best.preference_score || 0) ? current : best
  , {});
  
  return {
    preferred_content_type: preferredType.type || 'unknown',
    interaction_preference: preferredType.has_interactions ? 'high' : 'low',
    visual_preference: preferredType.type === 'Canvas' || preferredType.type === 'SVG' ? 'high' : 'low'
  };
}

// 辅助函数：分析学习目标达成度
function analyzeObjectiveAchievement(contents, dialogueSignals, interactionEvents, messages) {
  const objectives = contents
    .flatMap(c => (c.metadata_json?.learningObjectives || []))
    .filter((v, i, arr) => arr.indexOf(v) === i); // 去重
  
  return objectives.map(objective => {
    // 检查对话中是否理解了这个目标
    const understandingMentions = dialogueSignals.filter(
      s => s.signal_type === 'understanding_level' && 
      s.signal_value === 'high' &&
      s.evidence && s.evidence.includes(objective)
    ).length;
    
    // 检查是否有相关错误
    const relatedErrors = dialogueSignals.filter(
      s => s.signal_type === 'misconception' &&
      s.evidence && s.evidence.includes(objective)
    ).length;
    
    // 检查对话中是否讨论过
    const discussionCount = messages.filter(
      m => m.content && m.content.includes(objective)
    ).length;
    
    return {
      objective: objective,
      understanding_mentions: understandingMentions,
      related_errors: relatedErrors,
      discussion_count: discussionCount,
      achievement_status: understandingMentions >= 1 && relatedErrors === 0 ? 'achieved' :
                          understandingMentions >= 1 && relatedErrors <= 1 ? 'mostly_achieved' :
                          relatedErrors >= 2 ? 'struggling' : 'not_achieved'
    };
  });
}
```

### 6.4 整合分析的优势

**通过整合多数据源，可以实现：**

1. **更准确的评估**
   - 单一数据源可能不完整
   - 整合后可以交叉验证

2. **更深入的洞察**
   - 对话揭示认知状态
   - 交互揭示行为模式
   - 整合揭示学习过程全貌

3. **个性化推荐**
   - 根据对话内容推荐相关内容
   - 根据交互行为推荐适合的内容类型
   - 根据学习目标达成度调整学习路径

4. **预测性分析**
   - 结合历史对话和交互，预测学习困难
   - 提前识别可能需要帮助的知识点

### 6.5 整合分析查询示例

**快速查询：学生某个知识点的完整学习情况**

```sql
-- 综合查询：某个知识点的完整学习画像
SELECT 
  -- 基本信息
  c.id as content_id,
  c.title,
  c.tags[1] as knowledge_point,
  
  -- 对话分析
  (SELECT COUNT(*) FROM dialogue_signals 
   WHERE content_id = c.id AND user_id = :user_id
   AND signal_type = 'understanding_level' AND signal_value = 'high') as understanding_count,
  
  (SELECT COUNT(*) FROM dialogue_signals 
   WHERE content_id = c.id AND user_id = :user_id
   AND signal_type = 'confusion_detected') as confusion_count,
  
  (SELECT COUNT(*) FROM dialogue_signals 
   WHERE content_id = c.id AND user_id = :user_id
   AND signal_type = 'misconception') as misconception_count,
  
  -- 交互分析
  (SELECT AVG((payload->>'duration_ms')::float / 1000 / 60) 
   FROM learning_events 
   WHERE content_id = c.id AND user_id = :user_id 
   AND event_type = 'content_exit') as avg_time_minutes,
  
  (SELECT MAX((payload->>'max_scroll_depth')::float) 
   FROM learning_events 
   WHERE content_id = c.id AND user_id = :user_id 
   AND event_type = 'scroll_depth') as max_scroll_depth,
  
  (SELECT AVG((payload->>'total_clicks')::int) 
   FROM learning_events 
   WHERE content_id = c.id AND user_id = :user_id 
   AND event_type = 'content_exit') as avg_clicks,
  
  -- 对话统计
  (SELECT COUNT(*) FROM ai_conversations 
   WHERE content_id = c.id AND user_id = :user_id) as conversation_count,
  
  (SELECT AVG(message_count) FROM (
    SELECT conversation_id, COUNT(*) as message_count
    FROM ai_messages
    WHERE conversation_id IN (
      SELECT id FROM ai_conversations 
      WHERE content_id = c.id AND user_id = :user_id
    )
    AND role = 'user'
    GROUP BY conversation_id
  ) sub) as avg_messages_per_conversation,
  
  -- Metadata信息
  c.metadata_json->'learningObjectives' as learning_objectives,
  c.metadata_json->'contentStructure'->>'totalStages' as total_stages
  
FROM content c
WHERE c.tags && ARRAY[:knowledge_point]  -- 包含该知识点
  AND (
    EXISTS (SELECT 1 FROM dialogue_signals WHERE content_id = c.id AND user_id = :user_id)
    OR EXISTS (SELECT 1 FROM learning_events WHERE content_id = c.id AND user_id = :user_id)
  )
ORDER BY c.created_at DESC;
```

---

## 七、分析算法

### 6.1 对话信号提取算法（核心）

**在每次AI Guide对话后，自动提取学习信号：**

```javascript
// 对话完成后，触发信号提取
async function onConversationComplete(conversationId, userId, contentId) {
  // 1. 提取对话信号
  const signals = await extractDialogueSignals(conversationId, userId, contentId);
  
  // 2. 更新知识点掌握度
  const knowledgePoints = await getKnowledgePointsFromContent(contentId);
  for (const kp of knowledgePoints) {
    await updateKnowledgeMastery(userId, kp);
  }
}

// 从content表的tags字段获取知识点
async function getKnowledgePointsFromContent(contentId) {
  const { data: content } = await supabase
    .from('content')
    .select('tags')
    .eq('id', contentId)
    .single();
  
  return content?.tags || [];
  
  // 3. 更新学习画像（定期，不每次更新）
  const shouldUpdateProfile = await shouldUpdateLearningProfile(userId);
  if (shouldUpdateProfile) {
    await updateLearningProfile(userId);
  }
}
```

### 7.2 知识点掌握度更新算法（整合对话+交互）

**整合对话记录和交互记录进行综合分析：**

```javascript
async function updateKnowledgeMastery(userId, knowledgePoint) {
  // ========== 1. 从对话记录中提取学习信号 ==========
  const { data: signals } = await supabase
    .from('dialogue_signals')
    .select('*')
    .eq('user_id', userId)
    .eq('knowledge_point', knowledgePoint);
  
  const highUnderstandingCount = signals.filter(
    s => s.signal_type === 'understanding_level' && s.signal_value === 'high'
  ).length;
  
  const confusionCount = signals.filter(
    s => s.signal_type === 'confusion_detected'
  ).length;
  
  const misconceptionCount = signals.filter(
    s => s.signal_type === 'misconception'
  ).length;
  
  // ========== 2. 从交互记录中提取行为数据 ==========
  const { data: interactionEvents } = await supabase
    .from('learning_events')
    .select('*')
    .eq('user_id', userId)
    .eq('knowledge_point', knowledgePoint);
  
  // 计算平均停留时间
  const exitEvents = interactionEvents.filter(e => e.event_type === 'content_exit');
  const avgTimeMinutes = exitEvents.length > 0
    ? exitEvents.map(e => (e.payload?.duration_ms || 0) / 1000 / 60).reduce((sum, t) => sum + t, 0) / exitEvents.length
    : 0;
  
  // 计算平均活跃度
  const avgClicks = exitEvents.length > 0
    ? exitEvents.map(e => e.payload?.total_clicks || 0).reduce((sum, c) => sum + c, 0) / exitEvents.length
    : 0;
  
  const avgScrollDepth = interactionEvents
    .filter(e => e.event_type === 'scroll_depth')
    .map(e => e.payload?.depth_percent || 0)
    .reduce((max, d) => Math.max(max, d), 0);
  
  // ========== 3. 从对话记录中提取对话统计 ==========
  const contentIds = [...new Set(signals.map(s => s.content_id))];
  const { data: conversations } = await supabase
    .from('ai_conversations')
    .select('id, content_id, created_at, updated_at')
    .eq('user_id', userId)
    .in('content_id', contentIds);
  
  const { data: messages } = await supabase
    .from('ai_messages')
    .select('conversation_id, role, created_at')
    .eq('role', 'user')
    .in('conversation_id', conversations.map(c => c.id));
  
  const avgMessagesPerConversation = conversations.length > 0
    ? messages.length / conversations.length
    : 0;
  
  // 计算平均对话时长
  const avgConversationMinutes = conversations.length > 0
    ? conversations.map(c => {
        const duration = (new Date(c.updated_at) - new Date(c.created_at)) / 1000 / 60;
        return duration;
      }).reduce((sum, d) => sum + d, 0) / conversations.length
    : 0;
  
  // ========== 4. 综合判断掌握程度 ==========
  let masteryLevel = 'unknown';
  
  // 综合多个指标判断
  const understandingScore = highUnderstandingCount * 2 - confusionCount - misconceptionCount;
  const engagementScore = (avgClicks > 15 ? 1 : 0) + (avgScrollDepth > 80 ? 1 : 0);
  const efficiencyScore = (avgMessagesPerConversation < 5 ? 1 : 0) + (avgTimeMinutes < 15 ? 1 : 0);
  
  if (understandingScore >= 3 && confusionCount === 0 && avgMessagesPerConversation < 3) {
    masteryLevel = 'mastered';
  } else if (understandingScore >= 1 && confusionCount <= 1 && avgMessagesPerConversation < 6) {
    masteryLevel = 'proficient';
  } else if (confusionCount >= 2 || misconceptionCount >= 2 || avgMessagesPerConversation > 8) {
    masteryLevel = 'emerging';
  }
  
  // ========== 5. 综合判断优势/劣势 ==========
  const isStrength = understandingScore >= 3 
    && avgMessagesPerConversation < 3 
    && avgTimeMinutes < 10
    && engagementScore >= 1;
  
  const isWeakness = (confusionCount >= 3 || misconceptionCount >= 2) 
    && (avgMessagesPerConversation > 6 || avgTimeMinutes > 20)
    && engagementScore < 1;
  
  // ========== 6. 综合判断学习速度 ==========
  // 结合对话轮次和停留时间
  let speedCategory = 'normal';
  const speedScore = (avgMessagesPerConversation < 3 ? 1 : 0) + (avgTimeMinutes < 10 ? 1 : 0);
  
  if (speedScore >= 2 && avgConversationMinutes < 5) {
    speedCategory = 'fast';
  } else if (avgMessagesPerConversation > 6 || avgTimeMinutes > 20) {
    speedCategory = 'slow';
  }
  
  // ========== 7. 提取常见错误 ==========
  const commonErrors = signals
    .filter(s => s.signal_type === 'misconception')
    .map(s => s.signal_value)
    .reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
  
  const topErrors = Object.entries(commonErrors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([error, count]) => error);
  
  // ========== 8. 更新knowledge_mastery表 ==========
  await supabase
    .from('knowledge_mastery')
    .upsert({
      user_id: userId,
      knowledge_point: knowledgePoint,
      mastery_level: masteryLevel,
      is_strength: isStrength,
      is_weakness: isWeakness,
      learning_speed_category: speedCategory,
      avg_learning_time_minutes: avgTimeMinutes > 0 ? avgTimeMinutes : null,
      common_errors: topErrors.length > 0 ? topErrors : null,
      last_updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,knowledge_point'
    });
}
```

### 6.3 学习画像更新算法（基于对话）

```javascript
async function updateLearningProfile(userId) {
  // 1. 从dialogue_signals计算学习风格
  const { data: signals } = await supabase
    .from('dialogue_signals')
    .select('*')
    .eq('user_id', userId);
  
  // 2. 计算主动/被动比例
  const activeCount = signals.filter(
    s => s.signal_type === 'learning_intent' && 
    ['explore', 'verify', 'understand'].includes(s.signal_value)
  ).length;
  
  const passiveCount = signals.filter(
    s => s.signal_type === 'learning_intent' && 
    s.signal_value === 'answer_seeking'
  ).length;
  
  const totalIntent = activeCount + passiveCount;
  const activeRatio = totalIntent > 0 ? activeCount / totalIntent : 0.5;
  
  // 3. 计算AI依赖度（平均对话轮次）
  const { data: conversations } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('user_id', userId);
  
  const { data: messageCounts } = await supabase
    .from('ai_messages')
    .select('conversation_id')
    .eq('role', 'user')
    .in('conversation_id', conversations.map(c => c.id));
  
  const avgMessagesPerConversation = messageCounts.length / conversations.length;
  
  // 4. 计算学习速度
  const { data: masteryData } = await supabase
    .from('knowledge_mastery')
    .select('learning_speed_category')
    .eq('user_id', userId);
  
  const fastTopics = masteryData
    .filter(m => m.learning_speed_category === 'fast')
    .map(m => m.knowledge_point);
  
  const slowTopics = masteryData
    .filter(m => m.learning_speed_category === 'slow')
    .map(m => m.knowledge_point);
  
  // 5. 判断学习风格
  let engagementStyle = 'balanced';
  if (activeRatio > 0.6) {
    engagementStyle = 'active';
  } else if (activeRatio < 0.3) {
    engagementStyle = 'passive';
  }
  
  let learningStyle = 'mixed';
  if (activeRatio > 0.4 && avgMessagesPerConversation < 5) {
    learningStyle = 'exploratory';
  } else if (avgMessagesPerConversation > 8) {
    learningStyle = 'guided';
  }
  
  let aiDependencyLevel = 'medium';
  if (avgMessagesPerConversation < 3) {
    aiDependencyLevel = 'low';
  } else if (avgMessagesPerConversation > 8) {
    aiDependencyLevel = 'high';
  }
  
  // 6. 更新profile
  await supabase
    .from('student_learning_profile')
    .upsert({
      user_id: userId,
      learning_style: learningStyle,
      engagement_style: engagementStyle,
      ai_dependency_level: aiDependencyLevel,
      fast_learning_topics: fastTopics,
      slow_learning_topics: slowTopics,
      last_updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    });
}
```

### 5.2 知识点掌握度更新算法

```javascript
async function updateKnowledgeMastery(userId, knowledgePoint) {
  // 1. 统计学习数据
  const stats = await db
    .from('learning_events')
    .select(`
      *,
      COUNT(DISTINCT CASE WHEN event_type = 'interaction_success' THEN id END) as success_count,
      COUNT(DISTINCT CASE WHEN event_type = 'interaction_failure' THEN id END) as failure_count,
      AVG(attempts_before_success) as avg_attempts,
      AVG(learning_time_minutes) as avg_time
    `)
    .eq('user_id', userId)
    .eq('knowledge_point', knowledgePoint)
    .single();
  
  // 2. 计算掌握程度
  const masteryLevel = calculateMasteryLevel(stats);
  
  // 3. 识别常见错误
  const commonErrors = await identifyCommonErrors(userId, knowledgePoint);
  
  // 4. 判断优势/劣势
  const isStrength = stats.success_rate > 0.7 && stats.avg_attempts < 2;
  const isWeakness = stats.success_rate < 0.3 || stats.avg_attempts > 5;
  
  // 5. 更新 mastery
  await db.from('knowledge_mastery').upsert({
    user_id: userId,
    knowledge_point: knowledgePoint,
    mastery_level: masteryLevel,
    first_attempt_success_rate: stats.first_attempt_success_rate,
    avg_attempts_before_success: stats.avg_attempts,
    avg_learning_time_minutes: stats.avg_time,
    common_errors: commonErrors,
    is_strength: isStrength,
    is_weakness: isWeakness,
    last_updated_at: new Date().toISOString()
  }, {
    onConflict: 'user_id,knowledge_point'
  });
}
```

### 5.3 学习速度分析算法

```javascript
async function analyzeLearningSpeed(userId) {
  const speedData = await db
    .from('knowledge_mastery')
    .select('knowledge_point, speed_ratio, learning_speed_category')
    .eq('user_id', userId);
  
  const fastTopics = speedData
    .filter(d => d.learning_speed_category === 'fast')
    .map(d => d.knowledge_point);
  
  const slowTopics = speedData
    .filter(d => d.learning_speed_category === 'slow')
    .map(d => d.knowledge_point);
  
  return {
    fastTopics,
    slowTopics,
    avgSpeedRatio: speedData.reduce((sum, d) => sum + d.speed_ratio, 0) / speedData.length
  };
}
```

---

## 六、学习报告生成

### 6.1 报告结构

```json
{
  "report_type": "monthly",
  "period": {
    "start": "2026-01-01",
    "end": "2026-01-31"
  },
  "student_profile": {
    "learning_style": "exploratory",
    "modality_preference": "visual",
    "engagement_style": "active"
  },
  "knowledge_analysis": {
    "strengths": [
      {
        "knowledge_point": "linear_equation_basic",
        "mastery_level": "mastered",
        "learning_speed": "fast",
        "indicators": ["high_success_rate", "low_attempts"]
      }
    ],
    "weaknesses": [
      {
        "knowledge_point": "quadratic_function",
        "mastery_level": "emerging",
        "learning_speed": "slow",
        "common_errors": ["sign_error", "formula_misuse"],
        "recommendations": ["more_practice", "visual_aids"]
      }
    ]
  },
  "learning_efficiency": {
    "fast_learning_topics": ["linear_equation_basic", "fraction_operations"],
    "slow_learning_topics": ["quadratic_function", "trigonometry"],
    "avg_speed_ratio": 0.85
  },
  "recommendations": {
    "next_steps": [
      {
        "type": "strengthen_weakness",
        "knowledge_point": "quadratic_function",
        "suggested_content": ["content_id_1", "content_id_2"],
        "learning_approach": "visual_exploration"
      }
    ],
    "learning_strategy": {
      "preferred_modality": "visual",
      "interaction_level": "high",
      "ai_guidance": "moderate"
    }
  }
}
```

### 6.2 报告生成算法

```javascript
async function generateLearningReport(userId, reportType, periodStart, periodEnd) {
  // 1. 获取学习画像
  const profile = await getLearningProfile(userId);
  
  // 2. 获取知识点掌握度
  const masteryData = await getKnowledgeMastery(userId, periodStart, periodEnd);
  
  // 3. 识别优势/劣势
  const strengths = masteryData.filter(m => m.is_strength);
  const weaknesses = masteryData.filter(m => m.is_weakness);
  
  // 4. 分析学习速度
  const speedAnalysis = await analyzeLearningSpeed(userId);
  
  // 5. 生成建议
  const recommendations = await generateRecommendations(
    profile,
    strengths,
    weaknesses,
    speedAnalysis
  );
  
  // 6. 组装报告
  const report = {
    report_type: reportType,
    period: {
      start: periodStart,
      end: periodEnd
    },
    student_profile: {
      learning_style: profile.learning_style,
      modality_preference: profile.modality_preference,
      engagement_style: profile.engagement_style
    },
    knowledge_analysis: {
      strengths: strengths.map(s => ({
        knowledge_point: s.knowledge_point,
        mastery_level: s.mastery_level,
        learning_speed: s.learning_speed_category,
        indicators: getStrengthIndicators(s)
      })),
      weaknesses: weaknesses.map(w => ({
        knowledge_point: w.knowledge_point,
        mastery_level: w.mastery_level,
        learning_speed: w.learning_speed_category,
        common_errors: w.common_errors,
        recommendations: getWeaknessRecommendations(w, profile)
      }))
    },
    learning_efficiency: {
      fast_learning_topics: speedAnalysis.fastTopics,
      slow_learning_topics: speedAnalysis.slowTopics,
      avg_speed_ratio: speedAnalysis.avgSpeedRatio
    },
    recommendations: recommendations
  };
  
  // 7. 保存报告
  await db.from('learning_analysis_reports').upsert({
    user_id: userId,
    report_type: reportType,
    report_period_start: periodStart,
    report_period_end: periodEnd,
    report_data: report,
    generated_at: new Date().toISOString()
  }, {
    onConflict: 'user_id,report_type,report_period_start'
  });
  
  return report;
}
```

### 6.3 个性化建议生成

```javascript
async function generateRecommendations(profile, strengths, weaknesses, speedAnalysis) {
  const recommendations = {
    next_steps: [],
    learning_strategy: {}
  };
  
  // 1. 针对薄弱点的建议
  for (const weakness of weaknesses.slice(0, 3)) {
    // 根据学习风格推荐内容
    const suggestedContent = await recommendContent(
      weakness.knowledge_point,
      profile.modality_preference,
      profile.learning_style
    );
    
    recommendations.next_steps.push({
      type: 'strengthen_weakness',
      knowledge_point: weakness.knowledge_point,
      suggested_content: suggestedContent.map(c => c.id),
      learning_approach: getLearningApproach(profile, weakness)
    });
  }
  
  // 2. 学习策略建议
  recommendations.learning_strategy = {
    preferred_modality: profile.modality_preference,
    interaction_level: profile.learning_style === 'exploratory' ? 'high' : 'moderate',
    ai_guidance: profile.ai_dependency_level === 'high' ? 'frequent' : 'moderate'
  };
  
  // 3. 基于快速掌握的知识点，推荐相似内容
  if (speedAnalysis.fastTopics.length > 0) {
    const similarTopics = await findSimilarTopics(speedAnalysis.fastTopics[0]);
    recommendations.next_steps.push({
      type: 'leverage_strength',
      knowledge_point: speedAnalysis.fastTopics[0],
      suggested_content: similarTopics.map(t => t.content_id),
      learning_approach: 'similar_to_fast_learning'
    });
  }
  
  return recommendations;
}
```

---

## 七、实现路线图

### Phase 1: 对话信号提取（核心，3周）

**重点：建立从AI Guide对话中提取学习信号的能力**

- [ ] 实现 `dialogue_signals` 表
- [ ] 实现规则基础的信号提取（extractDialogueSignals）
- [ ] 实现AI语义分析（analyzeDialogueWithAI）
- [ ] 对话完成后自动触发信号提取
- [ ] 信号提取的测试和验证

### Phase 2: 知识点掌握度分析（2周）

**基于对话信号分析知识点掌握情况**

- [ ] 实现 `knowledge_mastery` 表
- [ ] 实现知识点掌握度更新算法（updateKnowledgeMastery）
- [ ] 优势/劣势识别（基于对话信号）
- [ ] 学习速度分析（基于对话轮次）
- [ ] 常见错误提取和分类

### Phase 3: 学习画像生成（2周）

**基于对话分析学习风格和方式**

- [ ] 实现 `student_learning_profile` 表
- [ ] 学习风格识别算法（主动/被动、探索/指导）
- [ ] AI依赖度分析（基于对话轮次）
- [ ] 画像更新机制（定期触发）

### Phase 4: 基础交互事件（简化，1周）

**只实现最基础的学习路径追踪**

- [ ] 实现 `learning_events` 表（简化版）
- [ ] 简化的事件追踪脚本（只采集content_enter/exit, stage_enter, content_complete）
- [ ] 后端事件接收 API
- [ ] 与对话分析结果整合

### Phase 5: 报告生成（2周）

- [ ] 实现 `learning_analysis_reports` 表
- [ ] 报告生成算法（基于对话分析结果）
- [ ] 个性化建议生成
- [ ] 报告展示 UI

### Phase 6: 优化与扩展（持续）

- [ ] 对话信号提取准确度优化
- [ ] AI语义分析模型优化
- [ ] 报告内容细化
- [ ] 实时分析能力

---

## 八、关键指标定义

### 8.1 掌握程度（Mastery Level）

- **unknown**：未学习或数据不足
- **emerging**：刚开始学习，成功率 < 50%
- **proficient**：基本掌握，成功率 50-80%
- **mastered**：熟练掌握，成功率 > 80%

### 8.2 学习速度（Learning Speed）

- **fast**：实际时间 < 预期时间 * 0.7
- **normal**：实际时间在预期时间 * 0.7 ~ 1.3 之间
- **slow**：实际时间 > 预期时间 * 1.3

### 8.3 AI 依赖度（AI Dependency）

- **low**：平均每个知识点 AI 对话 < 1 次
- **medium**：平均每个知识点 AI 对话 1-3 次
- **high**：平均每个知识点 AI 对话 > 3 次

---

## 九、总结

本系统通过：

1. **全面采集**：记录所有学习交互和对话
2. **多维度分析**：优劣势、学习速度、学习方式
3. **个性化建议**：基于分析结果生成针对性建议

实现真正的**个性化学习分析和指导**。
