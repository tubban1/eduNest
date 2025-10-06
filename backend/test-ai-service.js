const aiService = require('./src/services/aiService');

async function testAIService() {
  try {
    console.log('=== 测试AI服务 ===');
    
    // 测试简单的AI生成
    console.log('开始测试AI生成...');
    
    const result = await aiService.generateEducationalContent(
      '小学数学加法运算',
      'understanding',
      '测试AI服务是否正常工作',
      'zh-CN',
      '1145c642-0fc9-4c85-8f74-c3ef6f413242', // 使用您的用户ID
      'generate',
      'kimi',
      null, // requestId
      false // isAsyncMode = false，同步模式
    );
    
    console.log('AI生成结果:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ AI服务正常工作');
    } else {
      console.log('❌ AI服务出现问题:', result.error);
    }
    
  } catch (error) {
    console.error('❌ AI服务测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行测试
testAIService().then(() => {
  console.log('\n=== 测试完成 ===');
  process.exit(0);
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
