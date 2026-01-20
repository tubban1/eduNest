# 交互式学习分析增强方案（可选）

## 📋 说明

本文档描述的是**可选的增强功能**，需要在AI生成HTML内容时添加标记，或者优化Metadata提取。

**如果不实施这些增强功能**，系统仍然可以工作，但只能追踪基础事件（参见 `Interactive_Learning.md` 中的"基础交互分析"部分）。

---

## 一、知识点标记规范（AI生成内容时使用）

**AI在生成HTML时，需要标记知识点，以便追踪脚本能够关联交互和知识点：**

### 1.1 方式1：元素级别标记（推荐）

```html
<!-- 函数参数滑块，标记知识点 -->
<input 
  type="range" 
  id="param-a" 
  name="parameter_a"
  data-knowledge-point="quadratic_function"
  data-interaction-knowledge-point="function_parameter_effect"
  min="-5" 
  max="5" 
  value="1"
/>

<!-- 函数图像Canvas，标记知识点 -->
<canvas 
  id="function-graph"
  data-knowledge-point="quadratic_function"
  data-interaction-area="function_visualization"
></canvas>

<!-- 交互按钮，标记知识点 -->
<button 
  data-knowledge-point="quadratic_function"
  data-interaction-knowledge-point="function_transformation"
>
  重置图像
</button>
```

### 1.2 方式2：区域级别标记（用于复杂交互）

```html
<!-- 整个函数探索区域 -->
<div data-section-knowledge-point="quadratic_function" data-interaction-area="function_exploration">
  <h3>探索二次函数</h3>
  <input type="range" id="param-a" ... />
  <canvas id="graph"></canvas>
  <button>重置</button>
</div>
```

### 1.3 方式3：阶段级别标记（用于多阶段内容）

```html
<!-- 阶段1：函数基础 -->
<div data-stage="introduction" data-stage-knowledge-point="quadratic_function_basic">
  <h2>二次函数基础</h2>
  <!-- 内容 -->
</div>

<!-- 阶段2：函数变换 -->
<div data-stage="transformation" data-stage-knowledge-point="quadratic_function_transformation">
  <h2>函数变换</h2>
  <!-- 内容 -->
</div>
```

### 1.4 方式4：Meta标签标记（内容级别）

```html
<head>
  <meta name="knowledge-points" content='["quadratic_function", "function_parameter"]' />
  <meta name="primary-knowledge-point" content="quadratic_function" />
</head>
```

### 1.5 AI生成提示词模板

在AI生成内容的prompt中，添加以下要求：

```
【知识点标记要求】

在生成HTML时，必须为所有交互元素添加知识点标记，以便追踪学习行为：

1. **函数/数学参数滑块**：
   - 添加 data-knowledge-point="[知识点]"（从tags数组获取）
   - 添加 data-interaction-knowledge-point="function_parameter_effect"（如果是函数参数）
   - 示例：<input type="range" data-knowledge-point="quadratic_function" data-interaction-knowledge-point="function_parameter_effect" />

2. **Canvas/图表元素**：
   - 添加 data-knowledge-point="[知识点]"
   - 添加 data-interaction-area="[交互类型]"（如：function_visualization, graph_exploration）
   - 示例：<canvas data-knowledge-point="quadratic_function" data-interaction-area="function_visualization" />

3. **交互按钮**：
   - 添加 data-interaction-knowledge-point="[知识点]"
   - 示例：<button data-interaction-knowledge-point="quadratic_function">重置</button>

4. **多阶段内容**：
   - 每个阶段添加 data-stage="[阶段ID]"
   - 每个阶段添加 data-stage-knowledge-point="[该阶段的知识点]"
   - 示例：<div data-stage="introduction" data-stage-knowledge-point="quadratic_function_basic">

5. **交互区域容器**：
   - 用 data-section-knowledge-point 标记整个交互区域
   - 示例：<div data-section-knowledge-point="quadratic_function" data-interaction-area="function_exploration">

6. **自定义事件触发**（JavaScript代码中）：
   - 当函数图像绘制完成时，触发：canvas.dispatchEvent(new CustomEvent('function_graph_drawn', { detail: { function: '...', parameter: 'a' } }))
   - 当交互成功时，触发：window.dispatchEvent(new CustomEvent('interaction_success', { detail: { type: '...', attempts: 1 } }))
   - 当交互失败时，触发：window.dispatchEvent(new CustomEvent('interaction_failure', { detail: { type: '...', error: '...' } }))

知识点来源：
- 主要知识点：使用 tags 数组的第一个元素
- 交互知识点：根据交互类型选择对应的知识点
- 如果 tags 包含多个，选择最相关的那个

标记优先级：
- 元素级别 > 区域级别 > 阶段级别 > 内容级别
```

---

## 二、脚本注入和知识点关联

### 2.1 脚本注入位置

在`FullHTMLRenderer`组件中，处理HTML时统一注入追踪脚本：

```typescript
// 在 edu/frontend/src/components/FullHTMLRenderer.tsx
interface TrackingConfig {
  contentId: string;
  sessionId: string;
  userId?: string;
  visitorId?: string;
  knowledgePoints: string[];  // 从content表的tags字段获取
  contentMetadata?: {
    stageKnowledgePoints?: Record<string, string>;  // 阶段 -> 知识点映射
    interactionKnowledgeMap?: Record<string, string>; // 交互类型 -> 知识点映射
  };
}

function injectTrackingScript(html: string, content: Content, trackingConfig: TrackingConfig): string {
  // 从content的tags字段获取知识点
  const knowledgePoints = content.tags || [];
  
  // 从HTML中提取阶段知识点映射（如果存在）
  const stageKnowledgePoints = extractStageKnowledgePoints(html);
  
  // 生成追踪脚本
  const trackingScript = generateTrackingScript({
    ...trackingConfig,
    knowledgePoints,
    contentMetadata: {
      stageKnowledgePoints,
      interactionKnowledgeMap: {}  // 可以从content.metadata中获取
    }
  });
  
  // 在 </body> 前注入
  if (html.includes('</body>')) {
    return html.replace('</body>', `${trackingScript}\n</body>`);
  } else {
    return html + trackingScript;
  }
}

// 从HTML中提取阶段知识点映射
function extractStageKnowledgePoints(html: string): Record<string, string> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const stages = doc.querySelectorAll('[data-stage][data-stage-knowledge-point]');
  
  const mapping: Record<string, string> = {};
  stages.forEach(stage => {
    const stageId = stage.getAttribute('data-stage');
    const knowledgePoint = stage.getAttribute('data-stage-knowledge-point');
    if (stageId && knowledgePoint) {
      mapping[stageId] = knowledgePoint;
    }
  });
  
  return mapping;
}
```

### 2.2 知识点关联机制（增强版追踪脚本）

如果HTML中有知识点标记，可以在追踪脚本中添加知识点关联逻辑：

```javascript
// ========== 知识点关联机制 ==========

/**
 * 获取元素关联的知识点
 * 优先级：元素data属性 > 父元素data属性 > 区域标记 > 内容级别
 */
function getKnowledgePointForElement(element) {
  if (!element) return null;
  
  // 1. 检查元素自身的 data-knowledge-point 属性
  if (element.dataset?.knowledgePoint) {
    return element.dataset.knowledgePoint;
  }
  
  // 2. 检查元素自身的 data-interaction-knowledge-point 属性（交互专用）
  if (element.dataset?.interactionKnowledgePoint) {
    return element.dataset.interactionKnowledgePoint;
  }
  
  // 3. 向上查找父元素中的 data-section-knowledge-point（区域标记）
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    if (parent.dataset?.sectionKnowledgePoint) {
      return parent.dataset.sectionKnowledgePoint;
    }
    parent = parent.parentElement;
  }
  
  // 4. 检查是否有特定的交互区域标记（如：函数图像交互区）
  const interactionArea = element.closest('[data-interaction-area]');
  if (interactionArea?.dataset?.knowledgePoint) {
    return interactionArea.dataset.knowledgePoint;
  }
  
  // 5. 如果都没有，返回内容的主要知识点（第一个）
  if (TRACKING_CONFIG.knowledgePoints && TRACKING_CONFIG.knowledgePoints.length > 0) {
    return TRACKING_CONFIG.knowledgePoints[0];
  }
  
  return null;
}

/**
 * 获取当前阶段的知识点（用于多阶段内容）
 */
function getCurrentStageKnowledgePoint() {
  // 从URL hash获取阶段
  const hash = window.location.hash;
  const stage = hash ? hash.substring(1) : null;
  
  // 从阶段元素获取
  const stageElement = document.querySelector('[data-stage]');
  const currentStage = stage || (stageElement?.dataset.stage || null);
  
  if (currentStage && TRACKING_CONFIG.contentMetadata?.stageKnowledgePoints) {
    return TRACKING_CONFIG.contentMetadata.stageKnowledgePoints[currentStage] || null;
  }
  
  return null;
}

/**
 * 获取交互的知识点（综合方法）
 */
function getKnowledgePointForInteraction(element, interactionType) {
  // 优先使用元素的知识点
  const elementKnowledgePoint = getKnowledgePointForElement(element);
  if (elementKnowledgePoint) return elementKnowledgePoint;
  
  // 对于特定交互类型，使用预定义的映射
  if (TRACKING_CONFIG.contentMetadata?.interactionKnowledgeMap) {
    const map = TRACKING_CONFIG.contentMetadata.interactionKnowledgeMap;
    if (map[interactionType]) {
      return map[interactionType];
    }
  }
  
  // 使用当前阶段的知识点
  const stageKnowledgePoint = getCurrentStageKnowledgePoint();
  if (stageKnowledgePoint) return stageKnowledgePoint;
  
  // 最后使用内容的主要知识点
  if (TRACKING_CONFIG.knowledgePoints && TRACKING_CONFIG.knowledgePoints.length > 0) {
    return TRACKING_CONFIG.knowledgePoints[0];
  }
  
  return null;
}

// 在发送事件时使用
function sendEvent(eventType, payload, element = null) {
  // 获取知识点（如果提供了元素）
  const knowledgePoint = element ? getKnowledgePointForInteraction(element, payload.interaction_type) : null;
  
  // 获取当前阶段
  const stageId = getCurrentStageKnowledgePoint() ? 
    (window.location.hash?.substring(1) || document.querySelector('[data-stage]')?.dataset.stage || null) : 
    null;
  
  const event = {
    type: 'LEARNING_EVENT',
    data: {
      event_type: eventType,
      payload: {
        ...payload,
        knowledge_point: knowledgePoint,
        stage_id: stageId
      },
      content_id: TRACKING_CONFIG.contentId,
      knowledge_point: knowledgePoint,
      stage_id: stageId,
      session_id: TRACKING_CONFIG.sessionId,
      user_id: TRACKING_CONFIG.userId,
      visitor_id: TRACKING_CONFIG.visitorId,
      occurred_at: new Date().toISOString(),
      client_ts: new Date().toISOString()
    }
  };
  
  // 发送到父页面或后端
  // ...
}
```

### 2.3 知识点关联的优先级

1. **元素级别**（最高优先级）
   - `data-knowledge-point`：元素直接关联的知识点
   - `data-interaction-knowledge-point`：交互专用的知识点

2. **区域级别**
   - `data-section-knowledge-point`：整个区域的知识点
   - `data-interaction-area` + `data-knowledge-point`：交互区域的知识点

3. **阶段级别**
   - `data-stage` + `data-stage-knowledge-point`：当前阶段的知识点

4. **内容级别**（最低优先级）
   - `content.tags` 数组中的第一个知识点

---

## 三、知识点关联示例

### 3.1 完整示例：函数图像交互

**场景**：学生拖动滑块改变二次函数参数 `a`，看到图像变化。

**HTML生成时（AI需要标记）：**

```html
<!DOCTYPE html>
<html>
<head>
  <meta name="knowledge-points" content='["quadratic_function", "function_parameter_effect"]' />
  <meta name="primary-knowledge-point" content="quadratic_function" />
</head>
<body>
  <div data-section-knowledge-point="quadratic_function" data-interaction-area="function_exploration">
    <h2>探索二次函数 f(x) = ax²</h2>
    
    <!-- 参数滑块，标记知识点 -->
    <label>参数 a = <span id="param-a-value">1</span></label>
    <input 
      type="range" 
      id="param-a" 
      name="parameter_a"
      data-knowledge-point="quadratic_function"
      data-interaction-knowledge-point="function_parameter_effect"
      min="-5" 
      max="5" 
      value="1"
      step="0.1"
    />
    
    <!-- 函数图像Canvas，标记知识点 -->
    <canvas 
      id="function-graph"
      data-knowledge-point="quadratic_function"
      data-interaction-area="function_visualization"
      width="800"
      height="400"
    ></canvas>
  </div>
  
  <script>
    const paramA = document.getElementById('param-a');
    const canvas = document.getElementById('function-graph');
    const ctx = canvas.getContext('2d');
    
    function drawFunction(a) {
      // 绘制函数图像
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // ... 绘制逻辑 ...
      
      // 触发自定义事件，通知追踪脚本
      canvas.dispatchEvent(new CustomEvent('function_graph_drawn', {
        detail: {
          function: `f(x) = ${a}x²`,
          graphType: 'quadratic',
          parameter: 'a',
          parameterValue: a
        }
      }));
    }
    
    paramA.addEventListener('input', (e) => {
      const a = parseFloat(e.target.value);
      document.getElementById('param-a-value').textContent = a;
      drawFunction(a);
    });
    
    // 初始绘制
    drawFunction(1);
  </script>
</body>
</html>
```

**追踪脚本捕获的事件序列：**

1. **滑块变化事件**：
```json
{
  "event_type": "interaction_change",
  "knowledge_point": "quadratic_function",
  "payload": {
    "interaction_type": "function_parameter_change",
    "element_type": "slider",
    "element_id": "param-a",
    "parameter_name": "parameter_a",
    "value": "2.5",
    "is_function_parameter": true
  }
}
```

2. **图像更新事件**：
```json
{
  "event_type": "interaction_change",
  "knowledge_point": "quadratic_function",
  "payload": {
    "interaction_type": "function_graph_update",
    "element_type": "canvas",
    "triggered_by": "slider_change",
    "parameter_changed": "parameter_a",
    "parameter_value": "2.5",
    "function_info": "f(x) = 2.5x²",
    "graph_type": "quadratic"
  }
}
```

**分析结果**：
- 知识点：`quadratic_function`
- 交互类型：参数探索 → 图像观察
- 学习行为：通过改变参数观察函数图像变化
- 可用于分析：学生对函数参数影响的理解程度

---

## 四、Metadata提取优化方案

### 4.1 现有Metadata分析

**优点**：
- ✅ 结构清晰，包含sections/stages、interactions、visualElements
- ✅ 有learningObjectives，可以映射到知识点
- ✅ 有pageStateSchema，便于理解页面状态

**问题**：
- ❌ **缺少明确的`knowledge_points`字段**
- ❌ **sections/stages没有标记知识点**
- ❌ **interactions没有映射到知识点**
- ❌ **无法直接用于追踪脚本的知识点关联**

### 4.2 优化后的Metadata结构

**需要在现有metadata基础上添加以下字段：**

```json
{
  "meta": {
    "title": "...",
    "topic": "...",
    "subject": "...",
    "language": "zh-CN",
    "description": "...",
    "technologyStack": [...]
  },
  
  // ========== 新增：知识点字段 ==========
  "knowledge_points": [
    "water_molecule_structure",      // 主要知识点
    "covalent_bond",                 // 次要知识点
    "molecular_geometry",            // 次要知识点
    "molecular_polarity",             // 次要知识点
    "hydrogen_bond"                  // 次要知识点
  ],
  "primary_knowledge_point": "water_molecule_structure",  // 主要知识点
  
  "keywords": [...],
  
  // ========== 优化：为每个section添加知识点 ==========
  "sections": [
    {
      "id": "intro",
      "stage": 0,
      "title": "引言",
      "knowledge_point": "water_molecule_structure",  // 新增
      "formula": "H_2O",
      "description": "..."
    },
    {
      "id": "bonding",
      "stage": 2,
      "title": "共价键",
      "knowledge_point": "covalent_bond",  // 新增：这个阶段主要讲共价键
      "formula": "H : O : H → H-O-H",
      "description": "..."
    }
  ],
  
  // ========== 优化：为interactions添加知识点映射 ==========
  "interactions": {
    "audio": [...],
    "navigation": [...],
    // ========== 新增：交互知识点映射 ==========
    "knowledge_map": {
      "slider_change": "water_molecule_structure",  // 滑块变化 -> 知识点
      "canvas_click": "molecular_geometry",        // Canvas点击 -> 知识点
      "button_click": null,                        // null表示使用当前stage的知识点
      "audio_play": null                           // null表示使用当前stage的知识点
    }
  },
  
  "visualElements": {...},
  "pageStateSchema": {...},
  "learningObjectives": [...]
}
```

### 4.3 优化后的Metadata提取Prompt

**在现有的metadata提取prompt基础上，添加以下要求：**

```
【知识点提取要求】

1. **提取知识点列表**：
   - 从learningObjectives和content中提取所有知识点
   - 知识点使用下划线命名（如：water_molecule_structure）
   - 知识点应该是可枚举的、稳定的标识符
   - 输出格式：knowledge_points: ["知识点1", "知识点2", ...]
   - 主要知识点（primary_knowledge_point）：选择最重要的一个

2. **为每个section/stage标记知识点**：
   - 每个section必须有一个knowledge_point字段
   - 如果section主要讲某个知识点，标记为该知识点
   - 如果section涉及多个知识点，选择最重要的一个
   - 示例：{ "id": "bonding", "stage": 2, "knowledge_point": "covalent_bond", ... }

3. **为interactions添加知识点映射**：
   - 在interactions对象中添加knowledge_map字段
   - 将交互类型映射到知识点
   - 如果交互类型没有特定知识点，使用null（表示使用当前stage的知识点）
   - 示例：
     "knowledge_map": {
       "slider_change": "water_molecule_structure",
       "canvas_click": "molecular_geometry",
       "button_click": null
     }

4. **知识点命名规范**：
   - 使用下划线命名：water_molecule_structure
   - 使用英文（便于跨语言）
   - 保持简洁但语义清晰
   - 与content表的tags字段保持一致
```

### 4.4 从现有Metadata自动提取知识点

**如果metadata中没有knowledge_points，可以从以下字段推导：**

```javascript
// 从learningObjectives提取知识点
function extractKnowledgePointsFromObjectives(objectives) {
  // 使用AI或规则从学习目标中提取知识点
  // 例如："理解共价键的形成" -> "covalent_bond"
  return objectives.map(obj => {
    // 使用关键词映射
    if (obj.includes('共价键') || obj.includes('covalent')) return 'covalent_bond';
    if (obj.includes('键角') || obj.includes('geometry')) return 'molecular_geometry';
    if (obj.includes('极性') || obj.includes('polarity')) return 'molecular_polarity';
    if (obj.includes('氢键') || obj.includes('hydrogen')) return 'hydrogen_bond';
    // ...
  }).filter(Boolean);
}

// 从sections的title和description提取知识点
function extractKnowledgePointsFromSections(sections) {
  const knowledgePoints = new Set();
  
  sections.forEach(section => {
    // 从title提取
    if (section.title.includes('共价键')) knowledgePoints.add('covalent_bond');
    if (section.title.includes('键角') || section.title.includes('VSEPR')) {
      knowledgePoints.add('molecular_geometry');
    }
    if (section.title.includes('极性')) knowledgePoints.add('molecular_polarity');
    if (section.title.includes('氢键')) knowledgePoints.add('hydrogen_bond');
    
    // 从description提取
    // ...
  });
  
  return Array.from(knowledgePoints);
}
```

### 4.5 使用优化后的Metadata

**在FullHTMLRenderer中，使用metadata生成知识点映射：**

```typescript
function buildKnowledgePointMapping(content: Content, metadata: any) {
  const mapping = {
    // 内容级别知识点
    knowledgePoints: metadata.knowledge_points || content.tags || [],
    primaryKnowledgePoint: metadata.primary_knowledge_point || 
                          (metadata.knowledge_points?.[0]) || 
                          (content.tags?.[0]) || null,
    
    // 阶段 -> 知识点映射
    stageKnowledgePoints: {},
    
    // 交互类型 -> 知识点映射
    interactionKnowledgeMap: metadata.interactions?.knowledge_map || {}
  };
  
  // 从sections构建阶段知识点映射
  if (metadata.sections) {
    metadata.sections.forEach((section: any) => {
      const stageId = section.stage?.toString() || section.id;
      const knowledgePoint = section.knowledge_point || mapping.primaryKnowledgePoint;
      if (stageId && knowledgePoint) {
        mapping.stageKnowledgePoints[stageId] = knowledgePoint;
      }
    });
  }
  
  // 从contentStructure.stages构建（如果存在）
  if (metadata.contentStructure?.stages) {
    metadata.contentStructure.stages.forEach((stage: any) => {
      const stageId = stage.index?.toString() || stage.id;
      const knowledgePoint = stage.knowledge_point || mapping.primaryKnowledgePoint;
      if (stageId && knowledgePoint) {
        mapping.stageKnowledgePoints[stageId] = knowledgePoint;
      }
    });
  }
  
  return mapping;
}
```

### 4.6 是否可以直接使用现有Metadata？

**结论：不能直接使用，需要优化**

**原因**：
1. ❌ 缺少`knowledge_points`字段，无法知道内容涉及哪些知识点
2. ❌ sections/stages没有`knowledge_point`，无法知道每个阶段对应的知识点
3. ❌ interactions没有`knowledge_map`，无法知道交互类型对应的知识点

**解决方案**：

**方案A：优化Metadata提取Prompt（推荐）**
- 在现有的metadata提取prompt中添加知识点提取要求
- AI生成metadata时自动包含知识点信息
- 优点：一次到位，后续直接使用
- 缺点：需要修改prompt

**方案B：从现有Metadata推导知识点（临时方案）**
- 从learningObjectives、sections的title/description中提取关键词
- 使用规则或AI映射到知识点
- 优点：可以立即使用现有metadata
- 缺点：可能不够准确，需要后续验证

**方案C：混合方案（最佳实践）**
- 优化prompt，要求提取知识点
- 同时保留推导逻辑作为fallback
- 如果metadata有知识点就用，没有就推导

---

## 五、完整示例：优化后的Metadata

```json
{
  "meta": {
    "title": "水分子的奥秘",
    "topic": "Molecular Structure",
    "subject": "Chemistry",
    "language": "zh-CN"
  },
  
  "knowledge_points": [
    "water_molecule_structure",
    "covalent_bond",
    "molecular_geometry",
    "molecular_polarity",
    "hydrogen_bond"
  ],
  "primary_knowledge_point": "water_molecule_structure",
  
  "contentStructure": {
    "stages": [
      {
        "index": 0,
        "id": "intro",
        "title": "引言",
        "knowledge_point": "water_molecule_structure",
        "formula": "H_2O"
      },
      {
        "index": 2,
        "id": "bonding",
        "title": "共价键",
        "knowledge_point": "covalent_bond",
        "formula": "H : O : H → H-O-H"
      }
    ]
  },
  
  "interactions": {
    "audio": [...],
    "navigation": [...],
    "knowledge_map": {
      "slider_change": "water_molecule_structure",
      "canvas_click": "molecular_geometry",
      "button_click": null,
      "audio_play": null
    }
  },
  
  "learningObjectives": [...]
}
```

---

## 六、实施建议

### 6.1 优先级

1. **高优先级**（推荐实施）：
   - 优化Metadata提取Prompt，添加知识点字段
   - 在HTML中添加`data-stage`标记（用于阶段追踪）

2. **中优先级**（可选）：
   - 为交互元素添加`data-knowledge-point`标记
   - 实施知识点关联机制

3. **低优先级**（未来考虑）：
   - 自定义事件触发
   - 复杂的交互区域标记

### 6.2 迁移路径

1. **第一阶段**：只优化Metadata，不修改HTML生成
2. **第二阶段**：在HTML中添加阶段标记（`data-stage`）
3. **第三阶段**：为关键交互元素添加知识点标记
4. **第四阶段**：完整实施知识点关联机制

---

## 七、总结

本文档描述的是**可选的增强功能**，需要：

1. **AI生成HTML时添加标记**（如`data-knowledge-point`、`data-stage`等）
2. **优化Metadata提取**（添加知识点字段）

如果不实施这些增强功能，系统仍然可以：
- 追踪基础事件（`content_enter`、`content_exit`、`time_on_page`等）
- 分析AI Guide对话
- 生成学习画像和报告

但无法：
- 追踪阶段切换（`stage_enter`/`stage_exit`）
- 关联交互与特定知识点
- 分析特定交互行为的学习效果

建议：优先实施Metadata优化，再逐步添加HTML标记。
