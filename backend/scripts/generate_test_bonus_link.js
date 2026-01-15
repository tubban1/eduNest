/**
 * 生成早期用户额外奖励测试链接
 * 
 * 使用方法：
 * node scripts/generate_test_bonus_link.js [userId]
 * 
 * 如果不提供 userId，会生成一个示例 token（需要替换为真实 userId）
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const jwt = require('jsonwebtoken');
const config = require('../src/config');

// 获取命令行参数
const userId = process.argv[2] || '00000000-0000-0000-0000-000000000000'; // 默认示例 UUID

// 生成 bonus token
const bonusToken = jwt.sign(
  { 
    userId: userId, 
    type: 'early_user_bonus',
    timestamp: Date.now()
  },
  config.JWT_SECRET || 'dev-secret-key',
  { expiresIn: '30d' }
);

// 生成链接
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';
const bonusLink = `${FRONTEND_URL}/claim-bonus?token=${bonusToken}`;
const apiEndpoint = `${API_URL}/api/early-user-bonus/claim?token=${bonusToken}`;

console.log('\n' + '='.repeat(70));
console.log('🎁 早期用户额外奖励测试链接');
console.log('='.repeat(70));

if (userId === '00000000-0000-0000-0000-000000000000') {
  console.log('\n⚠️  注意: 使用的是示例 userId，请替换为真实的用户ID');
  console.log('使用方法: node scripts/generate_test_bonus_link.js <真实用户ID>');
}

console.log(`\n用户ID: ${userId}`);
console.log(`\nToken:`);
console.log(bonusToken);
console.log(`\n前端链接:`);
console.log(bonusLink);
console.log(`\nAPI 端点:`);
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
