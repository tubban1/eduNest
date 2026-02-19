const aiService = require('./aiService');
const DatabaseService = require('./database');
const { logAIUsage } = require('./database');
const { isVisitorId } = require('../utils/visitorId');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { getDefaultEngine } = require('./rendererEngine');
const { getOrGenerateMetadata, getOrGenerateContentInitialMessage } = require('./aiGuideService');

class AsyncGenerationQueue {
  constructor() {
    this.maxConcurrent = 3;
    this.runningTasks = new Set();
    this.runningContent = new Set(); // 按 content_id 互斥
    this.isProcessing = false;
    // 任务超时（毫秒）：默认 6 分钟
    this.taskTimeoutMs = 6 * 60 * 1000;
    // 瞬时错误重试配置
    this.retry = { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 4000 };
    // 网络错误抑制：避免频繁记录相同的网络错误
    this.networkErrorSuppression = {
      watchdog: { lastLogTime: 0, logCount: 0 },
      queue: { lastLogTime: 0, logCount: 0 },
      suppressionWindow: 5 * 60 * 1000 // 5分钟内相同错误只记录一次
    };
    
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
      // 注意：这个检查不是原子性的，所以需要在插入时再次检查
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
        logger.info(`[AddTask] 发现已有进行中的任务，跳过创建: contentId=${contentId}, taskId=${existingTask.id}, status=${existingTask.status}`);
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
      
      // 多图：规范为数组（兼容单图 image）
      const imagesList = Array.isArray(generationParams.images) && generationParams.images.length > 0
        ? generationParams.images
        : (generationParams.image && generationParams.image.data && generationParams.image.mime_type ? [generationParams.image] : []);

      let imageUrl = null;
      const imageUrlResults = [];
      if (imagesList.length > 0) {
        const { uploadToFreeimageHost } = require('./freeimage_upload_service');
        for (let i = 0; i < imagesList.length; i++) {
          const img = imagesList[i];
          try {
            const ext = (img.mime_type.split('/')[1] || 'png').replace('jpeg', 'jpg');
            const filename = `image_${Date.now()}_${i}.${ext}`;
            const uploadResult = await uploadToFreeimageHost(img.data, filename, img.mime_type);
            const url = uploadResult.displayUrl || uploadResult.url;
            imageUrlResults.push({
              url: uploadResult.url,
              displayUrl: uploadResult.displayUrl || uploadResult.url,
              mime_type: img.mime_type
            });
            if (!imageUrl) imageUrl = url;
            logger.info(`[AsyncGenerationQueue] 图片 ${i + 1}/${imagesList.length} 上传成功`);
          } catch (uploadError) {
            logger.error(`[AsyncGenerationQueue] 图片 ${i + 1} 上传失败:`, uploadError.message);
          }
        }
      }

      const { data: log, error } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .insert({
          content_id: contentId,
          user_id: actualUserId,
          visitor_id: visitorId,
          user_query: generationParams.knowledge_point,
          action_type: 'generate',
          status: 'pending',
          request_id: requestId,
          image_url: imageUrl,
          generation_params: {
            knowledge_point: generationParams.knowledge_point,
            output_type: generationParams.output_type || 'interactive',
            description: generationParams.description,
            language_code: generationParams.language_code,
            provider: generationParams.provider,
            images: imagesList.length ? imagesList : null,
            image_urls: imageUrlResults.length ? imageUrlResults : null,
            idempotency_key: idempotencyKey
          },
          request_payload: {
            knowledge_point: generationParams.knowledge_point,
            output_type: generationParams.output_type || 'interactive',
            description: generationParams.description,
            language_code: generationParams.language_code,
            provider: generationParams.provider,
            images: imagesList.length ? imagesList : null,
            idempotency_key: idempotencyKey
          }
        })
        .select()
        .single();

      if (error) {
        logger.error('创建生成任务失败:', error);
        throw new Error(`创建生成任务失败: ${error.message}`);
      }

      // 双重检查：插入后再次检查是否有其他任务（防止并发竞态条件）
      // 如果发现其他任务，删除刚创建的任务并返回已存在的任务
      const { data: duplicateTasks, error: dupCheckError } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .select('*')
        .eq('content_id', contentId)
        .eq('action_type', 'generate')
        .in('status', ['pending', 'processing'])
        .neq('id', log.id) // 排除刚创建的任务
        .order('created_at', { ascending: false })
        .limit(1);

      if (!dupCheckError && duplicateTasks && duplicateTasks.length > 0) {
        // 发现重复任务，删除刚创建的任务
        logger.warn(`[AddTask] 检测到并发重复任务，删除刚创建的任务: contentId=${contentId}, newTaskId=${log.id}, existingTaskId=${duplicateTasks[0].id}`);
        await DatabaseService.supabase
          .from('ai_usage_logs')
          .delete()
          .eq('id', log.id);
        
        const existingTask = duplicateTasks[0];
        // 触发处理（防止处于 pending 未被拉起）
        this.processQueue();
        return { log: existingTask, requestId: existingTask.request_id };
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
        // 检查 Supabase 连接状态
        if (DatabaseService.useMockData) {
          return; // 使用模拟数据时跳过
        }
        
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
        
        if (error) { 
          // 如果是网络错误（DNS 解析失败等），抑制频繁日志
          if (error.message && (error.message.includes('ENOTFOUND') || error.message.includes('fetch failed'))) {
            const now = Date.now();
            const suppression = this.networkErrorSuppression.watchdog;
            const shouldLog = now - suppression.lastLogTime > this.networkErrorSuppression.suppressionWindow;
            
            if (shouldLog) {
              suppression.lastLogTime = now;
              suppression.logCount = 1;
              logger.warn('Watchdog 查询失败（网络问题，将稍后重试。后续相同错误将静默处理）');
            } else {
              suppression.logCount++;
            }
          } else {
            logger.error('Watchdog 查询失败:', error);
          }
          return; 
        }
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
                error_message: '生成超时(>6min)', 
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
   * 判断错误是否可重试（网络错误、连接错误等）
   */
  isRetryableError(error) {
    if (!error) return false;
    
    const errorMessage = error.message || error.toString() || '';
    const errorCode = error.code || '';
    
    // 网络相关错误
    const retryablePatterns = [
      'fetch failed',
      'SocketError',
      'UND_ERR_SOCKET',
      'other side closed',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'timeout',
      'network'
    ];
    
    return retryablePatterns.some(pattern => 
      errorMessage.toLowerCase().includes(pattern.toLowerCase()) ||
      errorCode.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * 带重试的 Supabase 查询
   */
  async retryableSupabaseQuery(queryFn, maxRetries = 3, delayMs = 1000) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await queryFn();
        return result;
      } catch (error) {
        lastError = error;
        
        // 如果不是可重试的错误，直接抛出
        if (!this.isRetryableError(error)) {
          throw error;
        }
        
        // 如果是最后一次尝试，抛出错误
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        // 指数退避：延迟时间 = delayMs * 2^attempt
        const backoffDelay = delayMs * Math.pow(2, attempt);
        logger.warn(`清理重复processing任务查询失败，${backoffDelay}ms 后重试 (${attempt + 1}/${maxRetries}):`, {
          error: error.message || error.toString(),
          code: error.code
        });
        
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
    
    throw lastError;
  }

  /**
   * 清理重复的 processing 任务
   * 对于同一个 content_id，只保留最新的 processing 任务，其他的标记为 failed
   */
  async cleanupDuplicateProcessingTasks() {
    try {
      // 使用重试机制查询 processing 任务
      const { data: processingTasks, error } = await this.retryableSupabaseQuery(
        async () => {
          const result = await DatabaseService.supabase
            .from('ai_usage_logs')
            .select('id, content_id, created_at')
            .eq('action_type', 'generate')
            .eq('status', 'processing')
            .order('content_id, created_at', { ascending: false });
          
          if (result.error) {
            throw result.error;
          }
          
          return result;
        },
        3, // 最多重试3次
        500 // 初始延迟500ms
      );

      if (error) {
        logger.error('清理重复processing任务查询失败（重试后仍失败）:', error);
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
          
          try {
            // 使用重试机制更新任务状态
            const { error: updateError } = await this.retryableSupabaseQuery(
              async () => {
                const result = await DatabaseService.supabase
                  .from('ai_usage_logs')
                  .update({ 
                    status: 'failed', 
                    error_message: 'duplicate_processing_cleaned',
                    updated_at: new Date().toISOString()
                  })
                  .in('id', taskIds);
                
                if (result.error) {
                  throw result.error;
                }
                
                return result;
              },
              2, // 更新操作最多重试2次
              300 // 初始延迟300ms
            );

            if (updateError) {
              logger.error(`清理重复processing任务失败（重试后仍失败）: contentId=${contentId}`, updateError);
            } else {
              cleanedCount += tasksToClean.length;
              logger.warn(`清理了 ${tasksToClean.length} 个重复的processing任务: contentId=${contentId}`);
            }
          } catch (updateError) {
            // 重试机制已经处理了可重试的错误，这里只记录不可重试的错误
            if (!this.isRetryableError(updateError)) {
              logger.error(`清理重复processing任务失败（不可重试错误）: contentId=${contentId}`, updateError);
            }
          }
        }
      }

      if (cleanedCount > 0) {
        logger.warn(`Watchdog 清理重复processing任务: ${cleanedCount} 条`);
      }
    } catch (error) {
      // 区分可重试和不可重试的错误
      if (this.isRetryableError(error)) {
        logger.warn('清理重复processing任务异常（网络错误，已重试）:', {
          error: error.message || error.toString(),
          code: error.code
        });
      } else {
        logger.error('清理重复processing任务异常（非网络错误）:', error);
      }
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
      // 检查 Supabase 连接状态
      if (DatabaseService.useMockData) {
        return; // 使用模拟数据时跳过
      }

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
        // 如果是网络错误（DNS 解析失败等），抑制频繁日志
        if (error.message && (error.message.includes('ENOTFOUND') || error.message.includes('fetch failed'))) {
          const now = Date.now();
          const suppression = this.networkErrorSuppression.queue;
          const shouldLog = now - suppression.lastLogTime > this.networkErrorSuppression.suppressionWindow;
          
          if (shouldLog) {
            suppression.lastLogTime = now;
            suppression.logCount = 1;
            logger.warn('查询待处理任务失败（网络问题，将稍后重试。后续相同错误将静默处理）');
          } else {
            suppression.logCount++;
          }
        } else {
          logger.error('查询待处理任务失败:', error);
        }
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

      // 原子性更新：只更新状态为 'pending' 的任务，确保只有一个任务能被标记为 processing
      // 这样可以防止并发情况下多个任务同时被处理
      const { data: updatedTask, error: updateError } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .update({ 
          status: 'processing',
          error_message: null,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .eq('status', 'pending') // 只更新状态为 pending 的任务
        .select()
        .maybeSingle(); // 使用 maybeSingle() 而不是 single()，允许返回 0 行

      if (updateError) {
        // 检查是否是"没有行返回"的错误（PGRST116）
        // 这通常意味着任务状态已经不是 pending，已被其他进程处理
        const isNoRowsError = updateError.code === 'PGRST116' || 
                              (updateError.message && updateError.message.includes('no rows returned'));
        
        if (isNoRowsError) {
          logger.warn(`[ProcessTask] 任务状态已变更（已被其他进程处理），跳过处理: taskId=${taskId}, contentId=${contentId}`, {
            errorCode: updateError.code,
            errorMessage: updateError.message
          });
          // 清理运行中任务集合
          this.runningTasks.delete(taskId);
          this.runningContent.delete(contentId);
          return; // 优雅退出，不抛出错误
        }
        
        // 其他错误才是真正的错误
        logger.error(`更新任务状态失败: ${taskId}`, updateError);
        // 清理运行中任务集合
        this.runningTasks.delete(taskId);
        this.runningContent.delete(contentId);
        throw new Error(`更新任务状态失败: ${updateError.message}`);
      }

      // 如果更新返回空（说明任务状态已经不是 pending），说明有其他任务已经处理了
      if (!updatedTask) {
        logger.warn(`[ProcessTask] 任务状态已变更，跳过处理: taskId=${taskId}, contentId=${contentId}`);
        // 清理运行中任务集合
        this.runningTasks.delete(taskId);
        this.runningContent.delete(contentId);
        return;
      }

      // 更新成功，添加到运行中任务集合
      this.runningTasks.add(taskId);
      this.runningContent.add(contentId);

      // 多图：从 generation_params.images 或兼容单图 image / image_url
      let imagesData = task.generation_params?.images && Array.isArray(task.generation_params.images)
        ? task.generation_params.images.filter((img) => img && img.mime_type && img.data)
        : [];
      if (imagesData.length === 0 && task.generation_params?.image?.mime_type && task.generation_params?.image?.data) {
        imagesData = [task.generation_params.image];
      }
      if (imagesData.length === 0 && task.image_url) {
        try {
          logger.info(`[Process Task] 从 image_url 下载单张图片`);
          const response = await fetch(task.image_url);
          if (response.ok) {
            const buf = Buffer.from(await response.arrayBuffer()).toString('base64');
            let mimeType = response.headers.get('content-type') || 'image/jpeg';
            if (!mimeType.startsWith('image/')) {
              const u = task.image_url.toLowerCase();
              mimeType = u.includes('.png') ? 'image/png' : u.includes('.gif') ? 'image/gif' : u.includes('.webp') ? 'image/webp' : 'image/jpeg';
            }
            imagesData = [{ mime_type: mimeType, data: buf }];
          }
        } catch (e) {
          logger.warn('[Process Task] 从 image_url 下载失败:', e.message);
        }
      }
      if (imagesData.length > 0) {
        logger.info(`[Process Task] 使用 ${imagesData.length} 张图片`);
      }

      const aiPromise = aiService.generateEducationalContent(
        task.generation_params.knowledge_point,
        task.generation_params.output_type || 'interactive',
        task.generation_params.description,
        task.generation_params.language_code,
        task.user_id,
        'generate',
        task.generation_params.provider,
        task.request_id,
        true,
        imagesData.length ? imagesData : null
      );

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TASK_TIMEOUT_6MIN')), this.taskTimeoutMs);
      });

      const aiResult = await Promise.race([aiPromise, timeoutPromise]);

      if (aiResult.success && aiResult.data) {
        // 生成成功，更新 content 表
        let contentUpdateSuccess = false;
        try {
          await this.updateContentFromAIResult(contentId, aiResult.data);
          contentUpdateSuccess = true;
          logger.info(`[Process Task] ✅ 成功更新 content: ${contentId}`);
        } catch (contentError) {
          logger.error(`[Process Task] ❌ 更新 content 失败: ${contentId}`, contentError);
          // 即使 content 更新失败，也要更新任务状态，避免状态卡在 processing
        }
        
        // 在内容更新成功后绑定/创建会话，并写入生成起点的对话消息（用户提示词 + 图片 + start-session assistant）
        if (contentUpdateSuccess) {
          try {
            await this.ensureGenerationConversation(task, contentId);
          } catch (convError) {
            logger.error('[Process Task] 绑定生成会话失败（不影响生成本身）:', convError);
          }
        }

        // 在内容更新成功后扣除积分（仅已登录用户，非 Pro 订阅）
        if (contentUpdateSuccess && task.user_id) {
          try {
            const { data: subscription } = await DatabaseService.getActiveSubscription(task.user_id);
            if (!subscription || !['pro', 'monthly', 'yearly'].includes(subscription.plan)) {
              const CREDITS_COST = 10; // AI 内容生成消耗 10 积分
              await DatabaseService.addCreditChange(task.user_id, 'usage', -CREDITS_COST);
              logger.info(`[Process Task] ✅ 扣除积分成功: user_id=${task.user_id}, credits=-${CREDITS_COST}`);
            }
          } catch (creditError) {
            logger.error(`[Process Task] ❌ 扣除积分失败: user_id=${task.user_id}`, creditError);
            // 积分扣除失败不影响内容生成，只记录错误
          }
        }
        
        // 计算总时长
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
        
        // 根据 content 更新是否成功决定任务状态
        // 如果 AI 生成成功但 content 更新失败，应该标记为 failed 而不是 done
        const finalStatus = contentUpdateSuccess ? 'done' : 'failed';
        const errorMsg = contentUpdateSuccess ? null : 'AI生成成功但更新content失败，请重试';
        
        try {
          await this.updateTaskStatusWithCompletion(taskId, finalStatus, completedAt, totalDuration);
          if (errorMsg) {
            await this.updateTaskError(taskId, errorMsg);
          }
          logger.info(`[Process Task] ✅ 成功更新任务状态为 ${finalStatus}: ${taskId}`);
        } catch (statusError) {
          logger.error(`[Process Task] ❌ 更新任务状态失败: ${taskId}`, statusError);
          // 如果更新状态失败，尝试使用更简单的方式
          try {
            await DatabaseService.supabase
              .from('ai_usage_logs')
              .update({ 
                status: finalStatus,
                error_message: errorMsg,
                completed_at: completedAt,
                total_duration: totalDuration,
                updated_at: completedAt
              })
              .eq('id', taskId);
            logger.info(`[Process Task] ✅ 使用回退方式成功更新任务状态为 ${finalStatus}: ${taskId}`);
          } catch (fallbackError) {
            logger.error(`[Process Task] ❌ 回退更新任务状态也失败: ${taskId}`, fallbackError);
            throw fallbackError;
          }
        }
        
        // 只有成功时才清理同一 content_id 的其他 pending 任务
        if (contentUpdateSuccess) {
          try {
            await this.cleanupPendingTasks(contentId, taskId);
          } catch (cleanupError) {
            logger.warn(`[Process Task] 清理 pending 任务失败: ${taskId}`, cleanupError);
            // 清理失败不影响主流程
          }
        }
        
        // 注意：缩略图生成已移除，只在 test-thumbnail 页面手动生成
        
      } else {
        // 生成失败，处理重试逻辑
        await this.handleFailure(task, (aiResult && aiResult.error) || 'AI生成失败');
      }

    } catch (error) {
      logger.error(`任务处理失败: ${taskId}`, error);
      const reason = error && error.message === 'TASK_TIMEOUT_6MIN' ? '生成超时(>6min)' : (error?.message || '未知错误');
      // 确保失败时也更新状态
      try {
        await this.handleFailure(task, reason);
      } catch (failureError) {
        logger.error(`处理失败逻辑时出错: ${taskId}`, failureError);
        // 即使 handleFailure 失败，也要尝试至少更新状态
        try {
          const completedAt = new Date().toISOString();
          await DatabaseService.supabase
            .from('ai_usage_logs')
            .update({ 
              status: 'failed',
              error_message: reason,
              completed_at: completedAt,
              updated_at: completedAt
            })
            .eq('id', taskId);
        } catch (finalError) {
          logger.error(`最终更新任务状态失败: ${taskId}`, finalError);
        }
      }
    } finally {
      // 从运行中任务集合移除
      this.runningTasks.delete(taskId);
      this.runningContent.delete(contentId);
    }
  }

  /**
   * 为生成任务绑定/创建会话，并写入首条用户提示词 + 图片消息，以及 start-session assistant 消息。
   * - 会话按 user_id / visitor_id + content_id 唯一；
   * - 若已存在会话，则不重复创建（保持幂等）。
   */
  async ensureGenerationConversation(task, contentId) {
    try {
      const userId = task.user_id || null;
      const visitorId = task.visitor_id || null;
      const ownerId = userId || visitorId;
      if (!ownerId || !contentId) return;

      // 1) 获取该用户/访客 + content 的会话（若已存在则复用；否则创建新会话）
      let query = DatabaseService.supabase
        .from('ai_conversations')
        .select('id')
        .eq('content_id', contentId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (userId) {
        query = query.eq('user_id', userId).is('visitor_id', null);
      } else {
        query = query.eq('visitor_id', visitorId).is('user_id', null);
      }

      const { data: existing, error: existingError } = await query;
      if (existingError) {
        logger.error('[ensureGenerationConversation] 查询 existing conversation 失败:', existingError);
        return;
      }
      let conversationId = existing && existing.length > 0 ? existing[0].id : null;
      if (!conversationId) {
        // 创建新的会话（entry_point 标记为 ai_generate，便于后续分析）
        const { data: convRows, error: convError } = await DatabaseService.supabase
          .from('ai_conversations')
          .insert({
            id: task.request_id, // 与 ai_usage_logs.request_id 对齐，便于追踪
            user_id: userId,
            visitor_id: visitorId,
            content_id: contentId,
            entry_point: 'ai_generate'
          })
          .select('id')
          .single();

        if (convError || !convRows) {
          logger.error('[ensureGenerationConversation] 创建 conversation 失败:', convError);
          return;
        }
        conversationId = convRows.id;
      }

      // 3) 写入首条用户消息：生成提示词 + 图片
      const gp = task.generation_params || {};
      const knowledgePoint = gp.knowledge_point || task.user_query || '';
      const description = gp.description || '';
      let userContent = knowledgePoint || '';
      if (description && description.trim()) {
        userContent = userContent
          ? `${userContent}\n\n${description}`
          : description;
      }

      const imageUrls = Array.isArray(gp.image_urls) ? gp.image_urls : [];
      const imageMeta = imageUrls.map((item) => ({
        url: item.url,
        displayUrl: item.displayUrl || item.url,
        mime_type: item.mime_type || 'image/jpeg'
      }));

      const userMetadata = {};
      if (imageMeta.length > 0) {
        userMetadata.image_urls = imageMeta;
        userMetadata.image_count = imageMeta.length;
        userMetadata.images_pending = false;
      }

      // 幂等：同一个生成 request_id 只写一次生成起点 user 消息
      const generationRequestId = task.request_id || null;
      const idempotencyKey = generationRequestId ? { generation_request_id: generationRequestId } : null;
      let alreadyHasGenUserMsg = false;
      if (idempotencyKey) {
        const { data: existedMsgs, error: existedMsgsError } = await DatabaseService.supabase
          .from('ai_messages')
          .select('id')
          .eq('conversation_id', conversationId)
          .eq('role', 'user')
          .contains('metadata', idempotencyKey)
          .limit(1);
        if (existedMsgsError) {
          logger.warn('[ensureGenerationConversation] 检查生成起点 user 消息失败（将继续尝试插入）:', existedMsgsError);
        } else {
          alreadyHasGenUserMsg = !!(existedMsgs && existedMsgs.length > 0);
        }
      }

      if (!alreadyHasGenUserMsg && (userContent || imageMeta.length > 0)) {
        const finalUserMetadata = Object.keys(userMetadata).length ? { ...userMetadata, ...(idempotencyKey || {}) } : (idempotencyKey || null);
        const { error: userMsgError } = await DatabaseService.supabase
          .from('ai_messages')
          .insert({
            conversation_id: conversationId,
            role: 'user',
            content: userContent || '(生成请求)',
            metadata: finalUserMetadata
          });

        if (userMsgError) {
          logger.error('[ensureGenerationConversation] 创建用户生成消息失败:', userMsgError);
        }
      }

      // 4) 写入 start-session assistant 消息（与 AI Guide 初始问候保持一致）
      try {
        const metadata = await getOrGenerateMetadata(contentId, ownerId);
        const initial = await getOrGenerateContentInitialMessage(contentId, metadata, ownerId);
        const assistantContent = initial?.content;

        // 幂等：若会话已存在任何 assistant 消息，则认为 start-session 已写入过，不重复插入
        let hasAssistant = false;
        const { data: assistantCheck, error: assistantCheckError } = await DatabaseService.supabase
          .from('ai_messages')
          .select('id')
          .eq('conversation_id', conversationId)
          .eq('role', 'assistant')
          .limit(1);
        if (assistantCheckError) {
          logger.warn('[ensureGenerationConversation] 检查 assistant 消息失败（将继续尝试插入）:', assistantCheckError);
        } else {
          hasAssistant = !!(assistantCheck && assistantCheck.length > 0);
        }

        if (!hasAssistant && assistantContent) {
          const { data: insertedAssistant, error: assistantMsgError } = await DatabaseService.supabase
            .from('ai_messages')
            .insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: assistantContent,
              metadata: null
            })
            .select('id')
            .single();

          if (assistantMsgError) {
            logger.error('[ensureGenerationConversation] 创建 start-session assistant 消息失败:', assistantMsgError);
          } else if (initial?.source === 'generated') {
            // 异步生成流程中首次调用 AI 生成欢迎语，需记录 ai_guide_init（否则用户后续打开 AI Guide 时走缓存，不会落表）
            const estimateTokens = (text) => Math.ceil((text || '').length / 3);
            const systemPrompt = `SYSTEM_PROMPT\n\nMETADATA:\n${JSON.stringify(metadata || {}, null, 2)}`;
            const inputTokens = initial?.usage?.prompt_tokens || estimateTokens(systemPrompt + 'Start the session.');
            const outputTokens = initial?.usage?.completion_tokens || estimateTokens(assistantContent);
            const totalTokens = initial?.usage?.total_tokens || (inputTokens + outputTokens);
            try {
              await logAIUsage({
                user_id: userId || null,
                visitor_id: visitorId || null,
                request_id: conversationId,
                conversation_id: conversationId,
                message_id: insertedAssistant?.id || null,
                action_type: 'ai_guide_init',
                content_id: contentId,
                user_query: 'Start the session.',
                request_payload: {
                  messages: [{ role: 'system', content: 'SYSTEM_PROMPT_TEMPLATE' }, { role: 'user', content: 'Start the session.' }],
                  max_tokens: 1500,
                  temperature: 0.7,
                  source: 'generated',
                  entry_point: 'ai_generate',
                  metadata_summary: {
                    title: metadata?.canonical?.topic || metadata?.meta?.title || metadata?.title || 'Unknown',
                    content_type: metadata?.canonical?.content_type || metadata?.meta?.contentType || 'Unknown'
                  }
                },
                response_metadata: { reply: assistantContent, role: 'assistant', source: 'generated' },
                model_name: initial?.model || 'unknown',
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                total_tokens: totalTokens,
                is_render_success: true
              });
            } catch (logErr) {
              logger.warn('[ensureGenerationConversation] 记录 ai_guide_init 失败（不影响主流程）:', logErr?.message || logErr);
            }
          }
        }

        // 更新会话活跃时间
        await DatabaseService.supabase
          .from('ai_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      } catch (e) {
        logger.error('[ensureGenerationConversation] 生成初始 assistant 消息失败:', e);
      }
    } catch (e) {
      logger.error('[ensureGenerationConversation] 异常:', e);
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

    // 确保 completedAt 和 totalDuration 是有效的
    if (!completedAt) {
      completedAt = new Date().toISOString();
    }
    if (typeof totalDuration !== 'number' || isNaN(totalDuration)) {
      totalDuration = 0;
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
      // 如果更新失败，尝试使用更简单的方式更新状态（至少更新状态）
      try {
        const { error: fallbackError } = await DatabaseService.supabase
          .from('ai_usage_logs')
          .update({ 
            status: status,
            updated_at: new Date().toISOString()
          })
          .eq('id', taskId);
        if (fallbackError) {
          logger.error(`回退更新任务状态失败: ${taskId}`, fallbackError);
          throw error; // 抛出原始错误
        } else {
          logger.warn(`更新任务状态时 completed_at/total_duration 失败，但状态已更新: ${taskId}`);
        }
      } catch (fallbackErr) {
        throw error; // 抛出原始错误
      }
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
      
      // 使用 RendererEngine 自动修复渲染问题
      let processedHtml = aiData.full_html;
      try {
        const rendererEngine = getDefaultEngine();
        const renderResult = await rendererEngine.process(aiData.full_html, {
          autoFix: true,
          checkers: ['math', 'runtime', 'eslint'] // 添加 eslint 检查器
        });
        
        if (renderResult.success || renderResult.fixes.length > 0) {
          processedHtml = renderResult.html;
          
          // 记录修复日志
          if (renderResult.fixes.length > 0) {
            logger.info(`[RendererEngine] contentId=${contentId} 自动修复了 ${renderResult.fixes.length} 个问题`, {
              fixes: renderResult.fixes.map(f => ({ code: f.issueCode, strategy: f.strategy }))
            });
          }
          
          // 保存渲染报告到数据库（可选）
          if (renderResult.report) {
            await this.saveRenderReport(contentId, renderResult.report).catch(err => {
              logger.warn(`[RendererEngine] 保存渲染报告失败: ${err.message}`);
            });
          }
        }
      } catch (renderError) {
        // RendererEngine 失败不应阻止内容保存，使用原始 HTML
        logger.warn(`[RendererEngine] 处理失败，使用原始 HTML: ${renderError.message}`);
      }
      
      const updateData = {
        title: aiData.title || 'AI生成内容',
        description: aiData.description || '',
        full_html: processedHtml,
        tags: aiData.tags || [],
        knowledge_points: aiData.knowledge_points || [],
        language_code: aiData.language_code || 'zh-CN',
        updated_at: new Date().toISOString()
      };

      // 验证并保存 content_type（从 AI 返回的数据中读取）
      if (aiData.content_type && typeof aiData.content_type === 'string') {
        // 验证 content_type 值（只允许 'interactive' 或 'animated'）
        if (['interactive', 'animated'].includes(aiData.content_type)) {
          updateData.content_type = aiData.content_type;
          logger.info(`[Content Update] ✅ 保存 content_type: ${aiData.content_type}`);
        } else {
          logger.warn(`[Content Update] ⚠️ AI 返回的 content_type 值无效: ${aiData.content_type}，跳过保存`);
        }
      } else {
        // 如果 AI 没有返回 content_type，从 generation_params 中获取（向后兼容）
        try {
          const { data: taskData, error: taskError } = await DatabaseService.supabase
            .from('ai_usage_logs')
            .select('generation_params')
            .eq('content_id', contentId)
            .eq('action_type', 'generate')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (!taskError && taskData?.generation_params?.output_type) {
            const outputType = taskData.generation_params.output_type;
            // 将 output_type 映射到 content_type
            if (['interactive', 'animated'].includes(outputType)) {
              updateData.content_type = outputType;
              logger.info(`[Content Update] ✅ 从 generation_params 获取 content_type: ${outputType}`);
            } else {
              logger.warn(`[Content Update] ⚠️ generation_params.output_type 值无效: ${outputType}，使用默认值 'interactive'`);
              updateData.content_type = 'interactive'; // 默认值
            }
          } else {
            logger.warn(`[Content Update] ⚠️ AI 返回的 content_type 为空，且无法从 generation_params 获取，使用默认值 'interactive'`);
            updateData.content_type = 'interactive'; // 默认值
          }
        } catch (taskQueryError) {
          logger.error(`[Content Update] ❌ 查询 generation_params 失败: ${taskQueryError.message}`);
          updateData.content_type = 'interactive'; // 默认值
        }
      }

      // 验证并记录 knowledge_points
      if (aiData.knowledge_points && Array.isArray(aiData.knowledge_points) && aiData.knowledge_points.length > 0) {
        logger.info(`[Content Update] ✅ 保存 knowledge_points: ${JSON.stringify(aiData.knowledge_points)}`);
      } else {
        logger.warn(`[Content Update] ⚠️ AI 返回的 knowledge_points 为空或格式无效，使用空数组`);
      }

      // 验证并保存 tech_stack
      if (aiData.tech_stack && Array.isArray(aiData.tech_stack) && aiData.tech_stack.length > 0) {
        updateData.tech_stack = aiData.tech_stack;
        logger.info(`[Content Update] ✅ 保存 tech_stack: ${JSON.stringify(aiData.tech_stack)}`);
      } else {
        logger.warn(`[Content Update] ⚠️ AI 返回的 tech_stack 为空或格式无效，跳过保存`);
      }

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
   * 保存渲染报告到数据库
   */
  async saveRenderReport(contentId, report) {
    try {
      const { error } = await DatabaseService.supabase
        .from('render_reports')
        .insert({
          content_id: contentId,
          engine_version: report.engineVersion,
          checks: report.checks,
          fixes: report.fixes,
          status: report.summary.status,
          issues_detected: report.summary.issuesDetected,
          issues_fixed: report.summary.issuesFixed,
          issues_remaining: report.summary.issuesRemaining
        });

      if (error) {
        // 如果表不存在，只记录警告，不抛出错误
        if (error.code === '42P01') {
          logger.debug(`[RendererEngine] render_reports 表不存在，跳过保存`);
          return;
        }
        throw error;
      }
      
      logger.debug(`[RendererEngine] 保存渲染报告成功: contentId=${contentId}`);
    } catch (error) {
      logger.warn(`[RendererEngine] 保存渲染报告失败: ${error.message}`);
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
      const { data: taskData, error: selectError } = await DatabaseService.supabase
        .from('ai_usage_logs')
        .select('started_at')
        .eq('id', task.id)
        .single();
      
      if (selectError) {
        logger.error(`获取任务数据失败: ${task.id}`, selectError);
        // 即使获取失败，也尝试更新状态
      }
      
      let totalDuration = 0;
      if (taskData && taskData.started_at) {
        const startTime = new Date(taskData.started_at);
        const endTime = new Date(completedAt);
        totalDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      }
      
      // 确保更新状态和完成信息
      try {
        await this.updateTaskStatusWithCompletion(task.id, 'failed', completedAt, totalDuration);
      } catch (statusError) {
        logger.error(`更新任务状态为 failed 失败: ${task.id}`, statusError);
        // 如果更新失败，尝试使用更简单的方式更新
        try {
          await DatabaseService.supabase
            .from('ai_usage_logs')
            .update({ 
              status: 'failed',
              error_message: errorMessage,
              completed_at: completedAt,
              total_duration: totalDuration,
              updated_at: completedAt
            })
            .eq('id', task.id);
        } catch (fallbackError) {
          logger.error(`回退更新任务状态失败: ${task.id}`, fallbackError);
          throw fallbackError;
        }
      }
      
      // 更新错误信息（如果还没有设置）
      try {
        await this.updateTaskError(task.id, errorMessage);
      } catch (errorUpdateError) {
        logger.warn(`更新任务错误信息失败: ${task.id}`, errorUpdateError);
        // 错误信息更新失败不影响主流程
      }
      
    } catch (error) {
      logger.error(`处理失败逻辑错误: ${task.id}`, error);
      // 最后的回退：直接更新状态
      try {
        await DatabaseService.supabase
          .from('ai_usage_logs')
          .update({ 
            status: 'failed',
            error_message: errorMessage || '处理失败',
            updated_at: new Date().toISOString()
          })
          .eq('id', task.id);
      } catch (finalError) {
        logger.error(`最终更新任务状态失败: ${task.id}`, finalError);
      }
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

      // 重新构建生成参数：优先从 generation_params 读取（request_payload 可能被 updateExistingLog 覆盖为 { messages, ... }）
      const gp = failedTask.generation_params || {};
      const generationParams = {
        user_id: userId,
        knowledge_point: gp.knowledge_point || failedTask.user_query,
        output_type: gp.output_type || 'interactive',
        description: gp.description || '',
        language_code: gp.language_code || failedTask.request_payload?.language_code || 'zh-CN',
        provider: gp.provider ?? failedTask.request_payload?.provider ?? process.env.DEFAULT_AI_PROVIDER ?? 'qenda'
      };
      
      // 多图：优先 generation_params.images / request_payload.images，否则单图 image / image_url 下载
      let imagesForRetry = gp.images && Array.isArray(gp.images) ? gp.images : (failedTask.request_payload?.images && Array.isArray(failedTask.request_payload.images) ? failedTask.request_payload.images : null);
      if (!imagesForRetry?.length && failedTask.image_url) {
        try {
          const response = await fetch(failedTask.image_url);
          if (response.ok) {
            const base64ImageData = Buffer.from(await response.arrayBuffer()).toString('base64');
            let mimeType = response.headers.get('content-type') || 'image/jpeg';
            if (!mimeType.startsWith('image/')) {
              const u = failedTask.image_url.toLowerCase();
              mimeType = u.includes('.png') ? 'image/png' : u.includes('.gif') ? 'image/gif' : u.includes('.webp') ? 'image/webp' : 'image/jpeg';
            }
            imagesForRetry = [{ mime_type: mimeType, data: base64ImageData }];
          }
        } catch (e) {
          logger.warn('[Retry Failed Task] 从 image_url 下载失败:', e.message);
        }
      }
      if (!imagesForRetry?.length && failedTask.request_payload?.image?.mime_type && failedTask.request_payload?.image?.data) {
        imagesForRetry = [failedTask.request_payload.image];
      }
      if (imagesForRetry?.length) {
        generationParams.images = imagesForRetry;
      }

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
