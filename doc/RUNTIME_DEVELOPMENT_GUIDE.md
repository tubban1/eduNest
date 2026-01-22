# eduNest Runtime 开发指南

> 完整的技术实现指南：从架构设计到代码实现
> 版本：1.0 | 日期：2026-01-21

---

## 📋 目录

1. [架构概述](#一架构概述)
2. [核心概念](#二核心概念)
3. [Runtime API 设计](#三runtime-api-设计)
4. [技术实现](#四技术实现)
5. [业务集成](#五业务集成)
6. [实施路线图](#六实施路线图)
7. [代码示例](#七代码示例)

---

## 一、架构概述

### 1.1 双层架构模型

```
┌─────────────────────────────────────────────────────────┐
│              eduNest 平台层（你控制）                    │
│  AI Guide、Tracking、Memory、KaTeX、积分、订阅           │
├─────────────────────────────────────────────────────────┤
│  <edu-lesson> ← Web Component（主权边界/防弹舱）        │
│    └── Shadow DOM / Light DOM                           │
│         └── AI 生成内容（Petite-Vue/Vue/Three.js）      │
│              └── 解题逻辑、动画、交互                     │
└─────────────────────────────────────────────────────────┘
```

### 1.2 核心原则

| 原则 | 说明 | 实现方式 |
|------|------|---------|
| **主权边界** | Web Component 是平台边界，防止 AI 内容破坏平台 | `<edu-lesson>` Custom Element |
| **统一接口** | 所有平台能力通过 Runtime API 暴露 | `window.eduNestRuntime` |
| **自动修复** | Renderer Engine 自动注入和修复 | 后端处理 |
| **分层 Prompt** | Runtime 层和 Content 层分离 | 两套 Prompt |

### 1.3 数据流

```
AI 生成内容（Content Prompt）
    ↓
Renderer Engine 处理
    ├── 注入 Runtime API
    ├── 包装成 Web Component
    ├── 修复数学公式错误
    └── 修复库依赖问题
    ↓
保存到数据库（content.full_html）
    ↓
前端呈现（FullHTMLRenderer）
    ├── iframe 加载 HTML
    ├── 监听 Runtime API 消息
    └── 与平台能力通信
    ↓
用户看到的内容
```

---

## 二、核心概念

### 2.1 Web Component = 防弹舱

**❌ 错误理解**：用 Web Component 写课件  
**✅ 正确理解**：Web Component 是平台的"主权边界"，防止 AI 内容破坏平台

**类比**：
- Web Component = 防弹玻璃
- AI 内容 = 玻璃后面的内容
- 平台能力 = 玻璃外面的系统

### 2.2 双层架构

| 层级 | 负责什么 | 谁控制 | 技术栈 |
|------|---------|--------|--------|
| **平台层** | AI Guide、Tracking、Memory、KaTeX、安全 | 你（人写） | Web Component + Runtime API |
| **内容层** | 解题逻辑、动画、交互 | AI 生成 | Petite-Vue/Vue/Three.js |

### 2.3 为什么用 Petite-Vue？

- ✅ **无需编译**：AI 直接输出 HTML + JS
- ✅ **错误率低**：比完整版 Vue 更简单
- ✅ **易于托管**：Web Component 可以轻松包裹
- ✅ **声明式思维**：保持 Vue 的优势

---

## 三、Runtime API 设计

### 3.1 完整接口列表

```javascript
window.eduNestRuntime = {
  // ========== 学习相关 ==========
  dispatchLearningEvent(type, payload),
  getLearningMemory(knowledgePoint),
  getLearningReport(options),
  recommendNextContent(options),
  
  // ========== AI Guide ==========
  requestAIGuideHelp(context),
  getAIGuideHistory(),
  
  // ========== 积分系统 ==========
  getCreditsBalance(),
  consumeCredits(amount, reason),
  showUpgradePrompt(options),
  isProUser(),
  
  // ========== 推荐系统 ==========
  getReferralCode(),
  shareContent(options),
  showReferralPrompt(options),
  
  // ========== 内容相关 ==========
  renderMath(container),
  registerInteractiveNode(nodeId, meta),
  adaptContent(options),
  
  // ========== 社交功能 ==========
  joinStudyGroup(options),
  syncLearningState(state),
  showCommunityDiscussion(options),
  submitQuestion(options),
  answerQuestion(options),
  
  // ========== 成就系统 ==========
  checkAchievement(options),
  unlockAchievement(achievementId, reward),
  getAchievements(),
  
  // ========== 内容市场 ==========
  purchaseContent(options),
  sellContent(options),
  getContentMarketplace()
};
```

### 3.2 核心接口详细设计

#### 3.2.1 学习事件上报

```javascript
/**
 * 上报学习事件
 * @param {string} type - 事件类型（如 'parameter_change', 'stage_enter', 'answer_submit'）
 * @param {object} payload - 事件数据
 */
window.eduNestRuntime.dispatchLearningEvent(type, payload);
```

**示例**：
```javascript
window.eduNestRuntime.dispatchLearningEvent('parameter_change', {
  a: 1,
  b: 0,
  c: 0,
  knowledgePoint: 'quadratic_function',
  timestamp: Date.now()
});
```

#### 3.2.2 AI Guide 帮助

```javascript
/**
 * 请求 AI Guide 帮助
 * @param {object} context - 上下文信息
 * @param {string} context.question - 用户问题
 * @param {string} context.knowledgePoint - 知识点
 * @param {object} context.uiState - 当前 UI 状态
 */
window.eduNestRuntime.requestAIGuideHelp(context);
```

**示例**：
```javascript
window.eduNestRuntime.requestAIGuideHelp({
  context: '二次函数图像',
  question: '如何理解参数 a 对图像的影响？',
  uiState: { a: 1, b: 0, c: 0 },
  knowledgePoint: 'quadratic_function'
});
```

#### 3.2.3 数学公式渲染

```javascript
/**
 * 渲染数学公式
 * @param {HTMLElement} container - 容器元素（可选，默认 document.body）
 */
window.eduNestRuntime.renderMath(container);
```

**示例**：
```javascript
// 渲染整个页面
window.eduNestRuntime.renderMath();

// 渲染特定容器
window.eduNestRuntime.renderMath(document.querySelector('#math-content'));
```

#### 3.2.4 积分查询

```javascript
/**
 * 获取积分余额
 * @returns {Promise<number>} 积分余额
 */
const credits = await window.eduNestRuntime.getCreditsBalance();
```

**示例**：
```javascript
const credits = await window.eduNestRuntime.getCreditsBalance();
if (credits < 10) {
  window.eduNestRuntime.showUpgradePrompt({
    reason: '积分不足',
    action: 'upgrade_to_pro'
  });
}
```

---

## 四、技术实现

### 4.1 Runtime API 注入（Renderer Engine）

**文件**：`edu/backend/src/services/rendererEngine/runtime/api.js`（新建）

```javascript
/**
 * eduNest Runtime API 生成器
 * 用于注入到 AI 生成的 HTML 中
 */

function generateRuntimeAPIScript() {
  return `
<script>
(function() {
  'use strict';
  
  // 避免重复注入
  if (window.eduNestRuntime) {
    console.warn('[eduNestRuntime] Already initialized');
    return;
  }
  
  window.eduNestRuntime = {
    // ========== 学习事件上报 ==========
    dispatchLearningEvent(type, payload) {
      const eventData = {
        type,
        payload: {
          ...payload,
          timestamp: Date.now(),
          contentId: window.__EDUNEST_CONTENT_ID__ || null,
          userId: window.__EDUNEST_USER_ID__ || null
        }
      };
      
      // 通过 postMessage 发送到父窗口
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'LEARNING_EVENT',
          data: eventData
        }, '*');
      }
      
      console.log('[eduNestRuntime] Learning event:', type, eventData);
    },
    
    // ========== AI Guide 帮助 ==========
    requestAIGuideHelp(context) {
      const requestData = {
        ...context,
        timestamp: Date.now(),
        contentId: window.__EDUNEST_CONTENT_ID__ || null,
        userId: window.__EDUNEST_USER_ID__ || null
      };
      
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'AI_GUIDE_REQUEST',
          data: requestData
        }, '*');
      }
      
      console.log('[eduNestRuntime] AI Guide request:', requestData);
    },
    
    // ========== 数学公式渲染 ==========
    renderMath(container) {
      if (typeof renderMathInElement === 'undefined') {
        console.warn('[eduNestRuntime] renderMathInElement not loaded');
        return;
      }
      
      const target = container || document.body;
      try {
        renderMathInElement(target, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\\\[', right: '\\\\]', display: true},
            {left: '\\\\(', right: '\\\\)', display: false}
          ],
          throwOnError: false,
          errorColor: '#cc0000'
        });
      } catch (e) {
        console.error('[eduNestRuntime] Math render error:', e);
      }
    },
    
    // ========== 注册交互节点 ==========
    registerInteractiveNode(nodeId, meta) {
      const node = document.getElementById(nodeId);
      if (node) {
        node.setAttribute('data-edu-interactive', 'true');
        node.setAttribute('data-edu-meta', JSON.stringify(meta));
        
        // 自动追踪交互
        node.addEventListener('click', () => {
          this.dispatchLearningEvent('node_interaction', {
            nodeId,
            action: 'click',
            ...meta
          });
        });
      }
    },
    
    // ========== 获取学习记忆 ==========
    getLearningMemory(knowledgePoint) {
      return new Promise((resolve, reject) => {
        if (window.parent !== window) {
          const requestId = 'memory_' + Date.now();
          
          // 发送请求
          window.parent.postMessage({
            type: 'GET_LEARNING_MEMORY',
            data: { knowledgePoint },
            requestId
          }, '*');
          
          // 监听回复
          const handler = (e) => {
            if (e.data.type === 'LEARNING_MEMORY_RESPONSE' && 
                e.data.requestId === requestId) {
              window.removeEventListener('message', handler);
              resolve(e.data.data);
            }
          };
          
          window.addEventListener('message', handler);
          
          // 超时处理
          setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve(null);
          }, 5000);
        } else {
          resolve(null);
        }
      });
    },
    
    // ========== 获取积分余额 ==========
    getCreditsBalance() {
      return new Promise((resolve, reject) => {
        if (window.parent !== window) {
          const requestId = 'credits_' + Date.now();
          
          window.parent.postMessage({
            type: 'GET_CREDITS_BALANCE',
            requestId
          }, '*');
          
          const handler = (e) => {
            if (e.data.type === 'CREDITS_BALANCE_RESPONSE' && 
                e.data.requestId === requestId) {
              window.removeEventListener('message', handler);
              resolve(e.data.data);
            }
          };
          
          window.addEventListener('message', handler);
          setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve(0);
          }, 5000);
        } else {
          resolve(0);
        }
      });
    },
    
    // ========== 检查 Pro 用户 ==========
    isProUser() {
      return new Promise((resolve) => {
        if (window.parent !== window) {
          const requestId = 'pro_' + Date.now();
          
          window.parent.postMessage({
            type: 'CHECK_PRO_USER',
            requestId
          }, '*');
          
          const handler = (e) => {
            if (e.data.type === 'PRO_USER_RESPONSE' && 
                e.data.requestId === requestId) {
              window.removeEventListener('message', handler);
              resolve(e.data.data);
            }
          };
          
          window.addEventListener('message', handler);
          setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve(false);
          }, 5000);
        } else {
          resolve(false);
        }
      });
    },
    
    // ========== 显示升级提示 ==========
    showUpgradePrompt(options) {
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'SHOW_UPGRADE_PROMPT',
          data: options
        }, '*');
      }
    },
    
    // ========== 分享内容 ==========
    shareContent(options) {
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'SHARE_CONTENT',
          data: options
        }, '*');
      }
    },
    
    // ========== 获取推荐码 ==========
    getReferralCode() {
      return new Promise((resolve) => {
        if (window.parent !== window) {
          const requestId = 'referral_' + Date.now();
          
          window.parent.postMessage({
            type: 'GET_REFERRAL_CODE',
            requestId
          }, '*');
          
          const handler = (e) => {
            if (e.data.type === 'REFERRAL_CODE_RESPONSE' && 
                e.data.requestId === requestId) {
              window.removeEventListener('message', handler);
              resolve(e.data.data);
            }
          };
          
          window.addEventListener('message', handler);
          setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve(null);
          }, 5000);
        } else {
          resolve(null);
        }
      });
    }
  };
  
  console.log('[eduNestRuntime] Initialized');
})();
</script>
`;
}

module.exports = { generateRuntimeAPIScript };
```

### 4.2 Runtime API 注入器（Renderer Engine）

**文件**：`edu/backend/src/services/rendererEngine/fixers/RuntimeAPIFixer.js`（新建）

```javascript
const { generateRuntimeAPIScript } = require('../runtime/api');

class RuntimeAPIFixer {
  constructor() {
    this.name = 'RuntimeAPIFixer';
    this.handles = ['MISSING_RUNTIME_API'];
  }
  
  canFix(issue) {
    return this.handles.includes(issue.code);
  }
  
  async fix(html, issue, context = {}) {
    const changes = [];
    let fixedHtml = html;
    
    // 检查是否已注入 Runtime API
    if (!html.includes('window.eduNestRuntime')) {
      // 在 </head> 之前注入
      if (html.includes('</head>')) {
        const runtimeScript = generateRuntimeAPIScript();
        fixedHtml = html.replace('</head>', `${runtimeScript}</head>`);
        changes.push({
          type: 'insert',
          location: '</head>',
          explanation: '注入 eduNest Runtime API'
        });
      } else {
        // 如果没有 </head>，在 <body> 之前注入
        if (html.includes('<body>')) {
          const runtimeScript = generateRuntimeAPIScript();
          fixedHtml = html.replace('<body>', `${runtimeScript}<body>`);
          changes.push({
            type: 'insert',
            location: '<body>',
            explanation: '注入 eduNest Runtime API'
          });
        }
      }
    }
    
    // 注入内容 ID 和用户 ID（用于事件追踪）
    if (context.contentId && !html.includes('__EDUNEST_CONTENT_ID__')) {
      const contentIdScript = `
<script>
  window.__EDUNEST_CONTENT_ID__ = '${context.contentId}';
  ${context.userId ? `window.__EDUNEST_USER_ID__ = '${context.userId}';` : ''}
</script>
`;
      fixedHtml = fixedHtml.replace('</head>', `${contentIdScript}</head>`);
      changes.push({
        type: 'insert',
        location: '</head>',
        explanation: '注入内容 ID 和用户 ID'
      });
    }
    
    return {
      success: changes.length > 0,
      html: fixedHtml,
      changes,
      explanation: changes.length > 0 ? '已注入 Runtime API' : 'Runtime API 已存在'
    };
  }
}

module.exports = RuntimeAPIFixer;
```

### 4.3 注册 RuntimeAPIFixer

**文件**：`edu/backend/src/services/rendererEngine/index.js`

```javascript
const RuntimeAPIFixer = require('./fixers/RuntimeAPIFixer');

function createRendererEngine(options = {}) {
  const engine = new RendererEngine(options);
  
  // 注册 Checkers
  engine.registerChecker(new WebComponentChecker());
  engine.registerChecker(new LibraryChecker());
  engine.registerChecker(new MathChecker());
  engine.registerChecker(new RuntimeChecker());
  
  // 注册 Fixers（RuntimeAPIFixer 优先级最高）
  engine.registerFixer(new RuntimeAPIFixer());  // 新增
  engine.registerFixer(new WebComponentFixer());
  engine.registerFixer(new LibraryFixer());
  engine.registerFixer(new MathFixer());
  engine.registerFixer(new RuntimeFixer());
  
  return engine;
}
```

### 4.4 前端消息监听（FullHTMLRenderer）

**文件**：`edu/frontend/src/components/FullHTMLRenderer.tsx`

```typescript
useEffect(() => {
  if (!iframeRef.current || !fullHTML) return;
  
  const iframe = iframeRef.current;
  
  // 监听来自 iframe 的消息
  const handleMessage = async (event: MessageEvent) => {
    // 安全检查
    if (event.source !== iframe.contentWindow) return;
    if (!event.data || typeof event.data !== 'object') return;
    
    const { type, data, requestId } = event.data;
    
    try {
      switch (type) {
        // ========== 学习事件上报 ==========
        case 'LEARNING_EVENT':
          await api.trackLearningEvent(data);
          break;
        
        // ========== AI Guide 请求 ==========
        case 'AI_GUIDE_REQUEST':
          // 打开 AI Guide
          if (onAIGuideRequest) {
            onAIGuideRequest(data);
          }
          break;
        
        // ========== 获取学习记忆 ==========
        case 'GET_LEARNING_MEMORY':
          try {
            const memory = await api.getLearningMemory(data.knowledgePoint);
            iframe.contentWindow?.postMessage({
              type: 'LEARNING_MEMORY_RESPONSE',
              requestId,
              data: memory
            }, '*');
          } catch (error) {
            iframe.contentWindow?.postMessage({
              type: 'LEARNING_MEMORY_RESPONSE',
              requestId,
              data: null
            }, '*');
          }
          break;
        
        // ========== 获取积分余额 ==========
        case 'GET_CREDITS_BALANCE':
          try {
            const balance = await api.getCreditsBalance();
            iframe.contentWindow?.postMessage({
              type: 'CREDITS_BALANCE_RESPONSE',
              requestId,
              data: balance
            }, '*');
          } catch (error) {
            iframe.contentWindow?.postMessage({
              type: 'CREDITS_BALANCE_RESPONSE',
              requestId,
              data: 0
            }, '*');
          }
          break;
        
        // ========== 检查 Pro 用户 ==========
        case 'CHECK_PRO_USER':
          try {
            const isPro = await api.isProUser();
            iframe.contentWindow?.postMessage({
              type: 'PRO_USER_RESPONSE',
              requestId,
              data: isPro
            }, '*');
          } catch (error) {
            iframe.contentWindow?.postMessage({
              type: 'PRO_USER_RESPONSE',
              requestId,
              data: false
            }, '*');
          }
          break;
        
        // ========== 显示升级提示 ==========
        case 'SHOW_UPGRADE_PROMPT':
          // 显示升级弹窗
          showUpgradeDialog(data);
          break;
        
        // ========== 分享内容 ==========
        case 'SHARE_CONTENT':
          // 触发分享
          handleShare(data);
          break;
        
        // ========== 获取推荐码 ==========
        case 'GET_REFERRAL_CODE':
          try {
            const code = await api.getReferralCode();
            iframe.contentWindow?.postMessage({
              type: 'REFERRAL_CODE_RESPONSE',
              requestId,
              data: code
            }, '*');
          } catch (error) {
            iframe.contentWindow?.postMessage({
              type: 'REFERRAL_CODE_RESPONSE',
              requestId,
              data: null
            }, '*');
          }
          break;
        
        default:
          console.warn('[FullHTMLRenderer] Unknown message type:', type);
      }
    } catch (error) {
      console.error('[FullHTMLRenderer] Message handling error:', error);
    }
  };
  
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [fullHTML, onAIGuideRequest]);
```

### 4.5 后端 API 接口

**文件**：`edu/backend/src/api/runtime.js`（新建）

```javascript
const express = require('express');
const router = express.Router();
const { supabase } = require('../services/database');
const { authenticate } = require('../middleware/auth');

/**
 * 追踪学习事件
 */
router.post('/learning-event', authenticate, async (req, res) => {
  try {
    const { type, payload } = req.body;
    const userId = req.user?.id;
    
    // 保存到 learning_events 表
    const { error } = await supabase
      .from('learning_events')
      .insert({
        user_id: userId,
        event_type: type,
        event_data: payload,
        created_at: new Date().toISOString()
      });
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取学习记忆
 */
router.get('/learning-memory/:knowledgePoint', authenticate, async (req, res) => {
  try {
    const { knowledgePoint } = req.params;
    const userId = req.user?.id;
    
    // 从 knowledge_mastery 表获取
    const { data, error } = await supabase
      .from('knowledge_mastery')
      .select('*')
      .eq('user_id', userId)
      .eq('knowledge_point', knowledgePoint)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    res.json({ success: true, data: data || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取积分余额
 */
router.get('/credits/balance', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // 从 user_credits 表计算余额
    const { data, error } = await supabase
      .from('user_credits')
      .select('change_amount')
      .eq('user_id', userId);
    
    if (error) throw error;
    
    const balance = data.reduce((sum, record) => sum + record.change_amount, 0);
    
    res.json({ success: true, data: balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 检查 Pro 用户
 */
router.get('/user/is-pro', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // 从 subscriptions 表检查
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('plan', 'pro')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    res.json({ success: true, data: !!data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

**注册路由**：`edu/backend/src/server.js`

```javascript
const runtimeRoutes = require('./api/runtime');
app.use('/api/runtime', runtimeRoutes);
```

### 4.6 前端 API 封装

**文件**：`edu/frontend/src/lib/api.ts`

```typescript
// 在 api 对象中添加
export const api = {
  // ... 现有方法
  
  // ========== Runtime API ==========
  runtime: {
    trackLearningEvent: async (data: any) => {
      const response = await fetch('/api/runtime/learning-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    
    getLearningMemory: async (knowledgePoint: string) => {
      const response = await fetch(`/api/runtime/learning-memory/${encodeURIComponent(knowledgePoint)}`);
      return response.json();
    },
    
    getCreditsBalance: async () => {
      const response = await fetch('/api/runtime/credits/balance');
      const result = await response.json();
      return result.data || 0;
    },
    
    isProUser: async () => {
      const response = await fetch('/api/runtime/user/is-pro');
      const result = await response.json();
      return result.data || false;
    },
    
    getReferralCode: async () => {
      const response = await fetch('/api/referrals/code');
      const result = await response.json();
      return result.data?.code || null;
    }
  }
};
```

---

## 五、业务集成

### 5.1 AI Guide 集成

#### 在 AI 生成的内容中调用

```javascript
// AI 生成的内容中
<button @click="requestHelp">需要帮助？</button>

<script>
function requestHelp() {
  window.eduNestRuntime.requestAIGuideHelp({
    context: '二次函数图像',
    question: '如何理解参数 a 对图像的影响？',
    uiState: { a: 1, b: 0, c: 0 },
    knowledgePoint: 'quadratic_function'
  });
}
</script>
```

#### 前端处理

```typescript
// FullHTMLRenderer.tsx
case 'AI_GUIDE_REQUEST':
  // 打开 AI Guide
  if (onAIGuideRequest) {
    onAIGuideRequest(data);
  } else {
    // 默认处理：打开 AI Guide 抽屉
    openAIGuideDrawer({
      initialQuestion: data.question,
      context: data.context,
      uiState: data.uiState
    });
  }
  break;
```

### 5.2 学习追踪集成

#### 在 AI 生成的内容中上报

```javascript
// AI 生成的内容中
window.eduNestRuntime.dispatchLearningEvent('parameter_change', {
  a: scope.a,
  b: scope.b,
  c: scope.c,
  knowledgePoint: 'quadratic_function'
});

// 注册交互节点
window.eduNestRuntime.registerInteractiveNode('graph', {
  type: 'canvas',
  knowledgePoint: 'quadratic_function',
  interactions: ['drag', 'zoom']
});
```

#### 后端处理

```javascript
// api/runtime.js
router.post('/learning-event', async (req, res) => {
  const { type, payload } = req.body;
  
  // 保存到 learning_events 表
  await supabase.from('learning_events').insert({
    user_id: req.user?.id,
    event_type: type,
    event_data: payload,
    created_at: new Date().toISOString()
  });
  
  res.json({ success: true });
});
```

### 5.3 积分系统集成

#### 在 AI 生成的内容中查询

```javascript
// AI 生成的内容中
const credits = await window.eduNestRuntime.getCreditsBalance();
if (credits < 10) {
  window.eduNestRuntime.showUpgradePrompt({
    reason: '积分不足',
    action: 'upgrade_to_pro'
  });
}
```

#### 前端处理

```typescript
// FullHTMLRenderer.tsx
case 'SHOW_UPGRADE_PROMPT':
  // 显示升级弹窗
  showUpgradeDialog({
    reason: data.reason,
    action: data.action
  });
  break;
```

---

## 六、实施路线图

### 阶段 1：MVP（1-2 周）

#### 任务清单

1. **创建 Runtime API 生成器**
   - [ ] 创建 `runtime/api.js`
   - [ ] 实现核心接口（`dispatchLearningEvent`, `requestAIGuideHelp`, `renderMath`）

2. **创建 RuntimeAPIFixer**
   - [ ] 创建 `fixers/RuntimeAPIFixer.js`
   - [ ] 注册到 Renderer Engine

3. **前端消息监听**
   - [ ] 更新 `FullHTMLRenderer.tsx`
   - [ ] 实现消息处理逻辑

4. **后端 API 接口**
   - [ ] 创建 `api/runtime.js`
   - [ ] 实现学习事件追踪接口

#### 验收标准

- ✅ AI 生成的内容可以调用 Runtime API
- ✅ 学习事件可以上报到后端
- ✅ AI Guide 可以从内容中打开
- ✅ 数学公式可以通过 Runtime API 渲染

---

### 阶段 2：核心功能（2-4 周）

#### 任务清单

1. **学习记忆系统**
   - [ ] 实现 `getLearningMemory` 接口
   - [ ] 后端查询 `knowledge_mastery` 表
   - [ ] 前端显示学习进度

2. **积分系统集成**
   - [ ] 实现 `getCreditsBalance` 接口
   - [ ] 实现 `showUpgradePrompt` 接口
   - [ ] 前端显示升级弹窗

3. **内容推荐**
   - [ ] 实现 `recommendNextContent` 接口
   - [ ] 基于学习记忆推荐内容

#### 验收标准

- ✅ 内容可以根据学习记忆调整
- ✅ 积分不足时自动提示升级
- ✅ 可以推荐下一步学习内容

---

### 阶段 3：增值功能（4-8 周）

#### 任务清单

1. **成就系统**
   - [ ] 实现 `checkAchievement` 接口
   - [ ] 实现 `unlockAchievement` 接口
   - [ ] 成就奖励积分

2. **社区功能**
   - [ ] 实现 `showCommunityDiscussion` 接口
   - [ ] 实现 `submitQuestion` 接口
   - [ ] 实现 `answerQuestion` 接口

3. **协作学习**
   - [ ] 实现 `joinStudyGroup` 接口
   - [ ] 实现 `syncLearningState` 接口
   - [ ] WebSocket 实时同步

---

## 七、Prompt 分层设计

### 7.1 Runtime Prompt（平台层，你写一次）

**文件**：`edu/backend/src/services/aiService.js`

```javascript
const RUNTIME_PROMPT = `
你是一个平台 Runtime 生成器。你的任务是生成一个 Web Component 容器。

要求：
1. 定义 <edu-lesson> Custom Element
2. 在 connectedCallback 中：
   - 调用 window.eduNestRuntime.renderMath(this)
   - 注册交互节点（如果有）
   - 设置事件监听
3. 使用 this.state 管理学习阶段
4. 在 disconnectedCallback 中清理资源

示例结构：
\`\`\`html
<edu-lesson></edu-lesson>
<script>
class EduLesson extends HTMLElement {
  constructor() {
    super();
    this.state = { stage: 1 };
  }
  
  connectedCallback() {
    // 注入 AI 生成的内容
    this.innerHTML = '<!-- 内容插槽 -->';
    
    // 初始化内容逻辑
    this.initContent();
    
    // 渲染数学公式
    if (window.eduNestRuntime) {
      window.eduNestRuntime.renderMath(this);
    }
  }
  
  disconnectedCallback() {
    // 清理资源
  }
}
customElements.define('edu-lesson', EduLesson);
</script>
\`\`\`
`;
```

### 7.2 Content Prompt（内容层，AI 高频使用）

**文件**：`edu/backend/src/services/aiService.js`

```javascript
const CONTENT_PROMPT = `
你是一个教学内容生成器。生成 Petite-Vue 内容。

要求：
1. 使用 Petite-Vue 的声明式语法（v-scope, v-model, @click）
2. 通过 window.eduNestRuntime 调用平台能力：
   - window.eduNestRuntime.dispatchLearningEvent() 上报事件
   - window.eduNestRuntime.requestAIGuideHelp() 请求帮助
   - window.eduNestRuntime.renderMath() 渲染数学公式
3. 不要直接操作 DOM（除了 shadowRoot 内的内容）
4. 使用 this.state 管理学习阶段（如果使用 Web Component）

数学公式：
- 内联公式：$...$
- 块级公式：$$...$$
- 在 JS 字符串中：\\\\frac, \\\\sqrt, \\\\times（双反斜杠）

示例：
\`\`\`html
<div id="app" v-scope="{ value: 0 }">
  <p>函数：$f(x) = x^2$</p>
  <input type="range" v-model="value" @input="onChange">
  <button @click="requestHelp">需要帮助？</button>
</div>
<script>
PetiteVue.createApp({
  value: 0,
  onChange() {
    window.eduNestRuntime.dispatchLearningEvent('value_change', {
      value: this.value
    });
  },
  requestHelp() {
    window.eduNestRuntime.requestAIGuideHelp({
      question: '如何理解这个函数？'
    });
  }
}).mount('#app');
</script>
\`\`\`
`;
```

### 7.3 更新 SYSTEM_PROMPT_CONTENT

**文件**：`edu/backend/src/services/aiService.js`

```javascript
const SYSTEM_PROMPT_CONTENT = {
  // ... 现有配置
  
  "architecture_constraints": {
    "web_components": {
      "mandatory": true,
      "rules": [
        "Use Custom Elements (class extends HTMLElement).",
        "Encapsulate all logic inside a single primary custom element.",
        "Use internal state (this.state) to control learning stages.",
        "DO NOT destroy or recreate DOM nodes to switch stages.",
        "DO NOT use display:none, opacity, or visibility-based hiding."
      ]
    },
    "runtime_api": {
      "mandatory": true,
      "rules": [
        "ALL platform capabilities MUST be accessed via window.eduNestRuntime API.",
        "DO NOT directly access platform features (AI Guide, Tracking, Memory).",
        "Use window.eduNestRuntime.dispatchLearningEvent() for tracking.",
        "Use window.eduNestRuntime.requestAIGuideHelp() for AI Guide.",
        "Use window.eduNestRuntime.renderMath() for math rendering."
      ]
    }
  },
  
  // ... 其他配置
};
```

---

## 八、代码示例

### 8.1 AI 生成的内容示例（使用 Runtime API）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>二次函数图像探索</title>
  <script src="https://unpkg.com/petite-vue@0.4.1/dist/petite-vue.umd.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js"></script>
</head>
<body>
  <div id="app" v-scope="{ a: 1, b: 0, c: 0 }">
    <h1>二次函数图像探索</h1>
    <p>函数：$f(x) = ax^2 + bx + c$</p>
    
    <div class="slider-container">
      <label>a = {{ a }}</label>
      <input type="range" v-model="a" min="-3" max="3" step="0.1" @input="onParameterChange">
    </div>
    
    <canvas id="graph" width="800" height="400"></canvas>
    
    <button @click="requestHelp">需要帮助？</button>
  </div>
  
  <script>
    // 初始化 Petite-Vue
    PetiteVue.createApp({
      a: 1,
      b: 0,
      c: 0,
      onParameterChange() {
        drawGraph(this.a, this.b, this.c);
        
        // 上报学习事件
        if (window.eduNestRuntime) {
          window.eduNestRuntime.dispatchLearningEvent('parameter_change', {
            a: this.a,
            b: this.b,
            c: this.c,
            knowledgePoint: 'quadratic_function'
          });
        }
      },
      async requestHelp() {
        if (window.eduNestRuntime) {
          window.eduNestRuntime.requestAIGuideHelp({
            context: '二次函数图像',
            question: '如何理解参数 a 对图像的影响？',
            uiState: { a: this.a, b: this.b, c: this.c },
            knowledgePoint: 'quadratic_function'
          });
        }
      }
    }).mount('#app');
    
    // 绘制函数图像
    function drawGraph(a, b, c) {
      const canvas = document.getElementById('graph');
      const ctx = canvas.getContext('2d');
      // ... 绘制逻辑
    }
    
    // 初始渲染
    drawGraph(1, 0, 0);
    
    // 渲染数学公式（使用 Runtime API）
    if (window.eduNestRuntime) {
      window.eduNestRuntime.renderMath(document.body);
    }
    
    // 注册交互节点
    if (window.eduNestRuntime) {
      window.eduNestRuntime.registerInteractiveNode('graph', {
        type: 'canvas',
        knowledgePoint: 'quadratic_function'
      });
    }
  </script>
</body>
</html>
```

### 7.2 Renderer Engine 处理后的代码

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>二次函数图像探索</title>
  <!-- Runtime API 已自动注入 -->
  <script>
    // ... Runtime API 代码（由 Renderer Engine 注入）
  </script>
  <script>
    window.__EDUNEST_CONTENT_ID__ = 'content_123';
    window.__EDUNEST_USER_ID__ = 'user_456';
  </script>
  <!-- ... 其他脚本 -->
</head>
<body>
  <!-- Web Component 容器（由 Renderer Engine 自动包装） -->
  <edu-lesson>
    <!-- AI 生成的内容在这里 -->
    <div id="app">...</div>
  </edu-lesson>
  
  <script>
    // Web Component 定义（由 Renderer Engine 自动注入）
    class EduLesson extends HTMLElement {
      connectedCallback() {
        // AI 生成的内容逻辑
        // Runtime API 已可用
      }
    }
    customElements.define('edu-lesson', EduLesson);
  </script>
</body>
</html>
```

---

## 八、测试清单

### 8.1 Runtime API 测试

- [ ] Runtime API 是否正确注入
- [ ] 学习事件是否可以上报
- [ ] AI Guide 是否可以打开
- [ ] 数学公式是否可以渲染
- [ ] 积分查询是否正常
- [ ] Pro 用户检查是否正常

### 8.2 业务集成测试

- [ ] AI Guide 集成是否正常
- [ ] 学习追踪是否正常
- [ ] 积分系统集成是否正常
- [ ] 推荐系统集成是否正常

### 8.3 兼容性测试

- [ ] 旧内容是否仍然可以正常显示
- [ ] 新内容是否可以使用 Runtime API
- [ ] Renderer Engine 是否自动修复问题

---

## 九、常见问题

### Q1: 旧内容如何处理？

**A**: 使用 `optimizeContentHtml.js` 批量迁移，Renderer Engine 会自动：
- 注入 Runtime API
- 包装成 Web Component
- 修复常见问题

### Q2: Runtime API 调用失败怎么办？

**A**: Runtime API 设计为**优雅降级**：
- 如果 `window.eduNestRuntime` 不存在，使用 fallback
- 如果 `postMessage` 失败，静默处理
- 所有异步调用都有超时处理

### Q3: 如何调试 Runtime API？

**A**: 
- 查看浏览器控制台的 `[eduNestRuntime]` 日志
- 检查 `postMessage` 消息是否发送
- 检查前端消息监听是否正常

---

## 九、数据库 Schema

### 9.1 learning_events 表（如果不存在）

```sql
CREATE TABLE IF NOT EXISTS learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  content_id UUID REFERENCES content(id),
  event_type TEXT NOT NULL,
  event_data JSONB,
  knowledge_point TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sequence_index INTEGER,
  time_since_last_seconds INTEGER,
  time_in_session_seconds INTEGER
);

CREATE INDEX idx_learning_events_user_id ON learning_events(user_id);
CREATE INDEX idx_learning_events_content_id ON learning_events(content_id);
CREATE INDEX idx_learning_events_knowledge_point ON learning_events(knowledge_point);
CREATE INDEX idx_learning_events_created_at ON learning_events(created_at);
```

### 9.2 knowledge_mastery 表（如果不存在）

```sql
CREATE TABLE IF NOT EXISTS knowledge_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  knowledge_point TEXT NOT NULL,
  mastery_level TEXT, -- 'beginner', 'intermediate', 'advanced'
  mastery_score NUMERIC,
  last_studied TIMESTAMP WITH TIME ZONE,
  next_review TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, knowledge_point)
);

CREATE INDEX idx_knowledge_mastery_user_id ON knowledge_mastery(user_id);
CREATE INDEX idx_knowledge_mastery_knowledge_point ON knowledge_mastery(knowledge_point);
```

---

## 十、完整实现流程

### 10.1 后端实现步骤

#### 步骤 1：创建 Runtime API 生成器

```bash
# 创建目录
mkdir -p edu/backend/src/services/rendererEngine/runtime

# 创建文件
touch edu/backend/src/services/rendererEngine/runtime/api.js
```

**文件内容**：见 [4.1 Runtime API 注入](#41-runtime-api-注入renderer-engine)

#### 步骤 2：创建 RuntimeAPIFixer

```bash
# 创建文件
touch edu/backend/src/services/rendererEngine/fixers/RuntimeAPIFixer.js
```

**文件内容**：见 [4.2 Runtime API 注入器](#42-runtime-api-注入器renderer-engine)

#### 步骤 3：注册 RuntimeAPIFixer

**文件**：`edu/backend/src/services/rendererEngine/index.js`

```javascript
const RuntimeAPIFixer = require('./fixers/RuntimeAPIFixer');

function createRendererEngine(options = {}) {
  const engine = new RendererEngine(options);
  
  // ... 现有 Checkers
  
  // 注册 Fixers（RuntimeAPIFixer 优先级最高）
  engine.registerFixer(new RuntimeAPIFixer());  // 新增
  engine.registerFixer(new WebComponentFixer());
  // ... 其他 Fixers
  
  return engine;
}
```

#### 步骤 4：创建后端 API 路由

```bash
# 创建文件
touch edu/backend/src/api/runtime.js
```

**文件内容**：见 [4.5 后端 API 接口](#45-后端-api-接口)

#### 步骤 5：注册路由

**文件**：`edu/backend/src/server.js`

```javascript
const runtimeRoutes = require('./api/runtime');
app.use('/api/runtime', runtimeRoutes);
```

### 10.2 前端实现步骤

#### 步骤 1：更新 FullHTMLRenderer

**文件**：`edu/frontend/src/components/FullHTMLRenderer.tsx`

添加消息监听逻辑（见 [4.4 前端消息监听](#44-前端消息监听fullhtmlrenderer)）

#### 步骤 2：更新 API 封装

**文件**：`edu/frontend/src/lib/api.ts`

在 `ApiClient` 类中添加 Runtime API 方法：

```typescript
class ApiClient {
  // ... 现有方法
  
  // Runtime API
  async trackLearningEvent(data: any) {
    return this.post('/runtime/learning-event', data);
  }
  
  async getLearningMemory(knowledgePoint: string) {
    return this.get(`/runtime/learning-memory/${encodeURIComponent(knowledgePoint)}`);
  }
  
  async getCreditsBalance() {
    const result = await this.get('/runtime/credits/balance');
    return result.data || 0;
  }
  
  async isProUser() {
    const result = await this.get('/runtime/user/is-pro');
    return result.data || false;
  }
  
  async getReferralCode() {
    const result = await this.get('/referrals/code');
    return result.data?.code || null;
  }
}
```

#### 步骤 3：集成 AI Guide

**文件**：`edu/frontend/src/app/c/[short_id]/page.tsx`

```typescript
// 在 FullHTMLRenderer 组件中
<FullHTMLRenderer
  fullHTML={content.full_html}
  onAIGuideRequest={(data) => {
    // 打开 AI Guide
    setAIGuideOpen(true);
    setAIGuideInitialQuestion(data.question);
    setAIGuideContext(data.context);
  }}
/>
```

---

## 十一、测试指南

### 11.1 本地测试 Runtime API

#### 创建测试 HTML

```html
<!DOCTYPE html>
<html>
<head>
  <title>Runtime API 测试</title>
</head>
<body>
  <button onclick="testRuntimeAPI()">测试 Runtime API</button>
  
  <script>
    // 模拟 Runtime API（用于测试）
    window.eduNestRuntime = {
      dispatchLearningEvent(type, payload) {
        console.log('Learning event:', type, payload);
      },
      requestAIGuideHelp(context) {
        console.log('AI Guide request:', context);
      },
      renderMath(container) {
        console.log('Render math:', container);
      }
    };
    
    function testRuntimeAPI() {
      window.eduNestRuntime.dispatchLearningEvent('test', { value: 1 });
      window.eduNestRuntime.requestAIGuideHelp({ question: '测试问题' });
    }
  </script>
</body>
</html>
```

### 11.2 集成测试

#### 测试流程

1. **生成内容**
   ```bash
   # 使用 AI 生成一个内容
   # 检查是否包含 Runtime API
   ```

2. **检查注入**
   ```bash
   # 运行 optimizeContentHtml.js
   node scripts/optimizeContentHtml.js <content_id>
   
   # 检查输出中是否包含 window.eduNestRuntime
   ```

3. **前端测试**
   - 打开内容页面
   - 打开浏览器控制台
   - 检查 `[eduNestRuntime]` 日志
   - 测试 Runtime API 调用

---

## 十二、常见问题与解决方案

### Q1: Runtime API 未注入？

**原因**：RuntimeAPIFixer 未注册或未执行

**解决方案**：
1. 检查 `index.js` 中是否注册了 `RuntimeAPIFixer`
2. 检查 Renderer Engine 是否执行了 Fixers
3. 检查 HTML 中是否已有 `window.eduNestRuntime`

### Q2: postMessage 通信失败？

**原因**：iframe 跨域或消息监听未设置

**解决方案**：
1. 检查 iframe 的 `sandbox` 属性（需要 `allow-same-origin`）
2. 检查前端消息监听是否正确设置
3. 检查消息格式是否正确

### Q3: 旧内容无法使用 Runtime API？

**原因**：旧内容生成时没有 Runtime API

**解决方案**：
```bash
# 批量迁移旧内容
node scripts/optimizeContentHtml.js --batch --all
```

### Q4: AI 生成的内容直接访问平台能力？

**原因**：Prompt 未明确要求使用 Runtime API

**解决方案**：
1. 更新 `SYSTEM_PROMPT_CONTENT`，添加 `runtime_api` 规则
2. 在 Renderer Engine 中检测并修复直接访问

---

## 十三、性能优化

### 13.1 Runtime API 脚本大小

- 当前实现：~5KB（压缩后）
- 优化建议：按需加载接口（懒加载）

### 13.2 消息通信性能

- 使用 `requestId` 避免消息冲突
- 设置超时避免内存泄漏
- 批量上报学习事件（防抖）

### 13.3 数据库查询优化

- 学习事件批量插入
- 使用索引加速查询
- 定期归档历史数据

---

## 十四、安全考虑

### 14.1 消息验证

```typescript
// FullHTMLRenderer.tsx
const handleMessage = (event: MessageEvent) => {
  // 验证消息来源
  if (event.source !== iframe.contentWindow) return;
  
  // 验证消息格式
  if (!event.data || typeof event.data !== 'object') return;
  if (!event.data.type) return;
  
  // 验证用户权限（某些接口需要登录）
  if (requiresAuth(event.data.type) && !user) {
    console.warn('Unauthorized API call');
    return;
  }
  
  // 处理消息
  // ...
};
```

### 14.2 内容隔离

- iframe 使用 `sandbox` 属性
- Web Component 使用 Shadow DOM（可选）
- Runtime API 不暴露敏感信息

---

## 十五、总结

### 核心价值

1. **统一接口**：所有平台能力通过 Runtime API 暴露
2. **自动集成**：AI 生成的内容自动获得平台能力
3. **业务扩展**：新业务功能只需扩展 Runtime API
4. **数据壁垒**：标准化的事件和数据格式

### 实施建议

1. **先实现 MVP**：核心接口（学习事件、AI Guide、数学渲染）
2. **逐步扩展**：根据业务需求添加新接口
3. **保持兼容**：确保旧内容仍然可以正常显示

### 关键文件清单

**后端**：
- `edu/backend/src/services/rendererEngine/runtime/api.js`（新建）
- `edu/backend/src/services/rendererEngine/fixers/RuntimeAPIFixer.js`（新建）
- `edu/backend/src/api/runtime.js`（新建）
- `edu/backend/src/services/rendererEngine/index.js`（更新）

**前端**：
- `edu/frontend/src/components/FullHTMLRenderer.tsx`（更新）
- `edu/frontend/src/lib/api.ts`（更新）

**Prompt**：
- `edu/backend/src/services/aiService.js`（更新 SYSTEM_PROMPT_CONTENT）

**Runtime API 是连接 AI 生成内容和平台商业化的桥梁。**


### 核心价值

1. **统一接口**：所有平台能力通过 Runtime API 暴露
2. **自动集成**：AI 生成的内容自动获得平台能力
3. **业务扩展**：新业务功能只需扩展 Runtime API
4. **数据壁垒**：标准化的事件和数据格式

### 实施建议

1. **先实现 MVP**：核心接口（学习事件、AI Guide、数学渲染）
2. **逐步扩展**：根据业务需求添加新接口
3. **保持兼容**：确保旧内容仍然可以正常显示

**Runtime API 是连接 AI 生成内容和平台商业化的桥梁。**
