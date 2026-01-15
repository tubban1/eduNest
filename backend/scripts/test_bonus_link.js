/**
 * 测试早期用户额外奖励链接
 * 
 * 使用方法：
 * node scripts/test_bonus_link.js [userId]
 * 
 * 如果不提供 userId，会生成一个测试 token
 * 如果提供 userId，会为该用户生成一个有效的 token
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const DatabaseService = require('../src/services/database');
const logger = require('../src/utils/logger');

// 获取命令行参数
const userId = process.argv[2];

async function testBonusLink() {
  try {
    let testUserId = userId;
    
    // 如果没有提供 userId，获取第一个用户作为测试
    if (!testUserId) {
      const { data: users, error: usersError } = await DatabaseService.getAllUsers();
      if (usersError || !users || users.length === 0) {
        logger.error('无法获取用户列表', usersError);
        console.log('\n❌ 无法获取用户列表，请手动提供 userId');
        console.log('使用方法: node scripts/test_bonus_link.js <userId>');
        process.exit(1);
      }
      testUserId = users[0].id;
      console.log(`\n📝 使用第一个用户进行测试: ${users[0].email} (${testUserId})`);
    } else {
      // 验证用户是否存在
      const { data: user, error: userError } = await DatabaseService.getUserById(testUserId);
      if (userError || !user) {
        logger.error('用户不存在', { userId: testUserId, error: userError });
        console.log(`\n❌ 用户不存在: ${testUserId}`);
        process.exit(1);
      }
      console.log(`\n📝 为用户生成测试链接: ${user.email} (${testUserId})`);
    }
    
    // 生成 bonus token
    const bonusToken = jwt.sign(
      { 
        userId: testUserId, 
        type: 'early_user_bonus',
        timestamp: Date.now()
      },
      config.JWT_SECRET || 'dev-secret-key',
      { expiresIn: '30d' }
    );
    
    // 生成链接
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const bonusLink = `${FRONTEND_URL}/claim-bonus?token=${bonusToken}`;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎁 早期用户额外奖励测试链接');
    console.log('='.repeat(60));
    console.log(`\n用户ID: ${testUserId}`);
    console.log(`\nToken: ${bonusToken}`);
    console.log(`\n完整链接:`);
    console.log(bonusLink);
    console.log(`\nAPI 端点:`);
    console.log(`GET ${process.env.API_URL || 'http://localhost:3001'}/api/early-user-bonus/claim?token=${bonusToken}`);
    
    // 检查用户是否已领取过
    const { data: existingCredits } = await DatabaseService.getCreditsHistory(testUserId, 100, 0);
    const hasBonusCredit = existingCredits && existingCredits.some(
      credit => credit.change_type === 'early_user_bonus'
    );
    
    console.log(`\n当前状态:`);
    console.log(`  - 已领取额外奖励: ${hasBonusCredit ? '✅ 是' : '❌ 否'}`);
    
    const { data: balance } = await DatabaseService.getCreditsBalance(testUserId);
    console.log(`  - 当前积分余额: ${balance || 0}`);
    
    console.log(`\n测试步骤:`);
    console.log(`  1. 在浏览器中打开链接: ${bonusLink}`);
    console.log(`  2. 或使用 curl 测试:`);
    console.log(`     curl "${process.env.API_URL || 'http://localhost:3001'}/api/early-user-bonus/claim?token=${bonusToken}"`);
    
    if (hasBonusCredit) {
      console.log(`\n⚠️  注意: 该用户已经领取过额外奖励，API 会返回 alreadyClaimed: true`);
    } else {
      console.log(`\n✅ 该用户尚未领取，点击链接后会发放 50 积分`);
    }
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    logger.error('生成测试链接失败', error);
    console.error('\n❌ 错误:', error.message);
    process.exit(1);
  }
}

// 执行测试
if (require.main === module) {
  testBonusLink()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error('测试失败', error);
      process.exit(1);
    });
}

module.exports = { testBonusLink };
