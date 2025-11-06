/**
 * HTML 组合工具测试
 * 运行: node htmlCombiner.test.js
 */

const { combineCodeBlocksToFullHTML, extractCodeBlocksFromFullHTML } = require('./htmlCombiner');

function testCombineBasic() {
  console.log('测试 1: 基本组合');
  const html = '<div id="app">Hello</div>';
  const css = 'body { margin: 0; }';
  const js = 'console.log("test");';
  const links = ['https://unpkg.com/vue@3/dist/vue.global.prod.js'];
  
  const result = combineCodeBlocksToFullHTML(html, css, js, links);
  
  if (result.includes('<!DOCTYPE html>') &&
      result.includes(html) &&
      result.includes(css) &&
      result.includes(js) &&
      result.includes(links[0])) {
    console.log('  ✓ 通过');
    return true;
  } else {
    console.log('  ✗ 失败');
    console.log('  结果:', result.substring(0, 200));
    return false;
  }
}

function testCombineWithExternalCSS() {
  console.log('测试 2: 外部 CSS 链接');
  const html = '<div>Test</div>';
  const css = '';
  const js = '';
  const links = [
    'https://cdn.jsdelivr.net/npm/bootstrap@5/dist/css/bootstrap.min.css',
    'https://unpkg.com/vue@3/dist/vue.global.prod.js'
  ];
  
  const result = combineCodeBlocksToFullHTML(html, css, js, links);
  
  if (result.includes('bootstrap.min.css') &&
      result.includes('vue.global.prod.js') &&
      result.includes('<link rel="stylesheet"')) {
    console.log('  ✓ 通过');
    return true;
  } else {
    console.log('  ✗ 失败');
    return false;
  }
}

function testCombineFullDocument() {
  console.log('测试 3: 完整文档注入');
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
</head>
<body>
  <div>Content</div>
</body>
</html>`;
  const css = '.test { color: red; }';
  const js = 'alert("test");';
  
  const result = combineCodeBlocksToFullHTML(fullHtml, css, js, []);
  
  if (result.includes(css) &&
      result.includes(js) &&
      result.includes('<!DOCTYPE html>')) {
    console.log('  ✓ 通过');
    return true;
  } else {
    console.log('  ✗ 失败');
    return false;
  }
}

function testExtract() {
  console.log('测试 4: 从完整 HTML 提取代码块');
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://example.com/style.css">
  <style>
    body { margin: 0; }
  </style>
</head>
<body>
  <div id="app">Hello</div>
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <script>
    console.log("test");
  </script>
</body>
</html>`;
  
  const extracted = extractCodeBlocksFromFullHTML(fullHtml);
  
  if (extracted.html.includes('app') &&
      extracted.css.includes('margin: 0') &&
      extracted.js.includes('console.log') &&
      extracted.externalLinks.includes('style.css') &&
      extracted.externalLinks.includes('vue.global.prod.js')) {
    console.log('  ✓ 通过');
    return true;
  } else {
    console.log('  ✗ 失败');
    console.log('  提取结果:', extracted);
    return false;
  }
}

function testRoundTrip() {
  console.log('测试 5: 往返测试（组合 -> 提取 -> 组合）');
  const html = '<div id="app">Test</div>';
  const css = 'body { padding: 20px; }';
  const js = 'const app = Vue.createApp({});';
  const links = ['https://unpkg.com/vue@3/dist/vue.global.prod.js'];
  
  // 组合
  const combined = combineCodeBlocksToFullHTML(html, css, js, links);
  
  // 提取
  const extracted = extractCodeBlocksFromFullHTML(combined);
  
  // 再次组合
  const recombined = combineCodeBlocksToFullHTML(
    extracted.html,
    extracted.css,
    extracted.js,
    extracted.externalLinks
  );
  
  // 验证关键内容是否一致
  if (recombined.includes(html) &&
      recombined.includes('padding: 20px') &&
      recombined.includes('createApp') &&
      recombined.includes(links[0])) {
    console.log('  ✓ 通过');
    return true;
  } else {
    console.log('  ✗ 失败');
    return false;
  }
}

// 运行所有测试
console.log('开始运行 HTML 组合工具测试...\n');

const tests = [
  testCombineBasic,
  testCombineWithExternalCSS,
  testCombineFullDocument,
  testExtract,
  testRoundTrip
];

let passed = 0;
let failed = 0;

tests.forEach(test => {
  try {
    if (test()) {
      passed++;
    } else {
      failed++;
    }
  } catch (error) {
    console.log(`  ✗ 异常: ${error.message}`);
    failed++;
  }
});

console.log(`\n测试完成: ${passed} 通过, ${failed} 失败`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('所有测试通过！');
}

