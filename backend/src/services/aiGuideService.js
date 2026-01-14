const { supabase, logAIUsage } = require('./database');
const { aiProviderFactory, safeReplace } = require('./aiService');
const { v4: uuidv4 } = require('uuid');
const { isVisitorId } = require('../utils/visitorId');

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
const SYSTEM_PROMPT_TEMPLATE = `You are an AI Learning Guide inside eduNest. You are "pair-learning" with a student who is looking at an interactive web page.

CONTEXT:
- **Metadata**: JSON describing the page's content, structure, and capabilities.
- **UI State**: Real-time values from the page (e.g., current slider value, selected object).
- **Conversation**: History of your chat.

YOUR ROLE:
Adapt your teaching style to the content_type and domain defined in metadata:
- **Experiment/Simulation**: Act as a Lab Partner. Encourage "What if?" questions. Suggest trying specific interactions defined in interactive_elements.
- **Math/Problem**: Act as a Tutor. Don't give answers. Ask guiding questions to check understanding of key_concepts.
- **Data/Chart**: Act as an Analyst. Ask the user to interpret trends or outliers in the visual_elements.
- **Game/Quiz**: Act as a Coach. Cheer them on and offer hints from guidance_strategy if they fail.
- **Article/Lecture**: Act as a Discussion Partner. Summarize sections and ask reflection questions.

INTERACTION RULES:
1. **Context Aware**: If the user asks "What is this?", use visual_elements to explain what they are likely pointing at or looking at.
2. **Flexible Pedagogy**: If the student proposes a valid alternative method or approach NOT shown on screen:
   - Acknowledge and validate their thinking first.
   - Briefly discuss how their method relates to the current visualization.
   - Then, gently invite them to see how the current interactive tool demonstrates the concept visually.
3. **Action Oriented**: If state_variables show the user hasn't interacted yet, gently suggest using a specific control (e.g., "Try dragging the blue slider...").
4. **Concise**: Keep replies short and focused on the content.

Start by welcoming the student. If learning_objectives are present, briefly mention what they can learn here.`;

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
const generateInitialMessage = async (contentId) => {
  try {
    const metadata = await getOrGenerateMetadata(contentId);
    const systemPrompt = `${SYSTEM_PROMPT_TEMPLATE}\n\nMETADATA:\n${JSON.stringify(metadata, null, 2)}`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Start the session.' }
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
 * Get or generate metadata for a content item
 */
const getOrGenerateMetadata = async (contentId, userId = null) => {
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
    
    // 如果已有 conversation，恢复历史对话
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
        is_resumed: true // 标记为恢复的对话
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
    const initialMessageResult = await generateInitialMessage(contentId);
    const initialMessage = initialMessageResult.content;
    const modelName = initialMessageResult.model || 'fallback';
    const usage = initialMessageResult.usage || {};
    
    // 4. 保存 system message（可选）
    await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'system',
        content: 'Session started'
      });
    
    // 5. 保存 assistant message
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
    const inputTokens = usage.prompt_tokens || estimateTokens(systemPrompt + 'Start the session.');
    const outputTokens = usage.completion_tokens || estimateTokens(initialMessage);
    const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
    
    await logAIUsage({
      user_id: !isVisitor ? userId : null,
      visitor_id: isVisitor ? userId : null,
      request_id: conversation.id,
      conversation_id: conversation.id,
      message_id: assistantMessage.id,
      action_type: 'ai_guide',
      content_id: contentId,
      user_query: 'Start the session.',
      request_payload: {
        messages: [
          { role: 'system', content: 'SYSTEM_PROMPT_TEMPLATE' },
          { role: 'user', content: 'Start the session.' }
        ],
        max_tokens: 1500,
        temperature: 0.7,
        metadata_summary: {
          title: metadata?.meta?.title || metadata?.title || 'Unknown',
          content_type: metadata?.meta?.contentType || metadata?.content_type || 'Unknown'
        }
      },
      response_metadata: { 
        reply: initialMessage,
        role: 'assistant'
      },
      model_name: modelName, // 使用实际的模型名称
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      is_render_success: true
    });
    
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
const handleChat = async (conversationId, message, uiState, userId) => {
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

module.exports = {
  getOrGenerateMetadata,
  initConversation,
  handleChat,
  getMessages,
  getConversations
};

