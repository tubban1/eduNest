/**
 * MathChecker - 数学公式检测器
 * 
 * 检测 KaTeX 相关的渲染问题：
 * - RENDER_CALL_MISSING: 缺少 renderMathInElement 调用
 * - STAGE_CHANGE_MATH_LOST: v-if 切换后公式不重渲染
 * - RAW_TEX_DETECTED: TeX 语法未被渲染
 * - ESCAPE_ERROR: LaTeX 转义错误
 * - V_KATEX_ESCAPE_MISSING: v-katex 指令中缺少双反斜杠
 */

class MathChecker {
  constructor() {
    this.name = 'MathChecker';
    this.priority = 1; // 高优先级
    
    // 需要在 JS 字符串中用双反斜杠的 LaTeX 命令和特殊字符
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
      'mid', 'Delta',
      // 特殊字符（需要转义）
      '\\{', '\\}', '\\[', '\\]', '\\(', '\\)'
    ];
  }
  
  /**
   * 获取已解析命令的模式定义（供检测器和修复器共享）
   * 这些模式用于检测已被 JavaScript 解析后的命令（没有反斜杠）
   * 例如：\frac → rac, \text → [TAB]ext, \times → [TAB]imes
   * 
   * 注意：检测器和修复器必须使用完全相同的模式，确保检测到的问题都能被修复
   */
  static getParsedCommandPatterns() {
    return {
      'div': /\bdiv\s*[=0-9]/g,  // "div 8" 或 "div ="
      'frac': /(^|[^\\a-zA-Z])rac\s*\{/g,     // "rac{" (应该是 \frac{)，前面不是反斜杠或字母
      'sqrt': /(^|[^\\])sqrt\s*\{/g,    // "sqrt{" (应该是 \sqrt{)，前面不是反斜杠
      'text': /([\t]|^|[^\\])ext\s*\{/g,     // "ext{" (应该是 \text{)，前面可能是制表符、开头或非反斜杠字符
      'times': /([\t]|^|[^\\])imes\b/g,      // "imes" (应该是 \times)，前面可能是制表符、开头或非反斜杠字符
      'approx': /(^|[^\\])approx\b/g,   // "approx" (应该是 \approx)，前面不是反斜杠
      'ln': /(^|[^\\])ln(?![a-zA-Z])/g,           // "ln" (应该是 \ln)，前面不是反斜杠，后面不是字母
      'prod': /(^|[^\\])prod(?![a-zA-Z])/g        // "prod" (应该是 \prod)，前面不是反斜杠，后面不是字母
    };
  }
  
  /**
   * 执行检测
   * @param {string} html - HTML 内容
   * @returns {Promise<CheckResult>}
   */
  async check(html) {
    const issues = [];
    const metadata = {
      hasKatex: false,
      hasRenderCall: false,
      hasMathRenderManager: false,
      hasVueStages: false,
      rawTexCount: 0,
      vKatexEscapeIssues: 0
    };
    
    if (!html) {
      return { issues, metadata };
    }
    
    // 检测是否使用了 KaTeX
    metadata.hasKatex = this.detectKatex(html);
    
    if (!metadata.hasKatex) {
      // 没有使用 KaTeX，检查是否有原始 TeX 语法
      const rawTexPatterns = this.detectRawTex(html);
      if (rawTexPatterns.count > 0) {
        metadata.rawTexCount = rawTexPatterns.count;
        issues.push({
          type: 'math',
          code: 'RAW_TEX_DETECTED',
          severity: 'high',
          message: `检测到 ${rawTexPatterns.count} 处未渲染的 TeX 语法`,
          fixable: true,
          fixStrategy: 'INJECT_KATEX_AND_RENDER',
          context: {
            samples: rawTexPatterns.samples
          }
        });
      }
      return { issues, metadata };
    }
    
    // 检测是否有 renderMathInElement 调用
    metadata.hasRenderCall = this.detectRenderCall(html);
    metadata.hasMathRenderManager = html.includes('MathRenderManager');
    metadata.hasAutoRender = html.includes('auto-render') || html.includes('auto-render.min.js');
    
    // 检测 Vue 多阶段
    metadata.hasVueStages = this.detectVueStages(html);
    
    // 问题 1: MathRenderManager 存在但缺少 auto-render 依赖
    if (metadata.hasMathRenderManager && !metadata.hasAutoRender) {
      issues.push({
        type: 'math',
        code: 'RENDER_CALL_MISSING',
        severity: 'high',
        message: 'MathRenderManager 存在但缺少 auto-render.min.js 依赖',
        fixable: true,
        fixStrategy: 'INJECT_MATH_RENDER_MANAGER'
      });
    }
    
    // 问题 2: 调用了 renderMathInElement 但缺少 auto-render.min.js
    if (metadata.hasRenderCall && !metadata.hasAutoRender) {
      issues.push({
        type: 'math',
        code: 'RENDER_CALL_MISSING',
        severity: 'high',
        message: '代码中调用了 renderMathInElement 但缺少 auto-render.min.js 库',
        fixable: true,
        fixStrategy: 'INJECT_MATH_RENDER_MANAGER'
      });
    }
    
    // 问题 3: Vue v-if 切换但缺少 MathRenderManager（重要！）
    // 即使有 renderMathInElement，Vue v-if 切换时也需要 MathRenderManager 来自动处理 DOM 更新
    // 同时检查是否有 $...$ 公式（通过检测 mathHtml 或模板中的 $ 符号）
    const hasMathFormulas = this.detectRawTex(html).count > 0 || 
                           html.includes('mathHtml') || 
                           html.includes('$') && (html.match(/\$[^$\n]+\$/g) || []).length > 0;
    
    if (metadata.hasVueStages && !metadata.hasMathRenderManager && hasMathFormulas) {
      issues.push({
        type: 'math',
        code: 'STAGE_CHANGE_MATH_LOST',
        severity: 'high',
        message: 'Vue v-if 阶段切换需要 MathRenderManager 来自动渲染公式（检测到阶段切换和数学公式）',
        fixable: true,
        fixStrategy: 'INJECT_MATH_RENDER_MANAGER'
      });
    }
    
    // 问题 3.5: 即使没有明确的阶段切换，如果有 $...$ 公式和 Vue，也应该使用 MathRenderManager
    // 注意：这个检测可能导致重复问题，如果已经检测到阶段切换，就不再检测自定义 renderMath
    if (metadata.hasKatex && hasMathFormulas && !metadata.hasMathRenderManager && 
        !metadata.hasVueStages && // 避免重复检测
        (html.includes('createApp') || html.includes('Vue.'))) {
      // 检查是否有自定义 renderMath 函数但没有 MathRenderManager
      const hasCustomRenderMath = /(const|let|var|function)\s+renderMath\s*[=:]/i.test(html);
      if (hasCustomRenderMath) {
        issues.push({
          type: 'math',
          code: 'STAGE_CHANGE_MATH_LOST',
          severity: 'high',
          message: '检测到自定义 renderMath 函数和数学公式，建议使用 MathRenderManager 确保正确渲染',
          fixable: true,
          fixStrategy: 'INJECT_MATH_RENDER_MANAGER'
        });
      }
    }
    
    // 问题 4: 缺少 renderMathInElement 和 MathRenderManager
    if (!metadata.hasRenderCall && !metadata.hasMathRenderManager) {
      issues.push({
        type: 'math',
        code: 'RENDER_CALL_MISSING',
        severity: 'high',
        message: '使用了 KaTeX 但未检测到 renderMathInElement 调用或 MathRenderManager',
        fixable: true,
        fixStrategy: 'INJECT_MATH_RENDER_MANAGER'
      });
    }
    
    // 问题 5: 检测空的 renderMathInElement 函数定义（会覆盖 auto-render.min.js 中的函数）
    const emptyRenderFunction = this.detectEmptyRenderFunction(html);
    if (emptyRenderFunction) {
      issues.push({
        type: 'math',
        code: 'EMPTY_RENDER_FUNCTION',
        severity: 'high',
        message: '检测到空的 renderMathInElement 函数定义，会覆盖 auto-render.min.js 中的函数',
        fixable: true,
        fixStrategy: 'REMOVE_EMPTY_RENDER_FUNCTION',
        context: {
          position: emptyRenderFunction.position,
          match: emptyRenderFunction.match
        }
      });
    }
    
    // 问题 6: 检测 v-katex 指令使用 katex.renderToString（阶段切换时不会重新渲染）
    const vKatexRenderToString = this.detectVKatexRenderToString(html);
    if (vKatexRenderToString.count > 0) {
      issues.push({
        type: 'math',
        code: 'V_KATEX_RENDER_TO_STRING',
        severity: 'high',
        message: `检测到 ${vKatexRenderToString.count} 处 v-katex 指令使用 katex.renderToString，阶段切换时公式不会重新渲染`,
        fixable: true,
        fixStrategy: 'FIX_V_KATEX_RENDER_TO_STRING',
        context: {
          samples: vKatexRenderToString.samples
        }
      });
    }
    
    // 问题 2: v-if 阶段切换后公式可能不重渲染
    // 注意：避免重复检测，如果问题 3 已经检测到阶段切换和数学公式，就不再检测
    if (metadata.hasVueStages && !metadata.hasMathRenderManager && !hasMathFormulas) {
      // 检查是否有正确的重渲染处理
      const hasProperRerender = this.checkVueStageRerender(html);
      
      if (!hasProperRerender) {
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
    
    // 问题 3: 检测 v-katex 指令中缺少双反斜杠的问题（最常见！）
    const vKatexEscapeIssues = this.detectVKatexEscapeIssues(html);
    if (vKatexEscapeIssues.count > 0) {
      metadata.vKatexEscapeIssues = vKatexEscapeIssues.count;
      issues.push({
        type: 'math',
        code: 'V_KATEX_ESCAPE_MISSING',
        severity: 'high',
        message: `检测到 ${vKatexEscapeIssues.count} 处 v-katex 指令中的 LaTeX 命令缺少双反斜杠`,
        fixable: true,
        fixStrategy: 'FIX_V_KATEX_ESCAPES',
        context: {
          issues: vKatexEscapeIssues.issues,
          samples: vKatexEscapeIssues.samples
        }
      });
    }
    
    // 问题 4: 检测 LaTeX 转义错误
    const escapeErrors = this.detectEscapeErrors(html);
    if (escapeErrors.length > 0) {
      issues.push({
        type: 'math',
        code: 'ESCAPE_ERROR',
        severity: 'medium',
        message: `检测到 ${escapeErrors.length} 处可能的 LaTeX 转义错误`,
        fixable: true,
        fixStrategy: 'FIX_ESCAPE_ERRORS',
        context: {
          errors: escapeErrors
        }
      });
    }
    
    return { issues, metadata };
  }
  
  /**
   * 检测是否使用了 KaTeX
   */
  detectKatex(html) {
    const patterns = [
      /katex/i,
      /renderMathInElement/,
      /katex\.min\.js/i,
      /katex\.min\.css/i
    ];
    
    return patterns.some(p => p.test(html));
  }
  
  /**
   * 检测原始 TeX 语法
   */
  detectRawTex(html) {
    const samples = [];
    let count = 0;
    
    // 常见的 TeX 模式
    const patterns = [
      /\$\$[^$]+\$\$/g,           // $$ ... $$
      /\$[^$\n]+\$/g,             // $ ... $ (单行)
      /\\\[[^\]]+\\\]/g,          // \[ ... \]
      /\\\([^)]+\\\)/g,           // \( ... \)
      /\\frac\{[^}]+\}\{[^}]+\}/g, // \frac{...}{...}
      /\\sum_/g,                   // \sum_
      /\\int_/g,                   // \int_
      /\\sqrt\{/g                  // \sqrt{
    ];
    
    for (const pattern of patterns) {
      const matches = html.match(pattern);
      if (matches) {
        count += matches.length;
        // 保存前几个样本
        if (samples.length < 3) {
          samples.push(...matches.slice(0, 3 - samples.length));
        }
      }
    }
    
    return { count, samples };
  }
  
  /**
   * 检测 renderMathInElement 调用
   */
  detectRenderCall(html) {
    const patterns = [
      /renderMathInElement\s*\(/,
      /katex\.render\s*\(/,
      /auto-render\.min\.js/
    ];
    
    return patterns.some(p => p.test(html));
  }
  
  /**
   * 检测 Vue 多阶段（v-if 切换）
   */
  detectVueStages(html) {
    // 检测常见的阶段切换模式
    // 注意：需要匹配 v-if="currentStage === 1" 这样的模式，不仅仅是引号内的
    const patterns = [
      /v-if\s*=\s*["'][^"']*stage/i,  // v-if="stage === 1"
      /v-if\s*=\s*["'][^"']*currentStage/i,  // v-if="currentStage === 1"
      /v-if\s*=\s*["'][^"']*step/i,  // v-if="step === 1"
      /v-show\s*=\s*["'][^"']*stage/i,  // v-show="stage"
      // 匹配 v-if="currentStage === 1" 这样的模式（不在引号内的变量）
      /v-if\s*=\s*["'][^"']*currentStage[^"']*["']/i,
      /v-if\s*=\s*["'][^"']*stage[^"']*===/i,
      // 匹配 :key="currentStage" 这样的模式
      /:key\s*=\s*["'][^"']*currentStage/i,
      /:key\s*=\s*["'][^"']*stage/i
    ];
    
    return patterns.some(p => p.test(html));
  }
  
  /**
   * 检查 Vue 阶段切换后是否有正确的重渲染处理
   */
  checkVueStageRerender(html) {
    const goodPatterns = [
      /MathRenderManager/,
      /\$nextTick.*renderMath/i,
      /nextTick.*renderMath/i,
      /watch.*renderMath/i,
      /updated.*renderMath/i
    ];
    
    return goodPatterns.some(p => p.test(html));
  }
  
  /**
   * 检测 v-katex 指令中缺少双反斜杠的问题
   * 
   * 问题：在 JavaScript 字符串中，\sqrt 会被解析为 sqrt（因为 \s 不是有效转义）
   * 正确写法应该是 \\sqrt
   * 
   * 例如：
   * - 错误：v-katex="'a = 2\sqrt{3}'"    → JS 解析后变成 'a = 2sqrt{3}'
   * - 正确：v-katex="'a = 2\\sqrt{3}'"   → JS 解析后变成 'a = 2\sqrt{3}'
   */
  detectVKatexEscapeIssues(html) {
    const issues = [];
    const samples = [];
    
    // 匹配 v-katex="'...'" 或 v-katex='"..."' 模式
    const vKatexPattern = /v-katex\s*=\s*["'](['"`])([^'"`]*)\1["']/g;
    let match;
    
    while ((match = vKatexPattern.exec(html)) !== null) {
      const fullMatch = match[0];
      const content = match[2];
      
      // 检查内容中是否有单反斜杠的 LaTeX 命令（应该是双反斜杠）
      for (const cmd of this.latexCommands) {
        // 跳过特殊字符，它们需要单独处理
        if (cmd.startsWith('\\')) {
          continue; // 特殊字符（如 \{ \}）单独处理
        }
        
        // 匹配所有 \cmd 或 \\cmd 模式
        // 然后过滤掉那些已经是双反斜杠的（\\cmd）
        const allMatchesRegex = new RegExp(`\\\\{1,2}${this.escapeRegex(cmd)}(?![a-zA-Z])`, 'g');
        const allMatches = content.match(allMatchesRegex) || [];
        
        // 过滤出单反斜杠的（即不是双反斜杠的）
        const singleBackslashMatches = allMatches.filter(m => !m.startsWith('\\\\'));
        
        if (singleBackslashMatches.length > 0) {
          issues.push({
            fullMatch,
            content,
            position: match.index,
            command: cmd,
            matches: singleBackslashMatches
          });
          
          if (samples.length < 5) {
            samples.push(`\\${cmd} in "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
          }
        }
        
        // 额外检测：已经被 JavaScript 解析后的命令（没有反斜杠）
        // 例如：\div → div, \frac → rac (因为 \d 和 \f 不是有效转义)
        // 使用共享的解析命令模式定义，确保与修复器完全一致
        const parsedCommandPatterns = MathChecker.getParsedCommandPatterns();
        
        if (parsedCommandPatterns[cmd]) {
          const parsedMatches = content.match(parsedCommandPatterns[cmd]) || [];
          if (parsedMatches.length > 0) {
            // 总是报告解析后的命令（即使内容中已经有正确的转义）
            // 因为内容中可能同时存在：既有 \\frac（正确）也有 rac（错误，从 \frac 解析而来）
            // 例如：v-katex="'\\frac{x}{y} + \frac{a}{b}'" 中既有 \\frac 也有 rac
            issues.push({
              fullMatch,
              content,
              position: match.index,
              command: cmd,
              matches: parsedMatches,
              isParsed: true  // 标记为已解析的命令
            });
            
            if (samples.length < 5) {
              samples.push(`${cmd} (parsed from \\${cmd}) in "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
            }
          }
        }
      }
      
      // 特殊处理：检测 \{ 和 \} 等特殊字符（它们在 JS 字符串中不是有效转义）
      // 匹配所有 \{, \}, \[, \], \(, \) 模式
      const specialCharPattern = /\\([{}[\]()])/g;
      const allSpecialMatches = content.match(specialCharPattern) || [];
      
      // 过滤出单反斜杠的（即不是双反斜杠的）
      // 通过检查前面是否有反斜杠来判断
      const singleBackslashSpecialMatches = [];
      for (let i = 0; i < allSpecialMatches.length; i++) {
        const matchStr = allSpecialMatches[i];
        const matchIndex = content.indexOf(matchStr);
        // 检查前面是否有反斜杠（不是双反斜杠的情况）
        if (matchIndex > 0) {
          const beforeChar = content[matchIndex - 1];
          if (beforeChar !== '\\') {
            singleBackslashSpecialMatches.push(matchStr);
          } else if (matchIndex > 1 && content[matchIndex - 2] === '\\') {
            // 前面是双反斜杠，跳过
            continue;
          } else {
            // 前面是单反斜杠，说明是双反斜杠的情况，跳过
            continue;
          }
        } else {
          singleBackslashSpecialMatches.push(matchStr);
        }
      }
      
      if (singleBackslashSpecialMatches.length > 0) {
        issues.push({
          fullMatch,
          content,
          position: match.index,
          command: 'special-char',
          matches: singleBackslashSpecialMatches
        });
        
        if (samples.length < 5) {
          samples.push(`\\{ or \\} in "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
        }
      }
    }
    
    return {
      count: issues.length,
      issues,
      samples
    };
  }
  
  /**
   * 检测 LaTeX 转义错误
   */
  detectEscapeErrors(html) {
    const errors = [];
    
    // 常见错误模式
    // 1. 双反斜杠应该是单反斜杠（在 HTML 中）
    // 例如: \\sin 应该是 \sin
    const doubleBackslashPattern = /\\\\(sin|cos|tan|log|ln|exp|sqrt|frac|sum|int|prod|lim)\b/g;
    let match;
    
    while ((match = doubleBackslashPattern.exec(html)) !== null) {
      // 检查是否在 script 标签内（JS 字符串中双反斜杠是正确的）
      const before = html.substring(0, match.index);
      const inScript = (before.match(/<script/gi) || []).length > (before.match(/<\/script/gi) || []).length;
      
      if (!inScript) {
        errors.push({
          pattern: match[0],
          position: match.index,
          suggestion: '\\' + match[1]
        });
      }
    }
    
    return errors;
  }
  
  /**
   * 检测空的 renderMathInElement 函数定义
   * 这种函数定义会覆盖 auto-render.min.js 中的函数，导致 $...$ 形式的公式不能被渲染
   */
  detectEmptyRenderFunction(html) {
    // 匹配 function renderMathInElement 函数定义（处理嵌套大括号）
    const functionStartPattern = /function\s+renderMathInElement\s*\([^)]*\)\s*\{/g;
    let match;
    
    while ((match = functionStartPattern.exec(html)) !== null) {
      const startIndex = match.index;
      const startMatch = match[0];
      
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
      
      // 提取函数体（不包括外层大括号）
      const fullFunction = html.substring(startIndex, endIndex + 1);
      const bodyContent = html.substring(startIndex + startMatch.length, endIndex);
      
      // 移除注释和空白
      const cleanBody = bodyContent
        .replace(/\/\/.*$/gm, '') // 移除单行注释
        .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
        .replace(/\s+/g, ' ')
        .trim();
      
      // 检查是否是空的或者只是占位符
      // 1. 函数体为空
      // 2. 只有变量声明但没有实际调用
      // 3. 只有 if 检查但没有实际实现（如只有 const text = el.innerHTML;）
      const isEmpty = !cleanBody || 
                      cleanBody === ';' ||
                      cleanBody.match(/^\/\/.*$/); // 只有注释
      
      // 检查是否只是占位符（有 if 检查但实际没有调用 renderMathInElement）
      const isPlaceholder = cleanBody.match(/^if\s*\([^)]+\)\s*\{[^}]*\}$/i) || // 只有 if 检查
                           cleanBody.match(/^const\s+\w+\s*=.*;?\s*$/i) || // 只有变量声明
                           (cleanBody.includes('el.innerHTML') && !cleanBody.includes('renderMathInElement')); // 有读取 innerHTML 但没有调用渲染
      
      if (isEmpty || isPlaceholder) {
        return {
          position: startIndex,
          match: fullFunction,
          body: bodyContent
        };
      }
    }
    
    return null;
  }
  
  /**
   * 检测 v-katex 指令使用 katex.renderToString
   * 这种用法在阶段切换时不会重新渲染公式
   */
  detectVKatexRenderToString(html) {
    const issues = [];
    const samples = [];
    
    // 匹配 app.directive('katex', { mounted(el, binding) { el.innerHTML = katex.renderToString(...) } })
    // 或 app.directive('katex', { updated(el, binding) { el.innerHTML = katex.renderToString(...) } })
    const directivePattern = /app\.directive\s*\(\s*['"]katex['"]\s*,\s*\{[^}]*(mounted|updated)\s*:\s*(?:function\s*\([^)]*\)|(?:\([^)]*\)\s*=>))\s*\{[^}]*el\.innerHTML\s*=\s*katex\.renderToString\s*\([^)]+\)\s*;?[^}]*\}\s*\}\s*\)/g;
    let match;
    
    while ((match = directivePattern.exec(html)) !== null) {
      issues.push({
        fullMatch: match[0],
        context: match[0].substring(0, 100) + (match[0].length > 100 ? '...' : ''),
        position: match.index,
        hook: match[1] // mounted 或 updated
      });
      if (samples.length < 5) {
        samples.push(`v-katex ${match[1]} hook uses katex.renderToString: ${match[0].substring(0, 50)}${match[0].length > 50 ? '...' : ''}`);
      }
    }
    
    return { count: issues.length, issues, samples };
  }
  
  /**
   * 转义正则表达式特殊字符
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = MathChecker;
