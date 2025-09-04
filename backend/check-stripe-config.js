#!/usr/bin/env node

// Stripe配置检查脚本
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

console.log('🔍 检查Stripe配置...\n');

// 必需的Stripe环境变量
const requiredVars = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY', 
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_PRO'
];

// 前端环境变量
const frontendVars = [
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'FRONTEND_URL'
];

console.log('📋 后端Stripe配置:');
let backendConfigOk = true;
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`  ❌ ${varName}: 未设置`);
    backendConfigOk = false;
  }
});

console.log('\n📋 前端Stripe配置:');
let frontendConfigOk = true;
frontendVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}: ${value}`);
  } else {
    console.log(`  ❌ ${varName}: 未设置`);
    frontendConfigOk = false;
  }
});

console.log('\n🔧 Stripe配置状态:');
if (backendConfigOk && frontendConfigOk) {
  console.log('  ✅ 所有必需的Stripe配置都已设置');
} else {
  console.log('  ❌ 部分Stripe配置缺失，请参考下面的配置指南');
}

console.log('\n📖 Stripe配置指南:');
console.log('1. 登录Stripe Dashboard: https://dashboard.stripe.com/');
console.log('2. 获取API密钥: Developers > API keys');
console.log('3. 创建产品价格: Products > Add product');
console.log('4. 配置Webhook: Developers > Webhooks');
console.log('5. 设置环境变量（见下面的示例）');

console.log('\n📝 环境变量示例:');
console.log('# Stripe支付配置');
console.log('STRIPE_SECRET_KEY=sk_test_...');
console.log('STRIPE_PUBLISHABLE_KEY=pk_test_...');
console.log('STRIPE_WEBHOOK_SECRET=whsec_...');
console.log('STRIPE_PRICE_ID_PRO=price_...');
console.log('');
console.log('# 前端Stripe配置');
console.log('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...');
console.log('FRONTEND_URL=http://localhost:3000');

console.log('\n🚀 下一步操作:');
if (backendConfigOk && frontendConfigOk) {
  console.log('1. 测试Stripe连接');
  console.log('2. 验证Webhook配置');
  console.log('3. 测试支付流程');
} else {
  console.log('1. 完成Stripe配置');
  console.log('2. 设置环境变量');
  console.log('3. 重新运行此脚本');
}
