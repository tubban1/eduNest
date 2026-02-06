/**
 * WebSocket 代理：转发到 OpenAI Realtime 兼容 API
 * 用于 AI Guide 实时语音测试
 * 仅限 admin 使用
 *
 * 支持 edu.context.update 消息，将 TeachingSnapshot 注入 Realtime 模型的 instructions
 */
const WebSocket = require('ws');
const { parse } = require('url');
const logger = require('../utils/logger');
const { verifySupabaseToken } = require('../middleware/auth');
const { buildTeachingSnapshot } = require('./teachingSnapshot');
const { normalizeMetadata } = require('../utils/metadataNormalizer');

const REALTIME_WS_URL = process.env.GPT_REALTIME_WS_URL || 'wss://hrqdapi.cn/v1/realtime';
const API_KEY = process.env.GPT_REALTIME_API_KEY;

// 基础教学指令（稳定层）
const BASE_INSTRUCTIONS = `You are an AI Learning Guide (Teacher Rao) inside eduNest.

Rules:
- Focus only on the current learning step.
- Never give the final answer.
- Use short, spoken, natural language.
- Guide by asking questions, not explaining everything.
- Make jokes when appropriate to keep learning engaging.`;

// 有 TeachingSnapshot 时追加的「必须使用上下文」说明
const CONTEXT_USAGE_RULES = `

IMPORTANT — You are given the current teaching context below. You MUST use it to answer.
- You CAN see what the student is learning (topic, current stage, visible expression, learning goal).
- Do NOT say you cannot see the teaching snapshot or the student's current step; you have it below.
- When the user asks "can you see what I'm learning" or "题目", confirm that you see it and briefly state the topic/current step from the context below.`;

/**
 * 发送 session.update 到上游（包含 BASE + TeachingSnapshot）
 */
function sendSessionUpdate(upstream, teachingSnapshot, callSite = 'unknown') {
  if (!upstream || upstream.readyState !== 1) {
    logger.warn('[Realtime Proxy] ⚠️ sendSessionUpdate 被调用但 upstream 未就绪', { callSite });
    return;
  }
  
  // 记录调用来源和 snapshot 状态
  logger.info('[Realtime Proxy] 🔍 sendSessionUpdate 被调用', {
    callSite,
    has_snapshot: !!teachingSnapshot,
    snapshot_topic: teachingSnapshot?.topic || null,
    snapshot_current_problem: teachingSnapshot?.current_problem || null,
  });
  
  let instructions = BASE_INSTRUCTIONS;
  
  if (teachingSnapshot) {
    // 把「当前题目」放在最前面，模型先看到、必须据此回答
    const problemLine = teachingSnapshot.current_problem
      ? `\n\n【当前题目】你必须据此回答，不可说「看不到题目」：\n${teachingSnapshot.current_problem}\n`
      : '';
    instructions += problemLine;
    instructions += CONTEXT_USAGE_RULES;
    instructions += `\n\nCurrent teaching context (you have this):\n${JSON.stringify(teachingSnapshot, null, 2)}`;
    
    logger.info('[Realtime Proxy] 📤 发送 session.update 到 Realtime，传给 AI 的上下文:', {
      current_problem: teachingSnapshot.current_problem || '(未生成)',
      topic: teachingSnapshot.topic || '(未设置)',
      current_stage: teachingSnapshot.current_stage ? {
        index: teachingSnapshot.current_stage.index,
        title: teachingSnapshot.current_stage.title || '(无标题)',
        visible_expression: teachingSnapshot.current_stage.visible_expression || null,
        key_rule: teachingSnapshot.current_stage.key_rule || null,
      } : null,
      learning_goal_now: teachingSnapshot.learning_goal_now || null,
      has_stages_summary: Array.isArray(teachingSnapshot.stages_summary) ? teachingSnapshot.stages_summary.length : 0,
      has_learning_objectives: Array.isArray(teachingSnapshot.learning_objectives) ? teachingSnapshot.learning_objectives.length : 0,
    });
  } else {
    if (callSite === 'initial_connection') {
      logger.info('[Realtime Proxy] 初始连接：暂无 snapshot，仅发送基础指令；待前端发送 edu.context.update 后会再发送完整上下文');
    } else {
      logger.warn('[Realtime Proxy] ⚠️ 发送 session.update 但 teachingSnapshot 为 null（只有基础指令）', { callSite });
    }
  }
  
  upstream.send(JSON.stringify({
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      instructions: instructions,
      input_audio_transcription: { model: 'whisper-1' }
    }
  }));
}

/**
 * @param {Function} onOpen - (ws) => void，上游连接打开时调用，用于发送当前 snapshot（可能已被 edu.context.update 提前设置）
 */
function createUpstreamConnection(onMessage, onError, onClose, onOpen) {
  if (!API_KEY) {
    onError(new Error('GPT_REALTIME_API_KEY 未配置'));
    return null;
  }
  const url = `${REALTIME_WS_URL}?model=gpt-4o-realtime-preview`;
  const ws = new WebSocket(url, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });

  ws.on('open', () => {
    logger.info('[Realtime Proxy] 🔌 上游 WebSocket 已连接（OPEN）');
    if (typeof onOpen === 'function') {
      onOpen(ws);
    }
  });

  ws.on('message', (data) => {
    try {
      onMessage(data.toString());
    } catch (e) {
      onError(e);
    }
  });

  ws.on('error', onError);
  ws.on('close', onClose);
  return ws;
}

async function handleClientConnection(clientWs, request) {
  const { query } = parse(request?.url || '', true);
  const token = query?.token || query?.access_token;
  if (!token) {
    clientWs.close(4003, '需要登录');
    return;
  }
  let user;
  try {
    user = await verifySupabaseToken(token);
  } catch (e) {
    logger.warn('[Realtime Proxy] token 验证失败:', e?.message);
    clientWs.close(4003, '认证失败');
    return;
  }
  if (!user || user.role !== 'admin') {
    logger.info('[Realtime Proxy] 非 admin 用户尝试连接，已拒绝', { userId: user?.id, role: user?.role });
    clientWs.close(4003, '仅限管理员使用');
    return;
  }

  let upstream = null;
  let currentTeachingSnapshot = null;
  /** 上游尚未 open 时收到的 snapshot，open 时必须发送此份，避免竞态导致读不到 currentTeachingSnapshot */
  let pendingSnapshotForOpen = null;
  let lastUpdateTime = 0;
  const UPDATE_THROTTLE_MS = 3000; // 3 秒内最多更新一次

  const cleanup = () => {
    if (upstream) {
      try { upstream.close(); } catch {}
      upstream = null;
    }
    currentTeachingSnapshot = null;
    pendingSnapshotForOpen = null;
    lastUpdateTime = 0;
  };

  upstream = createUpstreamConnection(
    (msg) => {
      if (clientWs.readyState === 1) clientWs.send(msg);
    },
    (err) => {
      logger.warn('Realtime upstream error:', err?.message);
      if (clientWs.readyState === 1) {
        clientWs.send(JSON.stringify({ type: 'error', error: { message: err?.message || '上游连接错误' } }));
      }
      cleanup();
    },
    () => cleanup(),
    (ws) => {
      // 优先发送「待发送」snapshot（先收到 edu.context.update、后 open 时已写入），再回退到当前 snapshot
      const snapshot = pendingSnapshotForOpen || currentTeachingSnapshot;
      if (pendingSnapshotForOpen) {
        logger.info('[Realtime Proxy] 上游已就绪，发送待发送的 snapshot（edu.context.update 先于 open 到达）', {
          has_snapshot: true,
          topic: snapshot?.topic || null,
          current_problem: snapshot?.current_problem || null,
        });
        pendingSnapshotForOpen = null;
      } else {
        logger.info('[Realtime Proxy] 上游已就绪，发送当前 snapshot', {
          has_snapshot: !!snapshot,
          topic: snapshot?.topic || null,
        });
      }
      sendSessionUpdate(ws, snapshot, 'initial_connection');
    }
  );

  if (!upstream) return;

  clientWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      // 处理 edu.context.update 消息
      if (msg.type === 'edu.context.update') {
        const { meta: rawMeta, currentStage, uiState } = msg.payload || {};
        
        logger.info('[Realtime Proxy] 📥 收到 edu.context.update:', {
          has_meta: !!rawMeta,
          meta_type: rawMeta ? (rawMeta.canonical ? 'has_canonical' : rawMeta.sections ? 'has_sections' : rawMeta.contentStructure ? 'has_contentStructure' : 'other') : 'null',
          currentStage: currentStage || null,
          uiState_keys: uiState ? Object.keys(uiState).slice(0, 5) : null,
        });
        
        // 规范化 meta：支持前端传完整 metadata_json 或仅 canonical
        let meta = null;
        if (rawMeta) {
          if (rawMeta.canonical && typeof rawMeta.canonical === 'object') {
            meta = rawMeta.canonical;
            logger.debug('[Realtime Proxy] 使用 rawMeta.canonical');
          } else if (rawMeta.sections || rawMeta.contentStructure || rawMeta.contentFlow || rawMeta.pageStructure) {
            const { canonical } = normalizeMetadata(rawMeta);
            meta = canonical;
            logger.debug('[Realtime Proxy] 规范化旧格式 metadata，得到 canonical:', {
              topic: canonical.topic,
              stages_count: canonical.stages?.length || 0,
            });
          } else if (rawMeta.topic != null || Array.isArray(rawMeta.stages)) {
            meta = rawMeta;
            logger.debug('[Realtime Proxy] 使用 rawMeta（简约 canonical）');
          }
        }
        
        if (meta) {
          const newSnapshot = buildTeachingSnapshot({
            meta,
            currentStage: currentStage || null,
            uiState: uiState || null
          });
          
          logger.info('[Realtime Proxy] ✅ 构建 TeachingSnapshot 完成:', {
            topic: newSnapshot.topic,
            current_problem: newSnapshot.current_problem || '(未生成)',
            current_stage_index: newSnapshot.current_stage?.index || null,
            current_stage_title: newSnapshot.current_stage?.title || null,
            learning_goal_now: newSnapshot.learning_goal_now || null,
          });
          
          // 防抖：3 秒内只更新一次（除非阶段真的改变了）；首次更新（lastUpdateTime===0）必须执行
          const now = Date.now();
          const stageChanged = currentTeachingSnapshot?.current_stage?.index !== newSnapshot.current_stage?.index;
          const timeSinceLastUpdate = lastUpdateTime > 0 ? now - lastUpdateTime : UPDATE_THROTTLE_MS + 1; // 首次视为已过防抖
          const isFirstUpdate = lastUpdateTime === 0;
          
          if (isFirstUpdate || stageChanged || timeSinceLastUpdate >= UPDATE_THROTTLE_MS) {
            logger.info('[Realtime Proxy] 🔄 准备更新 TeachingSnapshot', {
              is_first_update: isFirstUpdate,
              stage_changed: stageChanged,
              time_since_last_update_sec: Math.round(timeSinceLastUpdate / 1000),
              new_snapshot_topic: newSnapshot.topic,
              new_snapshot_current_problem: newSnapshot.current_problem,
            });
            
            currentTeachingSnapshot = newSnapshot;
            lastUpdateTime = now;
            
            logger.info('[Realtime Proxy] ✅ currentTeachingSnapshot 已更新', {
              stored_snapshot_topic: currentTeachingSnapshot.topic,
              stored_snapshot_current_problem: currentTeachingSnapshot.current_problem,
            });
            
            if (upstream && upstream.readyState === 1) {
              sendSessionUpdate(upstream, currentTeachingSnapshot, 'edu_context_update');
            } else {
              // 上游未就绪时显式写入「待发送」，上游 open 时一定会发这份，避免 onOpen 读到空
              pendingSnapshotForOpen = newSnapshot;
              logger.info('[Realtime Proxy] 上游尚未就绪，已写入 pendingSnapshotForOpen，待上游 open 时发送', {
                topic: newSnapshot.topic,
                current_problem: newSnapshot.current_problem,
              });
            }
          } else {
            logger.debug('[Realtime Proxy] ⏸️ TeachingSnapshot 更新被限流', {
              time_since_last_update_sec: Math.round(timeSinceLastUpdate / 1000),
              stage_changed: stageChanged,
              current_snapshot_topic: currentTeachingSnapshot?.topic || null,
            });
          }
        } else {
          logger.warn('[Realtime Proxy] ❌ edu.context.update missing meta（rawMeta 为空或无法规范化）');
        }
        
        // 不转发 edu.context.update 到上游
        return;
      }
      
      // 其他消息正常转发
      if (upstream && upstream.readyState === 1) {
        upstream.send(data.toString());
      }
    } catch (e) {
      // 如果不是 JSON，直接转发（可能是二进制音频数据）
      if (upstream && upstream.readyState === 1) {
        upstream.send(data);
      }
    }
  });

  clientWs.on('close', () => cleanup());
  clientWs.on('error', () => cleanup());
}

module.exports = { handleClientConnection };
