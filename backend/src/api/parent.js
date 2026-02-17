const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { validateVisitorId } = require('../middleware/visitorId');
const { supabase } = require('../services/database');
const aiProviderFactory = require('../services/aiProviderFactory');
const logger = require('../utils/logger');

/**
 * 家长建议：根据期待 / 兴趣 / 天赋 + 年龄 / 区域 / 科目 生成个性化建议
 * POST /api/parent/advice
 * - 可登录（推荐）或游客（仅生成建议，不落库）
 * - 请求体：
 *   {
 *     identity: 'parent',
 *     region: 'CN',
 *     language: 'zh-CN',
 *     age: 12,
 *     subjects: ['数学', '物理'],
 *     expectations: '希望孩子数学稳在班级前几',
 *     child_interests: '喜欢科学实验和搭乐高',
 *     child_talents: '逻辑思维好，动手能力强'
 *   }
 */
router.post('/advice', optionalAuth, validateVisitorId, async (req, res) => {
  try {
    const {
      identity,
      region,
      language,
      age,
      subjects,
      expectations,
      child_interests,
      child_talents,
    } = req.body || {};

    // 基本校验：家长身份 + 至少有一项描述
    if (identity && identity !== 'parent') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_IDENTITY',
        message: '仅支持家长身份调用此接口（identity = parent）',
      });
    }

    if (
      !expectations &&
      !child_interests &&
      !child_talents
    ) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PARENT_INPUT',
        message: '请至少提供期待、兴趣或天赋中的一项信息',
      });
    }

    // 构造 AI 提示词
    const lang = language || 'zh-CN';
    const isZh = lang.toLowerCase().startsWith('zh');

    const systemPrompt = isZh
      ? '你是一位专业的教育规划顾问，擅长根据家长的期待、孩子的兴趣与天赋，结合年龄、地区与科目，为家长提供具体、可执行、不过度焦虑的学习建议。请用简洁的中文回答，结构清晰，可分条列出。'
      : 'You are an educational planning advisor. Based on the parent\'s expectations, the child\'s interests and talents, combined with age, region, and subjects, provide concrete, actionable, non-anxiety-inducing learning advice. Use a clear structure and keep it concise.';

    const userPrompt = isZh
      ? `
请根据以下信息，给家长一段个性化的学习建议（可以分条）：

- 地区: ${region || '未知'}
- 语言: ${language || 'zh-CN'}
- 年龄: ${age || '未知'}
- 科目: ${(subjects || []).join('、') || '未指定'}
- 家长的期待: ${expectations || '未填写'}
- 孩子的兴趣: ${child_interests || '未填写'}
- 孩子的天赋/特长: ${child_talents || '未填写'}

请重点回答：
1. 当前阶段更适合关注哪些学习目标和习惯（而不是一味追高分）？
2. 可以从哪些具体的小行动开始（例如每周/每天可以做什么）？
3. 如何利用孩子的兴趣和天赋，把学习变得更有动力？
`
      : `
Based on the following information, give the parent personalized learning advice (you can use bullet points):

- Region: ${region || 'unknown'}
- Language: ${language || 'en-US'}
- Age: ${age || 'unknown'}
- Subjects: ${(subjects || []).join(', ') || 'not specified'}
- Parent expectations: ${expectations || 'not provided'}
- Child interests: ${child_interests || 'not provided'}
- Child talents/strengths: ${child_talents || 'not provided'}

Please focus on:
1. What learning goals and habits are most appropriate for this stage (not just chasing high scores)?
2. What small, concrete actions can they start with (e.g., weekly/daily routines)?
3. How to leverage the child\'s interests and talents to increase motivation?
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    // 调用 AI 提供商（使用 aiProviderFactory，保持与 aiService 一致）
    const result = await aiProviderFactory.createChatCompletion({
      provider: 'qenda', // 与主站默认一致
      messages,
      max_tokens: 1200,
      temperature: 0.7,
    });

    const adviceText = (result && result.content && String(result.content).trim()) || '';
    if (!adviceText) {
      return res.status(500).json({
        success: false,
        error: 'EMPTY_ADVICE',
        message: 'AI 未能生成有效的建议，请稍后重试',
      });
    }

    // 若已登录用户，且存在 parent_advice_records 表，则尝试落库
    try {
      if (req.user && req.user.id) {
        const snapshot = {
          identity: identity || 'parent',
          region: region || null,
          language: language || null,
          age: age || null,
          subjects: subjects || [],
        };

        const { error } = await supabase
          .from('parent_advice_records')
          .insert({
            user_id: req.user.id,
            expectations: expectations || null,
            child_interests: child_interests || null,
            child_talents: child_talents || null,
            advice_text: adviceText,
            init_context_snapshot: snapshot,
          });

        if (error) {
          logger.warn('写入 parent_advice_records 失败（不影响主流程）:', error);
        }
      }
    } catch (e) {
      logger.warn('保存家长建议记录时发生异常（忽略）:', e);
    }

    return res.json({
      success: true,
      data: {
        advice: adviceText,
      },
    });
  } catch (error) {
    logger.error('生成家长建议失败:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message || '生成家长建议失败',
    });
  }
});

/**
 * 家长建议历史（可选）
 * GET /api/parent/advice-history
 * 需要登录
 */
router.get('/advice-history', optionalAuth, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: '请先登录',
      });
    }

    const { data, error } = await supabase
      .from('parent_advice_records')
      .select('id, expectations, child_interests, child_talents, advice_text, init_context_snapshot, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('查询 parent_advice_records 失败:', error);
      return res.status(500).json({
        success: false,
        error: 'QUERY_FAILED',
        message: error.message || '查询家长建议历史失败',
      });
    }

    return res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    logger.error('获取家长建议历史失败:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message || '获取家长建议历史失败',
    });
  }
});

module.exports = router;

