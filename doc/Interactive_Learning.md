# 学生长期学习分析与个性化建议系统

## 📋 目录

1. [系统目标](#系统目标)
2. [数据采集方案](#数据采集方案)
3. [分析维度设计](#分析维度设计)
4. [数据表结构](#数据表结构)
5. [分析算法](#分析算法)
6. [学习报告生成](#学习报告生成)
7. [实现路线图](#实现路线图)

---

## 一、系统目标

### 1.1 核心目标

通过采集学生在平台上的**交互行为**和**AI对话**，实现：

- ✅ **优劣势识别**：哪些知识点掌握好，哪些薄弱
- ✅ **学习速度分析**：不同知识点的学习效率对比
- ✅ **学习方式适配**：探索型 vs 指导型，视觉型 vs 文字型
- ✅ **个性化建议**：针对性的学习路径和策略推荐

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

### 2.2 采集内容

#### 2.2.1 学习路径事件

| 事件类型 | 采集内容 | 用途 |
|---------|---------|------|
| `content_enter` | 进入内容、来源、时间 | 学习路径重建 |
| `content_exit` | 离开内容、停留时长 | 学习效率分析 |
| `stage_enter` | 进入阶段、阶段ID | 多阶段学习追踪 |
| `stage_exit` | 离开阶段、完成情况 | 阶段掌握度 |
| `content_complete` | 完成内容、完成方式 | 学习成果统计 |

#### 2.2.2 交互行为事件

| 事件类型 | 采集内容 | 用途 |
|---------|---------|------|
| `interaction_start` | 开始交互、交互类型 | 学习方式识别 |
| `interaction_change` | 参数变化、变化频率 | 探索行为分析 |
| `interaction_submit` | 提交尝试、尝试次数 | 学习毅力评估 |
| `interaction_success` | 成功、成功时间 | 学习效率计算 |
| `interaction_failure` | 失败、错误类型 | 薄弱点识别 |
| `interaction_reset` | 重置、重置次数 | 学习策略分析 |

#### 2.2.3 AI对话事件

| 事件类型 | 采集内容 | 用途 |
|---------|---------|------|
| `ai_message` | 对话内容、角色、意图 | 学习需求分析 |
| `ai_interaction_start` | 对话开始、触发原因 | AI依赖度评估 |
| `ai_interaction_end` | 对话结束、对话时长 | 学习辅助效果 |

#### 2.2.4 行为信号事件

| 事件类型 | 采集内容 | 用途 |
|---------|---------|------|
| `idle_detected` | 长时间无操作、时长 | 注意力分析 |
| `rapid_retry` | 快速多次尝试、间隔 | 学习策略分析 |
| `focus_lost` | 切换标签页、频率 | 专注度评估 |
| `return_after_exit` | 离开后回访、间隔 | 学习动机分析 |

---

## 三、分析维度设计

### 3.1 优劣势分析

#### 3.1.1 优势识别

**指标**：
- 首次尝试成功率 > 70%
- 平均尝试次数 < 2 次
- 学习时间 < 预期时间
- 无或少量 AI 求助
- 能主动解释概念

**算法**：
```sql
-- 识别优势知识点
WITH knowledge_performance AS (
  SELECT 
    knowledge_point,
    COUNT(DISTINCT content_id) as contents_count,
    AVG(CASE WHEN event_type = 'interaction_success' THEN 1 ELSE 0 END) as success_rate,
    AVG(attempts_before_success) as avg_attempts,
    AVG(time_to_success_seconds) as avg_time
  FROM learning_events
  WHERE user_id = :user_id
    AND knowledge_point IS NOT NULL
  GROUP BY knowledge_point
)
SELECT 
  knowledge_point,
  CASE 
    WHEN success_rate > 0.7 AND avg_attempts < 2 AND avg_time < expected_time * 0.8 
    THEN 'strength'
    ELSE NULL
  END as strength_level
FROM knowledge_performance;
```

#### 3.1.2 劣势识别

**指标**：
- 首次尝试成功率 < 30%
- 平均尝试次数 > 5 次
- 学习时间 > 预期时间 * 1.5
- 频繁 AI 求助（> 3 次/知识点）
- 常见错误模式重复出现

**算法**：
```sql
-- 识别劣势知识点
WITH knowledge_weaknesses AS (
  SELECT 
    knowledge_point,
    COUNT(DISTINCT CASE WHEN event_type = 'interaction_failure' THEN content_id END) as failure_count,
    AVG(attempts_before_success) as avg_attempts,
    COUNT(DISTINCT CASE WHEN event_type = 'ai_message' AND payload->>'intent' = 'hint_request' THEN id END) as ai_help_count
  FROM learning_events
  WHERE user_id = :user_id
    AND knowledge_point IS NOT NULL
  GROUP BY knowledge_point
)
SELECT 
  knowledge_point,
  CASE 
    WHEN avg_attempts > 5 OR ai_help_count > 3 OR failure_count > 3
    THEN 'weakness'
    ELSE NULL
  END as weakness_level,
  failure_count,
  avg_attempts,
  ai_help_count
FROM knowledge_weaknesses;
```

### 3.2 学习速度分析

#### 3.2.1 学习速度指标

**定义**：
- **快速掌握**：学习时间 < 预期时间 * 0.7
- **正常掌握**：学习时间在预期时间 * 0.7 ~ 1.3 之间
- **缓慢掌握**：学习时间 > 预期时间 * 1.3

**算法**：
```sql
-- 计算每个知识点的学习速度
WITH knowledge_speed AS (
  SELECT 
    knowledge_point,
    AVG(
      EXTRACT(EPOCH FROM (exit_time - enter_time)) / 60
    ) as actual_minutes,
    AVG(expected_minutes) as expected_minutes
  FROM (
    SELECT 
      le1.knowledge_point,
      le1.occurred_at as enter_time,
      MIN(le2.occurred_at) as exit_time,
      c.metadata->>'estimated_minutes'::int as expected_minutes
    FROM learning_events le1
    JOIN learning_events le2 ON le1.content_id = le2.content_id
      AND le2.event_type = 'content_exit'
      AND le2.occurred_at > le1.occurred_at
    JOIN content c ON le1.content_id = c.id
    WHERE le1.user_id = :user_id
      AND le1.event_type = 'content_enter'
    GROUP BY le1.knowledge_point, le1.occurred_at, c.metadata
  ) t
  GROUP BY knowledge_point
)
SELECT 
  knowledge_point,
  actual_minutes,
  expected_minutes,
  CASE 
    WHEN actual_minutes < expected_minutes * 0.7 THEN 'fast'
    WHEN actual_minutes > expected_minutes * 1.3 THEN 'slow'
    ELSE 'normal'
  END as speed_category,
  (actual_minutes / expected_minutes) as speed_ratio
FROM knowledge_speed;
```

#### 3.2.2 学习速度模式识别

**快速掌握的知识点特征**：
- 交互成功率高
- 探索行为少（直接找到答案）
- AI 求助少

**缓慢掌握的知识点特征**：
- 多次尝试
- 频繁探索
- 大量 AI 对话

### 3.3 学习方式适配

#### 3.3.1 学习风格识别

**维度**：

1. **探索型 vs 指导型**
   - 探索型：大量 `interaction_change`，少 AI 求助
   - 指导型：少交互，多 AI 对话

2. **视觉型 vs 文字型**
   - 视觉型：动画/图表交互成功率高
   - 文字型：文本内容学习效率高

3. **主动型 vs 被动型**
   - 主动型：主动提问、主动探索
   - 被动型：等待提示、跟随引导

**算法**：
```sql
-- 识别学习风格
WITH learning_style_metrics AS (
  SELECT 
    user_id,
    -- 探索行为比例
    COUNT(DISTINCT CASE WHEN event_type = 'interaction_change' THEN id END)::float / 
    NULLIF(COUNT(DISTINCT CASE WHEN event_type IN ('interaction_start', 'interaction_change') THEN id END), 0) as exploration_ratio,
    
    -- AI 依赖度
    COUNT(DISTINCT CASE WHEN event_type = 'ai_message' AND payload->>'role' = 'student' THEN id END)::float /
    NULLIF(COUNT(DISTINCT content_id), 0) as ai_dependency_ratio,
    
    -- 视觉内容成功率
    AVG(CASE 
      WHEN payload->>'ui'->>'component' IN ('CanvasArea', 'ThreeJS', 'Animation') 
        AND event_type = 'interaction_success' 
      THEN 1.0 
      ELSE 0.0 
    END) as visual_success_rate,
    
    -- 主动提问比例
    COUNT(DISTINCT CASE 
      WHEN event_type = 'ai_message' 
        AND payload->>'role' = 'student' 
        AND payload->>'intent' = 'question' 
      THEN id 
    END)::float /
    NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'ai_message' THEN id END), 0) as active_question_ratio
  FROM learning_events
  WHERE user_id = :user_id
  GROUP BY user_id
)
SELECT 
  user_id,
  CASE 
    WHEN exploration_ratio > 0.6 THEN 'exploratory'
    WHEN ai_dependency_ratio > 0.5 THEN 'guided'
    ELSE 'mixed'
  END as learning_style,
  
  CASE 
    WHEN visual_success_rate > 0.7 THEN 'visual'
    WHEN visual_success_rate < 0.3 THEN 'textual'
    ELSE 'mixed'
  END as modality_preference,
  
  CASE 
    WHEN active_question_ratio > 0.4 THEN 'active'
    WHEN active_question_ratio < 0.2 THEN 'passive'
    ELSE 'balanced'
  END as engagement_style
FROM learning_style_metrics;
```

#### 3.3.2 学习方式推荐

基于学习风格，推荐：

- **探索型**：提供更多交互式内容、开放性问题
- **指导型**：提供结构化学习路径、详细讲解
- **视觉型**：优先推荐图表、动画、3D 内容
- **文字型**：优先推荐文本、公式推导内容

---

## 四、数据表结构

### 4.1 learning_events 表（核心事件表）

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
  
  -- 时间
  occurred_at timestamptz NOT NULL DEFAULT now(),
  client_ts timestamptz,           -- 客户端时间（防网络延迟）
  
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

### 4.2 student_learning_profile 表（学习画像）

```sql
CREATE TABLE student_learning_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  
  -- 学习风格
  learning_style text,              -- exploratory / guided / mixed
  modality_preference text,          -- visual / textual / mixed
  engagement_style text,             -- active / passive / balanced
  
  -- 行为特征
  ai_dependency_level text,         -- low / medium / high
  persistence_level text,            -- low / medium / high
  attention_span_minutes float,      -- 平均专注时长
  
  -- 学习效率
  avg_learning_speed_ratio float,   -- 平均学习速度（实际/预期）
  fast_learning_topics text[],      -- 快速掌握的知识点
  slow_learning_topics text[],      -- 缓慢掌握的知识点
  
  -- 更新时间
  last_updated_at timestamptz DEFAULT now(),
  updated_by text DEFAULT 'system',
  
  UNIQUE(user_id)
);

CREATE INDEX idx_student_learning_profile_user 
  ON student_learning_profile (user_id);
```

### 4.3 knowledge_mastery 表（知识点掌握度）

```sql
CREATE TABLE knowledge_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  knowledge_point text NOT NULL,
  
  -- 掌握程度
  mastery_level text,               -- unknown / emerging / proficient / mastered
  confidence_level text,             -- low / medium / high
  
  -- 学习数据
  first_attempt_success_rate float, -- 首次尝试成功率
  avg_attempts_before_success float,-- 平均尝试次数
  avg_learning_time_minutes float, -- 平均学习时间
  total_learning_time_minutes float,-- 总学习时间
  
  -- 错误分析
  common_errors text[],              -- 常见错误类型
  misconception_tags text[],        -- 误区标签
  
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

## 五、分析算法

### 5.1 学习画像更新算法

```javascript
async function updateLearningProfile(userId) {
  // 1. 计算学习风格
  const learningStyle = await calculateLearningStyle(userId);
  
  // 2. 计算学习效率
  const learningEfficiency = await calculateLearningEfficiency(userId);
  
  // 3. 识别快速/缓慢掌握的知识点
  const speedAnalysis = await analyzeLearningSpeed(userId);
  
  // 4. 更新 profile
  await db.from('student_learning_profile').upsert({
    user_id: userId,
    learning_style: learningStyle.style,
    modality_preference: learningStyle.modality,
    engagement_style: learningStyle.engagement,
    ai_dependency_level: learningStyle.aiDependency,
    persistence_level: learningStyle.persistence,
    attention_span_minutes: learningStyle.attentionSpan,
    avg_learning_speed_ratio: learningEfficiency.avgSpeedRatio,
    fast_learning_topics: speedAnalysis.fastTopics,
    slow_learning_topics: speedAnalysis.slowTopics,
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

### Phase 1: 数据采集（2周）

- [ ] 实现 `learning_events` 表
- [ ] 前端事件采集 SDK
- [ ] 后端事件接收 API
- [ ] 基础事件类型实现

### Phase 2: 基础分析（3周）

- [ ] 实现 `knowledge_mastery` 表
- [ ] 知识点掌握度计算算法
- [ ] 优势/劣势识别算法
- [ ] 学习速度分析算法

### Phase 3: 学习画像（2周）

- [ ] 实现 `student_learning_profile` 表
- [ ] 学习风格识别算法
- [ ] 学习方式适配算法
- [ ] 画像更新机制

### Phase 4: 报告生成（2周）

- [ ] 实现 `learning_analysis_reports` 表
- [ ] 报告生成算法
- [ ] 个性化建议生成
- [ ] 报告展示 UI

### Phase 5: 优化与扩展（持续）

- [ ] 分析算法优化
- [ ] 报告内容细化
- [ ] 实时分析能力
- [ ] 多维度对比分析

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
