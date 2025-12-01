const { supabase, logAIUsage } = require('./database');
const { aiProviderFactory, safeReplace } = require('./aiService');
const { v4: uuidv4 } = require('uuid');

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
 * Get or generate metadata for a content item
 */
const getOrGenerateMetadata = async (contentId) => {
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
      messages,
      max_tokens: 4000,
      temperature: 0.2
    });

    const aiResponse = result.content;
    let metadata = null;
    
    // Extract JSON from response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      metadata = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Failed to parse metadata JSON from AI response');
    }

    // 3. Save metadata to DB
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
 * Initialize a new guided learning session
 */
const initConversation = async (contentId, userId) => {
  try {
    // 1. Ensure metadata exists
    const metadata = await getOrGenerateMetadata(contentId);
    
    // 2. Generate new conversation ID
    const conversationId = uuidv4();
    
    // 3. Generate initial greeting
    // Construct system prompt with metadata context
    // 增加错误捕获，避免 AI 服务失败导致 init 失败，而是返回降级方案
    let initialMessage = '';
    let result = { model: 'fallback', usage: {} };

    try {
      const systemPrompt = `${SYSTEM_PROMPT_TEMPLATE}\n\nMETADATA:\n${JSON.stringify(metadata, null, 2)}`;
      
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Start the session.' }
      ];

      result = await aiProviderFactory.createChatCompletion({
        messages,
        max_tokens: 500,
        temperature: 0.7
      });

      initialMessage = result.content;
    } catch (aiError) {
      console.warn('AI Greeting Failed, using fallback:', aiError);
      initialMessage = "你好！我是你的 AI 学习助手。虽然我的连接似乎有点不稳定，但我会尽力协助你探索这个内容。";
    }

    // 4. Log the interaction (save initial message)
    const { error: logError } = await logAIUsage({
      user_id: userId,
      request_id: conversationId,
      action_type: 'ai_guide',
      content_id: contentId,
      user_query: 'Start the session.',
      request_payload: {
        messages: [
          { role: 'system', content: 'SYSTEM_PROMPT_TEMPLATE' },
          { role: 'user', content: 'Start the session.' }
        ],
        max_tokens: 500,
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
      model_name: result.model || 'fallback',
      input_tokens: result.usage?.prompt_tokens || 0,
      output_tokens: result.usage?.completion_tokens || 0,
      total_tokens: result.usage?.total_tokens || 0,
      is_render_success: true // marking as success
    });

    if (logError) {
      console.error('initConversation: Failed to log initial interaction:', logError);
      throw new Error('Failed to initialize conversation log: ' + logError.message);
    }

    return {
      conversation_id: conversationId,
      initial_message: initialMessage,
      metadata
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
    // 1. Get conversation history
    const { data: history, error: historyError } = await supabase
      .from('ai_usage_logs')
      .select('content_id, user_query, response_metadata, created_at')
      .eq('request_id', conversationId)
      .eq('action_type', 'ai_guide')
      .order('created_at', { ascending: true });

    if (historyError) throw historyError;
    if (!history || history.length === 0) {
        const error = new Error('Conversation not found');
        error.code = 'CONVERSATION_NOT_FOUND';
        throw error;
    }

    const contentId = history[0].content_id;
    if (!contentId) {
        throw new Error(`Content ID missing in conversation history for request_id: ${conversationId}`);
    }

    // 2. Get metadata
    const metadata = await getOrGenerateMetadata(contentId);

    // 3. Build messages for LLM
    const systemPrompt = `${SYSTEM_PROMPT_TEMPLATE}\n\nMETADATA:\n${JSON.stringify(metadata, null, 2)}`;
    
    const llmMessages = [
      { role: 'system', content: systemPrompt }
    ];

    history.forEach(log => {
      if (log.user_query) {
        llmMessages.push({ role: 'user', content: log.user_query });
      }
      if (log.response_metadata && log.response_metadata.reply) {
        llmMessages.push({ role: 'assistant', content: log.response_metadata.reply });
      }
    });

    let finalUserMessage = message;
    if (uiState) {
      finalUserMessage += `\n\nUI STATE:\n${JSON.stringify(uiState, null, 2)}`;
    }
    llmMessages.push({ role: 'user', content: finalUserMessage });

    // 4. Call LLM with streaming enabled
    const stream = await aiProviderFactory.createChatCompletion({
      messages: llmMessages,
      max_tokens: 1000,
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
          // Estimate tokens if not provided by stream
          // Rough estimation: 1 token ≈ 4 characters for Chinese, 1 token ≈ 4 characters for English
          const estimateTokens = (text) => Math.ceil(text.length / 3);
          
          const inputTokens = usage?.prompt_tokens || estimateTokens(llmMessages.map(m => m.content).join(''));
          const outputTokens = usage?.completion_tokens || estimateTokens(fullReply);
          const totalTokens = usage?.total_tokens || (inputTokens + outputTokens);
          
          await logAIUsage({
            user_id: userId,
            request_id: conversationId,
            action_type: 'ai_guide',
            content_id: contentId,
            user_query: message,
            request_payload: {
              messages: llmMessages.map(m => ({
                role: m.role,
                content: m.role === 'system' ? 'SYSTEM_PROMPT_WITH_METADATA' : m.content.substring(0, 200) // Truncate for storage
              })),
              max_tokens: 1000,
              temperature: 0.7,
              stream: true,
              ui_state: uiState,
              history_length: history.length
            },
            response_metadata: { 
              reply: fullReply,
              role: 'assistant',
              estimated: !usage // Flag if tokens were estimated
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
 * Get conversation history
 */
const getMessages = async (conversationId) => {
  try {
    const { data: logs, error } = await supabase
      .from('ai_usage_logs')
      .select('user_query, response_metadata, created_at')
      .eq('request_id', conversationId)
      .eq('action_type', 'ai_guide')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const messages = [];
    logs.forEach(log => {
      // User message
      messages.push({
        role: 'user',
        content: log.user_query,
        created_at: log.created_at
      });
      // Assistant message
      if (log.response_metadata && log.response_metadata.reply) {
        messages.push({
          role: 'assistant',
          content: log.response_metadata.reply,
          created_at: log.created_at // Approximately same time
        });
      }
    });

    return messages;
  } catch (error) {
    console.error('Error in getMessages:', error);
    throw error;
  }
};

/**
 * Get list of conversations for a content
 */
const getConversations = async (contentId, userId) => {
  try {
    // This is tricky because we need to group by request_id.
    // Supabase JS client doesn't support complex GROUP BY well without RPC.
    // We can fetch all logs for the content/user and process in memory (if not too many).
    // Or just fetch distinct request_ids if possible.
    
    // Simpler approach: Fetch most recent logs for this user+content+action_type
    const { data: logs, error } = await supabase
      .from('ai_usage_logs')
      .select('request_id, created_at, user_query')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .eq('action_type', 'ai_guide')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const conversationMap = new Map();
    logs.forEach(log => {
      if (!conversationMap.has(log.request_id)) {
        conversationMap.set(log.request_id, {
          conversation_id: log.request_id,
          last_message: log.user_query, // This is user's last query, not AI's reply, but acceptable for summary
          last_active: log.created_at,
          message_count: 0
        });
      }
      conversationMap.get(log.request_id).message_count++;
    });

    return Array.from(conversationMap.values());
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

