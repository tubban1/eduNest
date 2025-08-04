const express = require('express');
const { body, validationResult } = require('express-validator');
const aiService = require('../services/aiService');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken'); // Added for token testing

const router = express.Router();

// AI生成教育内容
router.post('/generate', [
  authenticateToken,
  body('knowledgePoint').isString().isLength({ min: 1, max: 200 }).withMessage('知识点不能为空且长度不能超过200字'),
  body('learningStage').isIn(['understanding', 'application', 'assessment', 'expansion', 'gamify']).withMessage('学习阶段不合法'),
  body('description').optional().isString().isLength({ max: 1000 }).withMessage('描述长度不能超过1000字')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: '参数验证失败', 
        details: errors.array() 
      });
    }

    const { knowledgePoint, learningStage, description } = req.body;

    // 验证学习阶段
    if (!aiService.validateLearningStage(learningStage)) {
      return res.status(400).json({ error: '不支持的学习阶段' });
    }

    logger.info(`开始AI生成内容: 知识点=${knowledgePoint}, 学习阶段=${learningStage}`);

    const result = await aiService.generateEducationalContent(knowledgePoint, learningStage, description);

    if (result.success) {
      logger.info(`AI生成成功: 知识点=${knowledgePoint}, 学习阶段=${learningStage}`);
      res.json({
        success: true,
        data: result.data,
        learningStage: result.learningStage
      });
    } else {
      logger.error(`AI生成失败: ${result.error}`);
      res.status(500).json({
        success: false,
        error: result.error
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

// 简化AI生成测试（不需要认证）
router.post('/simple', [
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

    logger.info(`简化AI生成: 知识点=${knowledgePoint}, 学习阶段=${learningStage}`);

    const result = await aiService.generateSimpleContent(knowledgePoint, learningStage);

    if (result.success) {
      logger.info(`简化AI生成成功`);
      res.json({
        success: true,
        data: result.data,
        learningStage: result.learningStage
      });
    } else {
      logger.error(`简化AI生成失败: ${result.error}`);
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('简化AI生成API错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '简化AI生成失败'
    });
  }
});

// 测试AI API（不需要认证）
router.post('/test', [
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
      logger.error(`AI测试生成失败: ${result.error}`);
      res.status(500).json({
        success: false,
        error: result.error
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

    console.log('API配置:', {
      ARK_API_KEY: ARK_API_KEY ? `${ARK_API_KEY.substring(0, 8)}...` : '未设置',
      ARK_MODEL,
      ARK_URL
    });

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

    console.log('API测试响应状态:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API测试错误:', errorText);
      return res.status(500).json({
        success: false,
        error: `API测试失败: ${response.status} ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json();
    console.log('API测试成功，响应:', JSON.stringify(data, null, 2));

    res.json({
      success: true,
      message: 'API密钥有效',
      response: data
    });

  } catch (error) {
    console.error('API测试错误:', error);
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

module.exports = router;
