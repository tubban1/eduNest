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

const MathChecker = require('../checkers/MathChecker');

class MathFixer {
  constructor() {
    this.name = 'MathFixer';
    this.handles = [
      'RENDER_CALL_MISSING',
      'STAGE_CHANGE_MATH_LOST',
      'RAW_TEX_DETECTED',
      'ESCAPE_ERROR',
      'V_KATEX_ESCAPE_MISSING',
      'V_KATEX_RENDER_TO_STRING',
      'INJECT_KATEX_AND_RENDER',
      'EMPTY_RENDER_FUNCTION',
      'HTML_TEXT_DOUBLE_BACKSLASH',
      'LATEX_SINGLE_BACKSLASH_IN_SCRIPT'
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
      // 度数与角度符号（常见：^\\circ）
      'circ',
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
        // 注意：ESCAPE_ERROR 修复已被 V_KATEX_ESCAPE_MISSING 替代
        // 因为 fixEscapeErrors 会修改整个 HTML，包括 HTML 文本中的 $...$ 公式
        // 现在使用 fixVKatexEscapes 只修复 v-katex 属性中的转义问题
        // return this.fixEscapeErrors(html, issue.context?.errors || []);
        return { success: false, html, changes: [], explanation: 'ESCAPE_ERROR 修复已禁用，使用 V_KATEX_ESCAPE_MISSING 替代' };
        
      case 'V_KATEX_ESCAPE_MISSING':
        return this.fixVKatexEscapes(html);
        
      case 'V_KATEX_RENDER_TO_STRING':
        return this.fixVKatexRenderToString(html, issue);
        
      case 'EMPTY_RENDER_FUNCTION':
        return this.removeEmptyRenderFunction(html);
        
      case 'HTML_TEXT_DOUBLE_BACKSLASH':
        return this.fixHtmlTextDoubleBackslash(html, issue);
        
      case 'LATEX_SINGLE_BACKSLASH_IN_SCRIPT':
        return this.fixScriptContentLatexEscapes(html);
        
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
    
    // 检测项目特性（与 MathChecker.detectVueStages 保持一致）
    const isVue = html.includes('vue.global') || html.includes('createApp') || html.includes('Vue.');
    const isThreeJS = html.includes('three') || html.includes('THREE');
    const hasStages = /v-if\s*=\s*["'][^"']*stage/i.test(html) ||
      /v-show\s*=\s*["'][^"']*currentStage/i.test(html) ||
      /v-html\s*=\s*["'][^"']*stages\[/i.test(html) ||
      /v-for\s*=\s*["'][^"']*in\s+stages/i.test(html) ||
      (/\bcurrentStageIndex\b/.test(html) && /\bstages\b/.test(html));
    
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
    
    // 注入后，将空的/占位符 renderMath 替换为调用 MathRenderManager（阶段切换时公式才能重渲染）
    fixedHtml = this.patchEmptyRenderMath(fixedHtml, changes);
    // 自定义 renderMath 里 katex.renderToString(formula,...) 收到的 formula 可能含 &lt;/&gt;（v-html 转义），需解码后再传给 KaTeX
    fixedHtml = this.patchKatexRenderToStringDecodeEntities(fixedHtml, changes);
    
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
    let matchCount = 0; // 记录匹配到的 v-katex 属性数量
    
    // 匹配 v-katex="'...'" 或 v-katex='"..."' 模式
    const vKatexPattern = /v-katex\s*=\s*["'](['"`])([^'"`]*)\1["']/g;
    
    // 先统计匹配数量
    const allMatches = html.match(vKatexPattern);
    matchCount = allMatches ? allMatches.length : 0;
    
    fixedHtml = fixedHtml.replace(vKatexPattern, (fullMatch, quote, content) => {
      let fixedContent = content;
      let localFixes = 0;
      
      // 简化修复逻辑：统一处理所有 text 相关的问题
      // 目标：确保所有 text 命令在 HTML 中都是 \\\\text{（这样在 JavaScript 中就是 \\text{）
      // 策略：收集所有需要修复的位置，然后从后往前统一替换
      
      const fixes = [];
      
      // 1. 查找 ext{（已被解析的命令，前面不是 \\text）
      const extPattern = /ext\s*\{/g;
      let extMatch;
      while ((extMatch = extPattern.exec(fixedContent)) !== null) {
        const matchIndex = extMatch.index;
        const beforeText = fixedContent.substring(Math.max(0, matchIndex - 6), matchIndex);
        // 如果不是 \\\\text 或 \\text，则需要修复
        if (!beforeText.endsWith('\\\\text') && !beforeText.endsWith('\\text')) {
          fixes.push({
            index: matchIndex,
            length: extMatch[0].length,
            replacement: '\\\\text{'
          });
        }
      }
      
      // 2. 查找 \\text{（单反斜杠，在 HTML 中，前面不是 \\）
      const singleBackslashPattern = /\\text\{/g;
      let singleMatch;
      while ((singleMatch = singleBackslashPattern.exec(fixedContent)) !== null) {
        const matchIndex = singleMatch.index;
        const beforeChar = matchIndex > 0 ? fixedContent[matchIndex - 1] : '';
        // 如果前面不是反斜杠，则需要修复（单反斜杠的情况）
        if (beforeChar !== '\\') {
          fixes.push({
            index: matchIndex,
            length: singleMatch[0].length,
            replacement: '\\\\text{'
          });
        }
      }
      
      // 3. 从后往前统一替换，避免索引问题
      fixes.sort((a, b) => b.index - a.index); // 按索引从大到小排序
      let newContent = fixedContent;
      for (const fix of fixes) {
        newContent = newContent.substring(0, fix.index) + fix.replacement + 
                    newContent.substring(fix.index + fix.length);
        localFixes++;
      }
      fixedContent = newContent;
      
      // 第二步：移除所有 \\t（在 HTML 源码中，\\t 是字面的反斜杠加 t，会被解析为 \t 制表符）
      // 用户说"应该只需要 \t"，这意味着代码中不应该有 \\t，应该只有 \t
      // 但在 HTML 源码中，\t 会被解析为制表符，而制表符不应该出现在 LaTeX 公式中
      // 所以，最好的做法是直接移除 \\t，避免在公式中出现制表符
      fixedContent = fixedContent.replace(/\\\\t/g, '');
      
      // 第三步：修复已被 JavaScript 解析后的命令（没有反斜杠）
      // 例如：\div → div, \frac → rac (因为 \d 和 \f 不是有效转义)
      // 使用共享的解析命令模式定义，确保与检测器完全一致
      // 注意：必须与检测器使用完全相同的正则表达式，替换字符串也必须是匹配的
      const parsedCommandPatterns = MathChecker.getParsedCommandPatterns();
      const parsedCommandFixes = {
        'div': {
          pattern: /\bdiv(\s*)([=0-9])/g,
          replacement: '\\\\div$1$2'
        },
        'frac': {
          pattern: parsedCommandPatterns['frac'],
          replacement: (match, p1) => {
            // 如果 p1 是制表符，不保留它；否则保留 p1
            return (p1 === '\t' ? '' : p1) + '\\\\frac{';
          }
        },
        'sqrt': {
          pattern: parsedCommandPatterns['sqrt'],
          replacement: (match, p1) => {
            // 如果 p1 是制表符，不保留它；否则保留 p1
            return (p1 === '\t' ? '' : p1) + '\\\\sqrt{';
          }
        },
        'text': {
          pattern: parsedCommandPatterns['text'],
          replacement: (match, p1) => {
            // 如果 p1 是制表符或字面的 \t 字符串，不保留它；否则保留 p1
            // 这样可以避免在公式中出现 \t 字符
            // 注意：p1 可能是制表符字符（\t）或空字符串（匹配到开头）
            if (p1 === '\t' || p1 === '\\t' || p1 === '') {
              return '\\\\text{';
            }
            return p1 + '\\\\text{';
          }
        },
        'times': {
          pattern: parsedCommandPatterns['times'],
          replacement: (match, p1) => {
            // 如果 p1 是制表符或字面的 \t 字符串，不保留它；否则保留 p1
            if (p1 === '\t' || p1 === '\\t' || p1 === '') {
              return '\\\\times';
            }
            return p1 + '\\\\times';
          }
        },
        'approx': {
          pattern: parsedCommandPatterns['approx'],
          replacement: '$1\\\\approx'  // 匹配 (^|[^\\])approx → $1\\approx
        },
        'ln': {
          pattern: parsedCommandPatterns['ln'],
          replacement: '$1\\\\ln'  // 匹配 (^|[^\\])ln → $1\\ln
        },
        'prod': {
          pattern: parsedCommandPatterns['prod'],
          replacement: '$1\\\\prod'  // 匹配 (^|[^\\])prod → $1\\prod
        }
      };
      
      for (const [cmd, fix] of Object.entries(parsedCommandFixes)) {
        // 总是修复已解析的命令（rac, sqrt, ext 等）
        // 即使内容中已经有正确的转义（\\frac），也可能同时存在未转义的（\frac 被解析为 rac）
        // 例如：v-katex="'\\frac{x}{y} + \frac{a}{b}'" 中既有 \\frac 也有 rac
        const beforeFix = fixedContent;
        
        // 如果 replacement 是函数，使用函数替换；否则使用字符串替换
        if (typeof fix.replacement === 'function') {
          // 使用全局替换，确保所有匹配都被替换
          fixedContent = fixedContent.replace(fix.pattern, fix.replacement);
        } else {
          // 使用全局替换
          fixedContent = fixedContent.replace(fix.pattern, fix.replacement);
        }
        
        if (fixedContent !== beforeFix) {
          const matches = beforeFix.match(fix.pattern) || [];
          localFixes += matches.length;
        } else if (cmd === 'text') {
          // 如果替换没有生效，可能是因为模式没有匹配到
          // 对于 text，尝试更宽松的匹配：匹配 ext{ 即使前面有反斜杠（但不在 \\text{ 中）
          // 由于 JavaScript 不支持负向后查找，我们手动检查
          const loosePattern = /ext\s*\{/g;
          let match;
          let newContent = beforeFix;
          let found = false;
          
          while ((match = loosePattern.exec(beforeFix)) !== null) {
            const matchIndex = match.index;
            // 检查前面是否是 \\text{（即双反斜杠 + text）
            const beforeText = beforeFix.substring(Math.max(0, matchIndex - 5), matchIndex);
            // 如果不是 \\text{，则替换
            if (!beforeText.endsWith('\\\\text') && !beforeText.endsWith('\\text')) {
              // 替换 ext{ 为 \\text{
              newContent = newContent.substring(0, matchIndex) + '\\\\text{' + 
                          newContent.substring(matchIndex + match[0].length);
              found = true;
              localFixes++;
              // 更新索引，因为内容长度改变了
              loosePattern.lastIndex = matchIndex + 7; // 7 = '\\\\text{'.length
            }
          }
          
          if (found) {
            fixedContent = newContent;
          }
        }
      }
      
      // 第三步：修复单反斜杠的 LaTeX 命令（\cmd → \\cmd）
      // 例如：\vec → \\vec, \cdot → \\cdot
      // 注意：必须在修复已解析命令之后处理，避免产生冲突
      for (const cmd of this.latexCommands) {
        // 跳过特殊字符（它们需要单独处理）
        if (cmd.startsWith('\\')) {
          continue;
        }
        
        // 使用临时标记方法：先保护双反斜杠的命令，再替换单反斜杠的
        const tempMarker = `__TEMP_DOUBLE_BS_${cmd}__`;
        const doubleBackslashPattern = new RegExp(`\\\\\\\\${this.escapeRegex(cmd)}(?![a-zA-Z])`, 'g');
        
        // 先用临时标记保护双反斜杠的命令
        fixedContent = fixedContent.replace(doubleBackslashPattern, tempMarker);
        
        // 替换所有单反斜杠的命令为双反斜杠
        const singleBackslashRegex = new RegExp(`\\\\(${this.escapeRegex(cmd)})(?![a-zA-Z])`, 'g');
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
      
      // 第四步：修复 \{ 和 \} 等特殊字符
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
    
    const explanation = matchCount > 0 
      ? `匹配到 ${matchCount} 个 v-katex 属性，修复了 ${fixCount} 处 LaTeX 命令转义`
      : `未匹配到 v-katex 属性（正则表达式可能无法匹配当前 HTML 格式）`;
    
    return {
      success: fixCount > 0,
      html: fixedHtml,
      changes,
      explanation: explanation || `修复了 ${fixCount} 处 v-katex 指令中的 LaTeX 命令转义（将 \\cmd 改为 \\\\cmd）`
    };
  }

  /**
   * 修复 script 内模板字符串（如 stages[].content）中 LaTeX 单反斜杠
   * 将 \times、\frac、\sqrt 等改为 \\times、\\frac、\\sqrt，避免 JS 将 \t、\n 等转义导致公式错乱
   */
  fixScriptContentLatexEscapes(html) {
    const scriptCommandList = [
      'times', 'frac', 'sqrt', 'Rightarrow', 'cdot', 'text', 'alpha', 'beta', 'gamma', 'delta',
      'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'approx', 'pi', 'theta', 'eta', 'infty',
      'left', 'right', 'sum', 'int', 'prod', 'lim', 'log', 'ln', 'vec', 'hat', 'quad'
    ];
    const changes = [];
    let fixCount = 0;
    let result = '';
    let lastEnd = 0;
    let start = html.indexOf('<script');
    while (start !== -1) {
      result += html.slice(lastEnd, start);
      const tagEnd = html.indexOf('>', start);
      if (tagEnd === -1) {
        result += html.slice(start);
        lastEnd = html.length;
        break;
      }
      const contentStart = tagEnd + 1;
      const contentEnd = html.indexOf('</script>', contentStart);
      if (contentEnd === -1) {
        result += html.slice(start);
        lastEnd = html.length;
        break;
      }
      let content = html.slice(contentStart, contentEnd);
      const beforeContent = content;
      for (const cmd of scriptCommandList) {
        const re = new RegExp('(^|[^\\\\])' + '\\\\' + this.escapeRegex(cmd) + '(?![a-zA-Z])', 'g');
        content = content.replace(re, (m, p1) => {
          fixCount++;
          return p1 + '\\\\' + cmd;
        });
      }
      if (content !== beforeContent) {
        changes.push({
          type: 'replace',
          location: 'script content (template literal LaTeX)',
          reason: '将单反斜杠 LaTeX 改为双反斜杠'
        });
      }
      result += html.slice(start, contentStart) + content;
      lastEnd = contentEnd;
      start = html.indexOf('<script', contentEnd);
    }
    result += html.slice(lastEnd);
    return {
      success: fixCount > 0,
      html: result,
      changes,
      explanation: fixCount > 0
        ? `修复了 ${fixCount} 处 script 内模板字符串中的 LaTeX 单反斜杠（\\cmd → \\\\cmd）`
        : '未检测到需要修复的 script 内 LaTeX 单反斜杠'
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
      strict: false,
      // v-html 插入时会把 < > 转成 &lt; &gt;，公式在传给 KaTeX 前需解码，否则会显示为字面 &lt; 且影响后续命令解析
      preprocess: function(math) {
        return math.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      }
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
        var appContainer = document.getElementById('app');
        
        mutations.forEach(function(mutation) {
          if (mutation.type === 'childList') {
            // 检查是否有节点添加或移除（Vue 阶段切换会导致 DOM 变化）
            if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
              // 如果是 Vue 应用容器内的变化，直接标记需要渲染
              if (appContainer && (mutation.target === appContainer || appContainer.contains(mutation.target))) {
                needsRender = true;
                renderTargets.add(appContainer);
              }
            }
            
            mutation.addedNodes.forEach(function(node) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // 检查新添加的元素及其子树的文本内容
                var text = node.textContent || '';
                if (self.mightContainMath(text)) {
                  needsRender = true;
                  // 如果是 Vue 应用容器内的变化，渲染整个 #app 容器
                  if (appContainer && (appContainer.contains(node) || appContainer === node)) {
                    renderTargets.add(appContainer);
                  } else {
                    renderTargets.add(node);
                  }
                }
                // 同时检查父元素，因为 Vue 可能添加了包含文本的子节点
                if (mutation.target && mutation.target.nodeType === Node.ELEMENT_NODE) {
                  var parentText = mutation.target.textContent || '';
                  if (self.mightContainMath(parentText)) {
                    needsRender = true;
                    // 如果是 Vue 应用容器内的变化，渲染整个 #app 容器
                    if (appContainer && appContainer.contains(mutation.target)) {
                      renderTargets.add(appContainer);
                    } else {
                      renderTargets.add(mutation.target);
                    }
                  }
                }
              } else if (node.nodeType === Node.TEXT_NODE) {
                // 检查文本节点的内容及其父元素
                var text = node.textContent || '';
                if (self.mightContainMath(text)) {
                  needsRender = true;
                  // 渲染包含该文本节点的父元素
                  var parent = node.parentElement;
                  if (parent) {
                    // 如果是 Vue 应用容器内的变化，渲染整个 #app 容器
                    if (appContainer && appContainer.contains(parent)) {
                      renderTargets.add(appContainer);
                    } else {
                      renderTargets.add(parent);
                    }
                  }
                }
              }
            });
          }
        });
        
        if (needsRender && renderTargets.size > 0) {
          renderTargets.forEach(function(target) {
            self.renderDeferred(target);
          });
        }
      });
      
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    },
    
    // 检查文本是否可能包含数学公式
    mightContainMath: function(text) {
      if (!text) return false;
      // 匹配 $...$、$$...$$、\[...\]、\(...\) 等公式
      // 注意：textContent 是纯文本，包含字面的 $ 字符
      // 在字符串模板中，/\\$/ 会被解析为 /\$/，匹配字面的 $（\$ 转义 $）
      // 测试用例：text = "焦点在 $x$ 轴" 应该返回 true
      // 关键：在字符串模板中写 /\\$/ 会被解析为 /\$/，这是正确的
      // 但为了避免混淆，我们使用更明确的匹配方式
      var dollarPattern = /\\$[^$]+\\$/;
      var doubleDollarPattern = /\\$\\$[^$]+\\$\\$/;
      var bracketPattern = /\\\\\[|\\\\\]|\\\\\(|\\\\\)/;
      var commandPattern = /\\\\frac|\\\\sum|\\\\int|\\\\vec|\\\\cdot/;
      
      return dollarPattern.test(text) || doubleDollarPattern.test(text) || 
             bracketPattern.test(text) || commandPattern.test(text);
    }${isVue ? `,
    
    // Vue 集成
    setupVueIntegration: function() {
      var self = this;
      
      if (typeof Vue === 'undefined') return;
      
      // Vue 3 全局 mixin
      if (Vue.version && Vue.version.startsWith('3')) {
        // 注意：在生产环境中不建议使用全局 mixin
        // 这里只是作为备用方案
        
        // 延迟再次渲染，确保 Vue 挂载后的内容也能被渲染
        // Vue 挂载可能需要一些时间，所以延迟 200ms 后再次渲染
        setTimeout(function() {
          self.renderAll();
        }, 200);
        
        // 额外延迟渲染，应对 Vue 异步渲染的情况
        setTimeout(function() {
          self.renderAll();
        }, 500);
        
        // 增强 MutationObserver：专门监听 Vue 应用容器的变化
        var appContainer = document.getElementById('app');
        if (appContainer) {
          // 创建一个专门监听 #app 的 MutationObserver
          var vueObserver = new MutationObserver(function(mutations) {
            var needsRender = false;
            mutations.forEach(function(mutation) {
              // 任何 DOM 变化都触发重新渲染（Vue 的 v-if、v-show 等会改变 DOM）
              if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                needsRender = true;
              } else if (mutation.type === 'characterData') {
                // 文本节点内容变化也可能包含新公式
                var text = mutation.target.textContent || '';
                if (self.mightContainMath(text)) {
                  needsRender = true;
                }
              }
            });
            
            if (needsRender) {
              // Vue 更新是异步的，使用 nextTick 或延迟来确保 DOM 已更新
              setTimeout(function() {
                self.render(appContainer);
              }, 50);
            }
          });
          
          // 监听 #app 容器的所有变化
          vueObserver.observe(appContainer, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: false
          });
          
        }
        
        // 提供全局刷新方法，供 Vue 组件调用
        // 例如：在 reset 函数中可以调用 window.MathRenderManager.refreshOnStageChange()
        window.MathRenderManager = window.MathRenderManager || {};
        window.MathRenderManager.refreshOnStageChange = function() {
          var appContainer = document.getElementById('app');
          if (appContainer) {
            // 使用多次延迟渲染，确保 Vue 的异步更新完成
            setTimeout(function() {
              self.render(appContainer);
            }, 100);
            setTimeout(function() {
              self.render(appContainer);
            }, 200);
          }
        };
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
  
  //console.log('[MathRenderManager] Three.js CSS2D/CSS3D integration enabled');
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
  
  /**
   * 将空的/占位符 renderMath 替换为调用 MathRenderManager
   * 例如 forEach 体为空或仅注释时，改为调用 MathRenderManager.refresh
   */
  patchEmptyRenderMath(html, changes = []) {
    let fixedHtml = html;
    // 匹配 renderMath 内 forEach(el => { 空体或仅注释 }) - 空体不执行公式渲染
    const emptyForEachPattern = /(els\.forEach\s*\(\s*el\s*=>\s*\{\s*)((?:\/\/[^\n\r]*[\r\n]|\/\*[\s\S]*?\*\/|\s)*)(\s*\}\s*\))/g;
    let m;
    while ((m = emptyForEachPattern.exec(html)) !== null) {
      // 仅当前面有 querySelectorAll('.prose') 时替换（避免误伤）
      const before = html.slice(Math.max(0, m.index - 80), m.index);
      if (/querySelectorAll\s*\(\s*['"]\.prose['"]\s*\)/.test(before)) {
        const replacement = `${m[1]}if (window.MathRenderManager) { window.MathRenderManager.refresh(document.getElementById('app') || document.body); }${m[3]}`;
        fixedHtml = fixedHtml.replace(m[0], replacement);
        changes.push({
          type: 'replace',
          location: 'renderMath forEach body',
          reason: '空 renderMath 改为调用 MathRenderManager.refresh，确保 v-html 内公式能渲染'
        });
        break; // 只替换一处
      }
    }
    return fixedHtml;
  }

  /**
   * 在自定义 renderMath 中，katex.renderToString(formula, ...) 收到的 formula 来自 innerHTML，
   * v-html 插入时会把 < > 转成 &lt; &gt;，需在传入 KaTeX 前解码，否则公式中会显示字面 &lt; 且影响 \alpha、\pi 等解析
   */
  patchKatexRenderToStringDecodeEntities(html, changes = []) {
    const pattern = /katex\.renderToString\s*\(\s*(\w+)\s*,/g;
    const replacement = "katex.renderToString($1.replace(/&lt;/g, '<').replace(/&gt;/g, '>'),";
    const newHtml = html.replace(pattern, replacement);
    if (newHtml !== html) {
      changes.push({
        type: 'replace',
        location: 'katex.renderToString in renderMath',
        reason: '公式传入 KaTeX 前解码 &lt;/&gt;，避免 v-html 转义导致小于/大于号与后续命令显示错误'
      });
    }
    return newHtml;
  }

  /**
   * 优化自定义 renderMath 函数调用
   * 确保在 MathRenderManager 初始化后执行，或使用 MathRenderManager 的方法
   */
  optimizeCustomRenderMath(html) {
    const changes = [];
    let fixedHtml = html;
    
    // 匹配自定义 renderMath 函数定义和调用
    // 例如：const renderMath = () => { ... }
    // 或：function renderMath() { ... }
    // 或：watch(currentStage, () => { renderMath(); })
    
    // 1. 优化 renderMath 函数定义，确保等待 renderMathInElement 加载
    const renderMathPattern = /(const|let|var|function)\s+renderMath\s*[=:]\s*(?:\([^)]*\)\s*=>|function\s*\([^)]*\))\s*\{[^}]*renderMathInElement[^}]*\}/g;
    let match;
    
    while ((match = renderMathPattern.exec(html)) !== null) {
      const original = match[0];
      // 检查是否已经有等待逻辑
      if (!original.includes('waitForKaTeX') && !original.includes('typeof renderMathInElement')) {
        // 优化函数，添加等待逻辑
        const optimized = original.replace(
          /(\{)([^}]*renderMathInElement[^}]*)(\})/,
          (m, open, body, close) => {
            // 如果已经有 if 检查，添加等待逻辑
            if (body.includes('if (typeof renderMathInElement')) {
              return `${open}${body}${close}`;
            }
            // 否则添加等待逻辑
            return `${open}
        if (typeof renderMathInElement === 'undefined') {
          setTimeout(renderMath, 100);
          return;
        }
        ${body}${close}`;
          }
        );
        
        fixedHtml = fixedHtml.replace(original, optimized);
        changes.push({
          type: 'replace',
          location: 'renderMath function',
          before: original.substring(0, 100) + (original.length > 100 ? '...' : ''),
          after: optimized.substring(0, 100) + (optimized.length > 100 ? '...' : ''),
          reason: '优化 renderMath 函数，确保等待 renderMathInElement 加载完成'
        });
      }
    }
    
    // 2. 优化 watch 中的 renderMath 调用，使用 MathRenderManager
    // 匹配：watch(currentStage, () => { renderMath(); nextTick(() => { renderMath(); }); })
    const watchPattern = /watch\s*\(\s*currentStage[^,]*,\s*(?:\([^)]*\)\s*=>|function\s*\([^)]*\))\s*\{[^}]*renderMath\s*\([^}]*\}/g;
    let watchMatch;
    
    while ((watchMatch = watchPattern.exec(html)) !== null) {
      const original = watchMatch[0];
      // 如果已经有 MathRenderManager 调用，跳过
      if (original.includes('MathRenderManager')) {
        continue;
      }
      
      // 替换为使用 MathRenderManager
      // 先替换 nextTick 中的 renderMath 调用
      let optimized = original.replace(
        /nextTick\s*\(\s*\([^)]*\)\s*=>\s*\{[^}]*renderMath\s*\(\s*\)[^}]*\}/g,
        (m) => {
          return `nextTick(() => {
            if (window.MathRenderManager) {
              window.MathRenderManager.refreshOnStageChange();
            } else {
              renderMath();
            }
          })`;
        }
      );
      
      // 再替换其他 renderMath() 调用
      optimized = optimized.replace(
        /renderMath\s*\(\s*\)/g,
        (m) => {
          return `if (window.MathRenderManager) {
            window.MathRenderManager.refreshOnStageChange();
          } else {
            renderMath();
          }`;
        }
      );
      
      if (optimized !== original) {
        fixedHtml = fixedHtml.replace(original, optimized);
        changes.push({
          type: 'replace',
          location: 'watch currentStage',
          before: original.substring(0, 100) + (original.length > 100 ? '...' : ''),
          after: optimized.substring(0, 100) + (optimized.length > 100 ? '...' : ''),
          reason: '优化 watch 中的 renderMath 调用，优先使用 MathRenderManager'
        });
      }
    }
    
    return {
      success: changes.length > 0,
      html: fixedHtml,
      changes,
      explanation: changes.length > 0 
        ? `优化了 ${changes.length} 处自定义 renderMath 函数调用`
        : '未检测到需要优化的 renderMath 函数'
    };
  }

  /**
   * 删除空的 renderMathInElement 函数定义
   * 这种函数定义会覆盖 auto-render.min.js 中的函数，导致 $...$ 形式的公式不能被渲染
   */
  removeEmptyRenderFunction(html) {
    const changes = [];
    let fixedHtml = html;
    let removedCount = 0;
    
    // 匹配 function renderMathInElement 函数定义（处理嵌套大括号）
    const functionStartPattern = /function\s+renderMathInElement\s*\([^)]*\)\s*\{/g;
    const matches = [];
    let match;
    
    // 收集所有匹配的函数定义
    while ((match = functionStartPattern.exec(html)) !== null) {
      const startIndex = match.index;
      
      // 从函数开始位置查找匹配的大括号
      let braceCount = 0;
      let inString = false;
      let stringChar = null;
      let endIndex = -1;
      
      for (let i = startIndex; i < html.length; i++) {
        const char = html[i];
        const prevChar = i > 0 ? html[i - 1] : null;
        
        // 处理字符串（单引号和双引号）
        if (!inString && (char === '"' || char === "'") && prevChar !== '\\') {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar && prevChar !== '\\') {
          inString = false;
          stringChar = null;
        }
        
        // 只在非字符串状态下处理大括号
        if (!inString) {
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              endIndex = i;
              break;
            }
          }
        }
      }
      
      if (endIndex === -1) continue;
      
      const fullFunction = html.substring(startIndex, endIndex + 1);
      const startMatch = match[0];
      const bodyContent = html.substring(startIndex + startMatch.length, endIndex);
      
      matches.push({
        index: startIndex,
        match: fullFunction,
        body: bodyContent
      });
    }
    
    // 从后往前删除，避免索引变化
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      
      // 移除注释和空白
      const cleanBody = m.body
        .replace(/\/\/.*$/gm, '') // 移除单行注释
        .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
        .replace(/\s+/g, ' ')
        .trim();
      
      // 检查是否是空的或者只是占位符
      const isEmpty = !cleanBody || 
                      cleanBody === ';' ||
                      cleanBody.match(/^\/\/.*$/); // 只有注释
      
      // 检查是否为真实实现：AI 常自定义 renderMathInElement，使用 katex.renderToString/forEach 等
      // 这类实现不能调用自身，故 !cleanBody.includes('renderMathInElement') 恒为 true，不能据此判占位符
      const hasRealImplementation = 
        cleanBody.includes('katex.renderToString') ||
        cleanBody.includes('katex.render(') ||
        (cleanBody.includes('forEach') && (cleanBody.includes('katex') || cleanBody.includes('replace'))) ||
        (cleanBody.includes('querySelectorAll') && (cleanBody.includes('replace') || cleanBody.includes('katex')));
      
      // 检查是否只是占位符
      const isPlaceholder = !hasRealImplementation && (
        cleanBody.match(/^if\s*\([^)]+\)\s*\{[^}]*\}$/i) || // 只有 if 检查
        cleanBody.match(/^const\s+\w+\s*=.*;?\s*$/i) || // 只有变量声明
        (cleanBody.includes('el.innerHTML') && !cleanBody.includes('renderMathInElement'))
      );
      
      if (isEmpty || isPlaceholder) {
        // 删除函数定义（包括前后的空白和换行）
        const before = fixedHtml.substring(0, m.index);
        const after = fixedHtml.substring(m.index + m.match.length);
        
        // 移除前后的空白和换行
        const beforeTrimmed = before.replace(/\s*$/, '');
        const afterTrimmed = after.replace(/^\s*/, '');
        
        fixedHtml = beforeTrimmed + afterTrimmed;
        
        removedCount++;
        changes.push({
          type: 'remove',
          location: 'renderMathInElement function',
          before: m.match.substring(0, 100) + (m.match.length > 100 ? '...' : ''),
          after: '(removed)',
          reason: '删除空的 renderMathInElement 函数定义（会覆盖 auto-render.min.js 中的函数）'
        });
      }
    }
    
    return {
      success: removedCount > 0,
      html: fixedHtml,
      changes,
      explanation: removedCount > 0 
        ? `删除了 ${removedCount} 个空的 renderMathInElement 函数定义` 
        : '未检测到需要删除的函数定义'
    };
  }
  
  /**
   * 修复 v-katex 指令使用 katex.renderToString 的问题
   * 替换为使用 renderMathInElement，以便在阶段切换时重新渲染
   */
  fixVKatexRenderToString(html, issue) {
    const changes = [];
    let fixedHtml = html;
    
    // 匹配完整的 directive 定义，查找使用 katex.renderToString 的地方
    const directivePattern = /(app\.directive\s*\(\s*['"]katex['"]\s*,\s*\{[^}]*(mounted|updated)\s*:\s*(?:function\s*\([^)]*\)|(?:\([^)]*\)\s*=>))\s*\{[^}]*)(el\.innerHTML\s*=\s*katex\.renderToString\s*\(\s*([^,)]+)(?:\s*,\s*([^)]+))?\s*\)\s*;?\s*)([^}]*\}\s*\}\s*\))/g;
    
    fixedHtml = fixedHtml.replace(directivePattern, (fullMatch, before, hookName, renderCall, value, options, after) => {
      const optionsStr = options || '{ throwOnError: false }';
      
      // 替换为使用 renderMathInElement
      const replacement = 
        `${before}` + 
        `el.innerHTML = ${value};\n        if (typeof renderMathInElement !== 'undefined') {\n          renderMathInElement(el, {\n            delimiters: [\n              {left: '$$', right: '$$', display: true},\n              {left: '$', right: '$', display: false}\n            ],\n            throwOnError: false\n          });\n        }` + 
        `${after}`;
      
      changes.push({
        type: 'replace',
        location: `v-katex directive ${hookName} hook`,
        before: fullMatch.substring(0, 100) + (fullMatch.length > 100 ? '...' : ''),
        after: replacement.substring(0, 100) + (replacement.length > 100 ? '...' : ''),
        reason: `修复 v-katex 指令的 ${hookName} 钩子，改用 renderMathInElement 以支持阶段切换时的重新渲染`
      });
      
      return replacement;
    });
    
    return {
      success: changes.length > 0,
      html: fixedHtml,
      changes,
      explanation: changes.length > 0 
        ? `修复了 ${changes.length} 处 v-katex 指令，改用 renderMathInElement 以支持阶段切换时的重新渲染`
        : '未检测到需要修复的 v-katex 指令'
    };
  }
  
  /**
   * 修复 HTML 文本内容中 $...$ 内的双反斜杠
   * 在 HTML 文本内容中，LaTeX 公式应该使用单反斜杠，而不是双反斜杠
   */
  fixHtmlTextDoubleBackslash(html, issue) {
    const changes = [];
    let fixedHtml = html;
    let fixCount = 0;
    
    // 匹配 HTML 文本内容中的 $...$ 公式
    const dollarFormulaPattern = /\$[^$\n]+\$/g;
    let match;
    const replacements = [];
    
    while ((match = dollarFormulaPattern.exec(html)) !== null) {
      const formulaContent = match[0];
      const matchIndex = match.index;
      
      // 检查是否在 script 标签内
      const before = html.substring(0, matchIndex);
      const scriptOpenCount = (before.match(/<script[^>]*>/gi) || []).length;
      const scriptCloseCount = (before.match(/<\/script>/gi) || []).length;
      const inScript = scriptOpenCount > scriptCloseCount;
      
      // 检查是否在 v-katex 属性中
      const tagStartMatch = before.match(/<[^>]*$/);
      let inVKatex = false;
      if (tagStartMatch) {
        const tagStartIndex = tagStartMatch.index;
        const tagContent = html.substring(tagStartIndex, matchIndex + formulaContent.length);
        inVKatex = /v-katex\s*=\s*["'][^"']*\$[^$]*\$[^"']*["']/i.test(tagContent);
      }
      
      // 只处理 HTML 文本内容中的公式（不在 script 和 v-katex 中）
      if (!inScript && !inVKatex) {
        // 在公式内容中查找双反斜杠并替换为单反斜杠
        let fixedFormula = formulaContent;
        const doubleBackslashPattern = /\\\\[a-zA-Z]+/g;
        let backslashMatch;
        let localFixCount = 0;
        
        while ((backslashMatch = doubleBackslashPattern.exec(formulaContent)) !== null) {
          const cmd = backslashMatch[0].substring(2); // 去掉 \\，获取命令名
          // 检查是否是有效的 LaTeX 命令
          if (this.latexCommands.includes(cmd) || cmd.length <= 10) {
            const replacement = '\\' + cmd;
            fixedFormula = fixedFormula.replace(backslashMatch[0], replacement);
            localFixCount++;
          }
        }
        
        if (localFixCount > 0) {
          replacements.push({
            original: formulaContent,
            fixed: fixedFormula,
            position: matchIndex,
            fixCount: localFixCount
          });
        }
      }
    }
    
    // 从后往前替换，避免位置偏移
    replacements.sort((a, b) => b.position - a.position);
    
    for (const replacement of replacements) {
      const before = fixedHtml.substring(0, replacement.position);
      const after = fixedHtml.substring(replacement.position + replacement.original.length);
      fixedHtml = before + replacement.fixed + after;
      fixCount += replacement.fixCount;
      
      changes.push({
        type: 'replace',
        location: 'HTML text content',
        before: replacement.original,
        after: replacement.fixed,
        reason: `修复 HTML 文本内容中的双反斜杠：${replacement.original} → ${replacement.fixed}`
      });
    }
    
    return {
      success: fixCount > 0,
      html: fixedHtml,
      changes,
      explanation: fixCount > 0 
        ? `修复了 ${fixCount} 处 HTML 文本内容中 $...$ 公式的双反斜杠问题`
        : '未检测到需要修复的问题'
    };
  }
  
  /**
   * 转义正则表达式特殊字符
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = MathFixer;