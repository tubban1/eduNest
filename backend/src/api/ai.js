const express = require('express');
const { body, validationResult } = require('express-validator');
const aiService = require('../services/aiService');
const asyncGenerationQueue = require('../services/asyncGenerationQueue');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken'); // Added for token testing

const router = express.Router();
const DatabaseService = require('../services/database');

// AI生成教育内容
router.post('/generate', [
  authenticateToken,
  body('knowledgePoint').isString().isLength({ min: 1, max: 1500 }).withMessage('知识点不能为空且长度不能超过1500字'),
  body('learningStage').isIn(['understanding', 'application', 'assessment', 'expansion', 'gamify']).withMessage('学习阶段不合法'),
  body('description').optional().isString().isLength({ max: 1500 }).withMessage('描述长度不能超过1500字'),
  body('language_code').optional().isString().isLength({ min: 2, max: 35 }).withMessage('language_code 不合法'),
  body('provider').optional().isIn(['ark', 'kimi']).withMessage('provider 必须是 ark 或 kimi'),
  body('requestId').optional().isUUID().withMessage('requestId 必须是有效的UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: '参数验证失败', 
        details: errors.array() 
      });
    }

    const { knowledgePoint, learningStage, description, language_code, provider, requestId } = req.body;

    // 验证学习阶段
    if (!aiService.validateLearningStage(learningStage)) {
      return res.status(400).json({ error: '不支持的学习阶段' });
    }

    logger.info(`开始AI生成内容: 知识点=${knowledgePoint}, 学习阶段=${learningStage}, 语言=${language_code || '未指定'}`);

    // 订阅豁免与积分预校验（先校验，成功后再在成功渲染时扣减）
    const userId = req.user?.id;
    let shouldConsume = true;
    if (userId) {
      const { data: subscription } = await DatabaseService.getActiveSubscription(userId);
      if (subscription && subscription.plan === 'pro') {
        shouldConsume = false;
      } else {
        const { data: balance } = await DatabaseService.getCreditsBalance(userId);
        if ((balance || 0) < 1) {
          return res.status(402).json({ success: false, error: '积分不足' });
        }
      }
    }

    const result = await aiService.generateEducationalContent(knowledgePoint, learningStage, description, language_code, userId, 'generate', provider, requestId);

    if (result.success) {
      logger.info(`AI生成成功: 知识点=${knowledgePoint}, 学习阶段=${learningStage}, 语言=${result.data?.language_code || language_code || '未知'}`);
      // 在生成成功后扣减积分（仅当需要且用户存在）
      if (shouldConsume && userId) {
        await DatabaseService.addCreditChange(userId, 'usage', -1);
      }

      res.json({
        success: true,
        data: result.data,
        learningStage: result.learningStage
      });
    } else {
      logger.error(`AI生成失败: ${result.error}`, {
        knowledgePoint,
        learningStage,
        language_code,
        error: result.error,
        details: result.details
      });
      res.status(500).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }

  } catch (error) {
    logger.error('AI生成API错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'AI生成失败'
    });
  }
});

// 测试AI API（不需要认证）
router.post('/test', [
  body('knowledgePoint').isString().isLength({ min: 1, max: 1500 }).withMessage('知识点不能为空且长度不能超过1500字'),
  body('learningStage').isIn(['understanding', 'application', 'assessment', 'expansion', 'gamify']).withMessage('学习阶段不合法'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: '参数验证失败', 
        details: errors.array() 
      });
    }

    const { knowledgePoint, learningStage } = req.body;

    logger.info(`测试AI生成: 知识点=${knowledgePoint}, 学习阶段=${learningStage}`);

    const result = await aiService.generateEducationalContent(knowledgePoint, learningStage);

    if (result.success) {
      logger.info(`AI测试生成成功`);
      res.json({
        success: true,
        data: result.data,
        learningStage: result.learningStage
      });
    } else {
      logger.error(`AI测试生成失败: ${result.error}`, {
        knowledgePoint,
        learningStage,
        error: result.error,
        details: result.details
      });
      res.status(500).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }

  } catch (error) {
    logger.error('AI测试API错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'AI测试失败'
    });
  }
});

// 获取支持的学习阶段
router.get('/learning-stages', authenticateToken, async (req, res) => {
  try {
    const stages = aiService.getSupportedLearningStages();
    res.json({
      success: true,
      data: stages
    });
  } catch (error) {
    logger.error('获取学习阶段失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取学习阶段失败'
    });
  }
});

// 获取学习阶段描述
router.get('/learning-stage/:stage/description', authenticateToken, async (req, res) => {
  try {
    const { stage } = req.params;
    
    if (!aiService.validateLearningStage(stage)) {
      return res.status(400).json({ error: '不支持的学习阶段' });
    }

    const description = aiService.getLearningStageDescription(stage);
    res.json({
      success: true,
      data: {
        stage,
        description,
        name: aiService.LEARNING_STAGE_NAMES[stage]
      }
    });
  } catch (error) {
    logger.error('获取学习阶段描述失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取学习阶段描述失败'
    });
  }
});

// 测试API密钥
router.get('/test-key', async (req, res) => {
  try {
    const ARK_API_KEY = process.env.ARK_API_KEY;
    const ARK_MODEL = process.env.ARK_MODEL || 'kimi-k2-250711';
    const ARK_URL = process.env.ARK_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

    if (!ARK_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'ARK_API_KEY未配置'
      });
    }

    // 发送一个简单的测试请求
    const response = await fetch(ARK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify({
        model: ARK_MODEL,
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({
        success: false,
        error: `API测试失败: ${response.status} ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json();

    res.json({
      success: true,
      message: 'API密钥有效',
      response: data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'API测试失败'
    });
  }
});

// 测试AI返回的原始内容
router.post('/test-raw', [
  body('knowledgePoint').isString().isLength({ min: 1, max: 200 }).withMessage('知识点不能为空且长度不能超过200字'),
  body('learningStage').isIn(['understanding', 'application', 'assessment', 'expansion', 'gamify']).withMessage('学习阶段不合法'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: '参数验证失败', 
        details: errors.array() 
      });
    }

    const { knowledgePoint, learningStage } = req.body;

    logger.info(`测试AI原始返回: 知识点=${knowledgePoint}, 学习阶段=${learningStage}`);

    // 直接调用AI API查看原始返回
    const userPrompt = aiService.LEARNING_STAGE_PROMPTS[learningStage].replace('{{knowledge_point}}', knowledgePoint);
    
    const response = await fetch(process.env.ARK_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ARK_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.ARK_MODEL || 'kimi-k2-250711',
        messages: [
          { role: 'system', content: aiService.SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      return res.status(500).json({ error: `AI API请求失败: ${response.status}` });
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    res.json({
      success: true,
      rawResponse: aiResponse,
      responseLength: aiResponse?.length || 0
    });

  } catch (error) {
    logger.error('测试AI原始返回错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '测试失败'
    });
  }
});

// 测试Supabase token解析
router.post('/test-token', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(400).json({ error: '没有提供token' });
    }

    // 解码JWT token
    const decoded = jwt.decode(token);
    
    res.json({
      success: true,
      decoded: decoded,
      userId: decoded?.sub,
      email: decoded?.email
    });

  } catch (error) {
    logger.error('Token测试错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '测试失败'
    });
  }
});

// 通过request_id查询AI生成日志
router.get('/logs/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user?.id;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: 'request_id参数缺失'
      });
    }

    // 验证UUID格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(requestId)) {
      return res.status(400).json({
        success: false,
        error: '无效的request_id格式'
      });
    }

    logger.info(`查询AI生成日志: requestId=${requestId}, userId=${userId}`);

    // 从数据库查询日志
    const { data: logData, error: queryError } = await DatabaseService.supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('request_id', requestId)
      .single();

    if (queryError) {
      logger.error('查询AI日志失败:', queryError);
      return res.status(500).json({
        success: false,
        error: '查询日志失败'
      });
    }

    if (!logData) {
      return res.status(404).json({
        success: false,
        error: '未找到对应的生成记录'
      });
    }

    // 验证用户权限（只能查询自己的日志）
    if (userId && logData.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '无权访问此记录'
      });
    }

    // 解析response_metadata中的response_meta
    let responseMeta = null;
    if (logData.response_metadata) {
      try {
        const metadata = typeof logData.response_metadata === 'string' 
          ? JSON.parse(logData.response_metadata) 
          : logData.response_metadata;
        responseMeta = metadata.raw || metadata.response_meta || metadata;
      } catch (parseError) {
        logger.warn('解析response_metadata失败:', parseError);
      }
    }

    res.json({
      success: true,
      data: {
        ...logData,
        response_meta: responseMeta
      }
    });

  } catch (error) {
    logger.error('查询AI日志API错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '查询日志失败'
    });
  }
});

// 重新加载AI生成结果（通过request_id）
router.get('/reload', authenticateToken, async (req, res) => {
  try {
    const { request_id } = req.query;
    const userId = req.user?.id;

    if (!request_id) {
      return res.status(400).json({
        success: false,
        error: 'request_id参数缺失'
      });
    }

    // 验证UUID格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(request_id)) {
      return res.status(400).json({
        success: false,
        error: '无效的request_id格式'
      });
    }

    logger.info(`重新加载AI生成结果: requestId=${request_id}, userId=${userId}`);

    // 从数据库查询日志
    const { data: logData, error: queryError } = await DatabaseService.supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('request_id', request_id)
      .single();

    if (queryError) {
      logger.error('查询AI日志失败:', queryError);
      return res.status(500).json({
        success: false,
        error: '查询日志失败'
      });
    }

    if (!logData) {
      return res.status(404).json({
        success: false,
        error: '未找到对应的生成记录'
      });
    }

    // 验证用户权限（只能查询自己的日志）
    if (userId && logData.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '无权访问此记录'
      });
    }

    // 解析response_metadata中的response_meta
    let responseMeta = null;
    if (logData.response_metadata) {
      try {
        const metadata = typeof logData.response_metadata === 'string' 
          ? JSON.parse(logData.response_metadata) 
          : logData.response_metadata;
        responseMeta = metadata.raw || metadata.response_meta || metadata;
      } catch (parseError) {
        logger.warn('解析response_metadata失败:', parseError);
        return res.status(500).json({
          success: false,
          error: '解析生成结果失败'
        });
      }
    }

    if (!responseMeta) {
      return res.status(404).json({
        success: false,
        error: '未找到有效的生成结果'
      });
    }

    res.json({
      success: true,
      data: responseMeta,
      request_id: request_id
    });

  } catch (error) {
    logger.error('重新加载AI结果API错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '重新加载失败'
    });
  }
});

// 异步生成内容接口
router.post('/generate-async', [
  authenticateToken,
  body('content_id').isUUID().withMessage('content_id 必须是有效的UUID'),
  body('knowledge_point').isString().isLength({ min: 1, max: 1500 }).withMessage('知识点不能为空且长度不能超过1500字'),
  body('learning_stage').optional().isIn(['understanding', 'application', 'assessment', 'expansion', 'gamify']).withMessage('学习阶段不合法'),
  body('description').optional().isString().isLength({ max: 1500 }).withMessage('描述长度不能超过1500字'),
  body('language_code').optional().isString().isLength({ min: 2, max: 35 }).withMessage('language_code 不合法'),
  body('provider').optional().isIn(['ark', 'kimi']).withMessage('provider 必须是 ark 或 kimi')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        error: '参数验证失败', 
        details: errors.array() 
      });
    }

    const { content_id, knowledge_point, learning_stage, description, language_code, provider } = req.body;
    const userId = req.user?.id;

    // 验证 content 是否存在且属于当前用户
    const { data: content, error: contentError } = await DatabaseService.supabase
      .from('content')
      .select('id, created_by')
      .eq('id', content_id)
      .eq('created_by', userId)
      .single();

    if (contentError || !content) {
      return res.status(404).json({
        success: false,
        error: '内容不存在或无权限访问'
      });
    }

    // 订阅豁免与积分预校验
    let shouldConsume = true;
    if (userId) {
      const { data: subscription } = await DatabaseService.getActiveSubscription(userId);
      if (subscription && subscription.plan === 'pro') {
        shouldConsume = false;
      } else {
        const { data: balance } = await DatabaseService.getCreditsBalance(userId);
        if ((balance || 0) < 1) {
          return res.status(402).json({ 
            success: false, 
            error: '积分不足' 
          });
        }
      }
    }

    // 添加生成任务到队列
    const { log, requestId } = await asyncGenerationQueue.addTask(content_id, {
      user_id: userId,
      knowledge_point,
      learning_stage: learning_stage || 'understanding',
      description,
      language_code,
      provider
    });

    logger.info(`异步生成任务已添加: contentId=${content_id}, requestId=${requestId}`);

    res.json({
      success: true,
      data: {
        content_id,
        request_id: requestId,
        status: 'pending',
        message: '已加入生成队列'
      }
    });

  } catch (error) {
    logger.error('异步生成API错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '异步生成失败'
    });
  }
});

// 获取内容生成状态
router.get('/generation-status/:contentId', authenticateToken, async (req, res) => {
  try {
    const { contentId } = req.params;
    const userId = req.user?.id;

    // 验证 content 权限
    const { data: content, error: contentError } = await DatabaseService.supabase
      .from('content')
      .select('id, created_by')
      .eq('id', contentId)
      .eq('created_by', userId)
      .single();

    if (contentError || !content) {
      return res.status(404).json({
        success: false,
        error: '内容不存在或无权限访问'
      });
    }

    // 查询最新的生成日志
    const { data: log, error: logError } = await DatabaseService.supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('content_id', contentId)
      .eq('action_type', 'generate')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (logError || !log) {
      return res.status(404).json({
        success: false,
        error: '未找到生成记录'
      });
    }

    // 计算重试次数
    const retryCount = await asyncGenerationQueue.getRetryCount(contentId);
    
    // 计算进度
    let progress = 0;
    switch (log.status) {
      case 'pending': progress = 10; break;
      case 'processing': progress = 50; break;
      case 'done': progress = 100; break;
      case 'failed': progress = 0; break;
      default: progress = 0;
    }

    res.json({
      success: true,
      data: {
        status: log.status,
        progress,
        retry_count: retryCount,
        latest_request_id: log.request_id,
        error_message: log.error_message,
        created_at: log.created_at,
        updated_at: log.updated_at
      }
    });

  } catch (error) {
    logger.error('获取生成状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取生成状态失败'
    });
  }
});

// 批量获取生成状态
router.get('/generation-status', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.query;
    const userId = req.user?.id;

    if (!ids) {
      return res.status(400).json({
        success: false,
        error: '缺少 content_ids 参数'
      });
    }

    const contentIds = ids.split(',');
    
    // 验证权限并获取状态
    const statuses = await Promise.all(
      contentIds.map(async (contentId) => {
        try {
          // 验证权限
          const { data: content } = await DatabaseService.supabase
            .from('content')
            .select('id')
            .eq('id', contentId)
            .eq('created_by', userId)
            .single();

          if (!content) {
            return {
              content_id: contentId,
              status: 'unauthorized',
              progress: 0,
              retry_count: 0
            };
          }

          // 获取生成状态
          const { data: log } = await DatabaseService.supabase
            .from('ai_usage_logs')
            .select('*')
            .eq('content_id', contentId)
            .eq('action_type', 'generate')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (!log) {
            return {
              content_id: contentId,
              status: 'unknown',
              progress: 0,
              retry_count: 0
            };
          }

          const retryCount = await asyncGenerationQueue.getRetryCount(contentId);
          
          let progress = 0;
          switch (log.status) {
            case 'pending': progress = 10; break;
            case 'processing': progress = 50; break;
            case 'done': progress = 100; break;
            case 'failed': progress = 0; break;
            default: progress = 0;
          }

          return {
            content_id: contentId,
            status: log.status,
            progress,
            retry_count: retryCount,
            latest_request_id: log.request_id,
            error_message: log.error_message
          };
        } catch (error) {
          logger.error(`获取内容 ${contentId} 状态失败:`, error);
          return {
            content_id: contentId,
            status: 'error',
            progress: 0,
            retry_count: 0,
            error: error.message
          };
        }
      })
    );

    res.json({
      success: true,
      data: statuses
    });

  } catch (error) {
    logger.error('批量获取生成状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '批量获取生成状态失败'
    });
  }
});

// 手动重试失败的任务
router.post('/retry/:contentId', authenticateToken, async (req, res) => {
  try {
    const { contentId } = req.params;
    const userId = req.user?.id;

    // 验证 content 权限
    const { data: content, error: contentError } = await DatabaseService.supabase
      .from('content')
      .select('id, created_by')
      .eq('id', contentId)
      .eq('created_by', userId)
      .single();

    if (contentError || !content) {
      return res.status(404).json({
        success: false,
        error: '内容不存在或无权限访问'
      });
    }

    // 手动重试
    const result = await asyncGenerationQueue.retryFailedTask(contentId, userId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('手动重试失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '重试失败'
    });
  }
});

// 获取队列状态（管理员接口）
router.get('/queue-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    // 检查管理员权限
    const { data: user } = await DatabaseService.supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: '权限不足'
      });
    }

    const queueStatus = await asyncGenerationQueue.getQueueStatus();

    res.json({
      success: true,
      data: queueStatus
    });

  } catch (error) {
    logger.error('获取队列状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取队列状态失败'
    });
  }
});

module.exports = router;
