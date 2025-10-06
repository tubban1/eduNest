const DatabaseService = require('./src/services/database');
const logger = require('./src/utils/logger');

async function fixStuckTask() {
  try {
    console.log('=== 修复卡住的任务 ===');
    
    // 查找卡住的任务（超过10分钟还在processing状态）
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: stuckTasks, error } = await DatabaseService.supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('status', 'processing')
      .eq('action_type', 'generate')
      .lt('updated_at', tenMinutesAgo)
      .not('content_id', 'is', null);
    
    if (error) {
      console.error('❌ 查询卡住任务失败:', error);
      return;
    }
    
    console.log(`找到 ${stuckTasks.length} 个卡住的任务`);
    
    for (const task of stuckTasks) {
      console.log(`处理卡住任务: ${task.id}, content_id: ${task.content_id}`);
      
      // 将状态更新为failed
      const { error: updateError } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .update({
          status: 'failed',
          error_message: '任务超时，自动标记为失败',
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);
      
      if (updateError) {
        console.error(`❌ 更新任务状态失败: ${task.id}`, updateError);
      } else {
        console.log(`✅ 任务状态已更新为失败: ${task.id}`);
      }
    }
    
    // 检查当前队列状态
    console.log('\n=== 当前队列状态 ===');
    const { data: allTasks, error: allError } = await DatabaseService.supabase
      .from('ai_usage_logs')
      .select('status')
      .eq('action_type', 'generate')
      .not('content_id', 'is', null);
    
    if (!allError && allTasks) {
      const statusCounts = allTasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {});
      
      console.log('任务状态统计:', statusCounts);
    }
    
  } catch (error) {
    console.error('❌ 修复过程中出错:', error);
  }
}

// 运行修复
fixStuckTask().then(() => {
  console.log('\n=== 修复完成 ===');
  process.exit(0);
}).catch(error => {
  console.error('修复失败:', error);
  process.exit(1);
});
