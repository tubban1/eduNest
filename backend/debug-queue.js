const DatabaseService = require('./src/services/database');
const asyncGenerationQueue = require('./src/services/asyncGenerationQueue');
const logger = require('./src/utils/logger');

async function debugQueue() {
  try {
    console.log('=== 调试异步生成队列 ===');
    
    // 1. 检查数据库连接
    console.log('1. 检查数据库连接...');
    const { data: testData, error: dbError } = await DatabaseService.supabase
      .from('ai_usage_logs')
      .select('*')
      .limit(1);
    
    if (dbError) {
      console.error('❌ 数据库连接失败:', dbError);
      return;
    }
    console.log('✅ 数据库连接正常');
    
    // 2. 检查队列状态
    console.log('\n2. 检查队列状态...');
    const queueStatus = await asyncGenerationQueue.getQueueStatus();
    console.log('队列状态:', JSON.stringify(queueStatus, null, 2));
    
    // 3. 检查待处理任务
    console.log('\n3. 检查待处理任务...');
    const { data: pendingTasks, error: pendingError } = await DatabaseService.supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('status', 'pending')
      .eq('action_type', 'generate')
      .not('content_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(5);
    
    if (pendingError) {
      console.error('❌ 查询待处理任务失败:', pendingError);
    } else {
      console.log(`待处理任务数量: ${pendingTasks.length}`);
      pendingTasks.forEach((task, index) => {
        console.log(`任务 ${index + 1}:`, {
          id: task.id,
          content_id: task.content_id,
          user_query: task.user_query,
          created_at: task.created_at,
          request_id: task.request_id
        });
      });
    }
    
    // 4. 检查处理中任务
    console.log('\n4. 检查处理中任务...');
    const { data: processingTasks, error: processingError } = await DatabaseService.supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('status', 'processing')
      .eq('action_type', 'generate')
      .not('content_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(5);
    
    if (processingError) {
      console.error('❌ 查询处理中任务失败:', processingError);
    } else {
      console.log(`处理中任务数量: ${processingTasks.length}`);
      processingTasks.forEach((task, index) => {
        console.log(`任务 ${index + 1}:`, {
          id: task.id,
          content_id: task.content_id,
          user_query: task.user_query,
          created_at: task.created_at,
          updated_at: task.updated_at,
          request_id: task.request_id
        });
      });
    }
    
    // 5. 检查AI服务配置
    console.log('\n5. 检查AI服务配置...');
    try {
      const aiProviderFactory = require('./src/services/aiProviderFactory');
      const providers = aiProviderFactory.getAvailableProviders();
      console.log('可用AI提供商:', providers);
      
      const defaultProvider = aiProviderFactory.defaultProvider;
      console.log('默认提供商:', defaultProvider);
    } catch (error) {
      console.log('AI服务配置检查失败:', error.message);
    }
    
    // 6. 手动触发队列处理
    console.log('\n6. 手动触发队列处理...');
    await asyncGenerationQueue.processQueue();
    console.log('✅ 队列处理已触发');
    
    // 等待5秒后再次检查状态
    console.log('\n等待5秒后再次检查状态...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const finalQueueStatus = await asyncGenerationQueue.getQueueStatus();
    console.log('最终队列状态:', JSON.stringify(finalQueueStatus, null, 2));
    
  } catch (error) {
    console.error('❌ 调试过程中出错:', error);
  }
}

// 运行调试
debugQueue().then(() => {
  console.log('\n=== 调试完成 ===');
  process.exit(0);
}).catch(error => {
  console.error('调试失败:', error);
  process.exit(1);
});
