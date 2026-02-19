const { supabase, logAIUsage } = require('./database');
const { aiProviderFactory, safeReplace } = require('./aiService');
const { v4: uuidv4 } = require('uuid');
const { isVisitorId } = require('../utils/visitorId');
const DatabaseService = require('./database');
const { buildTeachingSnapshot } = require('./teachingSnapshot');
const { uploadToFreeimageHost } = require('./freeimage_upload_service');

// In-flight dedupe: avoid duplicated analyze/start-session when user quickly closes & reopens aiGuide.
// 关键：同一个 contentId 的 metadata/initial message 在生成中时，后续请求复用同一个 Promise，避免重复跑 LLM。
const metadataInFlight = new Map(); // contentId -> Promise<metadata>
const contentInitialInFlight = new Map(); // contentId -> Promise<{content, model, usage, source}>

// Metadata Extraction Prompt
// canonical = 固定 schema，供 buildTeachingSnapshot / Realtime / AI Guide 稳定解析
// extras = 灵活格式，供 AI Guide 获取更丰富上下文
const METADATA_PROMPT = `You are an advanced educational content analyzer. Extract structured metadata from the provided HTML.

RULES:
1. Analyze HTML structure, CSS, JS logic — what the page DOES, not just looks like.
2. Identify technology (Three.js, Vue, D3, etc.).
3. Capture interactivity: how users interact and what changes.
4. Extract pedagogy: exploring, solving, or reading?
5. No hallucinations: only describe features present in the code.

OUTPUT: Return ONLY valid JSON with two keys:

1. "canonical" (required) — FIXED schema. 

{
  "topic": "string, one-line theme",
  "language": "string, e.g. zh-CN | en-US",
  "stages": [
    {
      "index": 1,
      "title": "string",
      "description": "string, optional",
      "key_concept": "string, optional",
      "formula": "string, optional, LaTeX in this step",
      "pedagogy": "string, optional, e.g. 交互式实验 | Quiz | 讲解",
      "interactivity_hint": "string, optional, e.g. 拖动滑块；点击下一步"
    }
  ],
  "learning_objectives": ["string"],
  "concept_map": [{"concept": "string", "formula": "string, optional", "description": "string"}],
  "interactions_summary": [{"action": "string", "result": "string"}],
  "visual_hints": "string or array, optional"
}

- stages[].index: MUST start from 1 (1-based, not 0).
- concept_map: concept DEFINITIONS for "what is X?" — use {concept, formula?, description}, NOT source/target/relationship.
- interactions_summary: ARRAY of {action, result}. Omit optional fields if not applicable.

2. "extras" (optional) — FLEXIBLE format. Any page-specific structure: visualElements, pageStateSchema, gameMechanics, logicSchema, problemStatement, etc.

Omit fields that do not apply. Escape LaTeX backslashes in JSON: use \\\\ for \\ (e.g. \\\\frac not \\frac).

Analyze the HTML and output the JSON.`;

// AI Guided Learning System Prompt
const SYSTEM_PROMPT_TEMPLATE = `
{
  "role": "ai_learning_guide",
  "identity": {
    "name": "Teacher Rao"/“饶老师",
    "mode": "pair_learning",
    "environment": "interactive_web_page",
    "platform": "eduNest"
  },
  "inputs": {
    "metadata": "page content, structure, capabilities",
    "ui_state": "real-time interaction state",
    "conversation": "chat history"
  },
  "teaching_modes": {
    "structured_reasoning": {
      "goal": "step_by_step_logical_understanding",
      "rules": [
        "never_give_final_answer",
        "focus_on_current_step_reasoning",
        "do_not_skip_steps"
      ]
    },
    "concept_construction": {
      "goal": "build_intuition_from_visual_and_sensory_input",
      "rules": [
        "describe_observed_changes",
        "map_visuals_to_concepts",
        "check_intuitive_understanding"
      ]
    },
    "exploratory_interaction": {
      "goal": "discover_patterns_through_interaction",
      "rules": [
        "encourage_prediction",
        "compare_outcomes",
        "guide_pattern_naming"
      ]
    },
    "systems_thinking": {
      "goal": "understand_multi_variable_systems",
      "rules": [
        "build_mental_models",
        "explain_causal_links",
        "extract_general_principles"
      ]
    },
    "knowledge_synthesis": {
      "goal": "integrate_and_transfer_knowledge",
      "rules": [
        "ask_student_to_summarize",
        "encourage_cross_context_transfer"
      ]
    }
  },
  "interaction_rules": {
    "context_aware": {
      "trigger": "user asks unclear reference",
      "action": "explain_using_visual_elements"
    },
    "flexible_pedagogy": {
      "trigger": "valid_alternative_approach",
      "steps": [
        "acknowledge_and_validate",
        "relate_to_current_visualization",
        "invite_visual_exploration"
      ]
    },
    "action_oriented": {
      "trigger": "no_user_interaction_detected",
      "action": "suggest_specific_control"
    },
    "response_style": {
      "length": "concise",
      "focus": "current_content"
    }
  },
  "startup_behavior": {
    "welcome_student": true,
    "mention_learning_objectives_if_present": true
  }
}
`;

/** 从助手回复末尾剥离 [TASK:continue] / [TASK:new_content] 标签，返回纯净内容和意图 */
function stripTaskTag(reply) {
  if (!reply || typeof reply !== 'string') return { content: reply || '', intent: 'continue' };
  const trimmed = reply.trimEnd();
  const newContentMatch = trimmed.match(/\n\[TASK:new_content\]\s*$/);
  const continueMatch = trimmed.match(/\n\[TASK:continue\]\s*$/);
  if (newContentMatch) {
    return { content: trimmed.slice(0, trimmed.length - newContentMatch[0].length).trimEnd(), intent: 'new_content' };
  }
  if (continueMatch) {
    return { content: trimmed.slice(0, trimmed.length - continueMatch[0].length).trimEnd(), intent: 'continue' };
  }
  return { content: trimmed, intent: 'continue' };
}

/**
 * 将 content_id 解析为 content 表的主键 id（支持传入 UUID 或 short_id）
 * Learn 页等场景传入的是 iframe 的 short_id，需解析为 UUID 供后续查询使用。
 */
const resolveContentId = async (contentId) => {
  if (!contentId || typeof contentId !== 'string') {
    throw new Error('content_id is required');
  }
  const trimmed = contentId.trim();
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed);
  if (looksLikeUuid) {
    const { data } = await supabase.from('content').select('id').eq('id', trimmed).single();
    if (data?.id) return data.id;
    throw new Error(`Content not found: ${trimmed}`);
  }
  const { data } = await supabase.from('content').select('id').eq('short_id', trimmed).single();
  if (data?.id) return data.id;
  throw new Error(`Content not found (short_id): ${trimmed}`);
};

/**
 * 从 content 表获取 language_code
 */
const getLanguageCode = async (contentId) => {
  try {
    const { data: content } = await supabase
      .from('content')
      .select('language_code')
      .eq('id', contentId)
      .single();
    
    return content?.language_code || 'zh-CN';
  } catch (error) {
    console.warn(`获取 content ${contentId} 的 language_code 失败:`, error.message);
    return 'zh-CN';
  }
};

/**
 * 生成初始问候消息（返回消息内容和模型信息）
 */
const generateInitialMessage = async (contentId, metadataOverride = null) => {
  try {
    const metadata = metadataOverride || await getOrGenerateMetadata(contentId);
    const systemPrompt = `${SYSTEM_PROMPT_TEMPLATE}\n\nMETADATA:\n${JSON.stringify(metadata, null, 2)}`;

    // 语言只在 init welcome message 上强制，与 content.language_code 对齐
    const languageCode = await getLanguageCode(contentId);
    const languageHint = `The assistant MUST reply in the language specified by language_code: ${languageCode}.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Start the session. ${languageHint}` }
    ];

    const result = await aiProviderFactory.createChatCompletion({
      provider: 'qenda',
      messages,
      max_tokens: 1500,
      temperature: 0.7
    });

    return {
      content: result.content,
      model: result.model || 'fallback',
      usage: result.usage || {}
    };
  } catch (aiError) {
    console.warn('AI Greeting Failed, using fallback:', aiError);
    return {
      content: "你好！我是你的 AI 学习助手。虽然我的连接似乎有点不稳定，但我会尽力协助你探索这个内容。",
      model: 'fallback',
      usage: {}
    };
  }
};

/**
 * 获取或生成「content 级别」统一的初始问候消息（所有用户共享同一条）
 * - 优先读取 content.ai_guide_initial_message
 * - 不存在时生成一次并写回 content
 *
 * 注意：为了兼容老库/未执行 migration 的环境，这里对 “字段不存在” 做了降级处理。
 */
const getOrGenerateContentInitialMessage = async (contentId, metadata, userId = null) => {
  // In-flight 去重：同一 content 的欢迎语生成中，后续复用同一个 Promise
  if (contentInitialInFlight.has(contentId)) {
    return await contentInitialInFlight.get(contentId);
  }

  const job = (async () => {
  // 1) 尝试从 content 表读取全局初始消息
  try {
    const { data: contentRow, error: fetchError } = await supabase
      .from('content')
      .select('ai_guide_initial_message, ai_guide_initial_model, ai_guide_initial_created_at, ai_guide_initial_updated_at')
      .eq('id', contentId)
      .single();

    if (!fetchError && contentRow?.ai_guide_initial_message) {
      return {
        content: contentRow.ai_guide_initial_message,
        model: contentRow.ai_guide_initial_model || 'cached',
        usage: {},
        source: 'content_cached'
      };
    }
  } catch (e) {
    // 可能是字段不存在（migration 未执行）或其他查询错误：降级为每次生成
    console.warn('[aiGuide] 读取 content 级初始消息失败，降级为实时生成:', e?.message || e);
  }

  // 2) 不存在则生成一次
  const initialMessageResult = await generateInitialMessage(contentId, metadata);
  const now = new Date().toISOString();

  // 3) 写回 content 表，供后续所有用户复用
  try {
    const { error: updateError } = await supabase
      .from('content')
      .update({
        ai_guide_initial_message: initialMessageResult.content,
        ai_guide_initial_model: initialMessageResult.model || null,
        ai_guide_initial_created_at: now,
        ai_guide_initial_updated_at: now
      })
      .eq('id', contentId);

    if (updateError) {
      console.warn('[aiGuide] 写入 content 级初始消息失败（不影响返回）:', updateError.message || updateError);
    }
  } catch (e) {
    console.warn('[aiGuide] 写入 content 级初始消息异常（不影响返回）:', e?.message || e);
  }

  return {
    ...initialMessageResult,
    source: 'generated'
  };
  })();

  contentInitialInFlight.set(contentId, job);
  try {
    return await job;
  } finally {
    contentInitialInFlight.delete(contentId);
  }
};

/**
 * Get or generate metadata for a content item
 */
const getOrGenerateMetadata = async (contentId, userId = null) => {
  // In-flight 去重：同一 content 的 analyze_html 生成中，后续复用同一个 Promise
  if (metadataInFlight.has(contentId)) {
    return await metadataInFlight.get(contentId);
  }

  const job = (async () => {
  try {
    // 1. Check if metadata exists
    const { data: content, error: fetchError } = await supabase
      .from('content')
      .select('id, metadata_json, full_html')
      .eq('id', contentId)
      .single();

    if (fetchError) throw fetchError;
    if (!content) throw new Error('Content not found');

    if (content.metadata_json) {
      return content.metadata_json;
    }

    // 2. Generate metadata using LLM
    if (!content.full_html) throw new Error('No HTML content to analyze');

    const messages = [
      { role: 'system', content: METADATA_PROMPT },
      { role: 'user', content: content.full_html }
    ];

    const result = await aiProviderFactory.createChatCompletion({
      provider: 'qenda',
      messages,
      max_tokens: 4000,
      temperature: 0.2
    });

    const aiResponse = result.content;
    let metadata = null;
    let isJsonValid = false;
    
    // Extract JSON from response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        metadata = JSON.parse(jsonMatch[0]);
        isJsonValid = true;
      } catch (parseError) {
        console.error('Failed to parse metadata JSON:', parseError);
        throw new Error('Failed to parse metadata JSON from AI response');
      }
    } else {
      throw new Error('Failed to parse metadata JSON from AI response');
    }

    // 3. Log AI usage to ai_usage_logs
    try {
      const inputTokens = result.usage?.prompt_tokens || 0;
      const outputTokens = result.usage?.completion_tokens || 0;
      const totalTokens = result.usage?.total_tokens || 0;
      const requestId = uuidv4(); // Generate request_id

      await logAIUsage({
        user_id: userId,
        model_name: result.model || 'qenda',
        user_query: `Analyze HTML page for content_id: ${contentId}`,
        action_type: 'analyze_html',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        request_payload: {
          content_id: contentId,
          html_length: content.full_html?.length || 0,
          max_tokens: 4000,
          temperature: 0.2
        },
        generation_params: {
          content_id: contentId,
          provider: 'qenda',
          max_tokens: 4000,
          temperature: 0.2
        },
        response_metadata: {
          provider: result.provider || 'qenda',
          model: result.model || 'qenda',
          raw: result.response || aiResponse,
          parsed_metadata: metadata
        },
        created_at: new Date(result.created ? result.created * 1000 : Date.now()),
        is_json_valid: isJsonValid,
        is_render_success: true,
        error_message: null,
        request_id: requestId,
        content_id: contentId
      });
    } catch (logError) {
      // Log error but don't fail the metadata generation
      console.error('Failed to log AI usage for metadata generation:', logError);
    }

    // 4. Save metadata to DB
    const now = new Date().toISOString();
    await supabase
      .from('content')
      .update({
        metadata_json: metadata,
        metadata_created_at: now,
        metadata_updated_at: now
      })
      .eq('id', contentId);

    return metadata;
  } catch (error) {
    console.error('Error in getOrGenerateMetadata:', error);
    throw error;
  }
  })();

  metadataInFlight.set(contentId, job);
  try {
    return await job;
  } finally {
    metadataInFlight.delete(contentId);
  }
};

/**
 * Initialize a new guided learning session (支持历史对话恢复)
 * @param {string} contentId - content short_id 或 UUID
 * @param {string} userId - user_id 或 visitor_id
 * @param {{ forceNew?: boolean }} [options] - forceNew: true 时强制创建新会话，不恢复最近一条
 */
const initConversation = async (contentId, userId, options = {}) => {
  try {
    const resolvedId = await resolveContentId(contentId);
    const isVisitor = isVisitorId(userId);
    const forceNew = options.forceNew === true;

    // 1. 除非强制新会话，否则检查是否已有该 content_id 和 user_id 的 conversation
    if (!forceNew) {
      let query = supabase
      .from('ai_conversations')
      .select('id, created_at, updated_at')
      .eq('content_id', resolvedId)
      .order('updated_at', { ascending: false })
      .limit(1);
    
    if (isVisitor) {
      query = query.eq('visitor_id', userId).is('user_id', null);
    } else {
      query = query.eq('user_id', userId).is('visitor_id', null);
    }
    
    const { data: existingConversations, error: queryError } = await query;
    
    if (queryError) {
      console.error('Error querying existing conversations:', queryError);
    }
    
    // 如果已有 conversation，恢复历史对话（恢复对话不扣减积分）
    if (existingConversations && existingConversations.length > 0) {
      const existingConversation = existingConversations[0];
      
      // 获取历史消息（含 metadata，用于前端展示 image_urls 等）
      const { data: messages, error: messagesError } = await supabase
        .from('ai_messages')
        .select('role, content, created_at, metadata')
        .eq('conversation_id', existingConversation.id)
        .order('created_at', { ascending: true });
      
      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
      }
      
      // 构建历史消息列表（排除 system 消息）
      const historyMessages = (messages || [])
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role,
          content: msg.content,
          metadata: msg.metadata || null
        }));
      
      // 更新 conversation 的 updated_at
      await supabase
        .from('ai_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existingConversation.id);
      
      // 获取 metadata
      const metadata = await getOrGenerateMetadata(resolvedId, userId);
      
      return {
        conversation_id: existingConversation.id,
        initial_message: historyMessages.length > 0 ? null : undefined, // 如果有历史消息，不返回初始消息
        messages: historyMessages, // 返回历史消息列表
        metadata: metadata,
        is_resumed: true // 标记为恢复的对话（恢复对话不扣减积分）
      };
    }
    } // end if (!forceNew)

    // 2. 如果没有历史 conversation 或 forceNew，创建新的 conversation
    const languageCode = await getLanguageCode(resolvedId);
    
    const { data: conversation, error: insertError } = await supabase
      .from('ai_conversations')
      .insert({
        user_id: !isVisitor ? userId : null,
        visitor_id: isVisitor ? userId : null,
        content_id: resolvedId,
        language_code: languageCode
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    // 3. 生成初始消息
    const metadata = await getOrGenerateMetadata(resolvedId, userId);
    const initialMessageResult = await getOrGenerateContentInitialMessage(resolvedId, metadata, userId);
    const initialMessage = initialMessageResult.content;
    const modelName = initialMessageResult.model || 'fallback';
    const usage = initialMessageResult.usage || {};
    const source = initialMessageResult.source || 'unknown';
    
    // 4. 保存 assistant message（初始问候消息）
    // 注意：
    // - 不保存 "Start the session." 用户消息，因为：
    //   1. 这不是用户真实输入，只是系统内部触发的技术性消息
    //   2. 前端不会显示这个消息
    //   3. 对话历史应该只包含用户真实的消息
    //   4. ai_usage_logs 已经记录了这次交互（user_query: 'Start the session.'）
    // - 不保存 "Session started" system message，因为：
    //   1. ai_conversations.created_at 已经记录了对话创建时间
    //   2. ai_usage_logs 已经记录了所有交互日志
    //   3. 前端和业务逻辑都不使用 system 消息
    const { data: assistantMessage, error: messageError } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: initialMessage
      })
      .select()
      .single();
    
    if (messageError) throw messageError;
    
    // 6. 记录到 ai_usage_logs（用于计费）
    const estimateTokens = (text) => Math.ceil(text.length / 3);
    const systemPrompt = `${SYSTEM_PROMPT_TEMPLATE}\n\nMETADATA:\n${JSON.stringify(metadata, null, 2)}`;
    // 如果是 content 缓存复用，则不应重复计入 token 成本（这次 init 没有调用模型）
    const isCached = source === 'content_cached';
    const inputTokens = isCached ? 0 : (usage.prompt_tokens || estimateTokens(systemPrompt + 'Start the session.'));
    const outputTokens = isCached ? 0 : (usage.completion_tokens || estimateTokens(initialMessage));
    const totalTokens = isCached ? 0 : (usage.total_tokens || (inputTokens + outputTokens));
    
    await logAIUsage({
      user_id: !isVisitor ? userId : null,
      visitor_id: isVisitor ? userId : null,
      request_id: conversation.id,
      conversation_id: conversation.id,
      message_id: assistantMessage.id,
      action_type: 'ai_guide_init',
      content_id: resolvedId,
      user_query: 'Start the session.',
      request_payload: {
        messages: [
          { role: 'system', content: 'SYSTEM_PROMPT_TEMPLATE' },
          { role: 'user', content: 'Start the session.' }
        ],
        max_tokens: 1500,
        temperature: 0.7,
        source,
        metadata_summary: {
          title: metadata?.meta?.title || metadata?.title || 'Unknown',
          content_type: metadata?.meta?.contentType || metadata?.content_type || 'Unknown'
        }
      },
      response_metadata: { 
        reply: initialMessage,
        role: 'assistant',
        source
      },
      model_name: modelName, // 使用实际的模型名称
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      is_render_success: true
    });
    
    // 初始化对话不扣分
    
    return {
      conversation_id: conversation.id,
      initial_message: initialMessage,
      messages: [], // 新对话没有历史消息
      metadata: metadata,
      is_resumed: false // 标记为新对话
    };
  } catch (error) {
    console.error('Error in initConversation:', error);
    throw error;
  }
};

/**
 * Handle a user message in the guided learning session (Streaming)
 * @param {string} conversationId - conversation ID
 * @param {string} message - user message
 * @param {object} uiState - UI state
 * @param {string} userId - user ID or visitor ID
 * @param {boolean} shouldConsume - whether to consume credits
 * @param {number} creditsCost - credits cost
 * @param {Array} images - array of images (max 3), each with {mime_type, data}
 */
const handleChat = async (conversationId, message, uiState, userId, shouldConsume = false, creditsCost = 0, images = null) => {
  try {
    const isVisitor = isVisitorId(userId);
    
    // 1. 获取 conversation 信息（包含 content_id）
    let convQuery = supabase
      .from('ai_conversations')
      .select('id, content_id')
      .eq('id', conversationId);
    
    if (isVisitor) {
      convQuery = convQuery.eq('visitor_id', userId).is('user_id', null);
    } else {
      convQuery = convQuery.eq('user_id', userId).is('visitor_id', null);
    }
    
    const { data: conversation, error: convError } = await convQuery.single();
    
    if (convError || !conversation) {
      const error = new Error('Conversation not found');
      error.code = 'CONVERSATION_NOT_FOUND';
      throw error;
    }
    
    const contentId = conversation.content_id;
    if (!contentId) {
      throw new Error(`Content ID missing in conversation: ${conversationId}`);
    }
    
    // 2. 从 ai_messages 表获取历史消息（含 metadata，供「本页/当前步骤」相关回答时参考）
    const { data: historyMessages, error: messagesError } = await supabase
      .from('ai_messages')
      .select('role, content, metadata')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (messagesError) throw messagesError;
    
    // 3. Get metadata
    const metadata = await getOrGenerateMetadata(contentId, userId);

    // 4. Build TeachingSnapshot 并得到规范格式的 ui_state（入库用）
    let teachingSnapshot = null;
    /** 规范格式：{ uiState: { stageIndex, totalStages, currentStage, ... }, currentStage: { stageId, stageIndex } }，写入 metadata.ui_state */
    let canonicalUiState = null;
    if (uiState && typeof uiState === 'object') {
      // 兼容两种前端格式：
      // - Learn/standalone: { stageIndex, totalStages, currentStage } 直接是平铺
      // - AIGuidedLearning: { currentStage: string, uiState: { ... } }，currentStage 为阶段名
      // - 内容可能暴露 currentStageIndex（0-based），需转为 stageIndex（1-based）
      const actualUIState = uiState.uiState || uiState;
      let currentStage = uiState.currentStage ?? null;
      let stageIndexNum = typeof actualUIState?.stageIndex === 'number' ? actualUIState.stageIndex : null;
      if (stageIndexNum == null && typeof actualUIState?.currentStageIndex === 'number') stageIndexNum = actualUIState.currentStageIndex + 1;
      const hasStageIndex = stageIndexNum != null;
      const stageIdStr = actualUIState?.currentStage ?? currentStage;
      if (hasStageIndex && (stageIdStr != null || currentStage != null)) {
        currentStage = {
          stageIndex: stageIndexNum,
          stageId: typeof stageIdStr === 'string' ? stageIdStr : (currentStage && typeof currentStage === 'object' ? currentStage.stageId : String(stageIdStr))
        };
      } else if (currentStage != null && typeof currentStage !== 'object') {
        // 仅阶段名字符串时，用 uiState.stageIndex / currentStageIndex 或 1 补全
        currentStage = {
          stageIndex: stageIndexNum ?? actualUIState?.stageIndex ?? 1,
          stageId: String(currentStage)
        };
      }

      canonicalUiState = {
        uiState: { ...actualUIState, ...(stageIndexNum != null && { stageIndex: stageIndexNum }) },
        currentStage: currentStage ? { stageId: currentStage.stageId, stageIndex: currentStage.stageIndex } : null
      };

      if (metadata?.canonical) {
        teachingSnapshot = buildTeachingSnapshot({
          meta: metadata.canonical,
          currentStage: currentStage,
          uiState: actualUIState
        });
        // 调试日志（开发阶段）
        if (process.env.NODE_ENV !== 'production') {
          console.log('[AI Guide] TeachingSnapshot generated:', JSON.stringify(teachingSnapshot, null, 2));
        }
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[AI Guide] Cannot build TeachingSnapshot: metadata.canonical is missing');
        }
      }
    }

    // 5. Build messages for LLM
    let systemPrompt = `${SYSTEM_PROMPT_TEMPLATE}\n\nMETADATA:\n${JSON.stringify(metadata, null, 2)}`;
    
    if (teachingSnapshot) {
      systemPrompt += `\n\nTEACHING SNAPSHOT (Current Context):\n${JSON.stringify(teachingSnapshot, null, 2)}`;
    }

    // 当前步骤的完整内容（来自 content metadata_json），便于回答「本页/当前页/这一步」时紧扣页面
    const currentStageIndex = canonicalUiState?.currentStage?.stageIndex ?? teachingSnapshot?.current_stage?.index;
    const stages = metadata?.canonical?.stages;
    if (currentStageIndex != null && Array.isArray(stages) && stages.length > 0) {
      const stageDetail = stages.find(s => s.index === currentStageIndex) || stages[currentStageIndex - 1];
      if (stageDetail) {
        systemPrompt += `\n\nCURRENT STAGE DETAIL (from content metadata — use when user asks about "this page", "current step", "本页", "当前"):\n${JSON.stringify(stageDetail, null, 2)}`;
      }
    }

    // 最近一条用户消息与助手消息的 metadata（ui_state / teaching_snapshot），便于延续上下文
    const recentMeta = { last_user_message_metadata: null, last_assistant_message_metadata: null };
    if (Array.isArray(historyMessages) && historyMessages.length > 0) {
      for (let i = historyMessages.length - 1; i >= 0; i--) {
        if (historyMessages[i].role === 'assistant' && recentMeta.last_assistant_message_metadata == null && historyMessages[i].metadata)
          recentMeta.last_assistant_message_metadata = historyMessages[i].metadata;
        if (historyMessages[i].role === 'user' && recentMeta.last_user_message_metadata == null && historyMessages[i].metadata)
          recentMeta.last_user_message_metadata = historyMessages[i].metadata;
        if (recentMeta.last_user_message_metadata != null && recentMeta.last_assistant_message_metadata != null) break;
      }
      systemPrompt += `\n\nRECENT MESSAGE METADATA (ui_state / teaching_snapshot when these messages were sent):\n${JSON.stringify(recentMeta, null, 2)}`;
    }

    const llmMessages = [
      { role: 'system', content: systemPrompt }
    ];

    // 添加历史消息（排除 system 消息）
    (historyMessages || []).forEach(msg => {
      if (msg.role !== 'system') {
        llmMessages.push({ role: msg.role, content: msg.content });
      }
    });

    let finalUserMessage = message;
    // UI State 已包含在 TeachingSnapshot 中，不再单独附加（可选：保留作为补充信息）
    // if (uiState) {
    //   finalUserMessage += `\n\nUI STATE:\n${JSON.stringify(uiState, null, 2)}`;
    // }
    
    // 构建用户消息，如果提供了图片，则包含图片数据（先使用base64发送给LLM）
    const userMessage = {
      role: 'user',
      content: finalUserMessage
    };
    
    // 如果有图片，先添加到消息中（用于 Gemini API，使用base64数据）
    // 图片上传将在后台异步进行，不阻塞LLM响应
    if (images && Array.isArray(images) && images.length > 0) {
      console.log(`[AI Guide Service] 添加 ${images.length} 张图片到消息（base64，将异步上传）`);
      userMessage.images = images.map(img => ({
        mime_type: img.mime_type,
        data: img.data
      }));
    }
    
    llmMessages.push(userMessage);
    
    // 保存用户消息ID的引用，用于后续更新metadata（图片上传完成后）
    let savedUserMessageId = null;
    
    // 在开流前插入用户消息，这样图片上传完成后能立即用 savedUserMessageId 更新 metadata，避免 30s 拿不到 id
    const userMessageMetadataForDb = {};
    if (canonicalUiState || teachingSnapshot) {
      userMessageMetadataForDb.ui_state = canonicalUiState || null;
      userMessageMetadataForDb.teaching_snapshot = teachingSnapshot || null;
    }
    if (images && Array.isArray(images) && images.length > 0) {
      userMessageMetadataForDb.images_pending = true;
      userMessageMetadataForDb.image_count = images.length;
    }
    const { data: insertedUserMessage, error: userMsgInsertError } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: message,
        ui_state: canonicalUiState || uiState || null,
        metadata: Object.keys(userMessageMetadataForDb).length > 0 ? userMessageMetadataForDb : null
      })
      .select()
      .single();
    if (userMsgInsertError) {
      console.error('[AI Guide Service] 开流前保存用户消息失败:', userMsgInsertError);
    } else if (insertedUserMessage?.id) {
      savedUserMessageId = insertedUserMessage.id;
    }
    
    // 有图片时统一通过 freeimage_upload_service 上传，并将链接保存到该条用户消息的 ai_message.metadata
    if (images && Array.isArray(images) && images.length > 0) {
      (async () => {
        try {
          console.log(`[AI Guide Service] 开始上传 ${images.length} 张图片到 freeimage.host，完成后写入 ai_message.metadata`);
          
          // 并行上传所有图片
          const uploadPromises = images.map(async (img, index) => {
            try {
              // 根据 MIME 类型确定文件扩展名
              const extMap = {
                'image/jpeg': 'jpg',
                'image/jpg': 'jpg',
                'image/png': 'png',
                'image/gif': 'gif',
                'image/webp': 'webp'
              };
              const ext = extMap[img.mime_type] || 'png';
              const filename = `ai-guide-${Date.now()}-${index}.${ext}`;
              
              // 上传到 freeimage.host
              const uploadResult = await uploadToFreeimageHost(img.data, filename, img.mime_type);
              
              // 生成 markdown 链接
              const markdownLink = `![Image ${index + 1}](${uploadResult.url})`;
              return {
                markdown: markdownLink,
                url: uploadResult.url,
                displayUrl: uploadResult.displayUrl || uploadResult.url,
                mime_type: img.mime_type
              };
            } catch (uploadError) {
              console.error(`[AI Guide Service] 图片 ${index + 1} 上传失败:`, uploadError.message);
              // 如果上传失败，返回null（后续会使用base64数据）
              return {
                markdown: null,
                url: null,
                displayUrl: null,
                mime_type: img.mime_type,
                error: uploadError.message
              };
            }
          });
          
          const imageMarkdownLinks = await Promise.all(uploadPromises);
          const successCount = imageMarkdownLinks.filter(link => link.url).length;
          console.log(`[AI Guide Service] 图片上传完成，成功 ${successCount}/${images.length} 张`);
          
          // 上传完成后，只更新「本条」用户消息的 metadata，必须用插入后拿到的 id，避免错位到上一条
          if (successCount > 0) {
            // 等待本条用户消息插入并拿到 id（流式结束后才插入），最多等 30 秒，不查「最新一条」避免错位
            let userMsgId = savedUserMessageId;
            let retries = 60;
            while (!userMsgId && retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
              retries--;
            }
            
            if (userMsgId) {
              // 获取当前metadata
              const { data: currentMsg } = await supabase
                .from('ai_messages')
                .select('metadata')
                .eq('id', userMsgId)
                .single();
              
              const currentMetadata = currentMsg?.metadata || {};

              // 多图链接保存到 ai_message.metadata：统一结构为 image_urls（数组）+ image_count + images_pending
              const urlsWithMeta = imageMarkdownLinks.filter(link => link.url).map(link => ({
                url: link.url,
                displayUrl: link.displayUrl,
                mime_type: link.mime_type
              }));
              const updatedMetadata = {
                ...currentMetadata,
                images_pending: false,
                image_urls: urlsWithMeta,
                image_count: urlsWithMeta.length
              };
              
              const { data: updatedRows, error: updateError } = await supabase
                .from('ai_messages')
                .update({ metadata: updatedMetadata })
                .eq('id', userMsgId)
                .select('id, metadata');
              
              if (updateError) {
                console.error('[AI Guide Service] 更新消息metadata失败:', updateError);
              } else if (!updatedRows || updatedRows.length === 0) {
                const { data: checkRow } = await supabase.from('ai_messages').select('id, metadata').eq('id', userMsgId).single();
                console.error('[AI Guide Service] 更新消息metadata未命中任何行，messageId=', userMsgId, '存在=', !!checkRow, '当前metadata=', checkRow?.metadata);
              } else {
                console.log(`[AI Guide Service] ✅ 已更新消息metadata (id: ${userMsgId})，添加了 ${updatedMetadata.image_links.length} 个图片链接`);
                console.log(`[AI Guide Service] 图片链接:`, updatedMetadata.image_links);
              }
            } else {
              console.warn('[AI Guide Service] 未在 30s 内拿到本条用户消息 id，跳过写入图片链接（避免错位到上一条）');
            }
          }
        } catch (error) {
          console.error('[AI Guide Service] 图片上传过程出错:', error.message);
        }
      })();
    }

    // 4. Call LLM with streaming enabled
    const stream = await aiProviderFactory.createChatCompletion({
      provider: 'qenda',
      messages: llmMessages,
      max_tokens: 2000,
      temperature: 0.7,
      stream: true
    });

    // Return a generator that yields chunks and logs on completion.
    // Note: Streamed content may end with [TASK:continue] or [TASK:new_content]; client should strip that line for display and use it to decide whether to trigger new content (e.g. switch iframe). Stored message and metadata.task_intent already use stripped content and intent.
    async function* streamGenerator() {
      let fullReply = '';
      let model = '';
      let usage = null; // Store usage info if provided
      
      try {
        for await (const chunk of stream) {
          fullReply += chunk.content;
          model = chunk.model;
          // Some providers send usage info in the last chunk
          if (chunk.usage) {
            usage = chunk.usage;
          }
          yield chunk.content;
        }
      } catch (error) {
        console.error('Stream error:', error);
        throw error;
      } finally {
        // 5. Save interaction (after stream completes)（用户消息已在开流前插入，此处只保存助手消息）
        if (fullReply) {
          const { content: assistantContent, intent: taskIntent } = stripTaskTag(fullReply);

          // 5.1. 保存助手消息到 ai_messages（存剥离标签后的内容；intent 写入 metadata 供前端判断是否换内容）
          const assistantMetadata = { ...userMessageMetadataForDb, task_intent: taskIntent };
          const { data: assistantMessage, error: assistantMsgError } = await supabase
            .from('ai_messages')
            .insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: assistantContent,
              metadata: assistantMetadata
            })
            .select()
            .single();
          
          if (assistantMsgError) {
            console.error('Failed to save assistant message:', assistantMsgError);
          }
          
          // 5.3. 更新 conversation 的 updated_at
          await supabase
            .from('ai_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
          
          // 5.4. 记录到 ai_usage_logs（用于计费）
          const estimateTokens = (text) => Math.ceil(text.length / 3);
          const inputTokens = usage?.prompt_tokens || estimateTokens(llmMessages.map(m => m.content).join(''));
          const outputTokens = usage?.completion_tokens || estimateTokens(fullReply);
          const totalTokens = usage?.total_tokens || (inputTokens + outputTokens);
          
          await logAIUsage({
            user_id: !isVisitor ? userId : null,
            visitor_id: isVisitor ? userId : null,
            request_id: conversationId,
            conversation_id: conversationId,
            message_id: assistantMessage?.id || null,
            action_type: 'ai_guide',
            content_id: contentId,
            user_query: message,
            request_payload: {
              messages: llmMessages.map(m => ({
                role: m.role,
                content: m.role === 'system' ? 'SYSTEM_PROMPT_WITH_METADATA' : m.content.substring(0, 200)
              })),
              max_tokens: 2000,
              temperature: 0.7,
              stream: true,
              ui_state: canonicalUiState || uiState,
              teaching_snapshot: teachingSnapshot || null,
              history_length: (historyMessages || []).length,
              // 在日志中只保存图片的摘要信息（数量、MIME类型、上传状态），不保存完整的 base64 数据
              images_summary: images && Array.isArray(images) && images.length > 0 ? {
                count: images.length,
                mime_types: images.map(img => img.mime_type),
                uploaded_count: 0, // 上传是异步的，这里标记为0，实际上传状态在metadata中
                upload_status: 'async_uploading' // 标记为异步上传中
              } : null
            },
            response_metadata: { 
              reply: assistantContent,
              role: 'assistant',
              task_intent: taskIntent,
              estimated: !usage
            },
            model_name: model || 'unknown',
            input_tokens: inputTokens, 
            output_tokens: outputTokens,
            total_tokens: totalTokens,
            is_render_success: true
          });
          
          // 5.5. 扣减积分（仅当需要且用户存在且不是访客）
          if (shouldConsume && creditsCost > 0 && !isVisitor && userId) {
            try {
              await DatabaseService.addCreditChange(userId, 'usage', -creditsCost, null, contentId);
              console.log(`[AI Guide Chat] 扣除积分成功: user_id=${userId}, credits=-${creditsCost}`);
            } catch (creditError) {
              console.error(`[AI Guide Chat] 扣除积分失败: user_id=${userId}`, creditError);
              // 不抛出错误，因为对话已经成功完成
            }
          }
        }
      }
    }

    return streamGenerator();

  } catch (error) {
    console.error('Error in handleChat:', error);
    throw error;
  }
};

/**
 * Get conversation history (从新表查询)
 */
const getMessages = async (conversationId) => {
  try {
    const { data: messages, error } = await supabase
      .from('ai_messages')
      .select('role, content, metadata, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // 排除 system 消息，返回格式化的消息列表（含 metadata，用于前端展示 image_urls 等）
    return (messages || [])
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at,
        metadata: msg.metadata || null
      }));
  } catch (error) {
    console.error('Error in getMessages:', error);
    throw error;
  }
};

/**
 * Get list of conversations for a content (从新表查询)
 */
const getConversations = async (contentId, userId) => {
  try {
    const resolvedId = await resolveContentId(contentId);
    const isVisitor = isVisitorId(userId);
    
    // 查询该 content_id 和 user_id 的所有 conversations
    let query = supabase
      .from('ai_conversations')
      .select('id, created_at, updated_at')
      .eq('content_id', resolvedId)
      .order('updated_at', { ascending: false });
    
    if (isVisitor) {
      query = query.eq('visitor_id', userId).is('user_id', null);
    } else {
      query = query.eq('user_id', userId).is('visitor_id', null);
    }
    
    const { data: conversations, error } = await query;

    if (error) throw error;

    // 为每个 conversation 获取消息数量和最后一条消息
    const conversationsWithDetails = await Promise.all(
      (conversations || []).map(async (conv) => {
        // 获取消息数量
        const { count: messageCount } = await supabase
          .from('ai_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('role', 'system');
        
        // 获取最后一条用户消息（作为摘要）
        const { data: lastUserMessage } = await supabase
          .from('ai_messages')
          .select('content')
          .eq('conversation_id', conv.id)
          .eq('role', 'user')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        return {
          conversation_id: conv.id,
          last_message: lastUserMessage?.content || '',
          last_active: conv.updated_at,
          message_count: messageCount || 0
        };
      })
    );

    return conversationsWithDetails;
  } catch (error) {
    console.error('Error in getConversations:', error);
    throw error;
  }
};

/**
 * 统计用户在 ai_conversations 中的对话数（用于气泡提示：3 次以上不显示）
 * @param {string} userId - user_id (UUID) 或 visitor_id
 */
const getConversationCount = async (userId) => {
  if (!userId) return 0;
  try {
    const isVisitor = isVisitorId(userId);
    let query = supabase
      .from('ai_conversations')
      .select('*', { count: 'exact', head: true });
    if (isVisitor) {
      query = query.eq('visitor_id', userId).is('user_id', null);
    } else {
      query = query.eq('user_id', userId).is('visitor_id', null);
    }
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error in getConversationCount:', error);
    return 0;
  }
};

/**
 * 从数据库查询「最近有对话记录」的 conversation：按最后一条消息时间（ai_messages.created_at）判定，
 * 而不是按 ai_conversations.updated_at（init 恢复会话也会更新该字段，会误判）。
 * 返回 conversation_id、content_short_id 和 ai_messages 消息列表。
 */
const getLastConversationFromDB = async (userId) => {
  if (!userId) return null;
  try {
    const isVisitor = isVisitorId(userId);
    // 1) 先取该用户/访客的所有会话 id（用于按消息时间找「最近有对话」的会话）
    let convQuery = supabase
      .from('ai_conversations')
      .select('id');
    if (isVisitor) {
      convQuery = convQuery.eq('visitor_id', userId).is('user_id', null);
    } else {
      convQuery = convQuery.eq('user_id', userId).is('visitor_id', null);
    }
    const { data: convIds, error: convError } = await convQuery;
    if (convError) throw convError;
    if (!convIds || convIds.length === 0) return null;
    const ids = convIds.map((c) => c.id);
    // 2) 在 ai_messages 中找这些会话里「最后一条消息」对应的 conversation_id
    const { data: lastMsg, error: msgError } = await supabase
      .from('ai_messages')
      .select('conversation_id, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })
      .limit(1);
    if (msgError) throw msgError;
    let convIdToUse = null;
    if (lastMsg && lastMsg.length > 0) {
      convIdToUse = lastMsg[0].conversation_id;
    }
    // 3) 若没有任何消息，退化为按会话 updated_at 取最近一条（兼容老数据/空会话）
    if (!convIdToUse) {
      let fallbackQuery = supabase
        .from('ai_conversations')
        .select('id, content_id, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1);
      if (isVisitor) {
        fallbackQuery = fallbackQuery.eq('visitor_id', userId).is('user_id', null);
      } else {
        fallbackQuery = fallbackQuery.eq('user_id', userId).is('visitor_id', null);
      }
      const { data: fallbackData, error: fallbackError } = await fallbackQuery;
      if (fallbackError || !fallbackData || fallbackData.length === 0) return null;
      convIdToUse = fallbackData[0].id;
    }
    // 4) 取该会话的 content_id、updated_at 等
    const { data: convRows, error: convRowError } = await supabase
      .from('ai_conversations')
      .select('id, content_id, updated_at')
      .eq('id', convIdToUse)
      .limit(1);
    if (convRowError || !convRows || convRows.length === 0) return null;
    const conv = convRows[0];
    
    // 直接从数据库读取该 conversation 的所有消息
    const { data: messages, error: messagesError } = await supabase
      .from('ai_messages')
      .select('role, content, metadata, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });
    
    if (messagesError) {
      console.error('Error fetching messages for last session:', messagesError);
    }
    
    // 格式化消息列表（排除 system 消息）
    const formattedMessages = (messages || [])
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at,
        metadata: msg.metadata || null
      }));
    
    if (!conv.content_id) {
      return {
        conversation_id: conv.id,
        content_id: null,
        content_short_id: null,
        messages: formattedMessages,
        last_active: conv.updated_at,
      };
    }
    
    // 从数据库读取 content 的 short_id
    const { data: contentRow, error: contentError } = await supabase
      .from('content')
      .select('id, short_id')
      .eq('id', conv.content_id)
      .limit(1)
      .single();
    
    if (contentError) {
      console.error('Error fetching content for last session:', contentError);
    }
    
    return {
      conversation_id: conv.id,
      content_id: conv.content_id,
      content_short_id: contentRow?.short_id || null,
      messages: formattedMessages,
      last_active: conv.updated_at,
    };
  } catch (error) {
    console.error('Error in getLastSessionForUser:', error);
    throw error;
  }
};

module.exports = {
  getOrGenerateMetadata,
  // 导出初始问候生成函数，供生成流程复用「start session」assistant 消息
  getOrGenerateContentInitialMessage,
  initConversation,
  handleChat,
  getMessages,
  getConversations,
  getConversationCount,
  getLastConversationFromDB
};

