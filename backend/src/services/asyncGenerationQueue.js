const aiService = require('./aiService');
const DatabaseService = require('./database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class AsyncGenerationQueue {
  constructor() {
    this.maxConcurrent = 3;
    this.runningTasks = new Set();
    this.runningContent = new Set(); // 按 content_id 互斥
    this.isProcessing = false;
    // 任务超时（毫秒）：默认 10 分钟
    this.taskTimeoutMs = 10 * 60 * 1000;
    // 瞬时错误重试配置
    this.retry = { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 4000 };
    
    // 启动时清理重复任务
    this.initializeCleanup();
    
    // 启动队列处理器
    this.startQueueProcessor();
    // 启动看门狗，定时清理卡住的 processing 任务（即使进程重启也能纠正）
    this.startWatchdog();
  }

  /**
   * 初始化清理：服务启动时清理可能存在的重复任务
   */
  async initializeCleanup() {
    try {
      
      // 清理重复的 processing 任务
      await this.cleanupDuplicateProcessingTasks();
      
      // 清理可能卡住的 processing 任务（超过超时时间）
      const now = Date.now();
      const thresholdIso = new Date(now - this.taskTimeoutMs).toISOString();
      
      const { data: stuckTasks, error } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .select('id, content_id, updated_at')
        .eq('action_type', 'generate')
        .eq('status', 'processing')
        .lt('updated_at', thresholdIso);

      if (error) {
        logger.error('初始化清理查询卡住任务失败:', error);
      } else if (stuckTasks && stuckTasks.length > 0) {
        const taskIds = stuckTasks.map(t => t.id);
        const { error: updateError } = await DatabaseService.supabase
          .from('ai_usage_logs')
          .update({ 
            status: 'failed', 
            error_message: 'service_restart_cleanup',
            updated_at: new Date().toISOString()
          })
          .in('id', taskIds);

        if (updateError) {
          logger.error('初始化清理卡住任务失败:', updateError);
        } else {
          logger.warn(`初始化清理了 ${stuckTasks.length} 个卡住的processing任务`);
        }
      }
      
    } catch (error) {
      logger.error('初始化清理异常:', error);
    }
  }

  /**
   * 添加生成任务到队列
   */
  async addTask(contentId, generationParams) {
    try {
      const requestId = uuidv4();
      const idempotencyKey = generationParams.idempotency_key || generationParams.idempotencyKey || null;

      // 使用数据库级别的唯一约束来防止重复任务
      // 首先检查是否已有相同 content_id 的进行中任务
      const { data: existingTasks, error: checkError } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .select('*')
        .eq('content_id', contentId)
        .eq('action_type', 'generate')
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (checkError) {
        logger.error('检查现有任务失败:', checkError);
        throw new Error(`检查现有任务失败: ${checkError.message}`);
      }

      // 如果已有进行中的任务，直接返回
      if (existingTasks && existingTasks.length > 0) {
        const existingTask = existingTasks[0];
        // 触发处理（防止处于 pending 未被拉起）
        this.processQueue();
        return { log: existingTask, requestId: existingTask.request_id };
      }

      // 幂等性检查：如果传入了 idempotency_key，检查是否有相同幂等键的任务
      if (idempotencyKey) {
        try {
          const { data: idempotentTasks, error: idemErr } = await DatabaseService.supabase
            .from('ai_usage_logs')
            .select('*')
            .eq('content_id', contentId)
            .eq('action_type', 'generate')
            .contains('request_payload', { idempotency_key: idempotencyKey })
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (!idemErr && idempotentTasks && idempotentTasks.length > 0) {
            const log = idempotentTasks[0];
            // 触发处理（防止处于 pending 未被拉起）
            this.processQueue();
            return { log, requestId: log.request_id };
          }
        } catch (e) {
          logger.warn('幂等查询异常，忽略继续创建:', e?.message || e);
        }
      }
      
      // 创建 ai_usage_logs 记录
      // 判断是 visitor_id 还是 user_id
      const { isVisitorId } = require('../utils/visitorId');
      const userId = generationParams.user_id || null;
      const visitorId = userId && isVisitorId(userId) ? userId : null;
      const actualUserId = userId && !isVisitorId(userId) ? userId : null;
      
      const { data: log, error } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .insert({
          content_id: contentId,
          user_id: actualUserId, // 如果是 visitor_id，则设置为 NULL
          visitor_id: visitorId, // 如果是 visitor_id，则存储在这里
          user_query: generationParams.knowledge_point,
          action_type: 'generate',
          status: 'pending',
          request_id: requestId,
          generation_params: {
            knowledge_point: generationParams.knowledge_point,
            learning_stage: generationParams.learning_stage,
            description: generationParams.description,
            language_code: generationParams.language_code,
            provider: generationParams.provider,
            // 将幂等键保存在 JSON 里，便于 contains 查询，无需表结构变更
            idempotency_key: idempotencyKey
          },
          request_payload: {
            knowledge_point: generationParams.knowledge_point,
            learning_stage: generationParams.learning_stage,
            description: generationParams.description,
            language_code: generationParams.language_code,
            provider: generationParams.provider,
            // 将幂等键保存在 JSON 里，便于 contains 查询，无需表结构变更
            idempotency_key: idempotencyKey
          }
        })
        .select()
        .single();

      if (error) {
        logger.error('创建生成任务失败:', error);
        throw new Error(`创建生成任务失败: ${error.message}`);
      }

      
      // 触发队列处理
      this.processQueue();
      
      return { log, requestId };
    } catch (error) {
      logger.error('添加生成任务失败:', error);
      throw error;
    }
  }

  /**
   * 定时扫描 ai_usage_logs，将超过超时时间的 processing 任务标记为 failed
   */
  startWatchdog() {
    setInterval(async () => {
      try {
        const now = Date.now();
        const thresholdIso = new Date(now - this.taskTimeoutMs).toISOString();
        
        // 1. 处理超时的 processing 任务
        const { data, error } = await this.runQueryWithRetry(async () => {
          return await DatabaseService.supabase
            .from('ai_usage_logs')
            .select('id, updated_at, status, content_id, user_id, request_id, error_message')
            .eq('action_type', 'generate')
            .eq('status', 'processing')
            .lt('updated_at', thresholdIso);
        }, 'watchdog_select_timeouts');
        
        if (error) { logger.error('Watchdog 查询失败:', error); return; }
        if (!data || data.length === 0) return;
        
        let failed = 0;
        for (const row of data) {
          try {
            // 双重检查：在更新前再次确认任务状态仍为 processing
            // 防止在查询和更新之间任务已完成的情况
            const { data: currentTask, error: checkError } = await DatabaseService.supabase
              .from('ai_usage_logs')
              .select('id, status, started_at, updated_at')
              .eq('id', row.id)
              .single();
            
            if (checkError) {
              logger.error(`Watchdog 检查任务状态失败: ${row.id}`, checkError);
              continue;
            }
            
            // 如果任务状态已经不是 processing，跳过（可能已经完成或失败）
            if (!currentTask || currentTask.status !== 'processing') {
              continue;
            }
            
            // 再次检查 updated_at，确保任务确实超时
            // 如果 updated_at 已经被更新（例如在流式生成过程中），则不应该标记为超时
            const updatedAt = new Date(currentTask.updated_at);
            const thresholdTime = new Date(now - this.taskTimeoutMs);
            if (updatedAt >= thresholdTime) {
              // updated_at 已经被更新，说明任务仍在进行中，不应该标记为超时
              continue;
            }
            
            // 直接标记为失败，不进行重试
            const completedAt = new Date().toISOString();
            
            let totalDuration = 0;
            if (currentTask.started_at) {
              const startTime = new Date(currentTask.started_at);
              const endTime = new Date(completedAt);
              totalDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
            }
            
            const { error: updErr } = await DatabaseService.supabase
              .from('ai_usage_logs')
              .update({ 
                status: 'failed', 
                error_message: '生成超时(>10min)', 
                completed_at: completedAt,
                total_duration: totalDuration,
                updated_at: completedAt
              })
              .eq('id', row.id)
              .eq('status', 'processing'); // 只更新仍为 processing 的任务，防止覆盖已完成的任务
            if (updErr) { logger.error('Watchdog 更新失败:', updErr); }
            else { failed++; }
          } catch (e) { logger.error('Watchdog 处理单条记录异常:', e); }
        }
        if (failed > 0) logger.warn(`Watchdog 标记超时任务为 failed: ${failed} 条`);
        
        // 2. 清理重复的 processing 任务
        await this.cleanupDuplicateProcessingTasks();
        
      } catch (e) {
        logger.error('Watchdog 异常:', e);
      }
    }, 60 * 1000); // 每分钟执行一次
  }

  /**
   * 清理重复的 processing 任务
   * 对于同一个 content_id，只保留最新的 processing 任务，其他的标记为 failed
   */
  async cleanupDuplicateProcessingTasks() {
    try {
      // 查找所有 processing 任务，包含 id 字段
      const { data: processingTasks, error } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .select('id, content_id, created_at')
        .eq('action_type', 'generate')
        .eq('status', 'processing')
        .order('content_id, created_at', { ascending: false });

      if (error) {
        logger.error('清理重复processing任务查询失败:', error);
        return;
      }

      if (!processingTasks || processingTasks.length === 0) return;

      // 按 content_id 分组，找出有重复的
      const contentGroups = {};
      processingTasks.forEach(task => {
        if (!contentGroups[task.content_id]) {
          contentGroups[task.content_id] = [];
        }
        contentGroups[task.content_id].push(task);
      });

      let cleanedCount = 0;
      for (const [contentId, tasks] of Object.entries(contentGroups)) {
        if (tasks.length > 1) {
          // 保留最新的（第一个），其他的标记为 failed
          const tasksToClean = tasks.slice(1);
          const taskIds = tasksToClean.map(t => t.id);
          
          const { error: updateError } = await DatabaseService.supabase
            .from('ai_usage_logs')
            .update({ 
              status: 'failed', 
              error_message: 'duplicate_processing_cleaned',
              updated_at: new Date().toISOString()
            })
            .in('id', taskIds);

          if (updateError) {
            logger.error(`清理重复processing任务失败: contentId=${contentId}`, updateError);
          } else {
            cleanedCount += tasksToClean.length;
            logger.warn(`清理了 ${tasksToClean.length} 个重复的processing任务: contentId=${contentId}`);
          }
        }
      }

      if (cleanedCount > 0) {
        logger.warn(`Watchdog 清理重复processing任务: ${cleanedCount} 条`);
      }
    } catch (error) {
      logger.error('清理重复processing任务异常:', error);
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
      const { data: pendingTasks, error } = await this.runQueryWithRetry(async () => {
        return await DatabaseService.supabase
          .from('ai_usage_logs')
          .select('*')
          .eq('status', 'pending')
          .eq('action_type', 'generate')
          .not('content_id', 'is', null)
          .order('created_at', { ascending: true })
          .limit(availableSlots);
      }, 'queue_select_pending');

      if (error) {
        logger.error('查询待处理任务失败:', error);
        return;
      }

      if (!pendingTasks || pendingTasks.length === 0) {
        return; // 没有待处理的任务
      }

      // 同一 content_id 只取一个，且跳过已在运行中的内容
      const seen = new Set();
      const filteredTasks = [];
      for (const t of pendingTasks) {
        if (this.runningContent.has(t.content_id)) continue;
        if (seen.has(t.content_id)) continue;
        seen.add(t.content_id);
        filteredTasks.push(t);
      }


      // 并行处理任务
      const promises = filteredTasks.map(task => this.processTask(task));
      await Promise.allSettled(promises);

    } catch (error) {
      logger.error('处理队列失败:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 统一的 Supabase 查询重试助手
   */
  async runQueryWithRetry(exec, label) {
    let attempt = 0;
    const max = this.retry.maxAttempts;
    const base = this.retry.baseDelayMs;
    const cap = this.retry.maxDelayMs;
    while (true) {
      try {
        const res = await exec();
        return res;
      } catch (e) {
        attempt++;
        const isLast = attempt >= max;
        logger.warn(`[retry] ${label} attempt ${attempt} failed:`, e?.message || e);
        if (isLast) return { data: null, error: e };
        const jitter = Math.random() * base;
        const delay = Math.min(cap, base * Math.pow(2, attempt - 1)) + jitter;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  /**
   * 处理单个任务
   */
  async processTask(task) {
    const taskId = task.id;
    const contentId = task.content_id;
    
    try {
      // 检查是否已有相同 content_id 在运行
      if (this.runningContent.has(contentId)) {
        return;
      }

      // 双重检查：再次查询数据库确认没有其他 processing 任务
      const { data: processingTasks, error: checkError } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .select('id, status')
        .eq('content_id', contentId)
        .eq('action_type', 'generate')
        .eq('status', 'processing')
        .neq('id', taskId);

      if (checkError) {
        logger.error(`检查processing任务失败: ${taskId}`, checkError);
        return;
      }

      if (processingTasks && processingTasks.length > 0) {
        return;
      }

      // 添加到运行中任务集合
      this.runningTasks.add(taskId);
      this.runningContent.add(contentId);
      

      // 原子性更新：同时更新状态和清除错误信息，记录开始时间
      const { error: updateError } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .update({ 
          status: 'processing',
          error_message: null,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (updateError) {
        logger.error(`更新任务状态失败: ${taskId}`, updateError);
        throw new Error(`更新任务状态失败: ${updateError.message}`);
      }

      // 调用 AI 生成服务（异步模式）+ 超时保护
      const aiPromise = aiService.generateEducationalContent(
        task.generation_params.knowledge_point,
        task.generation_params.learning_stage || 'understanding',
        task.generation_params.description,
        task.generation_params.language_code,
        task.user_id,
        'generate',
        task.generation_params.provider,
        task.request_id,
        true // isAsyncMode = true
      );

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TASK_TIMEOUT_10MIN')), this.taskTimeoutMs);
      });

      const aiResult = await Promise.race([aiPromise, timeoutPromise]);

      if (aiResult.success && aiResult.data) {
        // 生成成功，更新 content 表
        await this.updateContentFromAIResult(contentId, aiResult.data);
        
        // 计算总时长并更新任务状态为 done
        const completedAt = new Date().toISOString();
        const { data: taskData } = await DatabaseService.supabase
          .from('ai_usage_logs')
          .select('started_at')
          .eq('id', taskId)
          .single();
        
        let totalDuration = 0;
        if (taskData && taskData.started_at) {
          const startTime = new Date(taskData.started_at);
          const endTime = new Date(completedAt);
          totalDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        }
        
        await this.updateTaskStatusWithCompletion(taskId, 'done', completedAt, totalDuration);
        
        // 清理同一 content_id 的其他 pending 任务
        await this.cleanupPendingTasks(contentId, taskId);
        
        // 注意：缩略图生成已移除，只在 test-thumbnail 页面手动生成
        
      } else {
        // 生成失败，处理重试逻辑
        await this.handleFailure(task, aiResult.error || 'AI生成失败');
      }

    } catch (error) {
      logger.error(`任务处理失败: ${taskId}`, error);
      const reason = error && error.message === 'TASK_TIMEOUT_10MIN' ? '生成超时(>10min)' : (error?.message || '未知错误');
      await this.handleFailure(task, reason);
    } finally {
      // 从运行中任务集合移除
      this.runningTasks.delete(taskId);
      this.runningContent.delete(contentId);
    }
  }

  /**
   * 清理同一 content_id 的其他 pending 任务
   */
  async cleanupPendingTasks(contentId, successTaskId) {
    try {
      const { data: pendingTasks, error } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .select('id, request_id')
        .eq('content_id', contentId)
        .eq('action_type', 'generate')
        .eq('status', 'pending')
        .neq('id', successTaskId);

      if (error || !pendingTasks || pendingTasks.length === 0) {
        return;
      }

      // 批量更新为失败状态
      const taskIds = pendingTasks.map(t => t.id);
      const { error: updateError } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .update({ 
          status: 'failed', 
          error_message: `closed_by_success:${successTaskId}`,
          updated_at: new Date().toISOString()
        })
        .in('id', taskIds);

      if (updateError) {
        logger.error('清理 pending 任务失败:', updateError);
      } else {
      }
    } catch (error) {
      logger.error('清理 pending 任务异常:', error);
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
   * 更新任务状态并记录完成信息
   */
  async updateTaskStatusWithCompletion(taskId, status, completedAt, totalDuration) {
    const validStatuses = ['pending', 'processing', 'done', 'failed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    const { error } = await DatabaseService.supabase
      .from('ai_usage_logs')
      .update({ 
        status: status,
        completed_at: completedAt,
        total_duration: totalDuration,
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
      // 只更新 full_html，不再使用代码块字段
      if (!aiData.full_html || typeof aiData.full_html !== 'string' || aiData.full_html.trim().length === 0) {
        throw new Error('AI返回的 full_html 字段为空或无效');
      }
      
      const updateData = {
        title: aiData.title || 'AI生成内容',
        description: aiData.description || '',
        full_html: aiData.full_html,
        tags: aiData.tags || [],
        language_code: aiData.language_code || 'zh-CN',
        updated_at: new Date().toISOString()
      };

      // 如果 AI 返回了 svg 字段，保存到 svg_thumbnail
      if (aiData.svg && typeof aiData.svg === 'string' && aiData.svg.trim().length > 0) {
        // 验证 SVG 格式（基本检查）
        const svgMatch = aiData.svg.match(/<svg[^>]*>[\s\S]*?<\/svg>/i);
        if (svgMatch) {
          updateData.svg_thumbnail = aiData.svg.trim();
          logger.info(`[Content Update] ✅ 保存 SVG thumbnail (length: ${updateData.svg_thumbnail.length} chars)`);
          // 如果 SVG 存在，设置 thumbnail_status 为 ready
          updateData.thumbnail_status = 'ready';
          updateData.thumbnail_updated_at = new Date().toISOString();
        } else {
          logger.warn(`[Content Update] ⚠️ AI 返回的 svg 字段格式无效，跳过保存`);
        }
      }

      const { error } = await DatabaseService.supabase
        .from('content')
        .update(updateData)
        .eq('id', contentId);

      if (error) {
        logger.error(`更新content失败: ${contentId}`, error);
        throw error;
      }

    } catch (error) {
      logger.error(`更新content失败: ${contentId}`, error);
      throw error;
    }
  }


  /**
   * 处理失败逻辑
   */
  /**
   * 处理失败逻辑 - 直接标记为失败，不自动重试
   */
  async handleFailure(task, errorMessage) {
    try {
      // 直接标记为失败，不进行任何自动重试
      const completedAt = new Date().toISOString();
      const { data: taskData } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .select('started_at')
        .eq('id', task.id)
        .single();
      
      let totalDuration = 0;
      if (taskData && taskData.started_at) {
        const startTime = new Date(taskData.started_at);
        const endTime = new Date(completedAt);
        totalDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      }
      
      await this.updateTaskStatusWithCompletion(task.id, 'failed', completedAt, totalDuration);
      await this.updateTaskError(task.id, errorMessage);
      
    } catch (error) {
      logger.error(`处理失败逻辑错误: ${task.id}`, error);
    }
  }


  /**
   * 创建重试任务（保留向后兼容）
   */
  async createRetryTask(originalTask) {
    try {
      const requestId = uuidv4();
      
      // 如果原任务还在processing状态，先标记为failed并记录完成时间
      if (originalTask.status === 'processing') {
        const completedAt = new Date().toISOString();
        const { data: taskData } = await DatabaseService.supabase
          .from('ai_usage_logs')
          .select('started_at')
          .eq('id', originalTask.id)
          .single();
        
        let totalDuration = 0;
        if (taskData && taskData.started_at) {
          const startTime = new Date(taskData.started_at);
          const endTime = new Date(completedAt);
          totalDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        }
        
        await this.updateTaskStatusWithCompletion(originalTask.id, 'failed', completedAt, totalDuration);
        await this.updateTaskError(originalTask.id, `重试前标记为失败: ${originalTask.error_message || '未知错误'}`);
      }
      
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
      
    } catch (error) {
      logger.error('创建重试任务失败:', error);
      throw error;
    }
  }


  /**
   * 获取队列状态
   */
  async getQueueStatus() {
    try {
      const { data, error } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .select('status, updated_at')
        .eq('action_type', 'generate')
        .not('content_id', 'is', null);

      if (error) {
        logger.error('获取队列状态失败:', error);
        return null;
      }

      const now = Date.now();
      const statusCounts = data.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {});

      const processingTimeout = data.filter((item) => item.status === 'processing' && item.updated_at && (now - new Date(item.updated_at).getTime()) > this.taskTimeoutMs).length;

      return {
        pending: statusCounts.pending || 0,
        processing: statusCounts.processing || 0,
        done: statusCounts.done || 0,
        failed: statusCounts.failed || 0,
        running_tasks: this.runningTasks.size,
        max_concurrent: this.maxConcurrent,
        processing_timeout: processingTimeout
      };
    } catch (error) {
      logger.error('获取队列状态失败:', error);
      return null;
    }
  }

  /**
   * 手动重试失败的任务
   * 方案2: 手动重试 = 重新提交用户查询，重新开始整个生成流程
   */
  async retryFailedTask(contentId, userId) {
    try {
      // 获取最新的失败任务，获取原始生成参数
      const { data: failedTask, error } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .select('*')
        .eq('content_id', contentId)
        .eq('action_type', 'generate')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !failedTask) {
        throw new Error('未找到失败的任务');
      }

      // 如果原任务还在processing状态，先标记为failed并记录完成时间
      if (failedTask.status === 'processing') {
        const completedAt = new Date().toISOString();
        const { data: taskData } = await DatabaseService.supabase
          .from('ai_usage_logs')
          .select('started_at')
          .eq('id', failedTask.id)
          .single();
        
        let totalDuration = 0;
        if (taskData && taskData.started_at) {
          const startTime = new Date(taskData.started_at);
          const endTime = new Date(completedAt);
          totalDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        }
        
        await this.updateTaskStatusWithCompletion(failedTask.id, 'failed', completedAt, totalDuration);
        await this.updateTaskError(failedTask.id, `手动重试前标记为失败: ${failedTask.error_message || '未知错误'}`);
      }

      // 重新构建生成参数
      const generationParams = {
        user_id: userId,
        knowledge_point: failedTask.user_query,
        learning_stage: failedTask.request_payload?.learning_stage || 'understanding',
        description: failedTask.request_payload?.description || '',
        language_code: failedTask.request_payload?.language_code || 'zh-CN',
        provider: failedTask.request_payload?.provider || process.env.DEFAULT_AI_PROVIDER || 'qenda'
      };

      // 直接调用 addTask，重新开始整个生成流程
      const result = await this.addTask(contentId, generationParams);
      
      // 标记这是手动重试的记录
      await DatabaseService.supabase
        .from('ai_usage_logs')
        .update({ 
          error_message: `手动重试: ${failedTask.error_message || '未知错误'}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', result.log.id);
      
      
      return { 
        success: true, 
        message: '已重新提交生成请求',
        request_id: result.requestId
      };
    } catch (error) {
      logger.error('手动重试失败:', error);
      throw error;
    }
  }

  /**
   * 获取重试次数（同一 content_id 的生成记录数 - 1）
   */
  async getRetryCount(contentId) {
    try {
      const { data: logs, error } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .select('id')
        .eq('content_id', contentId)
        .eq('action_type', 'generate');

      if (error) {
        logger.error(`获取重试次数失败: contentId=${contentId}`, error);
        return 0;
      }

      // 重试次数 = 总次数 - 1（减去第一次尝试）
      return Math.max(0, (logs?.length || 0) - 1);
    } catch (error) {
      logger.error(`获取重试次数异常: contentId=${contentId}`, error);
      return 0;
    }
  }

}

// 创建全局队列实例
const asyncGenerationQueue = new AsyncGenerationQueue();

module.exports = asyncGenerationQueue;
