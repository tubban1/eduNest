# 时间感知型学习分析体系 - 产品需求文档（PRD）

> **核心理念**：
> **学习不是状态，而是轨迹（Trajectory）。**
> 
> eduNest 不判断学生「此刻行不行」，而是持续建模学生如何随着时间学习、卡住、修复与进步。这是一个真正具备时间感知能力的学习智能系统。

## 📋 目录

1. [产品愿景与核心价值](#产品愿景与核心价值)
2. [为什么必须是长期时间线](#为什么必须是长期时间线)
3. [时间感知型四层架构理念](#时间感知型四层架构理念)
4. [完整分析指标体系（10个维度）](#完整分析指标体系10个维度)
5. [应用场景与用户价值](#应用场景与用户价值)
6. [系统能力要求](#系统能力要求)
7. [成功指标](#成功指标)

---

## 一、产品愿景与核心价值

### 1.1 产品定位

**eduNest 是一个时间感知型学习分析系统**，通过AI Guide的长期对话分析，深入了解学生的学习情况，提供个性化学习建议。

### 1.2 核心价值主张

**对外（用户/投资人）可以这样说：**

> "eduNest 不判断学生'此刻行不行'，
> 而是持续建模学生如何随着时间学习、卡住、修复与进步。
> 这是一个真正具备时间感知能力的学习智能系统。"

**对内（产品团队）的目标：**

1. **轨迹分析**：识别学习轨迹模式（上升、停滞、下降）
2. **长期理解**：区分短期记忆与深度理解
3. **越用越懂**：系统随着数据积累越来越智能
4. **预测干预**：提前识别风险，在最佳时机介入

### 1.3 解决的核心问题

传统学习分析系统的局限：

❌ **只看当下**：两个学生都答对同一道题，但：
- A：第一次就答对（自然掌握）
- B：错了5次，问了3次AI才答对（勉强通过）

**当下结果相同，但教育意义完全不同。**

✅ **时间感知型分析**：eduNest 关心的不是「此刻是否正确」，而是：
- 是**自然掌握**还是**勉强通过**
- 是**稳定进步**还是**短期波动**
- 是**理解增强**还是**记忆性通过**

---

## 二、为什么必须是长期时间线？

### 2.1 传统静态分析的问题

**局限性：**

1. **无法区分掌握方式**
   - 第一次答对 vs 多次尝试后才答对
   - 自然理解 vs 记忆性通过
   - 深度掌握 vs 表面掌握

2. **无法识别学习趋势**
   - 是否正在进步？
   - 是否进入平台期？
   - 是否面临学习困难？

3. **无法预测学习风险**
   - 未来可能在哪里卡住？
   - 什么时候需要介入？
   - 哪种干预策略更有效？

### 2.2 时间感知分析的优势

**通过长期时间线，系统能够：**

1. **区分掌握质量**
   - 识别自然掌握 vs 勉强通过
   - 识别深度理解 vs 记忆性掌握
   - 识别稳定进步 vs 短期波动

2. **识别学习模式**
   - 哪些知识点快速掌握？
   - 哪些知识点需要多次尝试？
   - 学习速度是在加快还是减慢？

3. **预测学习风险**
   - 提前识别可能的学习停滞
   - 预测平台期风险
   - 推荐最佳干预时机

4. **优化学习路径**
   - 根据学习速度调整内容推荐
   - 根据薄弱点提供针对性练习
   - 根据学习风格匹配内容类型

---

## 三、时间感知型四层架构理念

### 3.1 四层模型概览

```
第一层：原始学习事件（Learning Events，带时间戳和序列）
        ↓
第二层：时间感知信号（Time-aware Signals，趋势、频率、变化率）
        ↓
第三层：可演化学习状态（Evolving Learning State，velocity、acceleration）
        ↓
第四层：轨迹级洞察与预测（Trajectory-based Insights，预测风险与优化建议）
```

### 3.2 第一层：原始学习事件

**定位：**事实级数据，不做任何判断

**关键特征：**
- 包含精确的时间戳（精确到秒）
- 包含序列索引（事件在会话中的顺序）
- 包含时间间隔信息（距离上一个事件的时间）
- 包含会话信息（关联同一时间段的学习）

**价值：**
- 能够分析「发生顺序」，而不只是时间点
- 例如：是先困惑后理解，还是先理解后困惑？

### 3.3 第二层：时间感知信号

**定位：**从事件中抽取"认知信号"，并计算时间属性

**关键特征：**
- 信号不再是单一值，而是一个时间序列函数
- 包含趋势（上升/稳定/下降）
- 包含变化速度（velocity）
- 包含波动性（volatility）
- 包含稳定性（stability）

**示例：**
- **传统信号**：`confusion_detected: true`
- **时间感知信号**：`{trend: "decreasing", velocity: -0.05, volatility: "low", stability: 0.85}`

**价值：**
- 能够识别信号的长期变化趋势
- 能够区分短期波动和长期趋势
- 能够预测信号的可能走向

### 3.4 第三层：可演化学习状态

**定位：**跨时间、可累计、可回溯，包含速度与加速度

**关键特征：**
- 包含当前状态值
- 包含变化速度（velocity）
- 包含变化加速度（acceleration）
- 包含趋势（rising_fast/rising_slow/stable/declining）
- 包含稳定性评分

**示例：**
- **传统状态**：`mastery_level: 0.7`
- **时间感知状态**：`{current: 0.72, velocity: 0.05, acceleration: -0.01, trend: "rising_slow", stability: 0.85}`

**价值：**
- 能够识别掌握度的变化速度
- 能够识别掌握度的变化加速度（增速是否放缓）
- 能够预测未来的掌握度水平

### 3.5 第四层：轨迹级洞察与预测

**定位：**从"判断"升级到"预测"，回答未来问题

**关键特征：**
- 学习轨迹预测（未来7天/30天）
- 风险预测（平台期风险、学习困难风险）
- 干预时机推荐（最佳介入窗口）
- 干预策略推荐（不同策略的预期效果）

**示例：**
- **传统判断**：`status: "needs_improvement"`
- **时间感知预测**：`{predicted_mastery_7d: 0.67, risk_level: "high", recommended_intervention_window: "next_3_sessions", intervention_urgency: "high"}`

**价值：**
- 能够回答「三周后风险在哪里？」
- 能够回答「什么时候介入效果最好？」
- 能够回答「如果不介入，会发生什么？」

---

## 四、完整分析指标体系（10个维度）

### 4.1 认知维度分析

**目标：**评估学生的理解水平和认知能力

**核心指标：**

1. **理解水平评估**
   - 当前理解程度：low / medium / high
   - 理解趋势：上升 / 稳定 / 下降

2. **困惑检测**
   - 困惑频率：发生困惑的次数
   - 困惑类型：general / concept / formula / calculation / reasoning
   - 困惑趋势：是否在减少？

3. **概念掌握**
   - 概念误用检测：是否误用了概念？
   - 概念混淆识别：是否混淆了不同概念？
   - 概念理解深度：理解到哪个层次？

4. **推理能力**
   - 推理断裂识别：推理过程中是否有断裂？
   - 逻辑错误模式：常见的逻辑错误类型
   - 推理能力趋势：是否在提升？

5. **部分理解识别**
   - 哪些部分理解好？
   - 哪些部分理解不足？
   - 理解是否碎片化？

6. **知识盲区识别**
   - 基础概念缺失：是否缺少基础概念？
   - 前置知识缺失：是否缺少前置知识？
   - 高级概念缺失：是否缺少高级概念？
   - 结构性缺失：知识结构是否完整？

### 4.2 行为维度分析

**目标：**评估学生的学习行为模式和习惯

**数据来源：**
- **学习交互事件**：从点击、输入、滚动等行为提取行为模式
- **AI Guide对话**：从提问方式推断学习行为（主动探索 vs 被动依赖）
- **内容信息**：结合内容类型分析行为偏好

**核心指标：**

1. **坚持度分析**
   - 遇到困难时的坚持程度：high / medium / low
   - 坚持度变化趋势：是否在增强？

2. **试错倾向**
   - 是否愿意尝试错误：active / passive / none
   - 试错效率：试错后是否能快速找到正确答案？
   - 试错模式：是否有规律的试错模式？

3. **求助依赖**
   - 对AI Guide的依赖程度：high / medium / low
   - 依赖趋势：增强 / 稳定 / 减弱
   - 依赖类型：直接要答案 vs 寻求引导

4. **主动探索**
   - 主动探索行为：active / moderate / passive
   - 探索深度：是否深入探索？
   - 探索效果：探索后是否能理解？

5. **任务放弃**
   - 放弃倾向：frequent / occasional / rare
   - 放弃频率：放弃了多少次？
   - 放弃原因：为什么放弃？

### 4.3 元认知维度分析

**目标：**评估学生的元认知能力（对学习过程的认知）

**核心指标：**

1. **自我解释能力**
   - 能否用自己的话解释概念：yes / no
   - 自我解释质量：high_quality / medium_quality / low_quality
   - 自我解释频率：是否经常自我解释？

2. **反思能力**
   - 是否主动反思错误：yes / no
   - 反思深度：deep / moderate / shallow
   - 反思频率：是否经常反思？

3. **错误意识**
   - 能否识别自己的错误：high / medium / low
   - 错误意识增强趋势：是否在提升？

4. **学习策略变化**
   - 是否调整学习策略：adaptive / rigid / none
   - 策略调整效果：调整后是否更有效？

### 4.4 情绪与动机维度分析

**目标：**评估学生的情绪状态和学习动机

**核心指标：**

1. **挫败感检测**
   - 挫败频率：发生挫败的次数
   - 挫败程度：high / medium / low
   - 挫败趋势：是否在减少？

2. **信心水平**
   - 当前信心水平：high / medium / low
   - 信心变化趋势：上升 / 稳定 / 下降

3. **焦虑程度**
   - 焦虑检测：是否出现焦虑？
   - 焦虑类型：学习焦虑 / 考试焦虑 / 时间焦虑
   - 焦虑缓解趋势：是否在缓解？

4. **动机变化**
   - 动机水平：high / medium / low / dropping
   - 动机下降检测：是否出现动机下降？
   - 动机恢复能力：下降后能否恢复？

5. **正向投入**
   - 积极投入行为：high / medium / low
   - 投入频率：是否经常投入？
   - 投入质量：投入是否有成效？

### 4.5 掌握度与效率维度分析

**目标：**评估学生对知识点的掌握程度和学习效率

**核心指标：**

1. **知识点掌握度**
   - 掌握水平：0-1之间的数值
   - 掌握度变化速度（velocity）：每周变化多少？
   - 掌握度变化加速度（acceleration）：增速是否在放缓？

2. **掌握度趋势**
   - 趋势方向：rising_fast / rising_slow / stable / declining
   - 上升速度：快速上升 vs 缓慢上升

3. **错误减少速率**
   - 错误是否减少：yes / no
   - 减少速度：fast / moderate / slow
   - 错误模式演化：错误类型是否在变化？

4. **学习速度**
   - 理解时间趋势：缩短 / 稳定 / 延长
   - 学习效率提升：是否在提升？

5. **平台期检测**
   - 是否进入平台期：yes / no / at_risk
   - 平台期风险预测：风险等级（0-1）

### 4.6 学习方式维度分析

**目标：**识别学生的学习风格和偏好

**核心指标：**

1. **学习风格画像**
   - 视觉偏好：0-1之间的概率分布
   - 文本偏好：0-1之间的概率分布
   - 逻辑偏好：0-1之间的概率分布
   - 偏好稳定性：偏好是否稳定？
   - 偏好演化趋势：偏好是否在变化？

2. **学习方式偏好**
   - 探索型 vs 指导型
   - 主动型 vs 被动型

3. **示例驱动倾向**
   - 是否需要大量示例：high / medium / low
   - 示例依赖程度：是否依赖示例？

4. **交互方式偏好**
   - 偏好哪种类型的交互：视觉化 / 文本 / 实践 / 混合

### 4.7 情绪与心理状态维度分析

**目标：**评估学生的长期情绪和心理状态

**核心指标：**

1. **情绪基线**
   - 情绪稳定性：stable / volatile
   - 情绪波动频率：是否经常波动？

2. **压力趋势**
   - 学习压力水平：high / medium / low
   - 压力变化趋势：上升 / 稳定 / 下降

3. **抗挫力**
   - 面对困难的恢复能力：high / medium / low
   - 抗挫力变化趋势：是否在增强？

4. **信心趋势**
   - 信心水平变化：rising / stable / declining

5. **动机趋势**
   - 学习动机变化：rising / stable / declining

### 4.8 预测与干预维度分析

**目标：**预测学习风险和推荐干预策略

**核心指标：**

1. **学习轨迹预测**
   - 未来7天/30天的掌握度预测
   - 学习风险预测：可能在哪里卡住？

2. **平台期风险**
   - 识别可能的学习停滞：yes / no
   - 提前预警：风险等级（high / medium / low）

3. **干预时机**
   - 最佳干预窗口预测：什么时候介入？
   - 干预紧迫性评估：urgent / moderate / low

4. **干预效果预测**
   - 不同干预策略的预期效果评估
   - 策略优先级排序

### 4.9 知识结构维度分析

**目标：**评估学生的知识结构完整性

**核心指标：**

1. **前置知识缺失**
   - 识别前置知识缺失（structural_gap）
   - 缺失类型：prerequisite_missing / concept_fragile

2. **表面掌握检测**
   - 识别表面掌握、深层理解不足（fragile_mastery）
   - 掌握稳定性评估

3. **误区集中分析**
   - 识别误区集中的知识点（misconception_cluster）
   - 误区严重程度：high / medium / low

4. **知识关联强度**
   - 知识点之间的关联理解强度：strong / moderate / weak
   - 知识网络完整性评估

### 4.10 学习健康度综合评估

**目标：**综合评估学生的学习健康状态

**核心指标：**

1. **学习健康指数**
   - 综合理解速度、困惑频率、情绪稳定性、学习连续性
   - 健康指数评分：stable / at_risk / needs_intervention

2. **风险等级**
   - 🟢 稳定：学习状态良好，无需干预
   - 🟡 有风险：存在潜在问题，需要关注
   - 🔴 需要干预：存在明显问题，需要立即介入

3. **优势识别**
   - 哪些知识点是学生的强项？
   - 优势稳定性：优势是否稳定？
   - 优势可迁移性：能否迁移到其他知识点？

4. **薄弱点识别**
   - 哪些知识点薄弱？
   - 薄弱程度：严重 / 中等 / 轻微
   - 薄弱原因：知识缺失 / 理解偏差 / 应用困难

---

## 五、应用场景与用户价值

### 5.1 核心应用场景

#### 场景1：个性化学习路径推荐

**用户需求：**学生希望知道自己应该学什么、怎么学

**系统能力：**
- 识别学生的优势知识点和薄弱点
- 根据学习速度推荐合适的学习内容
- 根据学习风格匹配内容类型
- 预测学习困难，提前调整学习路径

**用户价值：**
- 学习更有针对性，效率更高
- 避免在不适合的内容上浪费时间
- 减少学习挫折感

#### 场景2：学习困难早期预警

**用户需求：**教师/家长希望提前知道学生可能在哪里遇到困难

**系统能力：**
- 预测平台期风险
- 识别学习轨迹异常
- 推荐最佳干预时机

**用户价值：**
- 提前介入，避免学习困难积累
- 在最佳时机提供帮助，效果更好
- 减少学生的学习挫折感

#### 场景3：学习效果全面评估

**用户需求：**学生/教师/家长希望全面了解学习情况

**系统能力：**
- 10个维度的全面分析
- 时间感知的动态评估
- 可解释的分析结果

**用户价值：**
- 不只是分数，而是全面的学习画像
- 了解学习趋势，不只是当前状态
- 知道改进方向，而不只是问题所在

#### 场景4：学习策略个性化调整

**用户需求：**学生希望找到最适合自己的学习方式

**系统能力：**
- 识别学习风格偏好
- 评估不同学习方式的效果
- 推荐最适合的学习策略

**用户价值：**
- 找到最适合自己的学习方式
- 提高学习效率
- 增强学习兴趣

### 5.2 用户角色与价值

#### 学生

**核心价值：**
- **了解自己**：全面的学习画像，知道自己的优势和薄弱点
- **个性化学习**：根据学习风格推荐最适合的内容和方式
- **预测风险**：提前知道可能的学习困难，做好准备
- **持续进步**：看到自己的学习轨迹和进步趋势

**使用场景：**
- 查看学习报告，了解自己的学习情况
- 获得个性化学习建议
- 了解自己的学习风格偏好
- 查看学习轨迹和进步趋势

#### 教师

**核心价值：**
- **全面了解学生**：不只是分数，而是全面的学习画像
- **早期预警**：提前知道学生可能在哪里遇到困难
- **精准干预**：知道什么时候介入、如何介入最有效
- **教学优化**：了解哪些内容学生容易理解、哪些困难

**使用场景：**
- 查看班级整体学习情况
- 查看个别学生的学习报告
- 获得干预建议
- 优化教学内容和方法

#### 家长

**核心价值：**
- **了解孩子**：全面了解孩子的学习情况
- **早期发现**：提前发现学习问题
- **科学指导**：知道如何帮助孩子学习
- **减少焦虑**：通过客观数据了解真实情况

**使用场景：**
- 查看孩子的学习报告
- 了解孩子的学习风格
- 获得家庭教育建议
- 跟踪孩子的学习进步

---

## 六、系统能力要求

### 6.1 数据采集能力

**要求：**
1. **全面采集**：采集所有学习交互和对话
2. **精确时间**：记录精确的时间戳和序列信息（支持时间线分析）
3. **上下文信息**：记录学习上下文（知识点、内容、会话等）
4. **非侵入性**：不影响正常学习体验
5. **时间感知**：所有数据必须包含时间维度，支持动态分析

**核心数据源：**

#### 6.1.1 AI Guide对话（核心数据源）

**数据内容：**
- 对话内容（完整对话历史）
- 提问方式（主动探索 vs 被动依赖）
- 错误频率（困惑、误解、概念混淆）
- 对话时长和轮次
- 知识点关联（从content.tags获取）

**时间要求：**
- 每条消息必须包含精确的时间戳（`created_at`）
- 对话必须包含开始和结束时间（`created_at`, `updated_at`）
- 需要计算对话持续时间、消息间隔时间
- 支持按时间序列分析对话模式

**数据表（已存在）：**
- `ai_conversations`：对话基本信息
  - 字段：`id`, `user_id`, `visitor_id`, `content_id`, `created_at`, `updated_at`
- `ai_messages`：对话消息详情
  - 字段：`id`, `conversation_id`, `role`, `content`, `created_at`

**后端接口设计：**
- 对话创建时：自动记录到`ai_conversations`表
- 消息发送时：自动记录到`ai_messages`表
- 对话结束时：更新`ai_conversations.updated_at`

#### 6.1.2 学习交互事件（核心数据源）

**可追踪的事件（无需HTML标记）：**

| 事件类型 | 追踪方式 | 采集内容 | 用途 | 时间要求 |
|---------|---------|---------|------|---------|
| **`content_enter`** | `DOMContentLoaded` / `document.readyState` | 进入内容、时间、来源 | 学习路径重建 | 精确时间戳、会话ID |
| **`content_exit`** | `beforeunload` / `visibilitychange` | 离开内容、停留时长 | 学习效率分析 | 进入时间、退出时间、持续时间 |
| **`page_visibility`** | `visibilitychange` | 页面可见性变化（切换标签页） | 专注度评估 | 每次可见性变化的时间戳 |
| **`scroll_depth`** | `scroll` | 滚动深度（百分比） | 内容阅读深度 | 每次滚动的时间戳、最大深度 |
| **`time_on_page`** | `setInterval` | 页面停留时间（定期记录） | 学习时长统计 | 定期时间戳、累计时间 |
| **`click_count`** | `click`（事件委托） | 总点击次数 | 互动活跃度 | 点击时间戳、点击频率 |
| **`input_interaction`** | `input` / `change` | 是否有输入行为、输入框数量 | 参与度分析 | 输入时间戳、输入次数 |
| **`focus_lost`** | `blur` | 失去焦点次数、时长 | 专注度分析 | 失去焦点时间、恢复焦点时间 |
| **`keyboard_activity`** | `keydown` | 键盘使用频率 | 互动方式识别 | 按键时间戳、按键频率 |
| **`window_resize`** | `resize` | 窗口大小变化 | 设备/环境信息 | 调整时间戳、窗口尺寸 |
| **`mouse_movement`** | `mousemove` | 鼠标移动频率（可选） | 活跃度检测 | 移动时间戳、移动频率 |

**时间要求：**
- 每个事件必须包含精确的时间戳（`occurred_at`）
- 每个事件必须包含序列索引（`sequence_index`）：事件在会话中的顺序
- 每个事件必须包含时间间隔（`time_since_last_seconds`）：距离上一个事件的时间
- 每个事件必须包含会话累计时间（`time_in_session_seconds`）：会话内累计时间
- 支持按时间序列分析事件模式（先困惑后理解 vs 先理解后困惑）

**数据表（需要新建）：**
```sql
CREATE TABLE learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 身份
  user_id uuid REFERENCES users(id),
  visitor_id text,
  session_id text NOT NULL,         -- 学习会话ID
  
  -- 上下文
  content_id uuid REFERENCES content(id),
  knowledge_point text,             -- 知识点（从content.tags获取）
  
  -- 行为
  event_type text NOT NULL,         -- 事件类型
  payload jsonb,                    -- 事件详情（见下方）
  
  -- 时间（时间感知增强）
  occurred_at timestamptz NOT NULL DEFAULT now(),
  client_ts timestamptz,           -- 客户端时间（防网络延迟）
  sequence_index int,              -- 事件在会话中的序列索引
  time_since_last_seconds int,     -- 距离上一个事件的时间（秒）
  time_in_session_seconds int,     -- 会话内累计时间（秒）
  
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

CREATE INDEX idx_learning_events_session 
  ON learning_events (session_id);
```

**事件关联：**
- `session_id`：学习会话ID（关联同一时间段的学习）
- `content_id`：关联的学习内容
- `knowledge_point`：关联的知识点（从`content.tags`获取）
- `user_id` / `visitor_id`：用户身份

**前端实现：交互事件追踪脚本**

```javascript
(function() {
  'use strict';
  
  const TRACKING_CONFIG = {
    contentId: '{{CONTENT_ID}}',
    sessionId: '{{SESSION_ID}}',
    userId: '{{USER_ID}}',
    visitorId: '{{VISITOR_ID}}',
    apiEndpoint: '/api/learning-events',
    knowledgePoints: {{KNOWLEDGE_POINTS}}  // 从content.tags获取
  };
  
  let contentEnterTime = null;
  let sequenceIndex = 0;
  let clickCount = 0;
  let inputCount = 0;
  let maxScrollDepth = 0;
  let timeTrackingInterval = null;
  let lastActivityTime = Date.now();
  let sessionStartTime = Date.now();
  let lastEventTime = Date.now();
  let eventBuffer = [];
  
  // 生成会话ID（如果未提供）
  if (!TRACKING_CONFIG.sessionId) {
    TRACKING_CONFIG.sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  // ========== 1. 内容进入 ==========
  function trackContentEnter() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        contentEnterTime = Date.now();
        sessionStartTime = Date.now();
        lastEventTime = Date.now();
        sendEvent('content_enter', {
          entry_source: 'direct',
          timestamp: contentEnterTime
        });
        startTracking();
      });
    } else {
      contentEnterTime = Date.now();
      sessionStartTime = Date.now();
      lastEventTime = Date.now();
      sendEvent('content_enter', {
        entry_source: 'direct',
        timestamp: contentEnterTime
      });
      startTracking();
    }
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
    
    // ========== 6. 页面可见性追踪 ==========
    document.addEventListener('visibilitychange', () => {
      sendEvent('page_visibility', {
        visible: !document.hidden,
        timestamp: Date.now()
      });
      if (!document.hidden) {
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
    
    // ========== 8. 键盘活动追踪 ==========
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
  }
  
  // ========== 发送事件函数 ==========
  function sendEvent(eventType, payload) {
    const now = Date.now();
    const timeSinceLast = Math.floor((now - lastEventTime) / 1000);
    const timeInSession = Math.floor((now - sessionStartTime) / 1000);
    
    sequenceIndex++;
    
    const event = {
      event_type: eventType,
      payload: payload,
      content_id: TRACKING_CONFIG.contentId,
      knowledge_point: TRACKING_CONFIG.knowledgePoints?.[0] || null,
      session_id: TRACKING_CONFIG.sessionId,
      user_id: TRACKING_CONFIG.userId || null,
      visitor_id: TRACKING_CONFIG.visitorId || null,
      occurred_at: new Date().toISOString(),
      client_ts: new Date().toISOString(),
      sequence_index: sequenceIndex,
      time_since_last_seconds: timeSinceLast,
      time_in_session_seconds: timeInSession
    };
    
    eventBuffer.push(event);
    lastEventTime = now;
    
    // 批量发送（每5个事件或每10秒）
    if (eventBuffer.length >= 5) {
      flushEvents();
    }
  }
  
  // ========== 批量发送事件 ==========
  function flushEvents() {
    if (eventBuffer.length === 0) return;
    
    const events = [...eventBuffer];
    eventBuffer = [];
    
    fetch(TRACKING_CONFIG.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events })
    }).catch(error => {
      console.error('Failed to send events:', error);
      // 失败时重新加入缓冲区
      eventBuffer.unshift(...events);
    });
  }
  
  // ========== 11. 内容离开 ==========
  window.addEventListener('beforeunload', () => {
    if (contentEnterTime) {
      const duration = Date.now() - contentEnterTime;
      
      sendEvent('content_exit', {
        duration_ms: duration,
        total_clicks: clickCount,
        total_inputs: inputCount,
        max_scroll_depth: maxScrollDepth,
        timestamp: Date.now()
      });
      
      if (timeTrackingInterval) {
        clearInterval(timeTrackingInterval);
      }
      
      flushEvents();
    }
  });
  
  // 定期刷新缓冲区
  setInterval(flushEvents, 10000); // 每10秒
  
  // 初始化
  trackContentEnter();
})();
```

**后端接口设计：**

```javascript
// POST /api/learning-events
// 批量接收学习交互事件
async function recordLearningEvents(req, res) {
  const { events } = req.body;
  
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'Events array required' });
  }
  
  try {
    // 验证并补充数据
    const validatedEvents = events.map(event => ({
      ...event,
      user_id: event.user_id || null,
      visitor_id: event.visitor_id || null,
      occurred_at: event.occurred_at || new Date().toISOString(),
      source: event.source || 'web'
    }));
    
    // 批量插入
    const { data, error } = await supabase
      .from('learning_events')
      .insert(validatedEvents);
    
    if (error) {
      console.error('Failed to insert learning events:', error);
      return res.status(500).json({ error: 'Failed to save events' });
    }
    
    res.json({ success: true, count: validatedEvents.length });
  } catch (error) {
    console.error('Error recording learning events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

#### 6.1.3 内容信息（核心数据源）

**可获取的内容信息：**

**从`content`表获取：**
- `tags`：知识点标签数组（**核心：用于知识点的关联**）
- `metadata_json`：内容元数据（JSONB格式）
  - `learningObjectives`：学习目标数组
  - `contentStructure`：内容结构
    - `totalStages`：总阶段数
    - `stages`：阶段详情
  - `visualElements`：视觉元素
    - `canvasType`：Canvas类型（Canvas / SVG / None）
    - `hasInteractions`：是否有交互
  - `interactions`：交互类型列表
  - `difficulty`：难度级别
  - `estimatedTime`：预估学习时间

**时间要求：**
- `created_at`：内容创建时间
- `updated_at`：内容更新时间
- `metadata_created_at`：元数据创建时间
- `metadata_updated_at`：元数据更新时间

**数据表（已存在）：**
- `content`：内容基本信息
  - 关键字段：
    - `tags`：知识点标签数组（**核心：用于知识点的关联**）
    - `metadata_json`：内容元数据（JSONB格式）
    - `created_at`：内容创建时间
    - `updated_at`：内容更新时间

**获取方式：**
```javascript
// 获取内容信息
async function getContentInfo(contentId) {
  const { data, error } = await supabase
    .from('content')
    .select('id, tags, metadata_json, created_at, updated_at')
    .eq('id', contentId)
    .single();
  
  if (error) {
    console.error('Failed to get content info:', error);
    return null;
  }
  
  return {
    contentId: data.id,
    knowledgePoints: data.tags || [],
    metadata: data.metadata_json || {},
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}
```

**内容来源：**
- 用户主动生成的内容
- 其他用户生成的内容
- 系统预设的内容

#### 6.1.4 数据关联与时间线要求

**数据关联：**
1. **用户身份关联**
   - `user_id`：登录用户ID
   - `visitor_id`：匿名用户ID
   - `session_id`：学习会话ID（关联同一时间段的学习）

2. **内容关联**
   - `content_id`：关联的学习内容
   - `knowledge_point`：关联的知识点（从`content.tags`获取）

3. **对话关联**
   - `conversation_id`：关联的AI Guide对话
   - `message_id`：关联的对话消息

**时间线要求（所有数据必须包含）：**

1. **原始时间戳**
   - `occurred_at` / `created_at`：事件发生时间（精确到秒）
   - `client_ts`：客户端时间（防网络延迟）

2. **序列信息**
   - `sequence_index`：事件/信号在会话中的序列索引
   - `time_since_last_seconds`：距离上一个事件的时间（秒）
   - `time_in_session_seconds`：会话内累计时间（秒）

3. **时间窗口分析**
   - 支持按时间窗口聚合（last_7_days / last_30_days / last_90_days）
   - 支持计算趋势、速度、加速度
   - 支持识别时间模式（先困惑后理解 vs 先理解后困惑）

**数据流示例：**

```
用户学习某个内容（content_id）
    ↓
1. 记录 content_enter 事件（包含时间戳、序列索引、知识点）
    ↓
2. 记录 scroll_depth 事件（包含时间戳、序列索引、滚动深度）
    ↓
3. 用户与AI Guide对话 → 记录对话消息（包含时间戳）
    ↓
4. 从对话中提取学习信号 → 记录 dialogue_signals（包含时间戳、序列索引、知识点）
    ↓
5. 记录 input_interaction 事件（包含时间戳、序列索引）
    ↓
6. 记录 content_exit 事件（包含时间戳、停留时长、总点击数）
    ↓
7. 计算时间感知信号（趋势、速度、稳定性）
    ↓
8. 更新知识点掌握度（包含velocity、acceleration）
    ↓
9. 生成轨迹级洞察与预测
```

### 6.2 信号提取能力

**要求：**
1. **多维度提取**：覆盖10个分析维度
2. **时间感知**：提取信号的时间属性（趋势、速度、稳定性）
3. **高准确度**：AI分析准确度要求高
4. **可解释性**：每个信号都有对应的证据
5. **多数据源融合**：从对话、交互事件、内容信息中提取信号

**提取数据源：**

1. **AI Guide对话**（核心）
   - 对话内容分析：提取认知、行为、情绪、元认知等信号
   - 提问方式分析：提取学习风格、求助依赖等信号
   - 错误模式分析：提取概念错误、逻辑错误等信号

2. **学习交互事件**（核心）
   - 行为模式分析：从点击、输入、滚动等行为提取参与度信号
   - 专注度分析：从页面可见性、焦点变化提取专注度信号
   - 学习效率分析：从停留时间、交互频率提取效率信号

3. **内容信息**（辅助）
   - 知识点关联：从`content.tags`获取知识点
   - 学习目标关联：从`metadata_json.learningObjectives`获取学习目标
   - 内容类型关联：从`metadata_json.visualElements`获取内容类型

**提取方法：**
1. **AI语义分析**：使用AI分析对话，提取学习信号
2. **规则基础**：部分信号可以通过规则提取（如交互频率）
3. **综合分析**：结合多数据源综合分析（对话+交互+内容）

**时间感知提取：**
- 每个信号都包含时间戳和序列索引
- 计算信号的时间属性（趋势、速度、稳定性）
- 支持时间窗口聚合和分析

**数据结构（需要新建）：**

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
  knowledge_point text,  -- 关联的知识点（从content.tags获取）
  session_id text,       -- 学习会话ID
  
  -- 信号核心
  signal_type text NOT NULL,     -- 信号类型（见下方10维度定义）
  signal_value text NOT NULL,    -- 信号值
  
  confidence float,              -- 0~1，AI判断置信度
  evidence text,                 -- 对应的原始文本片段
  
  -- 来源
  source text DEFAULT 'ai',      -- ai / rule / system
  extraction_method text,       -- 提取方法：ai_analysis / rule_based
  
  -- 时间（时间感知增强）
  occurred_at timestamptz NOT NULL DEFAULT now(),
  sequence_index int,            -- 信号在会话中的序列索引
  time_since_last_seconds int,   -- 距离上一个信号的时间（秒）
  time_in_session_seconds int,   -- 会话内累计时间（秒）
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

**后端实现：对话信号提取**

```javascript
// 从对话中提取学习信号
async function extractDialogueSignals(conversationId, userId, contentId) {
  // 1. 获取对话的所有消息
  const { data: messages } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  
  if (!messages || messages.length === 0) {
    return [];
  }
  
  // 2. 获取内容的知识点（从tags字段获取）
  const { data: content } = await supabase
    .from('content')
    .select('tags')
    .eq('id', contentId)
    .single();
  
  const knowledgePoints = content?.tags || [];
  
  // 3. 计算时间序列信息
  const sessionStartTime = new Date(messages[0].created_at);
  const signalsWithTime = [];
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const messageTime = new Date(message.created_at);
    const prevMessageTime = i > 0 ? new Date(messages[i - 1].created_at) : sessionStartTime;
    
    signalsWithTime.push({
      ...message,
      sequence_index: i + 1,
      time_since_last_seconds: Math.floor((messageTime - prevMessageTime) / 1000),
      time_in_session_seconds: Math.floor((messageTime - sessionStartTime) / 1000)
    });
  }
  
  // 4. 使用AI分析整个对话，提取所有学习信号
  const signals = await analyzeDialogueWithAI(
    signalsWithTime, 
    knowledgePoints, 
    conversationId, 
    userId, 
    contentId
  );
  
  // 5. 保存所有信号到数据库
  if (signals.length > 0) {
    await saveDialogueSignals(signals);
  }
  
  return signals;
}

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

【1. 认知维度】understanding_level, confusion_detected, concept_misuse, reasoning_gap, partial_understanding, knowledge_gap
【2. 行为维度】persistence, trial_and_error, help_dependency, exploration, task_abandonment
【3. 元认知维度】self_explanation, reflection, error_awareness, strategy_shift
【4. 情绪与动机维度】frustration, confidence, anxiety, motivation, positive_engagement
【5. 掌握度与效率维度】mastery_level, mastery_velocity, error_reduction_rate, learning_speed, plateau_detected
【6. 学习方式维度】learning_style_preference, learning_approach, example_dependency, interaction_preference
【7. 情绪与心理状态维度】emotional_baseline, stress_level, resilience, confidence_trend, motivation_trend
【8. 预测与干预维度】trajectory_prediction, plateau_risk, intervention_urgency, intervention_effectiveness
【9. 知识结构维度】structural_gap, fragile_mastery, misconception_cluster, knowledge_connection
【10. 学习健康度维度】learning_health_index, strength_identified, weakness_identified, risk_level

请输出JSON格式的学习信号数组，每个信号必须包含：
- signal_type: 信号类型
- signal_value: 信号值
- confidence: 置信度（0-1）
- evidence: 证据（对应的原始文本片段）
- knowledge_point: 关联的知识点

只输出JSON数组，不要其他文字。`;
  
  const response = await aiProviderFactory.createChatCompletion({
    provider: 'qenda',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 4000
  });
  
  try {
    let jsonText = response.content.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
    }
    
    const signals = JSON.parse(jsonText);
    
    if (!Array.isArray(signals)) {
      return [];
    }
    
    // 为每个信号添加元数据和时间信息
    const message = messages[messages.length - 1]; // 使用最后一条消息的时间
    return signals.map(signal => ({
      user_id: userId,
      conversation_id: conversationId,
      message_id: message.id,
      content_id: contentId,
      knowledge_point: signal.knowledge_point || knowledgePoints[0] || null,
      signal_type: signal.signal_type,
      signal_value: signal.signal_value,
      confidence: signal.confidence || 0.5,
      evidence: signal.evidence || '',
      source: 'ai',
      extraction_method: 'ai_analysis',
      occurred_at: message.created_at,
      sequence_index: message.sequence_index,
      time_since_last_seconds: message.time_since_last_seconds,
      time_in_session_seconds: message.time_in_session_seconds
    })).filter(signal => signal.signal_type && signal.signal_value);
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return [];
  }
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

**后端接口设计：**

```javascript
// POST /api/conversations/:conversationId/extract-signals
// 对话完成后触发信号提取
async function extractConversationSignals(req, res) {
  const { conversationId } = req.params;
  const userId = req.user?.id;
  
  try {
    // 获取对话信息
    const { data: conversation } = await supabase
      .from('ai_conversations')
      .select('id, content_id, user_id')
      .eq('id', conversationId)
      .single();
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // 提取信号
    const signals = await extractDialogueSignals(
      conversationId,
      conversation.user_id || userId,
      conversation.content_id
    );
    
    res.json({ success: true, signals, count: signals.length });
  } catch (error) {
    console.error('Error extracting signals:', error);
    res.status(500).json({ error: 'Failed to extract signals' });
  }
}
```

### 6.3 状态计算能力

**要求：**
1. **动态计算**：计算学习状态的velocity和acceleration
2. **趋势识别**：识别学习状态的长期趋势
3. **稳定性评估**：评估学习状态的稳定性
4. **历史追溯**：保留学习状态的历史轨迹

**计算维度：**
1. **掌握度**：current, velocity, acceleration, trend, stability
2. **学习速度**：理解时间趋势、效率提升
3. **错误减少**：错误减少速率、错误模式演化
4. **平台期**：平台期检测、平台期风险

**数据结构（需要新建）：**

```sql
CREATE TABLE knowledge_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  knowledge_point text NOT NULL,
  
  -- 掌握程度（静态）
  mastery_level text,               -- unknown / emerging / proficient / mastered
  confidence_level text,             -- low / medium / high
  
  -- 掌握度动态指标（时间感知增强）
  mastery_current float,            -- 当前掌握度（0-1）
  mastery_velocity float,           -- 掌握度变化速度（每周）
  mastery_acceleration float,       -- 掌握度变化加速度
  mastery_trend text,               -- 趋势：rising_fast/rising_slow/stable/declining
  mastery_stability float,          -- 稳定性（0-1）
  
  -- 学习数据
  first_attempt_success_rate float,
  avg_attempts_before_success float,
  avg_learning_time_minutes float,
  total_learning_time_minutes float,
  
  -- 学习速度（时间感知增强）
  learning_velocity_trend text,     -- 理解时间趋势：decreasing/stable/increasing
  plateau_detected boolean,         -- 是否进入平台期
  plateau_risk float,               -- 平台期风险（0-1）
  
  -- 错误分析
  common_errors text[],
  misconception_tags text[],
  misconception_decay_rate float,   -- 错误减少速率（每周百分比）
  
  -- 掌握度历史
  mastery_history jsonb,           -- [{"date": "2026-01-01", "value": 0.4}, ...]
  
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

CREATE INDEX idx_knowledge_mastery_trend 
  ON knowledge_mastery (user_id, mastery_trend) 
  WHERE mastery_trend IS NOT NULL;

CREATE TABLE student_learning_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  
  -- 学习风格（静态）
  learning_style text,              -- exploratory / guided / mixed
  modality_preference text,          -- visual / textual / mixed
  engagement_style text,             -- active / passive / balanced
  
  -- 学习风格动态指标（时间感知增强）
  learning_style_profile jsonb,     -- {visual_preference: {current, trend, stability}, ...}
  
  -- 行为特征
  ai_dependency_level text,         -- low / medium / high
  ai_dependency_trend text,         -- 趋势：decreasing/stable/increasing
  persistence_level text,            -- low / medium / high
  attention_span_minutes float,
  attention_span_trend text,
  
  -- 学习效率
  avg_learning_speed_ratio float,
  learning_efficiency_trend text,   -- 效率趋势：improving/stable/declining
  fast_learning_topics text[],
  slow_learning_topics text[],
  
  -- 情绪与心理状态（时间感知增强）
  emotional_baseline text,          -- 情绪基线：stable/volatile
  stress_trend text,                -- 压力趋势：rising/stable/decreasing
  resilience float,                 -- 抗挫力（0-1）
  confidence_trend text,            -- 信心趋势：rising/stable/declining
  motivation_trend text,            -- 动机趋势
  
  -- 更新时间
  last_updated_at timestamptz DEFAULT now(),
  updated_by text DEFAULT 'system',
  
  UNIQUE(user_id)
);

CREATE INDEX idx_student_learning_profile_user 
  ON student_learning_profile (user_id);
```

**后端实现：知识点掌握度更新算法**

```javascript
// 更新知识点掌握度
async function updateKnowledgeMastery(userId, knowledgePoint) {
  // 1. 从dialogue_signals获取学习信号
  const { data: signals } = await supabase
    .from('dialogue_signals')
    .select('*')
    .eq('user_id', userId)
    .eq('knowledge_point', knowledgePoint)
    .order('occurred_at', { ascending: true });
  
  // 2. 从learning_events获取交互数据
  const { data: events } = await supabase
    .from('learning_events')
    .select('*')
    .eq('user_id', userId)
    .eq('knowledge_point', knowledgePoint)
    .order('occurred_at', { ascending: true });
  
  // 3. 计算当前掌握度
  const highUnderstandingCount = signals.filter(
    s => s.signal_type === 'understanding_level' && s.signal_value === 'high'
  ).length;
  
  const confusionCount = signals.filter(
    s => s.signal_type === 'confusion_detected'
  ).length;
  
  const misconceptionCount = signals.filter(
    s => s.signal_type === 'concept_misuse' || s.signal_type === 'misconception_cluster'
  ).length;
  
  // 计算掌握度评分（0-1）
  const understandingScore = (highUnderstandingCount * 2 - confusionCount - misconceptionCount) / Math.max(signals.length, 1);
  const masteryCurrent = Math.max(0, Math.min(1, 0.5 + understandingScore * 0.5));
  
  // 4. 计算掌握度历史
  const masteryHistory = calculateMasteryHistory(signals, events);
  
  // 5. 计算velocity（基于最近4周的数据）
  const recentHistory = masteryHistory.slice(-4);
  const masteryVelocity = recentHistory.length >= 2
    ? (recentHistory[recentHistory.length - 1].value - recentHistory[0].value) / (recentHistory.length - 1)
    : 0;
  
  // 6. 计算acceleration（基于velocity的变化）
  const previousVelocity = recentHistory.length >= 3
    ? (recentHistory[recentHistory.length - 2].value - recentHistory[0].value) / (recentHistory.length - 2)
    : masteryVelocity;
  const masteryAcceleration = masteryVelocity - previousVelocity;
  
  // 7. 判断趋势
  let masteryTrend = 'stable';
  if (masteryVelocity > 0.1) masteryTrend = 'rising_fast';
  else if (masteryVelocity > 0.05) masteryTrend = 'rising_slow';
  else if (masteryVelocity < -0.05) masteryTrend = 'declining';
  
  // 8. 计算稳定性（基于历史波动）
  const values = masteryHistory.map(h => h.value);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  const volatility = Math.sqrt(variance) / avg;
  const masteryStability = Math.max(0, Math.min(1, 1 - volatility));
  
  // 9. 检测平台期
  const plateauDetected = masteryVelocity < 0.02 && masteryAcceleration < -0.01;
  const plateauRisk = Math.max(0, Math.min(1, (0.02 - masteryVelocity) / 0.02));
  
  // 10. 更新knowledge_mastery表
  await supabase
    .from('knowledge_mastery')
    .upsert({
      user_id: userId,
      knowledge_point: knowledgePoint,
      mastery_current: masteryCurrent,
      mastery_velocity: masteryVelocity,
      mastery_acceleration: masteryAcceleration,
      mastery_trend: masteryTrend,
      mastery_stability: masteryStability,
      mastery_history: masteryHistory,
      plateau_detected: plateauDetected,
      plateau_risk: plateauRisk,
      last_updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,knowledge_point'
    });
}

// 计算掌握度历史
function calculateMasteryHistory(signals, events) {
  // 按周分组计算
  const weeklyData = {};
  
  signals.forEach(signal => {
    const week = getWeekKey(new Date(signal.occurred_at));
    if (!weeklyData[week]) {
      weeklyData[week] = { signals: [], events: [] };
    }
    weeklyData[week].signals.push(signal);
  });
  
  events.forEach(event => {
    const week = getWeekKey(new Date(event.occurred_at));
    if (!weeklyData[week]) {
      weeklyData[week] = { signals: [], events: [] };
    }
    weeklyData[week].events.push(event);
  });
  
  // 计算每周掌握度
  const history = [];
  Object.keys(weeklyData).sort().forEach(week => {
    const data = weeklyData[week];
    const highUnderstanding = data.signals.filter(
      s => s.signal_type === 'understanding_level' && s.signal_value === 'high'
    ).length;
    const confusion = data.signals.filter(
      s => s.signal_type === 'confusion_detected'
    ).length;
    
    const score = (highUnderstanding * 2 - confusion) / Math.max(data.signals.length, 1);
    const value = Math.max(0, Math.min(1, 0.5 + score * 0.5));
    
    history.push({
      date: week,
      value: value
    });
  });
  
  return history;
}

function getWeekKey(date) {
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  return `${year}-W${week}`;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
```

**后端接口设计：**

```javascript
// POST /api/knowledge-mastery/update
// 更新知识点掌握度
async function updateMastery(req, res) {
  const { knowledgePoint } = req.body;
  const userId = req.user?.id;
  
  try {
    await updateKnowledgeMastery(userId, knowledgePoint);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating mastery:', error);
    res.status(500).json({ error: 'Failed to update mastery' });
  }
}
```

### 6.4 预测分析能力

**要求：**
1. **轨迹预测**：预测未来7天/30天的掌握度
2. **风险预测**：预测平台期风险、学习困难风险
3. **干预推荐**：推荐最佳干预时机和策略
4. **效果评估**：评估不同干预策略的预期效果

**预测方法：**
1. **基于历史模式**：基于历史学习模式预测
2. **基于相似学生**：基于相似学生的经验预测
3. **基于机器学习**：使用机器学习模型预测

**后端实现：学习轨迹预测**

```javascript
// 预测学习轨迹
async function predictLearningTrajectory(userId, knowledgePoint, days = 7) {
  // 1. 获取当前掌握度数据
  const { data: mastery } = await supabase
    .from('knowledge_mastery')
    .select('*')
    .eq('user_id', userId)
    .eq('knowledge_point', knowledgePoint)
    .single();
  
  if (!mastery || !mastery.mastery_history || mastery.mastery_history.length < 2) {
    return {
      predicted_mastery: null,
      confidence: 0,
      reason: 'Insufficient historical data'
    };
  }
  
  const history = mastery.mastery_history;
  const currentValue = mastery.mastery_current;
  const velocity = mastery.mastery_velocity || 0;
  const acceleration = mastery.mastery_acceleration || 0;
  
  // 2. 线性回归预测
  const weeksAhead = Math.ceil(days / 7);
  
  // 考虑velocity和acceleration
  let predictedValue = currentValue + (velocity * weeksAhead);
  if (acceleration !== 0) {
    // 如果acceleration不为0，使用二次模型
    predictedValue = currentValue + (velocity * weeksAhead) + (0.5 * acceleration * weeksAhead * weeksAhead);
  }
  
  // 限制在0-1范围内
  predictedValue = Math.max(0, Math.min(1, predictedValue));
  
  // 3. 计算置信度（基于历史数据的稳定性和数据量）
  const stability = mastery.mastery_stability || 0.5;
  const dataPoints = history.length;
  const confidence = Math.min(1, stability * 0.7 + (Math.min(dataPoints, 10) / 10) * 0.3);
  
  // 4. 预测风险
  const plateauRisk = mastery.plateau_risk || 0;
  const learningDifficultyRisk = calculateLearningDifficultyRisk(mastery, history);
  
  return {
    predicted_mastery: predictedValue,
    confidence: confidence,
    plateau_risk: plateauRisk,
    learning_difficulty_risk: learningDifficultyRisk,
    trajectory: {
      current: currentValue,
      predicted_7d: days <= 7 ? predictedValue : predictForDays(currentValue, velocity, acceleration, 7),
      predicted_30d: days >= 30 ? predictForDays(currentValue, velocity, acceleration, 30) : null
    }
  };
}

// 预测N天后的掌握度
function predictForDays(currentValue, velocity, acceleration, days) {
  const weeks = days / 7;
  let predicted = currentValue + (velocity * weeks);
  if (acceleration !== 0) {
    predicted = currentValue + (velocity * weeks) + (0.5 * acceleration * weeks * weeks);
  }
  return Math.max(0, Math.min(1, predicted));
}

// 计算学习困难风险
function calculateLearningDifficultyRisk(mastery, history) {
  // 基于困惑频率、错误频率等计算风险
  const recentValues = history.slice(-4).map(h => h.value);
  if (recentValues.length < 2) return 0;
  
  // 如果最近掌握度下降或停滞
  const recentTrend = recentValues[recentValues.length - 1] - recentValues[0];
  if (recentTrend < 0) return 0.7; // 高风险
  if (recentTrend < 0.05) return 0.4; // 中等风险
  
  // 结合平台期风险
  return Math.max(0, Math.min(1, (mastery.plateau_risk || 0) * 0.6 + (recentTrend < 0.1 ? 0.4 : 0)));
}

// 推荐干预策略
async function recommendIntervention(userId, knowledgePoint) {
  const { data: mastery } = await supabase
    .from('knowledge_mastery')
    .select('*')
    .eq('user_id', knowledgePoint)
    .eq('knowledge_point', knowledgePoint)
    .single();
  
  const { data: profile } = await supabase
    .from('student_learning_profile')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  const { data: signals } = await supabase
    .from('dialogue_signals')
    .select('*')
    .eq('user_id', userId)
    .eq('knowledge_point', knowledgePoint)
    .order('occurred_at', { ascending: false })
    .limit(20);
  
  const recommendations = [];
  
  // 1. 识别问题类型
  const structuralGap = signals.some(s => s.signal_type === 'structural_gap' && s.signal_value !== 'none');
  const fragileMastery = signals.some(s => s.signal_type === 'fragile_mastery' && s.signal_value === 'detected');
  const misconceptionCluster = signals.filter(s => s.signal_type === 'misconception_cluster').length > 2;
  
  // 2. 匹配干预策略
  if (structuralGap) {
    recommendations.push({
      type: 'step_back_and_rebuild',
      priority: 'high',
      reason: '前置知识缺失',
      estimated_effectiveness: 0.85,
      suggested_content: await findContentForPrerequisite(knowledgePoint)
    });
  }
  
  if (fragileMastery || misconceptionCluster) {
    const preferredModality = profile?.modality_preference || 'visual';
    recommendations.push({
      type: preferredModality === 'visual' ? 'visual_reinforcement' : 'text_reinforcement',
      priority: 'medium',
      reason: '表面掌握或误区集中',
      estimated_effectiveness: 0.70,
      suggested_content: await findReinforcementContent(knowledgePoint, preferredModality)
    });
  }
  
  // 3. 推荐时机
  const urgency = mastery?.plateau_risk > 0.5 ? 'high' : 'medium';
  const interventionWindow = urgency === 'high' ? 'next_3_sessions' : 'next_7_days';
  
  return {
    recommendations,
    urgency,
    intervention_window: interventionWindow,
    predicted_effectiveness: recommendations.reduce((sum, r) => sum + r.estimated_effectiveness, 0) / recommendations.length
  };
}
```

**后端接口设计：**

```javascript
// GET /api/learning-trajectory/predict
// 预测学习轨迹
async function predictTrajectory(req, res) {
  const { knowledgePoint, days = 7 } = req.query;
  const userId = req.user?.id;
  
  try {
    const prediction = await predictLearningTrajectory(userId, knowledgePoint, parseInt(days));
    res.json(prediction);
  } catch (error) {
    console.error('Error predicting trajectory:', error);
    res.status(500).json({ error: 'Failed to predict trajectory' });
  }
}

// GET /api/interventions/recommend
// 推荐干预策略
async function recommendInterventions(req, res) {
  const { knowledgePoint } = req.query;
  const userId = req.user?.id;
  
  try {
    const recommendations = await recommendIntervention(userId, knowledgePoint);
    res.json(recommendations);
  } catch (error) {
    console.error('Error recommending interventions:', error);
    res.status(500).json({ error: 'Failed to recommend interventions' });
  }
}
```

### 6.5 报告生成能力

**要求：**
1. **全面报告**：覆盖10个分析维度
2. **可视化展示**：直观的图表和可视化
3. **个性化建议**：基于分析结果生成个性化建议
4. **可解释性**：每个分析结果都有可解释的原因

**报告类型：**
1. **学习画像报告**：全面的学习画像
2. **知识点掌握地图**：每个知识点的掌握情况
3. **学习效率报告**：学习速度和效率分析
4. **个性化建议报告**：针对性的学习建议

**数据结构（需要新建）：**

```sql
CREATE TABLE learning_analysis_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  
  -- 报告类型
  report_type text NOT NULL,        -- weekly / monthly / semester / custom
  report_period_start timestamptz,
  report_period_end timestamptz,
  
  -- 报告内容（JSONB）
  report_data jsonb NOT NULL,       -- 完整的报告数据（见报告示例文档）
  
  -- 生成信息
  generated_at timestamptz DEFAULT now(),
  generated_by text DEFAULT 'system',
  
  UNIQUE(user_id, report_type, report_period_start)
);

CREATE INDEX idx_learning_analysis_reports_user 
  ON learning_analysis_reports (user_id, generated_at DESC);
```

**后端实现：报告生成**

```javascript
// 生成学习分析报告
async function generateLearningReport(userId, reportType, periodStart, periodEnd) {
  // 1. 获取学习画像
  const { data: profile } = await supabase
    .from('student_learning_profile')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  // 2. 获取知识点掌握度
  const { data: masteryData } = await supabase
    .from('knowledge_mastery')
    .select('*')
    .eq('user_id', userId)
    .gte('last_updated_at', periodStart)
    .lte('last_updated_at', periodEnd);
  
  // 3. 获取对话信号（用于10维度分析）
  const { data: signals } = await supabase
    .from('dialogue_signals')
    .select('*')
    .eq('user_id', userId)
    .gte('occurred_at', periodStart)
    .lte('occurred_at', periodEnd);
  
  // 4. 获取交互事件
  const { data: events } = await supabase
    .from('learning_events')
    .select('*')
    .eq('user_id', userId)
    .gte('occurred_at', periodStart)
    .lte('occurred_at', periodEnd);
  
  // 5. 按10个维度分析
  const analysis = {
    // 1. 认知维度
    cognitive: analyzeCognitiveDimension(signals),
    
    // 2. 行为维度
    behavioral: analyzeBehavioralDimension(signals, events),
    
    // 3. 元认知维度
    metacognitive: analyzeMetacognitiveDimension(signals),
    
    // 4. 情绪与动机维度
    affective: analyzeAffectiveDimension(signals),
    
    // 5. 掌握度与效率维度
    mastery_efficiency: analyzeMasteryEfficiencyDimension(masteryData, signals),
    
    // 6. 学习方式维度
    learning_style: analyzeLearningStyleDimension(signals, profile),
    
    // 7. 情绪与心理状态维度
    emotional_psychological: analyzeEmotionalPsychologicalDimension(signals, profile),
    
    // 8. 预测与干预维度
    prediction_intervention: analyzePredictionInterventionDimension(masteryData, signals),
    
    // 9. 知识结构维度
    knowledge_structure: analyzeKnowledgeStructureDimension(masteryData, signals),
    
    // 10. 学习健康度维度
    learning_health: analyzeLearningHealthDimension(masteryData, signals, profile)
  };
  
  // 6. 生成知识点掌握地图
  const knowledgeMap = generateKnowledgeMasteryMap(masteryData);
  
  // 7. 生成学习轨迹
  const trajectories = await generateLearningTrajectories(userId, masteryData);
  
  // 8. 生成个性化建议
  const recommendations = await generateRecommendations(userId, masteryData, profile, signals);
  
  // 9. 组装报告
  const report = {
    report_type: reportType,
    period: {
      start: periodStart,
      end: periodEnd
    },
    generated_at: new Date().toISOString(),
    student_profile: profile,
    analysis: analysis,
    knowledge_mastery_map: knowledgeMap,
    learning_trajectories: trajectories,
    recommendations: recommendations,
    summary: generateReportSummary(analysis, knowledgeMap, trajectories)
  };
  
  // 10. 保存报告
  await supabase
    .from('learning_analysis_reports')
    .upsert({
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

// 分析认知维度
function analyzeCognitiveDimension(signals) {
  const understandingLevels = signals.filter(s => s.signal_type === 'understanding_level');
  const confusionSignals = signals.filter(s => s.signal_type === 'confusion_detected');
  
  return {
    current_understanding_level: getMostFrequent(understandingLevels.map(s => s.signal_value)) || 'medium',
    confusion_frequency: confusionSignals.length / Math.max(signals.length, 1),
    confusion_types: groupBy(confusionSignals, 'signal_value'),
    trend: calculateTrend(understandingLevels)
  };
}

// 辅助函数：获取最频繁的值
function getMostFrequent(values) {
  const counts = {};
  values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
}

// 辅助函数：分组
function groupBy(array, key) {
  return array.reduce((acc, item) => {
    const value = item[key];
    if (!acc[value]) acc[value] = [];
    acc[value].push(item);
    return acc;
  }, {});
}

// 辅助函数：计算趋势
function calculateTrend(signals) {
  if (signals.length < 2) return 'stable';
  const first = signals[0].signal_value;
  const last = signals[signals.length - 1].signal_value;
  
  const levelMap = { low: 1, medium: 2, high: 3 };
  if (levelMap[last] > levelMap[first]) return 'rising';
  if (levelMap[last] < levelMap[first]) return 'declining';
  return 'stable';
}

// 生成报告摘要
function generateReportSummary(analysis, knowledgeMap, trajectories) {
  const healthIndex = analysis.learning_health?.health_index || 'stable';
  const strengths = knowledgeMap.filter(k => k.is_strength);
  const weaknesses = knowledgeMap.filter(k => k.is_weakness);
  const plateauRisk = trajectories.some(t => t.plateau_risk > 0.5);
  
  return {
    health_index: healthIndex,
    strengths_count: strengths.length,
    weaknesses_count: weaknesses.length,
    plateau_risk_detected: plateauRisk,
    key_findings: [
      `${strengths.length}个优势知识点`,
      `${weaknesses.length}个薄弱知识点`,
      plateauRisk ? '存在平台期风险' : '学习状态稳定'
    ]
  };
}
```

**后端接口设计：**

```javascript
// POST /api/learning-reports/generate
// 生成学习分析报告
async function generateReport(req, res) {
  const { reportType, periodStart, periodEnd } = req.body;
  const userId = req.user?.id;
  
  try {
    const report = await generateLearningReport(
      userId,
      reportType,
      new Date(periodStart),
      new Date(periodEnd)
    );
    
    res.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
}

// GET /api/learning-reports/:reportId
// 获取报告
async function getReport(req, res) {
  const { reportId } = req.params;
  const userId = req.user?.id;
  
  try {
    const { data: report } = await supabase
      .from('learning_analysis_reports')
      .select('*')
      .eq('id', reportId)
      .eq('user_id', userId)
      .single();
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json(report.report_data);
  } catch (error) {
    console.error('Error getting report:', error);
    res.status(500).json({ error: 'Failed to get report' });
  }
}
```

### 6.6 实时分析能力

**要求：**
1. **实时计算**：对话完成后实时提取信号
2. **实时更新**：实时更新学习状态
3. **实时预警**：实时识别学习风险
4. **实时推荐**：实时推荐学习内容

**性能要求：**
1. **低延迟**：信号提取延迟 < 5秒
2. **高并发**：支持高并发用户同时使用
3. **可扩展**：系统可扩展以支持更多用户

---

## 七、成功指标

### 7.1 产品成功指标

1. **用户采用率**
   - 使用学习分析功能的用户比例
   - 目标：> 60%

2. **用户满意度**
   - 用户对学习分析功能的满意度评分
   - 目标：> 4.0/5.0

3. **报告查看率**
   - 用户查看学习报告的频率
   - 目标：每周 > 1次

4. **建议采纳率**
   - 用户采纳系统建议的比例
   - 目标：> 40%

### 7.2 教育效果指标

1. **学习效率提升**
   - 使用系统后学习效率的提升幅度
   - 目标：> 20%

2. **学习困难减少**
   - 早期预警后，学习困难的减少幅度
   - 目标：> 30%

3. **学习满意度提升**
   - 学生对自己学习情况的满意度提升
   - 目标：> 15%

4. **知识掌握度提升**
   - 薄弱知识点掌握度的提升幅度
   - 目标：> 25%

### 7.3 系统质量指标

1. **信号提取准确度**
   - AI提取信号的准确度
   - 目标：> 85%

2. **预测准确度**
   - 学习轨迹预测的准确度
   - 目标：> 70%

3. **系统可用性**
   - 系统可用时间比例
   - 目标：> 99.5%

4. **响应时间**
   - 报告生成的响应时间
   - 目标：< 10秒

---

### 8.1 数据采集技术架构

#### 8.1.1 AI Guide对话采集

**数据表：**
- `ai_conversations`：对话基本信息（user_id, content_id, created_at, updated_at）
- `ai_messages`：对话消息详情（conversation_id, role, content, created_at）

**采集时机：**
- 对话创建时：记录`ai_conversations`
- 每条消息发送时：记录`ai_messages`
- 对话结束时：更新`ai_conversations.updated_at`

**时间字段：**
- `created_at`：对话/消息创建时间（精确到秒）
- `updated_at`：对话更新时间
- 计算字段：`duration = updated_at - created_at`（对话持续时间）

#### 8.1.2 学习交互事件采集

**数据表：**
- `learning_events`：学习交互事件（需要创建）

**采集方式：**
- 前端JavaScript脚本：使用事件委托监听浏览器事件
- 无需HTML标记：通过标准浏览器API追踪
- 实时发送：事件发生后立即发送到后端

**关键字段：**
- `event_type`：事件类型（content_enter, content_exit, scroll_depth等）
- `occurred_at`：事件发生时间（精确到秒）
- `sequence_index`：事件在会话中的序列索引（前端计算）
- `time_since_last_seconds`：距离上一个事件的时间（前端计算）
- `time_in_session_seconds`：会话内累计时间（前端计算）
- `session_id`：学习会话ID（前端生成）
- `content_id`：关联的学习内容
- `knowledge_point`：关联的知识点（从`content.tags`获取）
- `payload`：事件详情（JSONB格式）

**前端实现要点：**
- 使用事件委托，避免性能问题
- 防抖处理，减少事件频率
- 批量发送，优化网络请求
- 离线缓存，网络恢复后发送

#### 8.1.3 内容信息获取

**数据表：**
- `content`：内容基本信息（已存在）

**关键字段：**
- `tags`：知识点标签数组（**核心：用于知识点的关联**）
- `metadata_json`：内容元数据（JSONB格式）
  - `learningObjectives`：学习目标
  - `contentStructure`：内容结构
  - `visualElements`：视觉元素
  - `interactions`：交互类型

**获取时机：**
- 学习内容加载时：获取`content.tags`和`metadata_json`
- 事件关联时：将知识点关联到交互事件
- 分析时：结合内容信息进行综合分析

### 8.2 信号提取技术架构

#### 8.2.1 对话信号提取

**数据表：**
- `dialogue_signals`：对话信号（需要创建）

**提取流程：**
1. 对话完成后触发信号提取
2. 获取对话的所有消息（`ai_messages`）
3. 获取内容的知识点（`content.tags`）
4. 使用AI分析整个对话，提取学习信号
5. 保存信号到`dialogue_signals`表

**AI分析Prompt：**
- 覆盖10个分析维度的完整信号定义
- 要求输出JSON格式的信号数组
- 每个信号包含：signal_type, signal_value, confidence, evidence, knowledge_point

**时间字段：**
- `occurred_at`：信号发生时间（对应消息时间）
- `sequence_index`：信号在会话中的序列索引
- `time_since_last_seconds`：距离上一个信号的时间
- `time_in_session_seconds`：会话内累计时间

#### 8.2.2 交互信号提取

**提取方式：**
- 规则基础：从交互事件中直接提取（如点击频率、停留时间）
- 模式识别：识别交互模式（如快速滚动可能表示理解困难）

**信号类型：**
- `engagement_level`：参与度（基于点击、输入频率）
- `focus_level`：专注度（基于页面可见性、焦点变化）
- `exploration_depth`：探索深度（基于滚动深度、交互次数）

#### 8.2.3 时间感知信号聚合

**数据表：**
- `signal_time_series`：时间感知信号聚合表（需要创建）

**聚合流程：**
1. 按时间窗口聚合原始信号（last_7_days / last_30_days）
2. 计算信号的时间属性：
   - `current_value`：当前值
   - `trend`：趋势（线性回归）
   - `velocity`：变化速度
   - `volatility`：波动性
   - `stability`：稳定性
3. 保存到`signal_time_series`表

**计算算法：**
- 趋势计算：线性回归（最小二乘法）
- 速度计算：`(当前值 - 上次值) / 时间间隔`
- 波动性计算：`标准差 / 平均值`
- 稳定性计算：`1 - 波动性`

### 8.3 状态计算技术架构

#### 8.3.1 知识点掌握度计算

**数据表：**
- `knowledge_mastery`：知识点掌握度（需要创建）

**计算流程：**
1. 从`dialogue_signals`和`learning_events`获取历史数据
2. 计算当前掌握度（基于理解水平、困惑频率、错误频率）
3. 计算掌握度velocity（基于历史掌握度序列）
4. 计算掌握度acceleration（基于velocity序列）
5. 判断趋势（rising_fast / rising_slow / stable / declining）
6. 计算稳定性（基于历史波动）
7. 更新`knowledge_mastery`表

**关键字段：**
- `mastery_current`：当前掌握度（0-1）
- `mastery_velocity`：掌握度变化速度（每周）
- `mastery_acceleration`：掌握度变化加速度
- `mastery_trend`：趋势
- `mastery_stability`：稳定性（0-1）
- `mastery_history`：掌握度历史（JSONB格式）

#### 8.3.2 学习画像计算

**数据表：**
- `student_learning_profile`：学习画像（需要创建）

**计算流程：**
1. 从`dialogue_signals`分析学习风格（主动/被动、探索/指导）
2. 从`learning_events`分析交互偏好（视觉/文本/实践）
3. 从`knowledge_mastery`分析学习速度
4. 计算学习风格画像（概率分布）
5. 计算情绪与心理状态趋势
6. 更新`student_learning_profile`表

**关键字段：**
- `learning_style_profile`：学习风格画像（JSONB格式）
- `ai_dependency_trend`：AI依赖趋势
- `emotional_baseline`：情绪基线
- `stress_trend`：压力趋势
- `resilience`：抗挫力（0-1）

### 8.4 预测分析技术架构

#### 8.4.1 学习轨迹预测

**预测方法：**
1. **基于历史模式**：
   - 使用历史掌握度序列
   - 线性/指数回归预测未来值
   - 考虑velocity和acceleration

2. **基于相似学生**：
   - 找到相似学习模式的学生
   - 基于相似学生的历史轨迹预测

3. **基于机器学习**（未来）：
   - 训练时间序列预测模型
   - 考虑多维度特征

**预测输出：**
- `predicted_mastery_7d`：7天后预测掌握度
- `predicted_mastery_30d`：30天后预测掌握度
- `confidence`：预测置信度（0-1）

#### 8.4.2 风险预测

**风险识别：**
1. **平台期风险**：
   - 掌握度velocity < 阈值
   - 掌握度acceleration < 0
   - 困惑频率上升
   - 历史模式匹配（之前出现过平台期）

2. **学习困难风险**：
   - 错误频率上升
   - 理解时间延长
   - 求助依赖增加

**风险等级：**
- `high`：需要立即介入
- `medium`：需要关注
- `low`：正常范围

#### 8.4.3 干预推荐

**推荐算法：**
1. 识别问题类型（知识缺失 / 理解偏差 / 应用困难）
2. 匹配干预策略（回退前置概念 / 视觉强化 / 更多练习）
3. 评估预期效果（基于历史干预效果）
4. 推荐最佳时机（基于学习状态和风险等级）

### 8.5 报告生成技术架构

#### 8.5.1 报告数据聚合

**数据源整合：**
1. 从`dialogue_signals`聚合对话分析结果
2. 从`learning_events`聚合交互分析结果
3. 从`knowledge_mastery`获取掌握度数据
4. 从`student_learning_profile`获取学习画像
5. 从`signal_time_series`获取时间感知信号
6. 从`content`获取内容信息

**聚合时间窗口：**
- 按报告类型选择时间窗口（weekly / monthly / semester）
- 支持自定义时间范围

#### 8.5.2 报告生成流程

**生成步骤：**
1. 获取报告时间范围内的所有数据
2. 按10个维度聚合分析结果
3. 计算时间感知指标（趋势、速度、稳定性）
4. 生成预测和风险分析
5. 生成个性化建议
6. 组装报告JSON
7. 保存到`learning_analysis_reports`表

**报告结构：**
- 报告元信息（类型、时间范围）
- 学习画像（10个维度）
- 知识点分析（优势、薄弱点）
- 学习轨迹（历史、预测）
- 风险分析（平台期、学习困难）
- 个性化建议（学习路径、干预策略）

### 8.6 技术实现要点

#### 8.6.1 性能优化

1. **数据采集优化**
   - 前端事件防抖和批量发送
   - 后端异步处理，避免阻塞
   - 使用消息队列处理高并发

2. **信号提取优化**
   - AI分析异步处理
   - 批量处理多个对话
   - 缓存常用分析结果

3. **状态计算优化**
   - 增量计算，只计算变化部分
   - 定期批量更新，避免实时计算
   - 使用数据库索引优化查询

4. **报告生成优化**
   - 预生成常用报告
   - 缓存报告结果
   - 异步生成，避免阻塞

#### 8.6.2 数据一致性

1. **时间同步**
   - 使用服务器时间作为标准时间
   - 客户端时间仅用于防网络延迟
   - 统一时区处理

2. **序列索引**
   - 前端计算序列索引
   - 后端验证序列索引的连续性
   - 处理并发事件的序列冲突

3. **数据关联**
   - 使用外键约束保证数据完整性
   - 使用事务保证数据一致性
   - 处理数据缺失情况

#### 8.6.3 可扩展性

1. **水平扩展**
   - 无状态服务设计
   - 使用消息队列解耦
   - 支持多实例部署

2. **数据分片**
   - 按用户ID分片
   - 按时间范围分片
   - 支持数据归档

3. **功能扩展**
   - 插件化信号提取器
   - 可配置的分析算法
   - 支持自定义报告模板

---

## 八、总结

### 8.1 核心价值

eduNest 时间感知型学习分析体系通过：

1. **全面采集**：采集所有学习交互和对话
2. **多维度分析**：10个维度的全面分析
3. **时间感知**：识别学习轨迹和趋势
4. **预测干预**：提前识别风险，推荐最佳干预时机

实现真正的**个性化学习分析和指导**。

### 8.2 竞争优势

1. **时间感知能力**：不只是当前状态，而是学习轨迹
2. **全面分析维度**：10个维度的深度分析
3. **预测性分析**：能够预测未来风险和最佳干预时机
4. **可解释性**：每个分析结果都有可解释的原因

### 8.3 未来展望

随着数据积累和模型优化，系统将：

1. **越来越智能**：预测准确度不断提升
2. **越来越个性化**：学习建议越来越精准
3. **越来越有价值**：为教育提供更多洞察

---

**文档版本：** v1.0  
**最后更新：** 2026-01-20  
**文档状态：** 需求阶段
