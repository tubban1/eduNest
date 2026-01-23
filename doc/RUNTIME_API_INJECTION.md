# Runtime API 注入方案文档

## 1. 背景与需求

### 1.1 问题描述

当前 AI Guide 功能需要收集内容页面的 UI 状态（如滑块值、当前阶段、输入框内容等），以便 AI 能够理解用户当前的操作上下文。然而：

- 前端没有注入 Runtime API 来收集 UI state
- `uiState` 参数在调用 AI Guide API 时都是 `null`
- 内容页面无法与平台层通信

### 1.2 目标

1. **统一 Runtime API**：为所有内容页面提供标准化的 `window.eduNestRuntime` API
2. **UI State 收集**：自动收集页面状态（input、select、data-* 属性、Vue/React 状态等）
3. **事件追踪**：支持内容页面发送学习事件到平台层
4. **架构一致性**：与现有的 RendererEngine 注入机制保持一致

## 2. 方案评估

### 2.1 方案对比

| 维度 | 方案 1: FullHTMLRenderer 注入 | 方案 2: RendererEngine 注入 | 混合方案 |
|------|---------------------------|---------------------------|---------|
| **实现复杂度** | 低 | 中 | 中高 |
| **覆盖范围** | 所有内容（AI + 手动） | 仅 AI 生成内容 | 所有内容 |
| **架构一致性** | 低（前端注入） | 高（后端统一） | 高 |
| **可定制性** | 低（统一注入） | 高（按需注入） | 高 |
| **性能影响** | 所有页面都注入 | 仅 AI 内容注入 | 智能注入 |
| **维护成本** | 低 | 中 | 中 |

### 2.2 推荐方案

**优先采用方案 2（RendererEngine 注入）**，原因：

1. ✅ **架构统一**：与现有的 MathRenderManager、库注入等机制一致
2. ✅ **按需注入**：可以检测内容类型，只对交互式内容注入
3. ✅ **主要场景覆盖**：AI 生成内容是主要使用场景
4. ✅ **易于扩展**：可以添加检测逻辑（如检测 Vue/React/交互元素）

**后续可补充方案 1（FullHTMLRenderer 兜底）**，用于：
- 覆盖用户手动创建的内容
- 作为检测到交互元素时的兜底方案

## 3. 技术设计

### 3.1 Runtime API 规范

```javascript
window.eduNestRuntime = {
  // 获取当前 UI 状态
  getUIState: function() {
    // 返回包含所有可追踪状态的对象
    return {
      inputs: { ... },      // input/select/textarea 的值
      dataAttributes: { ... }, // data-* 属性的值
      currentStage: '...',  // 当前阶段/步骤
      vueState: { ... },    // Vue 组件状态（如果可访问）
      customState: { ... }  // 自定义状态
    };
  },
  
  // 发送学习事件
  trackEvent: function(eventType, data) {
    // 通过 postMessage 发送到父窗口
    // eventType: 'click', 'interaction', 'stage_change', 'completion', etc.
    // data: 事件相关的数据对象
  },
  
  // 请求 AI Guide（可选）
  requestAIGuide: function(message) {
    // 触发 AI Guide 打开并发送消息
  }
};
```

### 3.2 UI State 收集策略

#### 3.2.1 基础元素收集

```javascript
// 收集所有表单元素
inputs: {
  'slider-a': 0.5,           // range input
  'checkbox-option': true,   // checkbox
  'select-mode': 'advanced', // select
  'text-input': 'value'      // text input
}
```

#### 3.2.2 Data 属性收集

```javascript
// 收集 data-state, data-current, data-value 等
dataAttributes: {
  'current-stage': '2',
  'selected-item': 'item-3',
  'animation-state': 'playing'
}
```

#### 3.2.3 阶段/步骤检测

```javascript
// 检测当前阶段（常见于交互式教学内容）
currentStage: '2' // 从 .stage.active, [data-stage], .step.active 等获取
```

#### 3.2.4 Vue/React 状态收集（可选）

```javascript
// 尝试从 Vue/React 实例获取状态（如果可访问）
vueState: {
  currentStage: 2,
  isPlaying: true,
  // ... 其他响应式状态
}
```

### 3.3 事件追踪规范

#### 3.3.1 事件类型

- `click`: 用户点击交互元素
- `interaction`: 用户交互（拖拽、输入等）
- `stage_change`: 阶段/步骤切换
- `completion`: 完成某个任务
- `error`: 发生错误
- `custom`: 自定义事件

#### 3.3.2 事件数据格式

```javascript
{
  eventType: 'stage_change',
  data: {
    from: 1,
    to: 2,
    timestamp: '2026-01-23T10:00:00Z'
  }
}
```

## 4. 实现方案

### 4.1 RendererEngine 注入（主要方案）

#### 4.1.1 检测逻辑

在 `RuntimeChecker` 中添加检测：

```javascript
// 检测是否需要 Runtime API
checkRuntimeAPINeeded(html) {
  // 检测交互元素
  const hasInteractivity = 
    /<input|<select|<textarea|<button/i.test(html) ||
    /@click|@input|v-model|v-on:/i.test(html) ||
    /addEventListener|onclick/i.test(html) ||
    /data-stage|data-current|data-value/i.test(html);
  
  // 检测阶段切换
  const hasStageSwitching = 
    /v-if.*stage|currentStage|nextStage|prevStage/i.test(html);
  
  return hasInteractivity || hasStageSwitching;
}
```

#### 4.1.2 注入逻辑

在 `RuntimeFixer` 中添加注入方法：

```javascript
injectRuntimeAPI(html, context = {}) {
  // 检查是否已存在
  if (html.includes('window.eduNestRuntime')) {
    return { success: true, html, changes: [] };
  }
  
  // 生成 Runtime API 脚本
  const runtimeScript = this.generateRuntimeAPIScript();
  
  // 注入到 </body> 之前
  if (html.includes('</body>')) {
    html = html.replace('</body>', `${runtimeScript}</body>`);
  } else if (html.includes('</html>')) {
    html = html.replace('</html>', `${runtimeScript}</html>`);
  } else {
    html = html + runtimeScript;
  }
  
  return {
    success: true,
    html,
    changes: [{
      type: 'insert',
      location: '</body>',
      after: 'Runtime API',
      reason: '注入 EduNest Runtime API'
    }]
  };
}
```

#### 4.1.3 脚本生成

```javascript
generateRuntimeAPIScript() {
  return `
<script>
(function() {
  'use strict';
  
  // ========== EduNest Runtime API ==========
  window.eduNestRuntime = window.eduNestRuntime || {
    // 获取 UI 状态
    getUIState: function() {
      var state = {};
      
      // 1. 收集表单元素
      var inputs = document.querySelectorAll('input, select, textarea');
      inputs.forEach(function(input) {
        var name = input.name || input.id || input.className;
        if (name) {
          if (input.type === 'checkbox' || input.type === 'radio') {
            state[name] = input.checked;
          } else if (input.type === 'range') {
            state[name] = parseFloat(input.value) || 0;
          } else {
            state[name] = input.value || '';
          }
        }
      });
      
      // 2. 收集 data-* 属性
      var dataElements = document.querySelectorAll('[data-state], [data-current], [data-value]');
      dataElements.forEach(function(el) {
        var key = el.getAttribute('data-state') || 
                  el.getAttribute('data-current') || 
                  el.getAttribute('data-value');
        if (key) {
          state[key] = el.textContent || el.value || el.getAttribute('data-value') || '';
        }
      });
      
      // 3. 检测当前阶段
      var stageElements = document.querySelectorAll('[data-stage], [data-step], .stage, .step');
      if (stageElements.length > 0) {
        var activeStage = null;
        stageElements.forEach(function(el) {
          if (el.classList.contains('active') || 
              el.style.display !== 'none' ||
              el.getAttribute('data-stage')) {
            var stage = el.getAttribute('data-stage') || 
                       el.getAttribute('data-step') || 
                       el.textContent;
            if (stage) activeStage = stage;
          }
        });
        if (activeStage) state.currentStage = activeStage;
      }
      
      // 4. Vue 状态收集（如果可访问）
      if (window.Vue && window.Vue.version) {
        try {
          var app = document.getElementById('app');
          if (app && app.__vue_app__) {
            // 尝试从 Vue 实例获取状态
            // 注意：Vue 3 的响应式系统较复杂，这里只做基础收集
            state._vue = { detected: true };
          }
        } catch (e) {
          // 静默失败
        }
      }
      
      return state;
    },
    
    // 发送学习事件
    trackEvent: function(eventType, data) {
      if (window.parent) {
        window.parent.postMessage({
          type: 'EDUNEST_EVENT',
          data: {
            eventType: eventType,
            data: data || {},
            timestamp: new Date().toISOString()
          }
        }, '*');
      }
    },
    
    // 请求 AI Guide（可选）
    requestAIGuide: function(message) {
      if (window.parent) {
        window.parent.postMessage({
          type: 'EDUNEST_AI_GUIDE_REQUEST',
          data: {
            message: message || '',
            timestamp: new Date().toISOString()
          }
        }, '*');
      }
    }
  };
  
  // 监听来自父窗口的 UI state 请求
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'EDUNEST_GET_UI_STATE') {
      var uiState = window.eduNestRuntime.getUIState();
      if (window.parent) {
        window.parent.postMessage({
          type: 'EDUNEST_UI_STATE_RESPONSE',
          data: uiState
        }, '*');
      }
    }
  });
  
})();
</script>`;
}
```

### 4.2 FullHTMLRenderer 兜底（可选）

如果需要在 FullHTMLRenderer 中添加兜底逻辑：

```typescript
// 检测是否需要注入 Runtime API
const needsRuntimeAPI = useMemo(() => {
  if (!fullHTML) return false;
  return /<input|<select|<textarea|<button|@click|v-model|data-stage/i.test(fullHTML);
}, [fullHTML]);

// 注入 Runtime API 脚本（如果需要）
const runtimeAPIScript = needsRuntimeAPI ? generateRuntimeAPIScript() : '';
```

## 5. 前端集成

### 5.1 AIGuidedLearning 组件修改

```typescript
// 监听 iframe 消息，收集 UI state
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    // 处理 UI state 响应
    if (event.data?.type === 'EDUNEST_UI_STATE_RESPONSE') {
      const uiState = event.data.data;
      setCurrentUIState(uiState);
      onUIStateChange?.(uiState);
    }
  };
  
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [onUIStateChange]);

// 从 iframe 获取 UI state
const getUIState = useCallback(() => {
  // 通过 postMessage 请求 iframe 中的 UI state
  const iframe = document.querySelector('iframe[srcDoc]');
  if (iframe?.contentWindow) {
    iframe.contentWindow.postMessage(
      { type: 'EDUNEST_GET_UI_STATE' },
      '*'
    );
  }
  return currentUIState;
}, [currentUIState]);

// 在发送消息时使用 UI state
const handleSendMessage = async (text: string) => {
  const uiState = getUIState();
  await api.aiGuide.chatStream(conversationId, text, uiState, ...);
};
```

### 5.2 FullHTMLRenderer 消息处理

```typescript
// 监听来自 iframe 的事件
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'EDUNEST_EVENT') {
      // 处理学习事件
      const { eventType, data } = event.data.data;
      // 可以发送到后端记录或触发其他操作
      console.log('Learning event:', eventType, data);
    }
    
    if (event.data?.type === 'EDUNEST_AI_GUIDE_REQUEST') {
      // 触发 AI Guide 打开
      const { message } = event.data.data;
      // 可以调用 AIGuidedLearning 组件的方法
    }
  };
  
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

## 6. 使用示例

### 6.1 内容页面使用 Runtime API

```html
<!DOCTYPE html>
<html>
<head>
  <title>交互式教学内容</title>
</head>
<body>
  <div id="app">
    <input type="range" id="slider-a" min="0" max="1" step="0.1" value="0.5">
    <div data-stage="1" class="stage active">阶段 1</div>
    <button onclick="nextStage()">下一步</button>
  </div>
  
  <script>
    // Runtime API 已由 RendererEngine 自动注入
    function nextStage() {
      // 发送阶段切换事件
      window.eduNestRuntime.trackEvent('stage_change', {
        from: 1,
        to: 2
      });
    }
    
    // 获取当前 UI 状态（供 AI Guide 使用）
    function getCurrentState() {
      return window.eduNestRuntime.getUIState();
      // 返回: { 'slider-a': 0.5, currentStage: '1', ... }
    }
  </script>
</body>
</html>
```

### 6.2 AI Guide 使用 UI State

```typescript
// 用户发送消息时，自动收集 UI state
const handleSendMessage = async (text: string) => {
  // 1. 请求 iframe 中的 UI state
  const iframe = document.querySelector('iframe[srcDoc]');
  iframe?.contentWindow?.postMessage(
    { type: 'EDUNEST_GET_UI_STATE' },
    '*'
  );
  
  // 2. 等待响应（通过 useEffect 监听）
  // 3. 发送消息时包含 UI state
  await api.aiGuide.chatStream(conversationId, text, currentUIState, ...);
};
```

## 7. 实施计划

### 7.1 第一阶段：RendererEngine 注入（主要方案）

1. ✅ 创建文档（当前步骤）
2. ⬜ 在 `RuntimeChecker` 中添加检测逻辑
3. ⬜ 在 `RuntimeFixer` 中添加注入方法
4. ⬜ 实现 Runtime API 脚本生成
5. ⬜ 测试 AI 生成内容的注入效果

### 7.2 第二阶段：前端集成

1. ⬜ 修改 `AIGuidedLearning` 组件，添加 UI state 收集
2. ⬜ 修改 `FullHTMLRenderer`，添加消息监听
3. ⬜ 测试 UI state 的收集和传递

### 7.3 第三阶段：兜底方案（可选）

1. ⬜ 在 `FullHTMLRenderer` 中添加智能检测
2. ⬜ 对用户手动创建的内容也注入 Runtime API
3. ⬜ 测试完整覆盖

## 8. 注意事项

### 8.1 安全性

- ✅ 使用 `postMessage` 进行跨窗口通信，避免直接访问
- ✅ 使用 `'*'` 作为 targetOrigin（在 iframe 场景下安全）
- ⚠️ 生产环境可考虑使用具体的 origin 验证

### 8.2 性能

- ✅ Runtime API 脚本体积小（约 2-3KB）
- ✅ 只在需要时注入（通过检测逻辑）
- ✅ 使用防抖/节流处理频繁的状态收集

### 8.3 兼容性

- ✅ 支持 Vue 2/3（如果可访问）
- ✅ 支持原生 JavaScript
- ✅ 支持 Web Components
- ⚠️ React 状态收集需要额外处理（React 的响应式系统较难访问）

## 9. 后续扩展

### 9.1 增强状态收集

- 支持更多框架（React、Angular 等）
- 支持自定义状态收集器
- 支持状态变化监听

### 9.2 事件系统增强

- 支持事件过滤和聚合
- 支持事件回放
- 支持事件分析

### 9.3 平台功能集成

- 积分系统集成
- 学习报告生成
- 推荐系统集成

## 10. 参考

- [RendererEngine 架构文档](./RENDERER_ENGINE.md)
- [AI Guide 服务文档](./AI_GUIDE.md)
- [PostMessage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
