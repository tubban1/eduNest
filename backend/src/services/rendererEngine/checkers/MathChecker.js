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
    if (metadata.hasVueStages && !metadata.hasMathRenderManager) {
      issues.push({
        type: 'math',
        code: 'STAGE_CHANGE_MATH_LOST',
        severity: 'high',
        message: 'Vue v-if 阶段切换需要 MathRenderManager 来自动渲染公式',
        fixable: true,
        fixStrategy: 'INJECT_MATH_RENDER_MANAGER'
      });
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
    
    // 问题 2: v-if 阶段切换后公式可能不重渲染
    if (metadata.hasVueStages && !metadata.hasMathRenderManager) {
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
    const patterns = [
      /v-if\s*=\s*["'][^"']*stage/i,
      /v-if\s*=\s*["'][^"']*currentStage/i,
      /v-if\s*=\s*["'][^"']*step/i,
      /v-show\s*=\s*["'][^"']*stage/i
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
        // 只在数学公式上下文中检测（避免误报）
        const parsedCommandPatterns = {
          'div': /\bdiv\s*[=0-9]/g,  // "div 8" 或 "div ="
          'frac': /(^|[^\\])rac\s*\{/g,     // "rac{" (应该是 \frac{)，前面不是反斜杠
          'sqrt': /(^|[^\\])sqrt\s*\{/g,    // "sqrt{" (应该是 \sqrt{)，前面不是反斜杠
          'text': /(^|[^\\])ext\s*\{/g,     // "ext{" (应该是 \text{)，前面不是反斜杠
          'times': /(^|[^\\])imes\b/g,      // "imes" (应该是 \times)，前面不是反斜杠
          'approx': /(^|[^\\])approx\b/g    // "approx" (应该是 \approx)，前面不是反斜杠
        };
        
        if (parsedCommandPatterns[cmd]) {
          const parsedMatches = content.match(parsedCommandPatterns[cmd]) || [];
          if (parsedMatches.length > 0) {
            // 检查是否已经有正确的转义（避免重复报告）
            const correctPattern = new RegExp(`\\\\{1,2}${this.escapeRegex(cmd)}(?![a-zA-Z])`, 'g');
            const correctMatches = content.match(correctPattern) || [];
            
            // 如果已经有正确的转义，就不报告解析后的命令
            if (correctMatches.length === 0) {
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
   * 转义正则表达式特殊字符
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = MathChecker;
