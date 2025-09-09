#!/usr/bin/env node

/**
 * 测试AI提供商功能的脚本
 * 使用方法: node test-ai-providers.js
 */

const AIProviderFactory = require('./backend/src/services/aiProviderFactory');

async function testAIProviders() {
  console.log('🤖 测试AI提供商功能...\n');
  
  const factory = new AIProviderFactory();
  
  try {
    // 1. 获取可用提供商列表
    console.log('1. 获取可用提供商列表:');
    const providers = factory.getAvailableProviders();
    console.log(JSON.stringify(providers, null, 2));
    console.log('');
    
    // 2. 获取默认提供商
    console.log('2. 获取默认提供商:');
    const defaultProvider = factory.defaultProvider;
    console.log(`默认提供商: ${defaultProvider}`);
    console.log('');
    
    // 3. 测试提供商连接（如果配置了API密钥）
    console.log('3. 测试提供商连接:');
    for (const provider of providers) {
      if (provider.configured) {
        console.log(`测试 ${provider.name}...`);
        const result = await factory.testProvider(provider.key);
        console.log(`结果: ${result.success ? '✅ 成功' : '❌ 失败'}`);
        if (result.success) {
          console.log(`  响应时间: ${result.latency}ms`);
          console.log(`  模型: ${result.model}`);
        } else {
          console.log(`  错误: ${result.error}`);
        }
        console.log('');
      } else {
        console.log(`${provider.name}: ⚠️ 未配置API密钥`);
      }
    }
    
    // 4. 测试OpenAI配置生成
    console.log('4. 测试OpenAI配置生成:');
    try {
      const openaiConfig = factory.createOpenAIConfig();
      console.log('OpenAI配置:', {
        baseURL: openaiConfig.baseURL,
        hasApiKey: !!openaiConfig.apiKey
      });
    } catch (error) {
      console.log('OpenAI配置生成失败:', error.message);
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
testAIProviders().then(() => {
  console.log('\n✅ 测试完成');
}).catch(error => {
  console.error('\n❌ 测试出错:', error);
  process.exit(1);
});
