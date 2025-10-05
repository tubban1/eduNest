const aiService = require('./aiService');
const DatabaseService = require('./database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class AsyncGenerationQueue {
  constructor() {
    this.maxConcurrent = 3;
    this.runningTasks = new Set();
    this.isProcessing = false;
    
    // 启动队列处理器
    this.startQueueProcessor();
  }

  /**
   * 添加生成任务到队列
   */
  async addTask(contentId, generationParams) {
    try {
      const requestId = uuidv4();
      
      // 创建 ai_usage_logs 记录
      const { data: log, error } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .insert({
          content_id: contentId,
          user_id: generationParams.user_id,
          user_query: generationParams.knowledge_point,
          action_type: 'generate',
          status: 'pending',
          request_id: requestId,
          request_payload: {
            knowledge_point: generationParams.knowledge_point,
            learning_stage: generationParams.learning_stage,
            description: generationParams.description,
            language_code: generationParams.language_code,
            provider: generationParams.provider
          }
        })
        .select()
        .single();

      if (error) {
        logger.error('创建生成任务失败:', error);
        throw new Error(`创建生成任务失败: ${error.message}`);
      }

      logger.info(`生成任务已添加到队列: contentId=${contentId}, requestId=${requestId}`);
      
      // 触发队列处理
      this.processQueue();
      
      return { log, requestId };
    } catch (error) {
      logger.error('添加生成任务失败:', error);
      throw error;
    }
  }

  /**
   * 启动队列处理器
   */
  startQueueProcessor() {
    // 每5秒检查一次队列
    setInterval(() => {
      this.processQueue();
    }, 5000);
    
    // 立即处理一次
    this.processQueue();
  }

  /**
   * 处理队列中的任务
   */
  async processQueue() {
    if (this.isProcessing) {
      return; // 避免重复处理
    }

    try {
      this.isProcessing = true;
      
      // 检查是否有空闲的处理槽位
      const availableSlots = this.maxConcurrent - this.runningTasks.size;
      if (availableSlots <= 0) {
        return; // 已达到最大并发数
      }

      // 获取待处理的任务
      const { data: pendingTasks, error } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .select('*')
        .eq('status', 'pending')
        .eq('action_type', 'generate')
        .not('content_id', 'is', null)
        .order('created_at', { ascending: true })
        .limit(availableSlots);

      if (error) {
        logger.error('查询待处理任务失败:', error);
        return;
      }

      if (!pendingTasks || pendingTasks.length === 0) {
        return; // 没有待处理的任务
      }

      logger.info(`找到 ${pendingTasks.length} 个待处理任务`);

      // 并行处理任务
      const promises = pendingTasks.map(task => this.processTask(task));
      await Promise.allSettled(promises);

    } catch (error) {
      logger.error('处理队列失败:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 处理单个任务
   */
  async processTask(task) {
    const taskId = task.id;
    
    try {
      // 添加到运行中任务集合
      this.runningTasks.add(taskId);
      
      logger.info(`开始处理任务: ${taskId}, contentId=${task.content_id}`);

      // 更新状态为 processing
      await this.updateTaskStatus(taskId, 'processing');

      // 调用 AI 生成服务（异步模式）
      const aiResult = await aiService.generateEducationalContent(
        task.request_payload.knowledge_point,
        task.request_payload.learning_stage || 'understanding',
        task.request_payload.description,
        task.request_payload.language_code,
        task.user_id,
        'generate',
        task.request_payload.provider,
        task.request_id,
        true // isAsyncMode = true
      );

      if (aiResult.success && aiResult.data) {
        // 生成成功，更新 content 表
        await this.updateContentFromAIResult(task.content_id, aiResult.data);
        
        // 更新任务状态为 done
        await this.updateTaskStatus(taskId, 'done');
        
        logger.info(`任务处理成功: ${taskId}`);
      } else {
        // 生成失败，处理重试逻辑
        await this.handleFailure(task, aiResult.error || 'AI生成失败');
      }

    } catch (error) {
      logger.error(`任务处理失败: ${taskId}`, error);
      await this.handleFailure(task, error.message);
    } finally {
      // 从运行中任务集合移除
      this.runningTasks.delete(taskId);
    }
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(taskId, status) {
    const validStatuses = ['pending', 'processing', 'done', 'failed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    const { error } = await DatabaseService.supabase
      .from('ai_usage_logs')
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);

    if (error) {
      logger.error(`更新任务状态失败: ${taskId}`, error);
      throw error;
    }
  }

  /**
   * 更新任务错误信息
   */
  async updateTaskError(taskId, errorMessage) {
    const { error } = await DatabaseService.supabase
      .from('ai_usage_logs')
      .update({ 
        error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);

    if (error) {
      logger.error(`更新任务错误信息失败: ${taskId}`, error);
    }
  }

  /**
   * 从 AI 结果更新 content 表
   */
  async updateContentFromAIResult(contentId, aiData) {
    try {
      const updateData = {
        title: aiData.title || 'AI生成内容',
        description: aiData.description || '',
        code_html: aiData.html || '',
        code_css: aiData.css || '',
        code_js: aiData.js || '',
        external_links: aiData.external_links || [],
        tags: aiData.tags || [],
        language_code: aiData.language_code || 'zh-CN',
        updated_at: new Date().toISOString()
      };

      const { error } = await DatabaseService.supabase
        .from('content')
        .update(updateData)
        .eq('id', contentId);

      if (error) {
        logger.error(`更新content失败: ${contentId}`, error);
        throw error;
      }

      logger.info(`Content更新成功: ${contentId}`);
    } catch (error) {
      logger.error(`更新content失败: ${contentId}`, error);
      throw error;
    }
  }

  /**
   * 处理失败逻辑
   */
  async handleFailure(task, errorMessage) {
    try {
      // 获取该 content 的重试次数
      const retryCount = await this.getRetryCount(task.content_id);
      
      logger.info(`任务失败: ${task.id}, 重试次数: ${retryCount}, 错误: ${errorMessage}`);

      if (retryCount < 2) {
        // 创建重试任务
        await this.createRetryTask(task);
        logger.info(`创建重试任务: contentId=${task.content_id}, retryCount=${retryCount + 1}`);
      } else {
        // 最终失败
        await this.updateTaskStatus(task.id, 'failed');
        await this.updateTaskError(task.id, errorMessage);
        logger.info(`任务最终失败: ${task.id}, 已达到最大重试次数`);
      }
    } catch (error) {
      logger.error(`处理失败逻辑错误: ${task.id}`, error);
    }
  }

  /**
   * 创建重试任务
   */
  async createRetryTask(originalTask) {
    try {
      const requestId = uuidv4();
      
      const { error } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .insert({
          content_id: originalTask.content_id,
          user_id: originalTask.user_id,
          user_query: originalTask.user_query,
          action_type: 'generate',
          status: 'pending',
          request_id: requestId,
          request_payload: originalTask.request_payload,
          error_message: `重试: ${originalTask.error_message || '未知错误'}`
        });

      if (error) {
        logger.error('创建重试任务失败:', error);
        throw error;
      }

      // 更新原任务状态为 failed
      await this.updateTaskStatus(originalTask.id, 'failed');
      
    } catch (error) {
      logger.error('创建重试任务失败:', error);
      throw error;
    }
  }

  /**
   * 获取重试次数
   */
  async getRetryCount(contentId) {
    try {
      const { data, error } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .select('id')
        .eq('content_id', contentId)
        .eq('action_type', 'generate');

      if (error) {
        logger.error('获取重试次数失败:', error);
        return 0;
      }

      return (data?.length || 1) - 1; // 减去第一次尝试
    } catch (error) {
      logger.error('获取重试次数失败:', error);
      return 0;
    }
  }

  /**
   * 获取队列状态
   */
  async getQueueStatus() {
    try {
      const { data, error } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .select('status')
        .eq('action_type', 'generate')
        .not('content_id', 'is', null);

      if (error) {
        logger.error('获取队列状态失败:', error);
        return null;
      }

      const statusCounts = data.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {});

      return {
        pending: statusCounts.pending || 0,
        processing: statusCounts.processing || 0,
        done: statusCounts.done || 0,
        failed: statusCounts.failed || 0,
        running_tasks: this.runningTasks.size,
        max_concurrent: this.maxConcurrent
      };
    } catch (error) {
      logger.error('获取队列状态失败:', error);
      return null;
    }
  }

  /**
   * 手动重试失败的任务
   */
  async retryFailedTask(contentId, userId) {
    try {
      // 获取最新的失败任务
      const { data: failedTask, error } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .select('*')
        .eq('content_id', contentId)
        .eq('action_type', 'generate')
        .eq('status', 'failed')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !failedTask) {
        throw new Error('未找到失败的任务');
      }

      // 创建新的重试任务
      await this.createRetryTask(failedTask);
      
      // 触发队列处理
      this.processQueue();
      
      logger.info(`手动重试任务: contentId=${contentId}`);
      
      return { success: true, message: '已重新加入生成队列' };
    } catch (error) {
      logger.error('手动重试失败:', error);
      throw error;
    }
  }
}

// 创建全局队列实例
const asyncGenerationQueue = new AsyncGenerationQueue();

module.exports = asyncGenerationQueue;
