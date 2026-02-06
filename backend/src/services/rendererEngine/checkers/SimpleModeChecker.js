/**
 * SimpleModeChecker - 简单模式约束检查
 *
 * 检测并禁止会导致 Vue DOM 冲突的高危模式：
 * - MutationObserver
 * - renderMathInElement(document.body) / document
 * - document.body.innerHTML
 * - MathRenderManager 等全局 DOM 管理器
 * - mount('body')
 *
 * 设计理念：代码正确性优先，禁止全局 DOM 操作避免与 Vue 冲突
 */

const FORBIDDEN_PATTERNS = [
  {
    pattern: /new\s+MutationObserver\s*\(/,
    code: 'SIMPLE_MODE_MUTATION_OBSERVER',
    message: '禁止使用 MutationObserver，会与 Vue DOM 管理冲突'
  },
  {
    pattern: /renderMathInElement\s*\(\s*document\s*\.\s*body/,
    code: 'SIMPLE_MODE_RENDER_MATH_BODY',
    message: '禁止对 document.body 调用 renderMathInElement，请使用组件内 katex.renderToString + v-html'
  },
  {
    pattern: /renderMathInElement\s*\(\s*document\s*[,\s)]/,
    code: 'SIMPLE_MODE_RENDER_MATH_DOCUMENT',
    message: '禁止对 document 调用 renderMathInElement'
  },
  {
    pattern: /document\s*\.\s*body\s*\.\s*innerHTML\s*=/,
    code: 'SIMPLE_MODE_BODY_INNERHTML',
    message: '禁止设置 document.body.innerHTML'
  },
  {
    pattern: /document\s*\.\s*documentElement\s*\.\s*innerHTML\s*=/,
    code: 'SIMPLE_MODE_DOCUMENT_ELEMENT_INNERHTML',
    message: '禁止设置 document.documentElement.innerHTML'
  },
  {
    pattern: /MathRenderManager/,
    code: 'SIMPLE_MODE_GLOBAL_MATH_MANAGER',
    message: '禁止注入 MathRenderManager 等全局 DOM 管理器'
  },
  {
    pattern: /\.mount\s*\(\s*['\"]body['\"]\s*\)/,
    code: 'SIMPLE_MODE_MOUNT_BODY',
    message: '禁止 createApp(...).mount("body")，必须 mount("#app")'
  }
];

class SimpleModeChecker {
  constructor() {
    this.name = 'SimpleModeChecker';
    this.priority = 0; // 最高优先级，最先检测
  }

  /**
   * 执行检测
   * @param {string} html - HTML 内容
   * @returns {Promise<CheckResult>}
   */
  async check(html) {
    const issues = [];
    const metadata = { forbiddenHits: [] };

    if (!html || typeof html !== 'string') {
      return { issues, metadata };
    }

    for (const { pattern, code, message } of FORBIDDEN_PATTERNS) {
      const matches = html.matchAll(new RegExp(pattern.source, 'g'));
      for (const match of matches) {
        const index = match.index;
        const line = (html.slice(0, index).match(/\n/g) || []).length + 1;
        issues.push({
          type: 'simple_mode',
          code,
          severity: 'high',
          message,
          fixable: false,
          context: {
            line,
            position: index,
            match: match[0].slice(0, 80)
          }
        });
        metadata.forbiddenHits.push({ code, line, match: match[0].slice(0, 80) });
      }
    }

    return { issues, metadata };
  }
}

module.exports = SimpleModeChecker;
