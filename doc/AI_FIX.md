# Renderer Engine - 内容渲染与自动修复系统

> Product Requirements Document  
> Version: 2.0  
> Last Updated: 2026-01-17

---

## 一、架构概述

### 1.1 设计理念

```
检测 → 自动修复 → 验证 → 应用
```

**核心变化：**
- 将 `aiService.js` 中的库替换、fallback 逻辑独立为 **Library Service**
- 新建 **Renderer Engine** 负责检测和自动修复
- **纯本地自动修复**，无需 AI 介入

### 1.2 系统架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Renderer Engine                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐         │
│   │  Math Fixer     │   │  Runtime Fixer  │   │ Library Fixer   │         │
│   │  (KaTeX 渲染)   │   │  (音频/内存)    │   │  (CDN/Fallback) │         │
│   └────────┬────────┘   └────────┬────────┘   └────────┬────────┘         │
│            │                     │                     │                   │
│            └─────────────────────┼─────────────────────┘                   │
│                                  ▼                                         │
│                        ┌─────────────────┐                                 │
│                        │  Render Report  │                                 │
│                        │  + Fixed HTML   │                                 │
│                        └────────┬────────┘                                 │
│                                 │                                          │
│                    ┌────────────┴────────────┐                             │
│                    ▼                         ▼                             │
│           ┌─────────────────┐       ┌─────────────────┐                    │
│           │ 自动修复成功     │       │ 无法修复        │                    │
│           │ → 直接应用      │       │ → 记录到报告    │                    │
│           └─────────────────┘       └─────────────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 文件结构

```
edu/backend/src/services/
├── rendererEngine/
│   ├── index.js                 # 主入口
│   ├── RendererEngine.js        # 核心引擎类
│   ├── checkers/
│   │   ├── MathChecker.js       # 数学公式检测
│   │   └── RuntimeChecker.js    # 运行时问题检测（音频/内存）
│   ├── fixers/
│   │   ├── MathFixer.js         # 数学公式自动修复
│   │   ├── RuntimeFixer.js      # 运行时问题修复
│   │   └── LibraryFixer.js      # 库引用自动修复
│   └── types.ts                 # TypeScript 类型定义
├── libraryService/
│   ├── index.js                 # 主入口
│   ├── LibraryResolver.js       # 库解析器
│   └── FallbackManager.js       # 回退管理器
└── aiService.js                 # AI 生成服务（不变）
```

---

## 二、Renderer Engine 核心

### 2.1 主流程

```typescript
interface RenderResult {
  success: boolean;
  html: string;                    // 修复后的 HTML
  report: RenderReport;            // 检测报告
  fixes: FixRecord[];              // 应用的修复记录
  unfixedIssues: Issue[];          // 无法自动修复的问题
}

class RendererEngine {
  async process(html: string, options?: RenderOptions): Promise<RenderResult> {
    // 1. 检测阶段
    const checkResults = await this.runCheckers(html);
    
    // 2. 自动修复阶段
    const fixResults = await this.runFixers(html, checkResults);
    
    // 3. 验证阶段（重新检测修复后的 HTML）
    const verifyResults = await this.runCheckers(fixResults.html);
    
    // 4. 生成报告
    return {
      success: verifyResults.issues.length === 0,
      html: fixResults.html,
      report: this.generateReport(checkResults, verifyResults, fixResults),
      fixes: fixResults.appliedFixes,
      unfixedIssues: verifyResults.issues  // 记录无法修复的问题
    };
  }
}
```

### 2.2 Checker 接口

```typescript
interface Checker {
  name: string;
  priority: number;                // 执行优先级
  
  check(html: string, dom?: JSDOM): Promise<CheckResult>;
}

interface CheckResult {
  issues: Issue[];
  metadata: Record<string, any>;   // 额外信息供 Fixer 使用
}

interface Issue {
  type: 'math' | 'canvas' | 'component' | 'library' | 'error';
  code: string;                    // 问题代码
  severity: 'high' | 'medium' | 'low';
  message: string;
  location?: string;
  fixable: boolean;                // 是否可自动修复
  fixStrategy?: string;            // 推荐的修复策略
  context?: Record<string, any>;   // 上下文信息
}
```

### 2.3 Fixer 接口

```typescript
interface Fixer {
  name: string;
  handles: string[];               // 处理的 issue codes
  
  canFix(issue: Issue): boolean;
  fix(html: string, issue: Issue, context: FixContext): Promise<FixResult>;
  verify(html: string, issue: Issue): Promise<boolean>;
}

interface FixResult {
  success: boolean;
  html: string;
  changes: Change[];
  explanation: string;
}

interface Change {
  type: 'insert' | 'replace' | 'delete';
  location: string;
  before?: string;
  after?: string;
  reason: string;
}
```

---

## 三、Math Fixer - 数学公式自动修复

### 3.1 AI 生成后可能出现的 Math 问题

> ⚠️ AI 生成时会正确引入 KaTeX 库，但可能遗漏 **渲染调用** 或 **阶段切换重渲染**

| Code | 描述 | 频率 | 可自动修复 |
|------|------|------|-----------|
| `RENDER_CALL_MISSING` | 缺少 renderMathInElement 调用 | **高** | ✅ |
| `STAGE_CHANGE_MATH_LOST` | v-if 阶段切换后公式不重渲染 | **高** | ✅ |
| `RAW_TEX_DETECTED` | TeX 语法未被渲染 | 中 | ✅ |
| `ESCAPE_ERROR` | LaTeX 转义错误（\\\\sin vs \\sin） | 低 | ✅ |

### 3.2 自动修复策略

```typescript
class MathFixer implements Fixer {
  name = 'MathFixer';
  handles = [
    'RENDER_CALL_MISSING',       // 最常见
    'STAGE_CHANGE_MATH_LOST',    // v-if 切换问题
    'RAW_TEX_DETECTED',          // TeX 未渲染
    'ESCAPE_ERROR'               // 转义错误
  ];

  private strategies: Record<string, FixStrategy> = {
    // 策略 1: 注入 KaTeX 库
    'KATEX_MISSING': {
      priority: 1,
      fix: (html) => this.injectKaTeX(html)
    },
    
    // 策略 2: 添加 renderMathInElement 调用
    'RENDER_CALL_MISSING': {
      priority: 2,
      fix: (html) => this.injectRenderCall(html)
    },
    
    // 策略 3: 修复定界符
    'DELIMITER_MISMATCH': {
      priority: 3,
      fix: (html, context) => this.fixDelimiters(html, context)
    },
    
    // 策略 4: 修复 LaTeX 转义
    'ESCAPE_ERROR': {
      priority: 4,
      fix: (html, context) => this.fixEscapes(html, context)
    },
    
    // 策略 5: 修复 v-katex 语法
    'V_KATEX_SYNTAX_ERROR': {
      priority: 5,
      fix: (html, context) => this.fixVKatexSyntax(html, context)
    }
  };
}
```

### 3.3 KaTeX 注入实现

```typescript
private injectKaTeX(html: string): FixResult {
  const katexCSS = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">';
  const katexJS = '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js"></script>';
  const autoRenderJS = '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js"></script>';
  
  let fixedHtml = html;
  const changes: Change[] = [];
  
  // 检查是否已有 KaTeX CSS
  if (!html.includes('katex') || !html.includes('.css')) {
    fixedHtml = fixedHtml.replace('</head>', `${katexCSS}\n</head>`);
    changes.push({
      type: 'insert',
      location: '</head>',
      after: katexCSS,
      reason: '注入 KaTeX CSS 样式'
    });
  }
  
  // 检查是否已有 KaTeX JS
  if (!html.includes('katex.min.js')) {
    fixedHtml = fixedHtml.replace('</body>', `${katexJS}\n${autoRenderJS}\n</body>`);
    changes.push({
      type: 'insert',
      location: '</body>',
      after: `${katexJS}\n${autoRenderJS}`,
      reason: '注入 KaTeX JavaScript 库'
    });
  }
  
  return {
    success: true,
    html: fixedHtml,
    changes,
    explanation: '自动注入 KaTeX 数学公式渲染库'
  };
}
```

### 3.4 渲染时机问题分析

**复杂场景：Vue + Three.js + KaTeX 混合使用**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           渲染时机问题                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Vue 生命周期        Three.js 初始化         KaTeX 渲染                     │
│  ─────────────       ──────────────          ───────────                    │
│  beforeMount         scene 创建              库加载                         │
│       ↓                  ↓                      ↓                           │
│  mounted ────────────→ renderer 创建 ←──────── 首次渲染                     │
│       ↓                  ↓                      ↓                           │
│  nextTick            animate loop            DOM 更新后重渲染               │
│       ↓                  ↓                      ↓                           │
│  v-if 切换 ──────────→ CSS2D/CSS3D ←─────────── 重渲染                      │
│       ↓                  ↓                      ↓                           │
│  响应式更新          scene 更新               重渲染                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

问题：简单的 setTimeout(100) 无法处理以下场景：
1. v-if 切换后公式消失
2. 响应式数据变化后新公式未渲染
3. Three.js CSS2DRenderer 中的公式
4. 动态加载的内容
```

### 3.5 Math Render Manager（核心方案）

**设计目标**：统一管理数学公式渲染，处理所有渲染时机

```typescript
// MathRenderManager - 注入到生成的 HTML 中
const MATH_RENDER_MANAGER = `
<script>
(function() {
  'use strict';
  
  // ========== Math Render Manager ==========
  window.MathRenderManager = {
    initialized: false,
    renderQueue: [],
    observer: null,
    
    // 渲染配置
    config: {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\\\[', right: '\\\\]', display: true},
        {left: '\\\\(', right: '\\\\)', display: false}
      ],
      throwOnError: false,
      errorColor: '#cc0000',
      strict: false
    },
    
    // 初始化
    init: function() {
      if (this.initialized) return;
      this.initialized = true;
      
      // 1. 初始渲染
      this.renderAll();
      
      // 2. 设置 MutationObserver 监听 DOM 变化
      this.setupObserver();
      
      // 3. 监听 Vue 路由/状态变化（如果存在）
      this.setupVueIntegration();
      
      console.log('[MathRenderManager] Initialized');
    },
    
    // 渲染指定元素或全局
    render: function(element) {
      if (typeof renderMathInElement === 'undefined') {
        console.warn('[MathRenderManager] renderMathInElement not loaded');
        return;
      }
      
      const target = element || document.body;
      
      try {
        renderMathInElement(target, this.config);
      } catch (e) {
        console.error('[MathRenderManager] Render error:', e);
      }
    },
    
    // 渲染全局
    renderAll: function() {
      this.render(document.body);
    },
    
    // 延迟渲染（用于 Vue nextTick 后）
    renderDeferred: function(element, delay) {
      delay = delay || 0;
      var self = this;
      
      if (delay > 0) {
        setTimeout(function() { self.render(element); }, delay);
      } else {
        // 使用 requestAnimationFrame 确保 DOM 已更新
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            self.render(element);
          });
        });
      }
    },
    
    // 设置 MutationObserver
    setupObserver: function() {
      var self = this;
      
      // 检查是否支持 MutationObserver
      if (typeof MutationObserver === 'undefined') return;
      
      // 防抖函数
      var debounceTimer = null;
      var debouncedRender = function(target) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
          self.render(target);
        }, 50);
      };
      
      this.observer = new MutationObserver(function(mutations) {
        var needsRender = false;
        var renderTargets = new Set();
        
        mutations.forEach(function(mutation) {
          // 检查是否有新增的文本节点可能包含公式
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(function(node) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // 检查是否包含可能的公式标记
                var text = node.textContent || '';
                if (self.mightContainMath(text)) {
                  needsRender = true;
                  renderTargets.add(node);
                }
              }
            });
          }
          
          // 检查属性变化（v-if 切换等）
          if (mutation.type === 'attributes') {
            var text = mutation.target.textContent || '';
            if (self.mightContainMath(text)) {
              needsRender = true;
              renderTargets.add(mutation.target);
            }
          }
        });
        
        if (needsRender) {
          // 只渲染变化的部分，而非整个 body
          renderTargets.forEach(function(target) {
            debouncedRender(target);
          });
        }
      });
      
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    },
    
    // 检查文本是否可能包含数学公式
    mightContainMath: function(text) {
      if (!text) return false;
      // 检查常见的数学标记
      return /\\$[^$]+\\$|\\\\\\[|\\\\\\(|\\\\frac|\\\\sum|\\\\int/.test(text);
    },
    
    // Vue 集成
    setupVueIntegration: function() {
      var self = this;
      
      // 检查是否存在 Vue
      if (typeof Vue === 'undefined') return;
      
      // 创建全局 mixin，在每次更新后重新渲染公式
      Vue.mixin({
        updated: function() {
          // 使用 nextTick 确保 DOM 已更新
          this.$nextTick(function() {
            self.renderDeferred(this.$el);
          });
        }
      });
      
      console.log('[MathRenderManager] Vue integration enabled');
    },
    
    // 手动触发渲染（供外部调用）
    refresh: function(element) {
      this.renderDeferred(element);
    },
    
    // 销毁
    destroy: function() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      this.initialized = false;
    }
  };
  
  // ========== 自动初始化 ==========
  
  // 等待 KaTeX 和 auto-render 加载完成
  function waitForKaTeX(callback) {
    if (typeof renderMathInElement !== 'undefined') {
      callback();
    } else {
      // 最多等待 5 秒
      var attempts = 0;
      var maxAttempts = 50;
      var interval = setInterval(function() {
        attempts++;
        if (typeof renderMathInElement !== 'undefined') {
          clearInterval(interval);
          callback();
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          console.warn('[MathRenderManager] KaTeX not loaded after 5s');
        }
      }, 100);
    }
  }
  
  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      waitForKaTeX(function() {
        window.MathRenderManager.init();
      });
    });
  } else {
    waitForKaTeX(function() {
      window.MathRenderManager.init();
    });
  }
})();
</script>`;
```

### 3.6 Three.js CSS2D/CSS3D 集成

**问题**：Three.js 的 CSS2DRenderer/CSS3DRenderer 会创建独立的 DOM 容器，KaTeX 需要渲染这些容器中的公式。

```typescript
// Three.js 集成补丁
const THREEJS_MATH_INTEGRATION = `
<script>
(function() {
  // 检查是否存在 Three.js
  if (typeof THREE === 'undefined') return;
  
  // 保存原始的 CSS2DRenderer
  var originalCSS2DRenderer = THREE.CSS2DRenderer;
  var originalCSS3DRenderer = THREE.CSS3DRenderer;
  
  // 包装 CSS2DRenderer
  if (originalCSS2DRenderer) {
    THREE.CSS2DRenderer = function() {
      var renderer = new originalCSS2DRenderer();
      var originalRender = renderer.render.bind(renderer);
      
      renderer.render = function(scene, camera) {
        originalRender(scene, camera);
        
        // 渲染后触发公式渲染
        if (window.MathRenderManager && renderer.domElement) {
          window.MathRenderManager.renderDeferred(renderer.domElement, 16);
        }
      };
      
      return renderer;
    };
  }
  
  // 包装 CSS3DRenderer
  if (originalCSS3DRenderer) {
    THREE.CSS3DRenderer = function() {
      var renderer = new originalCSS3DRenderer();
      var originalRender = renderer.render.bind(renderer);
      
      renderer.render = function(scene, camera) {
        originalRender(scene, camera);
        
        if (window.MathRenderManager && renderer.domElement) {
          window.MathRenderManager.renderDeferred(renderer.domElement, 16);
        }
      };
      
      return renderer;
    };
  }
  
  console.log('[MathRenderManager] Three.js CSS2D/CSS3D integration enabled');
})();
</script>`;
```

### 3.7 Vue v-if 切换处理

**问题**：v-if 切换会销毁和重建 DOM，新创建的元素中的公式需要重新渲染。

```typescript
// Vue 阶段切换集成
const VUE_STAGE_INTEGRATION = `
<script>
(function() {
  // 检查是否存在 Vue 3
  if (typeof Vue === 'undefined' || !Vue.version || !Vue.version.startsWith('3')) return;
  
  // 创建 v-math 指令（替代 v-katex，支持响应式）
  var mathDirective = {
    mounted: function(el, binding) {
      if (typeof katex !== 'undefined' && binding.value) {
        try {
          el.innerHTML = katex.renderToString(binding.value, {
            throwOnError: false,
            displayMode: binding.modifiers.display || false
          });
        } catch (e) {
          el.innerHTML = binding.value;
          console.error('[v-math] Render error:', e);
        }
      }
    },
    updated: function(el, binding) {
      // 值变化时重新渲染
      if (binding.value !== binding.oldValue) {
        if (typeof katex !== 'undefined' && binding.value) {
          try {
            el.innerHTML = katex.renderToString(binding.value, {
              throwOnError: false,
              displayMode: binding.modifiers.display || false
            });
          } catch (e) {
            el.innerHTML = binding.value;
          }
        }
      }
    }
  };
  
  // 创建通用的阶段切换辅助函数
  window.mathAwareSetStage = function(app, newStage) {
    // 如果 app 有 currentStage 响应式变量
    if (app.currentStage !== undefined) {
      app.currentStage = newStage;
    }
    
    // 使用 nextTick 确保 DOM 更新后重新渲染公式
    Vue.nextTick(function() {
      if (window.MathRenderManager) {
        window.MathRenderManager.refresh();
      }
    });
  };
  
  // 暴露指令供应用注册
  window.VueMathDirective = mathDirective;
  
  console.log('[MathRenderManager] Vue stage integration ready');
})();
</script>`;
```

### 3.8 完整的 renderMathInElement 注入

```typescript
private injectRenderCall(html: string): FixResult {
  // 检测项目类型
  const isVue = html.includes('vue.global') || html.includes('createApp');
  const isThreeJS = html.includes('three') || html.includes('THREE');
  const hasStages = html.includes('v-if') && (html.includes('stage') || html.includes('currentStage'));
  
  const changes: Change[] = [];
  let fixedHtml = html;
  
  // 1. 始终注入 MathRenderManager（核心）
  fixedHtml = fixedHtml.replace('</body>', `${MATH_RENDER_MANAGER}\n</body>`);
  changes.push({
    type: 'insert',
    location: '</body>',
    after: 'MathRenderManager',
    reason: '注入数学公式渲染管理器（支持动态更新）'
  });
  
  // 2. 如果是 Three.js 项目，注入 Three.js 集成
  if (isThreeJS) {
    // 需要在 Three.js 加载后、使用前注入
    const threeScriptMatch = fixedHtml.match(/<script[^>]*three[^>]*><\/script>/i);
    if (threeScriptMatch) {
      const insertPoint = threeScriptMatch.index + threeScriptMatch[0].length;
      fixedHtml = fixedHtml.slice(0, insertPoint) + '\n' + THREEJS_MATH_INTEGRATION + fixedHtml.slice(insertPoint);
      changes.push({
        type: 'insert',
        location: 'after Three.js script',
        after: 'Three.js CSS2D/CSS3D integration',
        reason: '注入 Three.js 数学公式渲染集成'
      });
    }
  }
  
  // 3. 如果是 Vue 多阶段项目，注入阶段切换集成
  if (isVue && hasStages) {
    fixedHtml = fixedHtml.replace('</body>', `${VUE_STAGE_INTEGRATION}\n</body>`);
    changes.push({
      type: 'insert',
      location: '</body>',
      after: 'Vue stage integration',
      reason: '注入 Vue v-if 阶段切换数学公式渲染支持'
    });
    
    // 同时修复 v-katex 为 v-math（更可靠）
    if (html.includes('v-katex')) {
      // 建议用户迁移到 v-math，但不强制修改
      console.log('[MathFixer] 建议：将 v-katex 迁移到 v-math 指令以获得更好的响应式支持');
    }
  }
  
  return {
    success: true,
    html: fixedHtml,
    changes,
    explanation: this.generateExplanation(isVue, isThreeJS, hasStages)
  };
}

private generateExplanation(isVue: boolean, isThreeJS: boolean, hasStages: boolean): string {
  const parts = ['注入 MathRenderManager 统一管理数学公式渲染'];
  
  if (isVue) parts.push('支持 Vue 响应式更新');
  if (isThreeJS) parts.push('支持 Three.js CSS2D/CSS3D 渲染器');
  if (hasStages) parts.push('支持 v-if 阶段切换');
  
  return parts.join('，');
}
```

### 3.5 定界符修复

```typescript
private fixDelimiters(html: string, context: { detected: string[], expected: string[] }): FixResult {
  let fixedHtml = html;
  const changes: Change[] = [];
  
  // 常见问题：v-katex 中使用了 $ 定界符
  // 错误: v-katex="'$x^2$'"
  // 正确: v-katex="'x^2'"
  const vKatexWithDelimiters = /v-katex=["'](['"]\$[^$]+\$['"])["']/g;
  fixedHtml = fixedHtml.replace(vKatexWithDelimiters, (match, content) => {
    const fixed = content.replace(/^\$|\$$/g, '').replace(/^['"]|['"]$/g, '');
    changes.push({
      type: 'replace',
      location: match,
      before: match,
      after: `v-katex="'${fixed}'"`,
      reason: 'v-katex 指令不需要 $ 定界符'
    });
    return `v-katex="'${fixed}'"`;
  });
  
  return {
    success: changes.length > 0,
    html: fixedHtml,
    changes,
    explanation: '修复数学公式定界符语法'
  };
}
```

---

## 四、Canvas Fixer - Canvas 自动修复

### 4.1 检测的问题类型

| Code | 描述 | 可自动修复 |
|------|------|-----------|
| `EMPTY_CANVAS` | Canvas 为空白 | ⚠️ 部分 |
| `CANVAS_CONTEXT_FAIL` | 无法获取 context | ⚠️ 部分 |
| `CANVAS_NOT_FOUND` | Canvas 元素不存在 | ❌ |
| `DRAW_BEFORE_MOUNT` | 在 DOM 挂载前绑定 | ✅ |
| `RESIZE_HANDLER_MISSING` | 缺少响应式处理 | ✅ |

### 4.2 自动修复策略

```typescript
class CanvasFixer implements Fixer {
  name = 'CanvasFixer';
  handles = ['EMPTY_CANVAS', 'DRAW_BEFORE_MOUNT', 'RESIZE_HANDLER_MISSING'];

  private strategies: Record<string, FixStrategy> = {
    // 策略 1: 包装 Canvas 初始化到 onMounted
    'DRAW_BEFORE_MOUNT': {
      priority: 1,
      fix: (html, context) => this.wrapInOnMounted(html, context)
    },
    
    // 策略 2: 添加 nextTick 等待
    'EMPTY_CANVAS': {
      priority: 2,
      fix: (html, context) => this.addNextTickWait(html, context)
    },
    
    // 策略 3: 添加 resize 监听
    'RESIZE_HANDLER_MISSING': {
      priority: 3,
      fix: (html) => this.addResizeHandler(html)
    }
  };
}
```

### 4.3 Canvas 初始化修复

```typescript
private wrapInOnMounted(html: string, context: { canvasId: string }): FixResult {
  // 检测是否已经在 onMounted 中
  const hasOnMounted = html.includes('onMounted');
  
  if (!hasOnMounted) {
    // 如果没有 onMounted，添加一个
    const initScript = `
onMounted(() => {
  nextTick(() => {
    const canvas = document.getElementById('${context.canvasId}');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Canvas 初始化代码
        initCanvas(ctx, canvas);
      }
    }
  });
});`;
    
    // 找到合适的位置插入
    const setupMatch = html.match(/setup\s*\(\s*\)\s*\{/);
    if (setupMatch) {
      // 在 setup 函数末尾插入
      // ... 实现细节
    }
  }
  
  return {
    success: true,
    html,
    changes: [],
    explanation: '将 Canvas 初始化代码包装到 onMounted 中'
  };
}
```

---

## 五、运行时问题 Checker & Fixer

> 针对 AI 生成代码后**真正可能出现**的运行时问题

### 5.1 AI 生成后可能出现的问题

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   AI 生成后的常见运行时问题                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ❌ 不会出现                           ✅ 可能出现                            │
│  ─────────────                         ───────────                          │
│  • 加载顺序错误（AI 会正确排序）        • KaTeX 公式未渲染                    │
│  • 多个 Canvas 库冲突                   • v-if 切换后公式消失                 │
│  • CSS 框架冲突（AI 只用 Tailwind）     • Canvas 初始化时机问题               │
│  • 命名空间冲突                         • 音频自动播放被阻止（浏览器限制）     │
│                                        • Three.js 资源未释放（内存泄漏）     │
│                                        • GSAP 动画未清理                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 需要检测的问题（精简版）

| Code | 类别 | 描述 | 频率 | 可修复 |
|------|------|------|------|--------|
| **Math 渲染（最常见）** |
| `RAW_TEX_DETECTED` | Math | TeX 语法未渲染 | 高 | ✅ |
| `RENDER_CALL_MISSING` | Math | 缺少 renderMathInElement | 高 | ✅ |
| `STAGE_CHANGE_MATH_LOST` | Math | v-if 切换后公式消失 | 高 | ✅ |
| **Canvas 初始化** |
| `EMPTY_CANVAS` | Canvas | Canvas 为空白 | 中 | ⚠️ |
| `CANVAS_INIT_TIMING` | Canvas | DOM 未就绪时初始化 | 中 | ✅ |
| **浏览器限制** |
| `AUDIO_AUTOPLAY_BLOCKED` | Audio | 音频自动播放被阻止 | 中 | ✅ |
| **内存泄漏** |
| `THREE_DISPOSE_MISSING` | Memory | Three.js 资源未释放 | 中 | ✅ |
| `GSAP_ANIMATION_LEAK` | Memory | GSAP 动画未清理 | 低 | ✅ |

### 5.3 Runtime Checker（精简版）

```typescript
class RuntimeChecker implements Checker {
  name = 'RuntimeChecker';
  priority = 2;
  
  async check(html: string): Promise<CheckResult> {
    const issues: Issue[] = [];
    
    // 1. 检测使用的库
    const hasKatex = html.includes('katex');
    const hasThree = html.includes('THREE') || html.includes('three');
    const hasGsap = html.includes('gsap');
    const hasTone = html.includes('Tone');
    const hasHowler = html.includes('Howler');
    const hasVueStages = html.includes('v-if') && html.includes('stage');
    
    // 2. KaTeX 检查（最常见问题）
    if (hasKatex) {
      // 检查是否有 renderMathInElement 调用
      if (!html.includes('renderMathInElement')) {
        issues.push({
          type: 'math',
          code: 'RENDER_CALL_MISSING',
          severity: 'high',
          message: '使用了 KaTeX 但未检测到 renderMathInElement 调用',
          fixable: true,
          fixStrategy: 'INJECT_MATH_RENDER_MANAGER'
        });
      }
      
      // 检查 v-if 阶段切换后是否重新渲染公式
      if (hasVueStages && !html.includes('MathRenderManager') && !html.includes('nextTick')) {
        issues.push({
          type: 'math',
          code: 'STAGE_CHANGE_MATH_LOST',
          severity: 'high',
          message: 'v-if 阶段切换后公式可能不会重新渲染',
          fixable: true,
          fixStrategy: 'INJECT_MATH_RENDER_MANAGER'
        });
      }
    }
    
    // 3. 音频检查（浏览器限制）
    if (hasTone || hasHowler) {
      // 检查是否有用户交互触发音频的代码
      const hasUserInteraction = html.includes('click') || html.includes('touchstart');
      const hasToneStart = html.includes('Tone.start()');
      
      if (!hasUserInteraction || !hasToneStart) {
        issues.push({
          type: 'audio',
          code: 'AUDIO_AUTOPLAY_BLOCKED',
          severity: 'medium',
          message: '音频可能因浏览器自动播放策略被阻止',
          fixable: true,
          fixStrategy: 'INJECT_AUDIO_HANDLER'
        });
      }
    }
    
    // 4. Three.js 内存泄漏检查
    if (hasThree) {
      const hasDispose = html.includes('.dispose()');
      const hasCleanup = html.includes('onUnmounted') || html.includes('beforeUnmount');
      
      if (!hasDispose || !hasCleanup) {
        issues.push({
          type: 'memory',
          code: 'THREE_DISPOSE_MISSING',
          severity: 'medium',
          message: 'Three.js 项目未检测到资源清理代码',
          fixable: true,
          fixStrategy: 'INJECT_THREE_CLEANUP'
        });
      }
    }
    
    // 5. GSAP 动画清理检查
    if (hasGsap) {
      const hasKill = html.includes('killTweensOf') || html.includes('killAll');
      
      if (!hasKill) {
        issues.push({
          type: 'memory',
          code: 'GSAP_ANIMATION_LEAK',
          severity: 'low',
          message: 'GSAP 动画未检测到清理代码',
          fixable: true,
          fixStrategy: 'INJECT_GSAP_CLEANUP'
        });
      }
    }
    
    return { issues, metadata: { hasKatex, hasThree, hasGsap, hasTone, hasHowler } };
  }
}
```

### 5.4 Runtime Fixer（精简版）

```typescript
class RuntimeFixer implements Fixer {
  name = 'RuntimeFixer';
  handles = [
    'RENDER_CALL_MISSING',
    'STAGE_CHANGE_MATH_LOST',
    'AUDIO_AUTOPLAY_BLOCKED',
    'THREE_DISPOSE_MISSING',
    'GSAP_ANIMATION_LEAK'
  ];
  
  // 策略 1: 注入 MathRenderManager（见第三章）
  // 策略 2: 注入音频用户交互处理
  private injectAudioHandler(html: string): FixResult {
    const audioHandler = `
<script>
// Audio Autoplay Handler
(function() {
  let resumed = false;
  const resume = async () => {
    if (resumed) return;
    if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
      await Tone.start();
    }
    if (typeof Howler !== 'undefined' && Howler.ctx?.state !== 'running') {
      Howler.ctx.resume();
    }
    resumed = true;
  };
  ['click', 'touchstart', 'keydown'].forEach(e => 
    document.addEventListener(e, resume, { once: true })
  );
})();
</script>`;
    return {
      success: true,
      html: html.replace('</body>', `${audioHandler}\n</body>`),
      changes: [{ type: 'insert', reason: '音频自动播放处理' }],
      explanation: '注入用户交互监听，解决浏览器音频自动播放限制'
    };
  }
  
  // 策略 3: 注入 Three.js 清理
  private injectThreeCleanup(html: string): FixResult {
    const cleanup = `
<script>
// Three.js Auto Cleanup
window.addEventListener('beforeunload', () => {
  if (typeof THREE !== 'undefined') {
    // 遍历所有 renderer 并释放
    document.querySelectorAll('canvas').forEach(canvas => {
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
      if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
    });
  }
});
</script>`;
    return {
      success: true,
      html: html.replace('</body>', `${cleanup}\n</body>`),
      changes: [{ type: 'insert', reason: 'Three.js 资源清理' }],
      explanation: '注入页面卸载时的 WebGL 资源释放'
    };
  }
  
  // 策略 4: 注入 GSAP 清理
  private injectGsapCleanup(html: string): FixResult {
    const cleanup = `
<script>
// GSAP Auto Cleanup
window.addEventListener('beforeunload', () => {
  if (typeof gsap !== 'undefined') gsap.killTweensOf('*');
});
</script>`;
    return {
      success: true,
      html: html.replace('</body>', `${cleanup}\n</body>`),
      changes: [{ type: 'insert', reason: 'GSAP 动画清理' }],
      explanation: '注入页面卸载时的 GSAP 动画清理'
    };
  }
}
```

---

## 六、Library Fixer - 库引用自动修复

### 6.1 从 aiService 独立的逻辑

将以下函数从 `aiService.js` 移到独立模块：

```typescript
// 原 aiService.js 中的函数 → 新位置
extractLibraryInfo()      → libraryService/LibraryResolver.js
findReplacementUrl()      → libraryService/LibraryResolver.js
generateFallbackUrl()     → libraryService/FallbackManager.js
replaceLibrariesInHtml()  → rendererEngine/fixers/LibraryFixer.js
```

### 6.2 Library Fixer 实现

```typescript
class LibraryFixer implements Fixer {
  name = 'LibraryFixer';
  handles = ['CDN_UNREACHABLE', 'LIBRARY_VERSION_MISMATCH', 'DUPLICATE_LIBRARY'];
  
  private resolver: LibraryResolver;
  private fallbackManager: FallbackManager;
  
  constructor() {
    this.resolver = new LibraryResolver();
    this.fallbackManager = new FallbackManager();
  }
  
  async fix(html: string, issue: Issue): Promise<FixResult> {
    let fixedHtml = html;
    const changes: Change[] = [];
    
    // 1. 替换为推荐的 CDN
    fixedHtml = this.replaceToRecommendedCDN(fixedHtml, changes);
    
    // 2. 添加 fallback onerror
    fixedHtml = this.addFallbackHandlers(fixedHtml, changes);
    
    // 3. 修复重复库引用
    fixedHtml = this.deduplicateLibraries(fixedHtml, changes);
    
    return {
      success: true,
      html: fixedHtml,
      changes,
      explanation: '优化库引用并添加容错机制'
    };
  }
  
  private replaceToRecommendedCDN(html: string, changes: Change[]): string {
    // 从 aiService 移植的 replaceLibrariesInHtml 逻辑
    // ...
  }
  
  private addFallbackHandlers(html: string, changes: Change[]): string {
    // 为所有外部脚本添加 onerror fallback
    // ...
  }
}
```

### 6.3 Library Service 独立

```typescript
// libraryService/index.js
const LibraryResolver = require('./LibraryResolver');
const FallbackManager = require('./FallbackManager');

module.exports = {
  LibraryResolver,
  FallbackManager,
  
  // 便捷方法
  resolveLibrary: (url) => new LibraryResolver().resolve(url),
  getFallbackUrl: (libraryInfo) => new FallbackManager().getFallback(libraryInfo)
};
```

```typescript
// libraryService/LibraryResolver.js
class LibraryResolver {
  private supportedLibraries: Map<string, LibraryConfig>;
  
  constructor() {
    this.loadConfig();
  }
  
  resolve(url: string): ResolvedLibrary | null {
    const info = this.extractLibraryInfo(url);
    if (!info) return null;
    
    return {
      ...info,
      recommended: this.findRecommendedUrl(info),
      fallback: this.fallbackManager.getFallback(info)
    };
  }
  
  // 从 aiService 移植
  private extractLibraryInfo(url: string): LibraryInfo | null {
    // ... 原 extractLibraryInfo 逻辑
  }
}
```

---

## 七、Render Report 结构

### 7.1 完整报告结构

```typescript
interface RenderReport {
  // 元信息
  id: string;
  contentId: string;
  createdAt: string;
  engineVersion: string;
  
  // 检测结果
  checks: {
    math: MathCheckResult;
    canvas: CanvasCheckResult;
    library: LibraryCheckResult;
    component: ComponentCheckResult;
  };
  
  // 修复结果
  fixes: {
    applied: FixRecord[];
    failed: FixRecord[];
    skipped: FixRecord[];
  };
  
  // 汇总
  summary: {
    status: 'pass' | 'warning' | 'error';
    issuesDetected: number;
    issuesFixed: number;
    issuesRemaining: number;
  };
  
  // 最终 HTML（修复后）
  fixedHtml?: string;
}
```

### 7.2 示例报告

```json
{
  "id": "report-uuid-123",
  "contentId": "content-uuid-456",
  "createdAt": "2026-01-17T10:30:00Z",
  "engineVersion": "2.0.0",
  
  "checks": {
    "math": {
      "hasRenderedMath": false,
      "hasRawTex": true,
      "rawTexCount": 3,
      "issues": [
        {
          "code": "KATEX_MISSING",
          "severity": "high",
          "fixable": true,
          "fixStrategy": "INJECT_KATEX"
        },
        {
          "code": "RENDER_CALL_MISSING",
          "severity": "high",
          "fixable": true,
          "fixStrategy": "INJECT_RENDER_CALL"
        }
      ]
    },
    "canvas": {
      "canvasCount": 1,
      "blankCount": 0,
      "issues": []
    }
  },
  
  "fixes": {
    "applied": [
      {
        "issueCode": "KATEX_MISSING",
        "strategy": "INJECT_KATEX",
        "success": true,
        "changes": [
          {
            "type": "insert",
            "location": "</head>",
            "after": "<link rel=\"stylesheet\" href=\"...katex.min.css\">"
          }
        ]
      },
      {
        "issueCode": "RENDER_CALL_MISSING",
        "strategy": "INJECT_RENDER_CALL",
        "success": true
      }
    ],
    "failed": [],
    "skipped": []
  },
  
  "summary": {
    "status": "pass",
    "issuesDetected": 2,
    "issuesFixed": 2,
    "issuesRemaining": 0
  }
}
```

---

## 八、集成到内容生成流程

### 8.1 生成后自动处理

```typescript
// asyncGenerationQueue.js 中的集成
async function processTask(task) {
  // 1. AI 生成内容
  const aiResult = await aiService.generateEducationalContent(task.params);
  
  if (!aiResult.success) {
    return handleFailure(task, aiResult.error);
  }
  
  // 2. 通过 Renderer Engine 自动修复
  const rendererEngine = new RendererEngine();
  const renderResult = await rendererEngine.process(aiResult.data.full_html, {
    autoFix: true,
    checkers: ['math', 'runtime', 'library']
  });
  
  // 3. 使用修复后的 HTML
  const finalHtml = renderResult.html;
  
  // 4. 保存报告（可选）
  if (renderResult.fixes.length > 0) {
    await saveRenderReport(task.contentId, renderResult.report);
  }
  
  // 5. 更新内容
  await updateContent(task.contentId, {
    full_html: finalHtml,
    render_status: renderResult.summary.status
  });
}
```

### 8.2 手动触发修复（可选）

```typescript
// API: POST /api/render/fix
async function handleFixRequest(req, res) {
  const { contentId, issues } = req.body;
  
  // 获取当前内容
  const content = await getContent(contentId);
  
  // 创建 Renderer Engine 实例
  const engine = new RendererEngine();
  
  // 尝试自动修复指定问题
  const result = await engine.fixSpecificIssues(content.full_html, issues);
  
  if (result.success) {
    await updateContent(contentId, { full_html: result.html });
  }
  
  return res.json({ 
    success: result.success, 
    fixedCount: result.fixes.length,
    unfixedCount: result.unfixedIssues.length,
    report: result.report 
  });
}
```

---

## 九、aiService 重构

### 9.1 移出的代码

从 `aiService.js` 中移出以下函数到独立模块：

```javascript
// 移到 libraryService/
- extractLibraryInfo()
- findReplacementUrl()
- generateFallbackUrl()
- replaceLibrariesInHtml()
```

### 9.2 aiService 保持不变

```javascript
// aiService.js 继续负责 AI 生成
module.exports = {
  generateEducationalContent,
  generateSimpleContent,
  logAIUsageWithDefaults,
  updateExistingLog,
  safeReplace
};
```

---

## 十、数据模型

### 10.1 数据库 Schema

```sql
-- 渲染报告表（可选，用于记录修复历史）
CREATE TABLE render_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content(id),
  
  -- 引擎信息
  engine_version TEXT NOT NULL,
  
  -- 检测结果
  checks JSONB NOT NULL,
  
  -- 修复结果
  fixes JSONB DEFAULT '[]',
  
  -- 汇总
  status TEXT NOT NULL,           -- pass / warning / error
  issues_detected INT DEFAULT 0,
  issues_fixed INT DEFAULT 0,
  issues_remaining INT DEFAULT 0,
  
  -- 时间
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_content FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
);

CREATE INDEX idx_render_reports_content ON render_reports(content_id);
CREATE INDEX idx_render_reports_status ON render_reports(status);
```

> 注：fix_records 表暂不需要，因为修复是自动应用的。

### 10.2 TypeScript 类型

```typescript
// 检测结果
interface CheckResult {
  issues: Issue[];
  metadata: Record<string, any>;
}

interface Issue {
  type: 'math' | 'canvas' | 'component' | 'library' | 'error';
  code: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  location?: string;
  fixable: boolean;
  fixStrategy?: string;
  context?: Record<string, any>;
}

// 修复结果
interface FixResult {
  success: boolean;
  html: string;
  changes: Change[];
  explanation: string;
}

interface Change {
  type: 'insert' | 'replace' | 'delete';
  location: string;
  before?: string;
  after?: string;
  reason: string;
}

// 渲染报告
interface RenderReport {
  id: string;
  contentId: string;
  createdAt: string;
  engineVersion: string;
  checks: Record<string, CheckResult>;
  fixes: {
    applied: FixRecord[];
    failed: FixRecord[];
    skipped: FixRecord[];
  };
  summary: ReportSummary;
  fixedHtml?: string;
}
```

---

## 十一、API 设计

### 11.1 Render Engine APIs

```
# 触发检测（可选，一般自动执行）
POST /api/render/check
{
  "contentId": "uuid",
  "checkers": ["math", "runtime", "library"]  // 可选，默认全部
}

# 触发自动修复（可选，一般自动执行）
POST /api/render/fix
{
  "contentId": "uuid",
  "issues": ["RENDER_CALL_MISSING"]  // 可选，默认修复全部
}

# 获取报告（可选）
GET /api/render/report/:contentId
```

> 注：通常 Renderer Engine 在内容生成后自动执行，无需手动调用 API。

---

## 十二、实施计划

### Phase 1: 核心 Fixer（3-4 天）

| 任务 | 优先级 | 预估工时 |
|------|--------|----------|
| 创建 rendererEngine 目录结构 | P0 | 0.5d |
| 实现 RendererEngine 核心类 | P0 | 0.5d |
| MathFixer（RENDER_CALL_MISSING、STAGE_CHANGE_MATH_LOST）| P0 | 1d |
| RuntimeFixer（音频、内存清理）| P1 | 0.5d |
| 集成到 asyncGenerationQueue | P0 | 0.5d |

### Phase 2: Library Service 迁移（2 天）

| 任务 | 优先级 | 预估工时 |
|------|--------|----------|
| 从 aiService 迁移 Library 逻辑 | P0 | 1d |
| LibraryFixer 实现 | P0 | 0.5d |
| 测试验证 | P0 | 0.5d |

---

## 十三、验收标准

### 13.1 自动修复验收

| 测试项 | 预期结果 |
|--------|----------|
| 缺少 renderMathInElement | ✅ 自动注入 MathRenderManager |
| v-if 阶段切换后公式消失 | ✅ 自动添加 MutationObserver |
| 使用音频库（Tone.js/Howler） | ✅ 自动注入用户交互处理 |
| 使用 Three.js | ✅ 自动注入资源清理代码 |
| 使用 GSAP | ✅ 自动注入动画清理代码 |

### 13.2 集成验收

| 测试项 | 预期结果 |
|--------|----------|
| 内容生成后自动处理 | ✅ 自动运行 Renderer Engine |
| 修复后内容正常显示 | ✅ 公式、动画、音频正常 |
| Library 逻辑已迁移 | ✅ aiService 精简完成 |

---

## 附录

### A. Issue Codes 精简列表

> 只保留 AI 生成后**真正可能出现**且**可自动修复**的问题

| Code | Type | Severity | Description |
|------|------|----------|-------------|
| **Math 渲染（最常见）** |
| `RENDER_CALL_MISSING` | math | high | 缺少 renderMathInElement 调用 |
| `STAGE_CHANGE_MATH_LOST` | math | high | v-if 切换后公式不重渲染 |
| `RAW_TEX_DETECTED` | math | medium | 未渲染的 TeX 语法 |
| **浏览器限制** |
| `AUDIO_AUTOPLAY_BLOCKED` | audio | medium | 音频被浏览器阻止自动播放 |
| **内存泄漏** |
| `THREE_DISPOSE_MISSING` | memory | medium | Three.js 资源未释放 |
| `GSAP_ANIMATION_LEAK` | memory | low | GSAP 动画未清理 |

### B. 术语表

| 术语 | 定义 |
|------|------|
| Renderer Engine | 负责检测和自动修复渲染问题的核心引擎 |
| Checker | 问题检测器，负责发现特定类型的问题 |
| Fixer | 问题修复器，负责自动修复特定类型的问题 |
| Fix Strategy | 修复策略，定义如何修复特定问题 |
| Library Service | 库管理服务，从 aiService 独立的库处理逻辑 |
| Render Report | 渲染报告，包含检测和修复结果 |
