/**
 * 检查 JWT_SECRET 配置
 * 用于诊断环境变量加载问题
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env'), override: true });
const config = require('../src/config');
const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(70));
console.log('🔍 JWT_SECRET 配置诊断');
console.log('='.repeat(70));

// 1. 检查 .env 文件是否存在
const envPath = path.resolve(__dirname, '../../.env');
console.log('\n1. .env 文件路径:');
console.log('   ', envPath);
console.log('   存在:', fs.existsSync(envPath) ? '✅' : '❌');

if (fs.existsSync(envPath)) {
  // 2. 检查 .env 文件内容
  console.log('\n2. .env 文件中的 JWT_SECRET:');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const jwtLine = envContent.split('\n').find(line => line.trim().startsWith('JWT_SECRET'));
  
  if (jwtLine) {
    console.log('   找到 JWT_SECRET 行:', jwtLine.substring(0, 50) + '...');
    const match = jwtLine.match(/JWT_SECRET\s*=\s*(.+)/);
    if (match) {
      const value = match[1].trim();
      // 移除可能的引号
      const cleanValue = value.replace(/^["']|["']$/g, '');
      console.log('   值长度:', cleanValue.length);
      console.log('   前20个字符:', cleanValue.substring(0, 20) + '...');
    } else {
      console.log('   ⚠️  无法解析 JWT_SECRET 值');
    }
  } else {
    console.log('   ❌ 未找到 JWT_SECRET 行');
  }
}

// 3. 检查 process.env
console.log('\n3. process.env.JWT_SECRET:');
if (process.env.JWT_SECRET) {
  console.log('   已加载:', '✅');
  console.log('   长度:', process.env.JWT_SECRET.length);
  console.log('   前20个字符:', process.env.JWT_SECRET.substring(0, 20) + '...');
} else {
  console.log('   未加载:', '❌');
}

// 4. 检查 config.JWT_SECRET
console.log('\n4. config.JWT_SECRET:');
if (config.JWT_SECRET) {
  console.log('   已加载:', '✅');
  console.log('   长度:', config.JWT_SECRET.length);
  console.log('   前20个字符:', config.JWT_SECRET.substring(0, 20) + '...');
  if (config.JWT_SECRET === 'dev-secret-key') {
    console.log('   ⚠️  使用的是默认值，.env 文件未正确加载');
  } else if (config.JWT_SECRET.length > 50) {
    console.log('   ✅ 看起来是正确的长密钥');
  }
} else {
  console.log('   未加载:', '❌');
}

// 5. 建议
console.log('\n5. 建议:');
if (!config.JWT_SECRET || config.JWT_SECRET === 'dev-secret-key') {
  console.log('   ❌ JWT_SECRET 未正确加载');
  console.log('   请检查:');
  console.log('   1. .env 文件中 JWT_SECRET 行格式是否正确（不要有引号）');
  console.log('   2. .env 文件路径是否正确');
  console.log('   3. 后端服务是否需要重启');
  console.log('   4. 确保 .env 文件中的 JWT_SECRET 行格式为:');
  console.log('      JWT_SECRET=你的密钥值');
} else {
  console.log('   ✅ JWT_SECRET 配置正确');
}

console.log('\n' + '='.repeat(70));
