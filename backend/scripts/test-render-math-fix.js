#!/usr/bin/env node
/**
 * 验证 RendererEngine 不会误删 AI 自定义的 renderMathInElement 实现
 * 运行: node scripts/test-render-math-fix.js
 */
const path = require('path');
const { createRendererEngine } = require('../src/services/rendererEngine');

const AI_HTML_WITH_CUSTOM_RENDER = `<!DOCTYPE html>
<html>
<head><script src="katex.min.js"></script></head>
<body>
<div id="app">$x^2$</div>
<script>
// Helper for KaTeX
function renderMathInElement(el, options) {
    const text = el.innerHTML;
    const mathBlocks = el.querySelectorAll('div, p, span, button');
    mathBlocks.forEach(block => {
        if (block.textContent.includes('$')) {
            try {
                const content = block.innerHTML;
                const newContent = content.replace(/\\$\\$(.*?)\\$\\$/g, (m, p1) => katex.renderToString(p1, {displayMode: true}))
                    .replace(/\\$(.*?)\\$/g, (m, p1) => katex.renderToString(p1, {displayMode: false}));
                block.innerHTML = newContent;
            } catch (e) {}
        }
    });
}
renderMathInElement(document.getElementById('app'), {});
</script>
</body>
</html>`;

async function run() {
  console.log('[Test] 开始验证 RendererEngine 不会误删 AI 自定义 renderMathInElement...\n');
  
  const engine = createRendererEngine();
  const result = await engine.process(AI_HTML_WITH_CUSTOM_RENDER, { autoFix: true });
  
  const preserved = result.html.includes('function renderMathInElement') && 
                   result.html.includes('katex.renderToString') &&
                   !result.html.includes('KaTeXcatch');
  
  if (preserved) {
    console.log('✅ 通过：AI 自定义的 renderMathInElement 已保留，未被误删');
    console.log('   - 函数定义存在:', result.html.includes('function renderMathInElement'));
    console.log('   - katex.renderToString 存在:', result.html.includes('katex.renderToString'));
    console.log('   - 无 KaTeXcatch 损坏:', !result.html.includes('KaTeXcatch'));
  } else {
    console.log('❌ 失败：renderMathInElement 可能被误删或损坏');
    console.log('   - 函数定义存在:', result.html.includes('function renderMathInElement'));
    console.log('   - katex.renderToString 存在:', result.html.includes('katex.renderToString'));
    console.log('   - 无 KaTeXcatch 损坏:', !result.html.includes('KaTeXcatch'));
    const snippet = result.html.includes('Helper for KaTeX') 
      ? result.html.match(/Helper for KaTeX[\s\S]{0,80}/)?.[0] 
      : '(未找到)';
    console.log('   - 相关代码片段:', snippet);
  }
  
  process.exit(preserved ? 0 : 1);
}

run().catch(e => {
  console.error('测试异常:', e);
  process.exit(1);
});
