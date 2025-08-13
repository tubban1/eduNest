const { safeReplace, testSafeReplace } = require('./src/services/aiService');

console.log('🚀 开始测试安全替换函数...\n');

// 运行内置测试
testSafeReplace();

console.log('\n🔍 额外安全测试:');

// 测试特殊字符
const specialChars = [
  '普通文本',
  '包含"双引号"的文本',
  "包含'单引号'的文本",
  '包含\n换行符的文本',
  '包含\t制表符的文本',
  '包含\\反斜杠的文本',
  '包含<script>alert("xss")</script>的文本',
  '包含SQL注入: \'; DROP TABLE users; --的文本',
  '包含正则表达式特殊字符: .*+?^${}()|[\\]的文本',
  '包含Unicode字符: 🚀🎉💻的文本'
];

specialChars.forEach((text, index) => {
  const template = '知识点：{{knowledge_point}}';
  const result = safeReplace(template, '{{knowledge_point}}', text);
  
  console.log(`测试 ${index + 1}:`);
  console.log(`  输入: ${text}`);
  console.log(`  输出: ${result}`);
  console.log(`  长度: ${result.length}`);
  console.log(`  是否包含原始文本: ${result.includes(text) ? '❌ 危险' : '✅ 安全'}`);
  console.log('');
});

// 测试模板注入攻击
console.log('🛡️ 模板注入攻击测试:');
const maliciousTemplates = [
  '{{knowledge_point}}',
  '{{knowledge_point}}{{knowledge_point}}',
  '{{knowledge_point}} 其他内容',
  '前缀 {{knowledge_point}} 后缀'
];

maliciousTemplates.forEach((template, index) => {
  const maliciousInput = '{{knowledge_point}}';
  const result = safeReplace(template, '{{knowledge_point}}', maliciousInput);
  
  console.log(`模板 ${index + 1}:`);
  console.log(`  模板: ${template}`);
  console.log(`  恶意输入: ${maliciousInput}`);
  console.log(`  结果: ${result}`);
  console.log(`  是否包含占位符: ${result.includes('{{knowledge_point}}') ? '❌ 危险' : '✅ 安全'}`);
  console.log('');
});

console.log('✅ 安全替换函数测试完成！'); 