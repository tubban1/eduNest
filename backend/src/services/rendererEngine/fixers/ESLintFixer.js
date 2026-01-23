/**
 * ESLintFixer - 使用 ESLint 自动修复 Vue 代码问题
 * 
 * 修复 ESLint 检测到的问题：
 * - Vue 3 语法错误
 * - ref 使用错误（.ref vs .value）
 * - 响应式数据使用问题
 */

const { ESLint } = require('eslint');

class ESLintFixer {
  constructor() {
    this.name = 'ESLintFixer';
    this.handles = [
      'ESLINT_VUE_NO_REF_AS_OPERAND',
      'ESLINT_VUE_REQUIRE_V_FOR_KEY',
      'ESLINT_VUE_NO_USE_V_IF_WITH_V_FOR',
      'ESLINT_NO_RESTRICTED_SYNTAX'
    ];
    this.eslint = null;
    this.initialized = false;
  }
  
  /**
   * 检查是否能修复这个问题
   */
  canFix(issue) {
    // 处理所有 ESLINT_ 开头的代码，或者明确列出的代码
    // 注意：只有 fixable 为 true 的问题才能修复
    return (issue.code.startsWith('ESLINT_') || this.handles.includes(issue.code)) && issue.fixable;
  }
  
  /**
   * 初始化 ESLint 实例（启用自动修复）
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
            // Vue 3 特定规则（启用自动修复）
            'vue/no-ref-as-operand': 'error',
            'vue/no-setup-props-destructure': 'warn',
            'vue/no-v-html': 'off',
            'vue/require-v-for-key': 'error',
            'vue/no-use-v-if-with-v-for': 'error',
            // 自定义规则：检测 .ref 使用错误（这个规则不能自动修复，需要手动处理）
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
        fix: true // 启用自动修复
      });
      
      this.initialized = true;
    } catch (error) {
      console.warn('[ESLintFixer] 初始化失败，将跳过 ESLint 修复:', error.message);
      this.eslint = null;
    }
  }
  
  /**
   * 从 HTML 中提取 Vue 代码（script 标签中的内容）
   */
  extractVueCode(html) {
    const scripts = [];
    
    // 匹配 <script> 标签
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
   * 将 script 内容包装成 Vue 单文件组件格式
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
   * 从 Vue SFC 中提取 script 内容
   */
  unwrapFromVueSFC(vueSFC) {
    const scriptMatch = vueSFC.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      // 移除 <script setup> 标签和内容，只保留实际的代码
      let content = scriptMatch[1];
      // 移除可能的 setup 关键字（如果存在）
      content = content.replace(/^\s*\/\/.*$/gm, ''); // 移除注释
      return content.trim();
    }
    return '';
  }
  
  /**
   * 执行修复
   */
  async fix(html, issue, context = {}) {
    // 初始化 ESLint
    await this.initialize();
    
    if (!this.eslint) {
      return { success: false, html, changes: [], explanation: 'ESLint 未初始化' };
    }
    
    const changes = [];
    let fixedHtml = html;
    
    // 提取所有 Vue script 标签
    const scripts = this.extractVueCode(html);
    
    if (scripts.length === 0) {
      return { success: false, html, changes: [], explanation: '未找到 Vue 代码' };
    }
    
    // 对每个 script 标签进行修复
    for (let i = scripts.length - 1; i >= 0; i--) {
      const script = scripts[i];
      
      try {
        // 包装成 Vue SFC 格式
        const vueSFC = this.wrapAsVueSFC(script.content);
        
        // 使用 ESLint 自动修复
        const results = await this.eslint.lintText(vueSFC, {
          filePath: 'inline.vue'
        });
        
        if (results && results.length > 0) {
          const result = results[0];
          
          // 检查是否有修复
          if (result.output && result.output !== vueSFC) {
            // 提取修复后的 script 内容
            const fixedScriptContent = this.unwrapFromVueSFC(result.output);
            
            // 构建修复后的 script 标签
            const scriptTagMatch = script.fullMatch.match(/<script([^>]*)>/);
            const scriptAttrs = scriptTagMatch ? scriptTagMatch[1] : '';
            const fixedScriptTag = `<script${scriptAttrs}>${fixedScriptContent}</script>`;
            
            // 替换原始 HTML 中的 script 标签
            fixedHtml = fixedHtml.substring(0, script.startIndex) + 
                       fixedScriptTag + 
                       fixedHtml.substring(script.endIndex);
            
            changes.push({
              type: 'replace',
              location: `script tag ${i + 1}`,
              before: script.fullMatch.substring(0, 200) + (script.fullMatch.length > 200 ? '...' : ''),
              after: fixedScriptTag.substring(0, 200) + (fixedScriptTag.length > 200 ? '...' : ''),
              reason: `ESLint 自动修复了 ${result.messages?.filter(m => m.fix).length || 0} 处问题`
            });
          }
        }
      } catch (error) {
        console.warn(`[ESLintFixer] 修复 script ${i} 失败:`, error.message);
        // 继续处理其他 script 标签
      }
    }
    
    return {
      success: changes.length > 0,
      html: fixedHtml,
      changes,
      explanation: changes.length > 0 
        ? `ESLint 自动修复了 ${changes.length} 个 script 标签中的问题`
        : '未检测到可自动修复的问题'
    };
  }
}

module.exports = ESLintFixer;
