const asyncGenerationQueue = require('./src/services/asyncGenerationQueue');
const DatabaseService = require('./src/services/database');

async function testAsyncGeneration() {
  try {
    console.log('=== 测试异步生成 ===');
    
    // 1. 创建一个测试内容
    console.log('1. 创建测试内容...');
    const contentData = {
      title: '异步生成测试',
      description: '测试异步生成功能',
      code_html: '',
      code_css: '',
      code_js: '',
      external_links: [],
      tags: ['测试'],
      content_type: 'vue',
      language_code: 'zh-CN'
    };
    
    const testContent = await DatabaseService.createContent(contentData, '1145c642-0fc9-4c85-8f74-c3ef6f413242');
    console.log('✅ 测试内容创建成功:', testContent.id);
    
    // 2. 添加异步生成任务
    console.log('\n2. 添加异步生成任务...');
    const generationParams = {
      user_id: '1145c642-0fc9-4c85-8f74-c3ef6f413242',
      knowledge_point: '异步生成测试',
      learning_stage: 'understanding',
      description: '测试异步生成队列',
      language_code: 'zh-CN',
      provider: 'kimi'
    };
    
    const { log, requestId } = await asyncGenerationQueue.addTask(testContent.id, generationParams);
    console.log('✅ 异步任务添加成功:', requestId);
    
    // 3. 手动触发队列处理
    console.log('\n3. 手动触发队列处理...');
    await asyncGenerationQueue.processQueue();
    console.log('✅ 队列处理已触发');
    
    // 4. 监控任务状态
    console.log('\n4. 监控任务状态...');
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
      
      const { data: taskStatus, error } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .select('*')
        .eq('id', log.id)
        .single();
      
      if (!error && taskStatus) {
        console.log(`第 ${i + 1} 次检查: 状态=${taskStatus.status}, 更新时间=${taskStatus.updated_at}`);
        
        if (taskStatus.status === 'done' || taskStatus.status === 'failed') {
          console.log(`✅ 任务完成: ${taskStatus.status}`);
          console.log('最终状态:', JSON.stringify(taskStatus, null, 2));
          break;
        }
      }
    }
    
    // 5. 检查内容是否更新
    console.log('\n5. 检查内容是否更新...');
    const { data: finalContent, error: contentError } = await DatabaseService.supabase
      .from('content')
      .select('*')
      .eq('id', testContent.id)
      .single();
    
    if (!contentError && finalContent) {
      console.log('内容标题:', finalContent.title);
      console.log('HTML长度:', finalContent.code_html?.length || 0);
      console.log('CSS长度:', finalContent.code_css?.length || 0);
      console.log('JS长度:', finalContent.code_js?.length || 0);
    }
    
  } catch (error) {
    console.error('❌ 异步生成测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行测试
testAsyncGeneration().then(() => {
  console.log('\n=== 测试完成 ===');
  process.exit(0);
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});

