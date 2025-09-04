#!/usr/bin/env node

// 测试支付流程的脚本
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const axios = require('axios');

async function testPaymentFlow() {
  console.log('🧪 测试支付流程...\n');

  try {
    // 1. 检查环境变量
    console.log('📋 检查环境变量...');
    const requiredVars = [
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'STRIPE_PRICE_ID_PRO',
      'FRONTEND_URL'
    ];
    
    let configOk = true;
    requiredVars.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        console.log(`  ✅ ${varName}: ${varName.includes('KEY') ? value.substring(0, 20) + '...' : value}`);
      } else {
        console.log(`  ❌ ${varName}: 未设置`);
        configOk = false;
      }
    });

    if (!configOk) {
      console.log('\n❌ 环境变量配置不完整，请先完成配置');
      return;
    }

    console.log('\n✅ 环境变量配置完整');

    // 2. 测试后端服务器连接
    console.log('\n🔌 测试后端服务器连接...');
    try {
      const healthResponse = await axios.get('http://localhost:3001/health');
      console.log('✅ 后端服务器连接正常');
      console.log('📊 服务器状态:', healthResponse.data);
    } catch (error) {
      console.log('❌ 后端服务器连接失败:', error.message);
      console.log('💡 请确保后端服务器正在运行: npm start');
      return;
    }

    // 3. 测试API端点
    console.log('\n🌐 测试API端点...');
    try {
      const apiResponse = await axios.get('http://localhost:3001/api/test');
      console.log('✅ API端点正常');
      console.log('📊 API状态:', apiResponse.data);
    } catch (error) {
      console.log('❌ API端点测试失败:', error.message);
      return;
    }

    // 4. 提供测试步骤
    console.log('\n📝 下一步测试步骤:');
    console.log('1. 确保Stripe CLI监听器正在运行');
    console.log('2. 在浏览器中登录获取JWT token');
    console.log('3. 使用以下命令测试支付API:');
    console.log('');
    console.log('curl -X POST http://localhost:3001/api/payments/create-session \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\');
    console.log('  -d \'{"plan_type": "pro"}\'');
    console.log('');
    console.log('4. 检查Stripe CLI输出中的webhook事件');
    console.log('5. 验证数据库中是否创建了订阅记录');

    // 5. 检查Stripe CLI状态
    console.log('\n🔍 检查Stripe CLI状态...');
    const { exec } = require('child_process');
    exec('ps aux | grep "stripe listen"', (error, stdout, stderr) => {
      if (stdout.includes('stripe listen')) {
        console.log('✅ Stripe CLI监听器正在运行');
      } else {
        console.log('❌ Stripe CLI监听器未运行');
        console.log('💡 请运行: stripe listen --forward-to localhost:3001/api/payments/webhook');
      }
    });

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
testPaymentFlow();
