/**
 * MathFixer - 数学公式自动修复器
 * 
 * 处理的问题：
 * - RENDER_CALL_MISSING: 注入 MathRenderManager
 * - STAGE_CHANGE_MATH_LOST: 注入 MathRenderManager（支持 Vue 阶段切换）
 * - RAW_TEX_DETECTED: 注入 KaTeX 库和 MathRenderManager
 * - ESCAPE_ERROR: 修复 LaTeX 转义错误
 * - V_KATEX_ESCAPE_MISSING: 修复 v-katex 指令中缺少双反斜杠的问题
 */

class MathFixer {
  constructor() {
    this.name = 'MathFixer';
    this.handles = [
      'RENDER_CALL_MISSING',
      'STAGE_CHANGE_MATH_LOST',
      'RAW_TEX_DETECTED',
      'ESCAPE_ERROR',
      'V_KATEX_ESCAPE_MISSING',
      'INJECT_KATEX_AND_RENDER'
    ];
    
    // 需要在 JS 字符串中用双反斜杠的 LaTeX 命令和特殊字符
    // 注意：特殊字符（\{, \}等）需要单独处理，不在此列表中
    this.latexCommands = [
      // 数学函数
      'sqrt', 'frac', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
      'log', 'ln', 'exp', 'lim', 'sum', 'int', 'prod', 'infty',
      // 希腊字母
      'pi', 'theta', 'alpha', 'beta', 'gamma', 'delta', 'epsilon',
      'lambda', 'sigma', 'omega', 'phi', 'psi', 'mu', 'nu', 'rho',
      // 运算符和符号
      'implies', 'text', 'triangle', 'quad', 'cdot', 'times', 'div',
      'le', 'ge', 'ne', 'lt', 'gt', 'approx', 'equiv', 'sim',
      // 格式和修饰
      'left', 'right', 'begin', 'end', 'mathbf', 'mathrm', 'mathit',
      'vec', 'hat', 'bar', 'dot', 'ddot', 'overline', 'underline',
      'partial', 'nabla', 'prime', 'degree', 'angle', 'perp', 'parallel',
      // 集合和逻辑
      'pm', 'mp', 'cap', 'cup', 'subset', 'supset', 'in', 'notin',
      'forall', 'exists', 'neg', 'land', 'lor', 'to', 'gets', 'mapsto',
      'mid', 'Delta'
    ];
  }
  
  /**
   * 检查是否能修复这个问题
   */
  canFix(issue) {
    return this.handles.includes(issue.code);
  }
  
  /**
   * 执行修复
   */
  async fix(html, issue, context = {}) {
    switch (issue.code) {
      case 'RENDER_CALL_MISSING':
      case 'STAGE_CHANGE_MATH_LOST':
        return this.injectMathRenderManager(html, context);
        
      case 'RAW_TEX_DETECTED':
      case 'INJECT_KATEX_AND_RENDER':
        return this.injectKatexAndRenderManager(html, context);
        
      case 'ESCAPE_ERROR':
        return this.fixEscapeErrors(html, issue.context?.errors || []);
        
      case 'V_KATEX_ESCAPE_MISSING':
        return this.fixVKatexEscapes(html);
        
      default:
        return { success: false, html, changes: [], explanation: '未知的问题类型' };
    }
  }
  
  /**
   * 注入 MathRenderManager（核心方案）
   */
  injectMathRenderManager(html, context = {}) {
    const changes = [];
    let fixedHtml = html;
    const hasMathRenderManager = html.includes('MathRenderManager');
    
    // MathRenderManager 依赖 auto-render.min.js，即使 MathRenderManager 已存在也要检查依赖
    if (!html.includes('auto-render') && !html.includes('auto-render.min.js')) {
      const autoRenderJS = '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js" onerror="this.onerror=null; this.src=\'https://tubban1.oss-cn-beijing.aliyuncs.com/static/lib/auto-render.min.js\'"></script>';
      
      // 找到 katex.min.js 后面插入
      if (fixedHtml.includes('katex.min.js')) {
        fixedHtml = fixedHtml.replace(
          /(<script[^>]*katex\.min\.js[^>]*><\/script>)/i,
          `$1\n    ${autoRenderJS}`
        );
        changes.push({
          type: 'insert',
          location: 'after katex.min.js',
          after: autoRenderJS,
          reason: '注入 KaTeX auto-render 库（MathRenderManager 依赖）'
        });
      } else {
        // 如果没有 katex.min.js，尝试在 head 末尾插入
        if (fixedHtml.includes('</head>')) {
          fixedHtml = fixedHtml.replace('</head>', `    ${autoRenderJS}\n</head>`);
          changes.push({
            type: 'insert',
            location: '</head>',
            after: autoRenderJS,
            reason: '注入 KaTeX auto-render 库（MathRenderManager 依赖）'
          });
        }
      }
    }
    
    // 如果 MathRenderManager 已存在，只检查依赖即可
    if (hasMathRenderManager) {
      return {
        success: changes.length > 0,
        html: fixedHtml,
        changes,
        explanation: changes.length > 0 ? 'MathRenderManager 已存在，已注入缺失的 auto-render 库' : 'MathRenderManager 和依赖都已存在'
      };
    }
    
    // 检测项目特性
    const isVue = html.includes('vue.global') || html.includes('createApp') || html.includes('Vue.');
    const isThreeJS = html.includes('three') || html.includes('THREE');
    const hasStages = /v-if\s*=\s*["'][^"']*stage/i.test(html);
    
    // 注入 MathRenderManager
    const mathRenderManagerScript = this.generateMathRenderManager(isVue, isThreeJS, hasStages);
    
    // 找到 </body> 标签前插入
    // 注意：使用函数替换避免 $$ 和 $' 被 replace() 特殊处理
    if (fixedHtml.includes('</body>')) {
      fixedHtml = fixedHtml.replace('</body>', () => `${mathRenderManagerScript}\n</body>`);
      changes.push({
        type: 'insert',
        location: '</body>',
        after: 'MathRenderManager',
        reason: '注入数学公式渲染管理器'
      });
    } else {
      // 如果没有 </body>，追加到末尾
      fixedHtml += mathRenderManagerScript;
      changes.push({
        type: 'insert',
        location: 'end',
        after: 'MathRenderManager',
        reason: '注入数学公式渲染管理器'
      });
    }
    
    // 如果是 Three.js 项目，注入 Three.js 集成
    if (isThreeJS) {
      const threeIntegration = this.generateThreeJSIntegration();
      
      // 在 Three.js 脚本后插入
      const threeScriptMatch = fixedHtml.match(/<script[^>]*three[^>]*><\/script>/i);
      if (threeScriptMatch) {
        const insertPoint = threeScriptMatch.index + threeScriptMatch[0].length;
        fixedHtml = fixedHtml.slice(0, insertPoint) + '\n' + threeIntegration + fixedHtml.slice(insertPoint);
        changes.push({
          type: 'insert',
          location: 'after Three.js script',
          after: 'Three.js CSS2D/CSS3D integration',
          reason: '注入 Three.js 数学公式渲染集成'
        });
      }
    }
    
    return {
      success: true,
      html: fixedHtml,
      changes,
      explanation: this.generateExplanation(isVue, isThreeJS, hasStages)
    };
  }
  
  /**
   * 注入 KaTeX 库和 MathRenderManager
   */
  injectKatexAndRenderManager(html, context = {}) {
    const changes = [];
    let fixedHtml = html;
    
    // 1. 检查并注入 KaTeX CSS
    if (!html.includes('katex') || !html.includes('.css')) {
      const katexCSS = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">';
      
      if (fixedHtml.includes('</head>')) {
        fixedHtml = fixedHtml.replace('</head>', `${katexCSS}\n</head>`);
      } else if (fixedHtml.includes('<body')) {
        fixedHtml = fixedHtml.replace(/<body/, `<head>${katexCSS}</head>\n<body`);
      }
      
      changes.push({
        type: 'insert',
        location: '</head>',
        after: katexCSS,
        reason: '注入 KaTeX CSS 样式'
      });
    }
    
    // 2. 检查并注入 KaTeX JS
    if (!html.includes('katex.min.js')) {
      const katexJS = '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js"></script>';
      
      if (fixedHtml.includes('</body>')) {
        fixedHtml = fixedHtml.replace('</body>', `${katexJS}\n</body>`);
      }
      
      changes.push({
        type: 'insert',
        location: '</body>',
        after: katexJS,
        reason: '注入 KaTeX JavaScript 库'
      });
    }
    
    // 3. 单独检查并注入 auto-render.min.js（MathRenderManager 依赖它）
    if (!html.includes('auto-render')) {
      const autoRenderJS = '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js"></script>';
      
      // 找到 katex.min.js 后面插入，或者插入到 </body> 前
      if (fixedHtml.includes('katex.min.js')) {
        fixedHtml = fixedHtml.replace(
          /(<script[^>]*katex\.min\.js[^>]*><\/script>)/i,
          `$1\n${autoRenderJS}`
        );
      } else if (fixedHtml.includes('</body>')) {
        fixedHtml = fixedHtml.replace('</body>', `${autoRenderJS}\n</body>`);
      }
      
      changes.push({
        type: 'insert',
        location: 'after katex.min.js',
        after: autoRenderJS,
        reason: '注入 KaTeX auto-render 库（用于自动渲染 $...$ 公式）'
      });
    }
    
    // 4. 注入 MathRenderManager
    const renderResult = this.injectMathRenderManager(fixedHtml, context);
    fixedHtml = renderResult.html;
    changes.push(...renderResult.changes);
    
    return {
      success: true,
      html: fixedHtml,
      changes,
      explanation: '自动注入 KaTeX 数学公式渲染库和 MathRenderManager'
    };
  }
  
  /**
   * 修复 LaTeX 转义错误
   */
  fixEscapeErrors(html, errors) {
    const changes = [];
    let fixedHtml = html;
    
    for (const error of errors) {
      if (error.pattern && error.suggestion) {
        fixedHtml = fixedHtml.replace(error.pattern, error.suggestion);
        changes.push({
          type: 'replace',
          location: `position ${error.position}`,
          before: error.pattern,
          after: error.suggestion,
          reason: '修复 LaTeX 转义错误'
        });
      }
    }
    
    return {
      success: changes.length > 0,
      html: fixedHtml,
      changes,
      explanation: `修复了 ${changes.length} 处 LaTeX 转义错误`
    };
  }
  
  /**
   * 修复 v-katex 指令中缺少双反斜杠的问题
   * 
   * 问题：在 JavaScript 字符串中，\sqrt 会被解析为 sqrt（因为 \s 不是有效转义）
   * 解决：将 \cmd 替换为 \\cmd
   * 
   * 例如：
   * - 修复前：v-katex="'a = 2\sqrt{3}'"
   * - 修复后：v-katex="'a = 2\\sqrt{3}'"
   */
  fixVKatexEscapes(html) {
    const changes = [];
    let fixedHtml = html;
    let fixCount = 0;
    
    // 匹配 v-katex="'...'" 或 v-katex='"..."' 模式
    const vKatexPattern = /v-katex\s*=\s*["'](['"`])([^'"`]*)\1["']/g;
    
    fixedHtml = fixedHtml.replace(vKatexPattern, (fullMatch, quote, content) => {
      let fixedContent = content;
      let localFixes = 0;
      
      // 对每个 LaTeX 命令进行修复
      for (const cmd of this.latexCommands) {
        // 跳过特殊字符（它们需要单独处理）
        if (cmd.startsWith('\\')) {
          continue;
        }
        
        // 使用临时标记方法：先保护双反斜杠的命令，再替换单反斜杠的
        const tempMarker = `__TEMP_DOUBLE_BS_${cmd}__`;
        const doubleBackslashPattern = new RegExp(`\\\\\\\\${cmd}(?![a-zA-Z])`, 'g');
        
        // 先用临时标记保护双反斜杠的命令
        fixedContent = fixedContent.replace(doubleBackslashPattern, tempMarker);
        
        // 替换所有单反斜杠的命令为双反斜杠
        const singleBackslashRegex = new RegExp(`\\\\(${cmd})(?![a-zA-Z])`, 'g');
        const beforeFix = fixedContent;
        fixedContent = fixedContent.replace(singleBackslashRegex, (m, cmdName) => {
          return `\\\\${cmdName}`;
        });
        
        // 恢复临时标记为双反斜杠
        fixedContent = fixedContent.replace(new RegExp(tempMarker, 'g'), `\\\\${cmd}`);
        
        if (fixedContent !== beforeFix) {
          const matches = beforeFix.match(singleBackslashRegex) || [];
          localFixes += matches.length;
        }
      }
      
      // 特殊处理：修复 \{ 和 \} 等特殊字符
      // 在 HTML 源码中，\{ 会被解析为 {，所以我们需要检测单独的 { 
      // 但更准确的是：检测后面跟着 { 或 } 的单反斜杠（不是双反斜杠）
      const specialChars = ['{', '}', '[', ']', '(', ')'];
      for (const char of specialChars) {
        // 匹配单反斜杠 + 特殊字符，但排除双反斜杠的情况
        // 例如：\{ 需要修复为 \\{，但 \\{ 保持不变
        const escapedChar = char.replace(/[{}[\]()]/g, '\\$&');
        const doubleBackslashPattern = new RegExp(`\\\\\\\\${escapedChar}`, 'g');
        const tempMarker = `__TEMP_SPECIAL_${char.charCodeAt(0)}__`;
        
        // 保护双反斜杠的特殊字符
        fixedContent = fixedContent.replace(doubleBackslashPattern, tempMarker);
        
        // 替换单反斜杠的特殊字符
        const singleBackslashPattern = new RegExp(`\\\\(${escapedChar})`, 'g');
        const beforeFix = fixedContent;
        fixedContent = fixedContent.replace(singleBackslashPattern, (m, ch) => {
          return `\\\\${ch}`;
        });
        
        // 恢复临时标记
        fixedContent = fixedContent.replace(new RegExp(tempMarker, 'g'), `\\\\${char}`);
        
        if (fixedContent !== beforeFix) {
          const matches = beforeFix.match(singleBackslashPattern) || [];
          localFixes += matches.length;
        }
      }
      
      if (localFixes > 0) {
        fixCount += localFixes;
        changes.push({
          type: 'replace',
          location: `v-katex directive`,
          before: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
          after: fixedContent.substring(0, 50) + (fixedContent.length > 50 ? '...' : ''),
          reason: `修复了 ${localFixes} 处 LaTeX 命令的转义`
        });
      }
      
      return `v-katex="${quote}${fixedContent}${quote}"`;
    });
    
    return {
      success: fixCount > 0,
      html: fixedHtml,
      changes,
      explanation: `修复了 ${fixCount} 处 v-katex 指令中的 LaTeX 命令转义（将 \\cmd 改为 \\\\cmd）`
    };
  }
  
  /**
   * 生成 MathRenderManager 脚本
   */
  generateMathRenderManager(isVue, isThreeJS, hasStages) {
    // 注意：使用字符串拼接避免 $$ 在模板字符串中被误解析
    const dollarDouble = '$' + '$';
    const dollarSingle = '$';
    
    return `
<script>
(function() {
  'use strict';
  
  // ========== Math Render Manager ==========
  window.MathRenderManager = {
    initialized: false,
    observer: null,
    debounceTimer: null,
    
    // 渲染配置
    config: {
      delimiters: [
        {left: '` + dollarDouble + `', right: '` + dollarDouble + `', display: true},
        {left: '` + dollarSingle + `', right: '` + dollarSingle + `', display: false},
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
      
      ${isVue ? '// 3. Vue 集成\n      this.setupVueIntegration();' : ''}
      
      console.log('[MathRenderManager] Initialized');
    },
    
    // 渲染指定元素或全局
    render: function(element) {
      if (typeof renderMathInElement === 'undefined') {
        console.warn('[MathRenderManager] renderMathInElement not loaded');
        return;
      }
      
      var target = element || document.body;
      
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
    
    // 延迟渲染（带防抖）
    renderDeferred: function(element, delay) {
      var self = this;
      delay = delay || 50;
      
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      
      this.debounceTimer = setTimeout(function() {
        self.render(element);
      }, delay);
    },
    
    // 手动刷新（供外部调用）
    refresh: function(element) {
      this.renderDeferred(element, 0);
    },
    
    // 设置 MutationObserver
    setupObserver: function() {
      var self = this;
      
      if (typeof MutationObserver === 'undefined') return;
      
      this.observer = new MutationObserver(function(mutations) {
        var needsRender = false;
        var renderTargets = new Set();
        
        mutations.forEach(function(mutation) {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(function(node) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                var text = node.textContent || '';
                if (self.mightContainMath(text)) {
                  needsRender = true;
                  renderTargets.add(node);
                }
              }
            });
          }
        });
        
        if (needsRender) {
          renderTargets.forEach(function(target) {
            self.renderDeferred(target);
          });
        }
      });
      
      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    },
    
    // 检查文本是否可能包含数学公式
    mightContainMath: function(text) {
      if (!text) return false;
      return /\\$[^$]+\\$|\\\\\\[|\\\\\\(|\\\\frac|\\\\sum|\\\\int/.test(text);
    }${isVue ? `,
    
    // Vue 集成
    setupVueIntegration: function() {
      var self = this;
      
      if (typeof Vue === 'undefined') return;
      
      // Vue 3 全局 mixin
      if (Vue.version && Vue.version.startsWith('3')) {
        // 注意：在生产环境中不建议使用全局 mixin
        // 这里只是作为备用方案
        console.log('[MathRenderManager] Vue 3 detected, using MutationObserver for updates');
      }
    }` : ''}
  };
  
  // ========== 自动初始化 ==========
  function waitForKaTeX(callback) {
    if (typeof renderMathInElement !== 'undefined') {
      callback();
    } else {
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
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      waitForKaTeX(function() { window.MathRenderManager.init(); });
    });
  } else {
    waitForKaTeX(function() { window.MathRenderManager.init(); });
  }
})();
</script>`;
  }
  
  /**
   * 生成 Three.js 集成脚本
   */
  generateThreeJSIntegration() {
    return `
<script>
(function() {
  // Three.js CSS2D/CSS3D 集成
  if (typeof THREE === 'undefined') return;
  
  var originalCSS2DRenderer = THREE.CSS2DRenderer;
  var originalCSS3DRenderer = THREE.CSS3DRenderer;
  
  if (originalCSS2DRenderer) {
    THREE.CSS2DRenderer = function() {
      var renderer = new originalCSS2DRenderer();
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
  }
  
  /**
   * 生成解释说明
   */
  generateExplanation(isVue, isThreeJS, hasStages) {
    const parts = ['注入 MathRenderManager 统一管理数学公式渲染'];
    
    if (isVue) parts.push('支持 Vue 响应式更新');
    if (isThreeJS) parts.push('支持 Three.js CSS2D/CSS3D 渲染器');
    if (hasStages) parts.push('支持 v-if 阶段切换');
    
    return parts.join('，');
  }
}

module.exports = MathFixer;
