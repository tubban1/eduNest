/**
 * ESLintChecker - 使用 ESLint 和 eslint-plugin-vue 检测 Vue 代码问题
 * 
 * 检测 AI 生成代码后可能出现的 Vue 相关问题：
 * - Vue 3 语法错误
 * - ref 使用错误（.ref vs .value）
 * - 响应式数据使用问题
 * - 生命周期钩子问题
 */

const { ESLint } = require('eslint');

class ESLintChecker {
  constructor() {
    this.name = 'ESLintChecker';
    this.priority = 1; // 高优先级，在运行时检查之前
    this.eslint = null;
    this.initialized = false;
  }
  
  /**
   * 初始化 ESLint 实例
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      this.eslint = new ESLint({
        useEslintrc: false,
        baseConfig: {
          parser: 'vue-eslint-parser',
          parserOptions: {
            ecmaVersion: 2021,
            sourceType: 'module',
            ecmaFeatures: {
              jsx: false
            }
          },
          plugins: ['vue'],
          extends: ['plugin:vue/vue3-strongly-recommended'],
          rules: {
            // Vue 3 特定规则
            'vue/no-ref-as-operand': 'error',
            'vue/no-setup-props-destructure': 'warn',
            'vue/no-v-html': 'off', // AI 生成的内容可能需要 v-html
            'vue/require-v-for-key': 'error',
            'vue/no-use-v-if-with-v-for': 'error',
            // 自定义规则：检测 .ref 使用错误（在 script 标签中）
            'no-restricted-syntax': [
              'error',
              {
                selector: 'MemberExpression[property.name="ref"]',
                message: 'Vue 3 ref 应该使用 .value 而不是 .ref'
              }
            ]
          },
          env: {
            browser: true,
            es2021: true
          }
        },
        fix: false // 检查阶段不修复
      });
      
      this.initialized = true;
    } catch (error) {
      console.warn('[ESLintChecker] 初始化失败，将跳过 ESLint 检查:', error.message);
      this.eslint = null;
    }
  }
  
  /**
   * 从 HTML 中提取 Vue 代码（script 标签中的内容）
   */
  extractVueCode(html) {
    const scripts = [];
    
    // 匹配 <script> 标签（包括 type="module" 等）
    const scriptPattern = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
    let match;
    
    while ((match = scriptPattern.exec(html)) !== null) {
      const scriptContent = match[1];
      const fullMatch = match[0];
      
      // 检查是否包含 Vue 相关代码
      if (scriptContent.includes('Vue') || 
          scriptContent.includes('createApp') || 
          scriptContent.includes('ref(') || 
          scriptContent.includes('reactive(') ||
          scriptContent.includes('computed(')) {
        scripts.push({
          content: scriptContent,
          fullMatch: fullMatch,
          startIndex: match.index,
          endIndex: match.index + fullMatch.length
        });
      }
    }
    
    return scripts;
  }
  
  /**
   * 将 script 内容包装成 Vue 单文件组件格式（供 ESLint 检查）
   */
  wrapAsVueSFC(scriptContent) {
    // 检查代码是否使用了 setup 语法
    const hasSetup = scriptContent.includes('setup()') || 
                     scriptContent.includes('createApp') ||
                     scriptContent.includes('app.mount');
    
    // 如果使用了 createApp，说明是选项式 API，不需要 setup
    if (hasSetup && scriptContent.includes('createApp')) {
      // 选项式 API：直接包装，不需要 setup
      return `<template></template>
<script>
${scriptContent}
</script>`;
    }
    
    // Composition API 或 setup 语法
    return `<template></template>
<script setup>
${scriptContent}
</script>`;
  }
  
  /**
   * 执行检测
   * @param {string} html - HTML 内容
   * @returns {Promise<CheckResult>}
   */
  async check(html) {
    const issues = [];
    const metadata = {
      hasVue: false,
      scriptCount: 0,
      eslintErrors: 0,
      eslintWarnings: 0
    };
    
    if (!html) {
      return { issues, metadata };
    }
    
    // 初始化 ESLint
    await this.initialize();
    
    if (!this.eslint) {
      // ESLint 未初始化，跳过检查
      return { issues, metadata };
    }
    
    // 提取 Vue 代码
    const scripts = this.extractVueCode(html);
    metadata.scriptCount = scripts.length;
    metadata.hasVue = scripts.length > 0;
    
    if (scripts.length === 0) {
      return { issues, metadata };
    }
    
    // 对每个 script 标签进行检查
    for (const script of scripts) {
      try {
        // 包装成 Vue SFC 格式
        const vueSFC = this.wrapAsVueSFC(script.content);
        
        // 使用 ESLint 检查
        const results = await this.eslint.lintText(vueSFC, {
          filePath: 'inline.vue' // 虚拟文件路径
        });
        
        if (results && results.length > 0) {
          const result = results[0];
          
          // 处理 ESLint 结果
          if (result.messages && result.messages.length > 0) {
            for (const message of result.messages) {
              const severity = message.severity === 2 ? 'high' : message.severity === 1 ? 'medium' : 'low';
              
              // 计算在原始 HTML 中的位置
              // Vue SFC 包装会添加 template 和 script 标签，需要减去这些行
              // template 标签通常占用 1 行，script 标签开始占用 1 行
              const templateLines = 1; // <template></template>
              const scriptTagLines = 1; // <script setup> 或 <script>
              const offsetLines = templateLines + scriptTagLines;
              
              // 如果 message.line 小于等于 offsetLines，说明错误在包装的标签中，跳过
              if (message.line <= offsetLines) {
                continue;
              }
              
              const actualLine = message.line - offsetLines - 1; // -1 因为行号从 1 开始
              const lineOffset = this.getLineOffset(script.content, Math.max(0, actualLine));
              const position = script.startIndex + lineOffset;
              
              issues.push({
                type: 'vue',
                code: `ESLINT_${message.ruleId || 'UNKNOWN'}`,
                severity,
                message: message.message,
                fixable: message.fix !== null && message.fix !== undefined,
                fixStrategy: 'ESLINT_AUTO_FIX',
                context: {
                  ruleId: message.ruleId,
                  line: message.line,
                  column: message.column,
                  endLine: message.endLine,
                  endColumn: message.endColumn,
                  scriptIndex: scripts.indexOf(script),
                  position,
                  source: message.source || null
                }
              });
              
              if (severity === 'high') {
                metadata.eslintErrors++;
              } else {
                metadata.eslintWarnings++;
              }
            }
          }
        }
      } catch (error) {
        // ESLint 检查失败，记录但不中断流程
        console.warn('[ESLintChecker] 检查 script 失败:', error.message);
        issues.push({
          type: 'vue',
          code: 'ESLINT_CHECK_ERROR',
          severity: 'low',
          message: `ESLint 检查失败: ${error.message}`,
          fixable: false,
          context: {
            scriptIndex: scripts.indexOf(script),
            error: error.message
          }
        });
      }
    }
    
    return { issues, metadata };
  }
  
  /**
   * 计算指定行在原始内容中的字符偏移量
   */
  getLineOffset(content, targetLine) {
    const lines = content.split('\n');
    let offset = 0;
    
    for (let i = 0; i < Math.min(targetLine, lines.length); i++) {
      offset += lines[i].length + 1; // +1 for newline
    }
    
    return offset;
  }
}

module.exports = ESLintChecker;
