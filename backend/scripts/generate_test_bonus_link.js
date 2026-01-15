/**
 * 生成早期用户额外奖励链接（支持生产环境）
 * 
 * 使用方法：
 * node scripts/generate_test_bonus_link.js [userId] [--production]
 * 
 * 参数：
 * - userId: 用户ID（可选，如果不提供会生成示例）
 * - --production: 强制使用生产环境配置
 * 
 * 环境变量：
 * - NODE_ENV=production: 自动使用生产环境
 * - FRONTEND_URL: 前端URL（生产环境应设置为 https://edunest.app）
 * - API_URL: API URL（可选）
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env'), override: true });
const jwt = require('jsonwebtoken');
const config = require('../src/config');

// 解析命令行参数
// process.argv 格式: ['node', '/path/to/script.js', 'arg1', 'arg2', ...]
const args = process.argv.slice(2).filter(arg => {
  // 过滤掉 node 路径和脚本路径
  return arg && 
         !arg.includes('node') && 
         !arg.includes('generate_test_bonus_link') &&
         !arg.endsWith('.js');
});

const isProduction = args.includes('--production') || process.env.NODE_ENV === 'production';
// 移除 --production 参数，找到第一个剩余的参数作为 userId
const userId = args.filter(arg => arg !== '--production').find(arg => !arg.startsWith('--')) || '00000000-0000-0000-0000-000000000000';

// 验证 JWT_SECRET
if (!config.JWT_SECRET || config.JWT_SECRET === 'dev-secret-key' || config.JWT_SECRET.length < 50) {
  console.error('\n❌ 错误: JWT_SECRET 未正确配置！');
  console.error('   生产环境必须设置强密钥（至少50字符）');
  console.error('   请在 .env 文件中设置 JWT_SECRET\n');
  process.exit(1);
}

// 确定前端 URL
let FRONTEND_URL;
if (isProduction) {
  // 生产环境：如果环境变量是 localhost，则使用默认的生产环境URL
  const envFrontendUrl = process.env.FRONTEND_URL;
  if (!envFrontendUrl || envFrontendUrl.includes('localhost') || envFrontendUrl.includes('127.0.0.1')) {
    FRONTEND_URL = 'https://edunest.app';
    if (envFrontendUrl) {
      console.warn(`⚠️  警告: FRONTEND_URL 设置为 ${envFrontendUrl}，生产环境应使用 HTTPS`);
      console.log(`ℹ️  已自动切换到生产环境URL: ${FRONTEND_URL}`);
    } else {
      console.log(`ℹ️  未设置 FRONTEND_URL，使用默认生产环境URL: ${FRONTEND_URL}`);
    }
  } else {
    FRONTEND_URL = envFrontendUrl;
    if (!FRONTEND_URL.startsWith('https://')) {
      console.warn('⚠️  警告: 生产环境应使用 HTTPS，当前使用:', FRONTEND_URL);
    }
  }
} else {
  FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
}

// 确定 API URL
const API_URL = process.env.API_URL || (isProduction ? 'https://api.edunest.app' : 'http://localhost:3001');

// 生成 bonus token
const bonusToken = jwt.sign(
  { 
    userId: userId, 
    type: 'early_user_bonus',
    timestamp: Date.now()
  },
  config.JWT_SECRET,
  { expiresIn: '30d' }
);

// 生成链接
const bonusLink = `${FRONTEND_URL}/claim-bonus?token=${bonusToken}`;
const apiEndpoint = `${API_URL}/api/early-user-bonus/claim?token=${bonusToken}`;

console.log('\n' + '='.repeat(70));
console.log('🎁 早期用户额外奖励链接生成器');
console.log('='.repeat(70));

// 显示环境信息
console.log(`\n📌 环境: ${isProduction ? '🔴 生产环境' : '🟢 开发环境'}`);
console.log(`📌 前端URL: ${FRONTEND_URL}`);
console.log(`📌 API URL: ${API_URL}`);
console.log(`📌 JWT_SECRET: ${config.JWT_SECRET ? '✅ 已配置 (' + config.JWT_SECRET.length + ' 字符)' : '❌ 未配置'}`);

if (userId === '00000000-0000-0000-0000-000000000000') {
  console.log('\n⚠️  注意: 使用的是示例 userId，请替换为真实的用户ID');
  console.log('使用方法: node scripts/generate_test_bonus_link.js <真实用户ID> [--production]');
}

console.log(`\n👤 用户ID: ${userId}`);
console.log(`\n🔑 Token:`);
console.log(bonusToken);
console.log(`\n🌐 前端链接:`);
console.log(bonusLink);
console.log(`\n🔗 API 端点:`);
console.log(apiEndpoint);

console.log(`\n测试方法:`);
console.log(`\n1. 浏览器测试:`);
console.log(`   在浏览器中打开: ${bonusLink}`);
console.log(`\n2. curl 测试:`);
console.log(`   curl "${apiEndpoint}"`);
console.log(`\n3. 使用 Postman 或类似工具:`);
console.log(`   GET ${apiEndpoint}`);

console.log(`\n预期响应（首次领取）:`);
console.log(JSON.stringify({
  success: true,
  data: {
    claimed: true,
    creditsAwarded: 50,
    balance: 150, // 假设用户已有100积分
    message: '成功领取50积分！'
  }
}, null, 2));

console.log(`\n预期响应（已领取过）:`);
console.log(JSON.stringify({
  success: true,
  data: {
    alreadyClaimed: true,
    message: '您已经领取过额外奖励了',
    balance: 150
  }
}, null, 2));

console.log('\n' + '='.repeat(70));
console.log('\n✅ 测试链接已生成！');
