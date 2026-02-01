const { supabase, logAIUsage } = require('./database');
const { aiProviderFactory, safeReplace } = require('./aiService');
const { v4: uuidv4 } = require('uuid');
const { isVisitorId } = require('../utils/visitorId');
const DatabaseService = require('./database');

// In-flight dedupe: avoid duplicated analyze/start-session when user quickly closes & reopens aiGuide.
// 关键：同一个 contentId 的 metadata/initial message 在生成中时，后续请求复用同一个 Promise，避免重复跑 LLM。
const metadataInFlight = new Map(); // contentId -> Promise<metadata>
const contentInitialInFlight = new Map(); // contentId -> Promise<{content, model, usage, source}>

// Metadata Extraction Prompt
const METADATA_PROMPT = `You are an advanced educational content analyzer. Your task is to extract comprehensive structured metadata from the provided HTML content to power an AI Learning Guide.

The content could be ANYTHING: a 3D experiment, a math problem, a business case chart, a game, a slide deck, or a simple interactive article.

RULES:
1. **Analyze Deeply**: Look at HTML structure, CSS styles, and JavaScript logic to understand what the page DOES, not just what it looks like.
2. **Identify Technology**: Recognize libraries like Three.js, PixiJS, D3, ECharts, Vue, React, etc., to better describe visual elements.
3. **Capture Interactivity**: Identify HOW a user interacts (clicks, drags, gestures, scrolls, inputs). What changes when they interact?
4. **Extract Pedagogy**: What is the learning goal? Is it exploring, solving, or reading?
5. **No Hallucinations**: Only describe features actually present in the code.

OUTPUT FORMAT:
- Return ONLY a valid JSON object.
- The structure MUST be tailored to the current HTML page.
- You may:
  - Use the recommended grouping keys: "meta", "objectives", "sections", "conceptMap", "visualElements", "interactions", "actions", "pageStateSchema", "keywords", **or**
  - Design a more page-specific schema if that matches the content better.
- Field names should be meaningful and consistent within the JSON.
- Do NOT include fields that do not make sense for this page.

Now analyze the provided HTML code and generate the metadata JSON that best fits it.`;

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
 */
const initConversation = async (contentId, userId) => {
  try {
    const isVisitor = isVisitorId(userId);
    
    // 1. 检查是否已有该 content_id 和 user_id 的 conversation
    let query = supabase
      .from('ai_conversations')
      .select('id, created_at, updated_at')
      .eq('content_id', contentId)
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
      
      // 获取历史消息
      const { data: messages, error: messagesError } = await supabase
        .from('ai_messages')
        .select('role, content, created_at')
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
          content: msg.content
        }));
      
      // 更新 conversation 的 updated_at
      await supabase
        .from('ai_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existingConversation.id);
      
      // 获取 metadata
      const metadata = await getOrGenerateMetadata(contentId, userId);
      
      return {
        conversation_id: existingConversation.id,
        initial_message: historyMessages.length > 0 ? null : undefined, // 如果有历史消息，不返回初始消息
        messages: historyMessages, // 返回历史消息列表
        metadata: metadata,
        is_resumed: true // 标记为恢复的对话（恢复对话不扣减积分）
      };
    }
    
    // 2. 如果没有历史 conversation，创建新的 conversation
    const languageCode = await getLanguageCode(contentId);
    
    const { data: conversation, error: insertError } = await supabase
      .from('ai_conversations')
      .insert({
        user_id: !isVisitor ? userId : null,
        visitor_id: isVisitor ? userId : null,
        content_id: contentId,
        language_code: languageCode
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    // 3. 生成初始消息
    const metadata = await getOrGenerateMetadata(contentId, userId);
    const initialMessageResult = await getOrGenerateContentInitialMessage(contentId, metadata, userId);
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
      content_id: contentId,
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
 */
const handleChat = async (conversationId, message, uiState, userId, shouldConsume = false, creditsCost = 0) => {
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
    
    // 2. 从 ai_messages 表获取历史消息
    const { data: historyMessages, error: messagesError } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (messagesError) throw messagesError;
    
    // 3. Get metadata
    const metadata = await getOrGenerateMetadata(contentId, userId);

    // 4. Build messages for LLM
    const systemPrompt = `${SYSTEM_PROMPT_TEMPLATE}\n\nMETADATA:\n${JSON.stringify(metadata, null, 2)}`;
    
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
    if (uiState) {
      finalUserMessage += `\n\nUI STATE:\n${JSON.stringify(uiState, null, 2)}`;
    }
    llmMessages.push({ role: 'user', content: finalUserMessage });

    // 4. Call LLM with streaming enabled
    const stream = await aiProviderFactory.createChatCompletion({
      provider: 'qenda',
      messages: llmMessages,
      max_tokens: 2000,
      temperature: 0.7,
      stream: true
    });

    // Return a generator that yields chunks and logs on completion
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
        // 5. Save interaction (after stream completes)
        if (fullReply) {
          // 5.1. 保存用户消息到 ai_messages
          const { data: userMessage, error: userMsgError } = await supabase
            .from('ai_messages')
            .insert({
              conversation_id: conversationId,
              role: 'user',
              content: message,
              ui_state: uiState || null
            })
            .select()
            .single();
          
          if (userMsgError) {
            console.error('Failed to save user message:', userMsgError);
          }
          
          // 5.2. 保存助手消息到 ai_messages
          const { data: assistantMessage, error: assistantMsgError } = await supabase
            .from('ai_messages')
            .insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: fullReply
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
              ui_state: uiState,
              history_length: (historyMessages || []).length
            },
            response_metadata: { 
              reply: fullReply,
              role: 'assistant',
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
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // 排除 system 消息，返回格式化的消息列表
    return (messages || [])
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at
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
    const isVisitor = isVisitorId(userId);
    
    // 查询该 content_id 和 user_id 的所有 conversations
    let query = supabase
      .from('ai_conversations')
      .select('id, created_at, updated_at')
      .eq('content_id', contentId)
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

module.exports = {
  getOrGenerateMetadata,
  initConversation,
  handleChat,
  getMessages,
  getConversations,
  getConversationCount
};

