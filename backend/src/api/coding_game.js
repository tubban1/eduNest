const express = require('express');
const DatabaseService = require('../services/database');
const { authenticateToken } = require('../middleware/auth');
const { uploadToFreeimageHost } = require('../services/freeimage_upload_service');
const { chatWithAudio } = require('../services/vectorengine_client');

const router = express.Router();

// 创建或更新游戏项目
router.post('/projects', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, ...payload } = req.body || {};

    if (!payload.title || !payload.title.trim()) {
      return res.status(400).json({ error: 'title 不能为空' });
    }

    if (id) {
      const { data, error } = await DatabaseService.updateGameProject(userId, id, payload);
      if (error) {
        return res.status(500).json({ error: error.message || '更新项目失败' });
      }
      return res.json({ success: true, data });
    }

    const { data, error } = await DatabaseService.createGameProject(userId, payload);
    if (error) {
      return res.status(500).json({ error: error.message || '创建项目失败' });
    }
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ error: error.message || '服务器错误' });
  }
});

// 获取单个项目
router.get('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const projectId = req.params.id;

    const { data, error } = await DatabaseService.getGameProjectById(userId, projectId);
    if (error) {
      if (error.code === 'PGRST116' || error.message === 'No rows found') {
        return res.status(404).json({ error: '项目不存在' });
      }
      return res.status(500).json({ error: error.message || '获取项目失败' });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ error: error.message || '服务器错误' });
  }
});

// 列出当前用户的项目
router.get('/projects', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await DatabaseService.listGameProjectsByUser(userId);
    if (error) {
      return res.status(500).json({ error: error.message || '获取项目列表失败' });
    }
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ error: error.message || '服务器错误' });
  }
});

// 为项目添加一张绘画
router.post('/projects/:id/drawings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const projectId = req.params.id;
    const { kind, image_url, label, meta } = req.body || {};

    if (!kind || !image_url) {
      return res.status(400).json({ error: 'kind 和 image_url 为必填字段' });
    }

    const { data, error } = await DatabaseService.addGameDrawing(userId, projectId, {
      kind,
      image_url,
      label,
      meta
    });

    if (error) {
      return res.status(500).json({ error: error.message || '保存绘画失败' });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ error: error.message || '服务器错误' });
  }
});

// 上传一张图片到 freeimage.host（由后端持有 API Key）
// Body: { dataUrl: "data:image/png;base64,...", filename?: string }
router.post('/upload/freeimage', authenticateToken, async (req, res) => {
  try {
    const { dataUrl, filename } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return res.status(400).json({ error: 'dataUrl 不能为空，且必须是 data URL' });
    }

    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'dataUrl 格式错误' });
    }
    const mimeType = match[1];
    const base64 = match[2];
    const safeName = (filename && String(filename).trim()) ? String(filename).trim() : `coding-lab-${Date.now()}.png`;

    const result = await uploadToFreeimageHost(base64, safeName, mimeType);
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ error: error.message || '上传失败' });
  }
});

// TTS：把文本转成 wav 音频（VectorEngine text+audio）
// Body: { text: string, voice?: string, format?: 'wav'|'mp3' }
router.post('/voice/tts', authenticateToken, async (req, res) => {
  try {
    const { text, voice = 'alloy', format = 'wav' } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'text 不能为空' });
    }

    // 开发环境/调试时可选择跳过真实 TTS，避免外部额度限制影响体验
    if (process.env.DISABLE_VECTOR_TTS === '1') {
      return res.json({
        success: true,
        data: {
          transcript: String(text),
          audio: null,
        },
      });
    }

    const { text: transcript, audio } = await chatWithAudio({
      messages: [{ role: 'user', content: String(text) }],
      voice,
      format,
      modalities: ['text', 'audio'],
      timeoutMs: 30000,
      model: process.env.VECTORENGINE_TTS_MODEL || process.env.VECTORENGINE_MODEL,
    });
    if (!audio) {
      return res.status(500).json({ error: '未获取到音频数据' });
    }

    return res.json({
      success: true,
      data: {
        transcript,
        audio,
      },
    });
  } catch (error) {
    const isAbort = error?.name === 'AbortError';
    return res.status(500).json({ error: isAbort ? 'TTS 请求超时' : (error.message || 'TTS 失败') });
  }
});

// ASR：把音频转成文本（优先配合前端录音上传模式；WebSpeech 模式不走该接口）
// Body: { audio: { data: base64, mimeType?: string }, language?: string }
router.post('/voice/asr', authenticateToken, async (req, res) => {
  try {
    const { audio, language = 'zh-CN' } = req.body || {};
    const base64 = audio?.data;
    const mimeType = audio?.mimeType || 'audio/webm';
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ error: 'audio.data 不能为空（base64）' });
    }

    const { text } = await chatWithAudio({
      modalities: ['text'],
      timeoutMs: 45000,
      model: process.env.VECTORENGINE_ASR_MODEL || process.env.VECTORENGINE_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: {
                data: base64,
                format: mimeType.includes('ogg')
                  ? 'ogg'
                  : mimeType.includes('webm')
                  ? 'webm'
                  : 'wav',
              },
            },
            {
              type: 'text',
              text: `请将上面的语音转写为${language}文本。只输出转写结果，不要添加任何解释。`,
            },
          ],
        },
      ],
    });

    if (!text || !String(text).trim()) {
      return res.status(500).json({ error: '未获取到转写文本' });
    }

    return res.json({ success: true, data: { text: String(text).trim() } });
  } catch (error) {
    const isAbort = error?.name === 'AbortError';
    return res.status(500).json({ error: isAbort ? 'ASR 请求超时' : (error.message || 'ASR 失败') });
  }
});

// AI 引导接口：根据孩子语音文本 + 现有规则，给出规则 diff 和一句简短说明
// Body: { projectId, rules_json, user_text, stage?, last_drawing? }
router.post('/ai/guide', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, rules_json, user_text, stage, last_drawing } = req.body || {};

    if (!projectId) {
      return res.status(400).json({ error: 'projectId 不能为空' });
    }
    const text = (user_text || '').toString().trim();
    if (!text) {
      return res.status(400).json({ error: 'user_text 不能为空' });
    }

    const currentRules = rules_json && typeof rules_json === 'object'
      ? rules_json
      : {
          commands: [],
          conditions: [],
          loops: [],
          variables: [],
          events: [],
        };

    const additions = {
      commands: [],
      variables: [],
    };

    // 极简启发式：如果提到了“跳”之类的词，就添加跳跃命令；否则添加移动命令
    const wantJump = /跳|jump/i.test(text);
    const wantFire = /火|fire/i.test(text);

    if (!Array.isArray(currentRules.commands)) {
      currentRules.commands = [];
    }
    if (!Array.isArray(currentRules.variables)) {
      currentRules.variables = [];
    }

    const existingCommandNames = new Set(
      (currentRules.commands || []).map((c) => c && c.name).filter(Boolean)
    );

    if (wantJump && !existingCommandNames.has('jump')) {
      additions.commands.push({
        id: `cmd_ai_jump_${Date.now()}`,
        name: 'jump',
        displayName: '跳跃',
        category: 'movement',
        params: { height: 1 },
      });
    } else if (!existingCommandNames.has('move')) {
      additions.commands.push({
        id: `cmd_ai_move_${Date.now()}`,
        name: 'move',
        displayName: '移动',
        category: 'movement',
        params: { speed: 1 },
      });
    }

    const existingVarNames = new Set(
      (currentRules.variables || []).map((v) => v && v.name).filter(Boolean)
    );
    if (wantFire && !existingVarNames.has('firePower')) {
      additions.variables.push({
        name: 'firePower',
        type: 'int',
        initial: 1,
        description: '喷火威力',
      });
    }

    const nextRules = {
      ...currentRules,
      commands: [...(currentRules.commands || []), ...additions.commands],
      variables: [...(currentRules.variables || []), ...additions.variables],
    };

    let guideMessage = '收到！我帮你把这个想法变成一条新规则，可以在左边的规则树里看到。';
    if (wantJump) {
      guideMessage = '好主意！我给角色加了一条“跳跃”的规则，你可以在左边规则树里改名字或者再加别的动作。';
    } else if (wantFire) {
      guideMessage = '太酷了！我帮你加了一个“喷火威力”的变量，后面可以用它来控制火有多厉害。';
    }

    // 记录到 ai_usage_logs，方便后续统计
    try {
      await DatabaseService.logAIUsage({
        user_id: userId,
        action_type: 'coding-game',
        model_name: 'coding-lab-heuristic',
        user_query: text,
        request_payload: {
          projectId,
          stage: stage || null,
          rules_before: currentRules,
          last_drawing: last_drawing || null,
        },
        response_metadata: {
          rules_after: nextRules,
          rules_diff: additions,
          guide_message: guideMessage,
        },
        is_json_valid: true,
        is_render_success: true,
        status: 'done',
      });
    } catch (e) {
      // 日志失败不影响主流程
      console.error('[coding-game][ai/guide] logAIUsage error:', e?.message || e);
    }

    return res.json({
      success: true,
      data: {
        rules: nextRules,
        rules_diff: additions,
        guide_message: guideMessage,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'AI 引导失败' });
  }
});

// AI 调试接口：根据运行日志 + 现有规则，给出简单的调试建议
// Body: { projectId, rules_json, run_log, user_text? }
router.post('/ai/debug', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, rules_json, run_log, user_text } = req.body || {};

    if (!projectId) {
      return res.status(400).json({ error: 'projectId 不能为空' });
    }

    const text = (user_text || '').toString().trim();
    const currentRules = rules_json && typeof rules_json === 'object'
      ? rules_json
      : {
          commands: [],
          conditions: [],
          loops: [],
          variables: [],
          events: [],
        };

    const suggestion =
      text && /老是死|总是死|太难|过不去/.test(text)
        ? '看起来关卡有点难，可以试着把怪物生成得更慢一点，或者多加一条“吃到道具回血”的规则。'
        : '你可以看看：是不是缺了一条“碰到怪物就扣血 / 游戏结束”的规则？也可以让我帮你加一条新的条件规则。';

    try {
      await DatabaseService.logAIUsage({
        user_id: userId,
        action_type: 'coding-game',
        model_name: 'coding-lab-heuristic-debug',
        user_query: text || null,
        request_payload: {
          projectId,
          rules: currentRules,
          run_log: run_log || null,
        },
        response_metadata: {
          suggestion,
        },
        is_json_valid: true,
        is_render_success: true,
        status: 'done',
      });
    } catch (e) {
      console.error('[coding-game][ai/debug] logAIUsage error:', e?.message || e);
    }

    return res.json({
      success: true,
      data: {
        suggestion,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'AI 调试失败' });
  }
});

module.exports = router;

