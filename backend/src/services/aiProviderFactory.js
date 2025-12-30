const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

/**
 * AI服务提供商工厂
 * 支持动态切换不同的AI模型提供商
 */
class AIProviderFactory {
  constructor() {
    this.providers = {
      ark: {
        name: 'ARK/Kimi (VolcEngine)',
        apiKey: process.env.ARK_API_KEY,
        baseURL: process.env.ARK_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        model: process.env.ARK_MODEL || 'kimi-k2-250905',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ARK_API_KEY}`
        }
      },
      kimi: {
        name: 'Kimi (Moonshot AI)',
        apiKey: process.env.KIMI_API_KEY,
        // 直接指向 OpenAI 兼容的 chat completions 端点，避免 404
        baseURL: process.env.KIMI_URL || 'https://api.moonshot.cn/v1/chat/completions',
        model: process.env.KIMI_MODEL || 'kimi-k2-0905-preview',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.KIMI_API_KEY}`
        }
      },
      qenda: {
        name: 'QENDA (Gemini)',
        apiKey: process.env.QENDA_API_KEY,
        baseURL: process.env.QENDA_URL || '',
        model: process.env.QENDA_MODEL || 'gemini-3-flash-preview',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.QENDA_API_KEY}`
        },
        // QENDA 使用 Gemini API 格式，不是 OpenAI 兼容格式
        isGeminiFormat: true
      }
    };
    
    this.defaultProvider = process.env.DEFAULT_AI_PROVIDER || 'qenda';
  }

  /**
   * 获取指定的AI提供商配置
   * @param {string} providerName - 提供商名称 (ark, kimi, qenda)
   * @returns {Object} 提供商配置
   */
  getProvider(providerName = null) {
    const provider = providerName || this.defaultProvider;
    
    
    if (!this.providers[provider]) {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }
    
    const config = this.providers[provider];
    
    
    if (!config.apiKey || config.apiKey === 'your-api-key-here') {
      throw new Error(`${config.name} API key not configured or using default value`);
    }
    
    return config;
  }

  /**
   * 获取所有可用的提供商列表
   * @returns {Array} 提供商列表
   */
  getAvailableProviders() {
    return Object.entries(this.providers).map(([key, config]) => ({
      key,
      name: config.name,
      model: config.model,
      configured: !!(config.apiKey && config.apiKey !== 'your-api-key-here')
    }));
  }

  /**
   * 创建OpenAI兼容的客户端配置
   * @param {string} providerName - 提供商名称
   * @returns {Object} OpenAI客户端配置
   */
  createOpenAIConfig(providerName = null) {
    const provider = this.getProvider(providerName);
    
    return {
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
      defaultQuery: { 'api-version': '2023-05-15' },
      defaultHeaders: {
        'User-Agent': 'eduNest-AI-Client/1.0.0'
      }
    };
  }

  /**
   * 发送聊天完成请求（支持流式和非流式）
   * @param {Object} params - 请求参数
   * @param {string} params.provider - 提供商名称
   * @param {string} params.model - 模型名称（可选，使用默认模型）
   * @param {Array} params.messages - 消息数组
   * @param {number} params.temperature - 温度参数
   * @param {number} params.max_tokens - 最大token数
   * @param {number} params.maxRetries - 最大重试次数
   * @param {boolean} params.stream - 是否启用流式传输
   * @returns {Promise<Object|AsyncGenerator>} API响应或流式生成器
   */
  async createChatCompletion({
    provider = null,
    model = null,
    messages = [],
    temperature = 0.6,
    max_tokens = 24000,
    maxRetries = 0,
    stream = false
  }) {
    const providerConfig = this.getProvider(provider);
    const requestModel = model || providerConfig.model;
    const isQenda = provider === 'qenda' || providerConfig.isGeminiFormat;
    
    // 根据提供商格式构建请求负载
    let requestPayload;
    let requestURL = providerConfig.baseURL;
    
    if (isQenda) {
      // QENDA 使用 Gemini API 格式
      // 分离 system 消息和普通消息
      let systemInstruction = null;
      const contents = [];
      
      for (const msg of messages) {
        if (msg.role === 'system') {
          // System 消息使用 systemInstruction 字段
          if (!systemInstruction) {
            systemInstruction = {
              parts: [{ text: msg.content }]
            };
          } else {
            // 如果有多个 system 消息，合并它们
            systemInstruction.parts[0].text += '\n' + msg.content;
          }
        } else {
          // 构建 parts 数组，包含文本和可能的图片
          const parts = [];
          
          // 如果有图片，先添加图片
          if (msg.image && msg.image.mime_type && msg.image.data) {
            console.log(`[AI Provider Factory] 添加图片到 Gemini parts: mime_type=${msg.image.mime_type}, data_length=${msg.image.data.length}`);
            parts.push({
              inline_data: {
                mime_type: msg.image.mime_type,
                data: msg.image.data
              }
            });
          } else {
            console.log(`[AI Provider Factory] 消息中没有图片数据`);
          }
          
          // 添加文本内容
          if (msg.content) {
            parts.push({ text: msg.content });
          }
          
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: parts
          });
        }
      }
      
      requestPayload = {
        contents: contents,
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: max_tokens,
          thinkingConfig: {
            includeThoughts: false,
            thinkingBudget: 26240
          }
        }
      };
      
      // 如果有 system instruction，添加到请求负载
      if (systemInstruction) {
        requestPayload.systemInstruction = systemInstruction;
      }
      
      // QENDA URL 格式
      // 流式: /v1beta/models/{model}:streamGenerateContent?key={apiKey}&alt=sse
      // 非流式: /v1beta/models/{model}:generateContent?key={apiKey}
      const baseUrl = providerConfig.baseURL || '';
      const endpoint = stream ? 'streamGenerateContent' : 'generateContent';
      const streamParam = stream ? '&alt=sse' : '';
      
      if (baseUrl.includes('{{YOUR_API_KEY}}')) {
        // 如果 URL 包含占位符，替换为实际 API key
        requestURL = baseUrl.replace('{{YOUR_API_KEY}}', providerConfig.apiKey);
        // 确保使用正确的端点
        if (stream) {
          requestURL = requestURL.replace(':generateContent', ':streamGenerateContent');
          if (!requestURL.includes('alt=sse')) {
            requestURL += requestURL.includes('?') ? '&alt=sse' : '?alt=sse';
          }
        }
      } else if (baseUrl.includes('?key=') || baseUrl.includes(':generateContent') || baseUrl.includes(':streamGenerateContent')) {
        // 如果 URL 已经包含完整路径，确保使用正确的端点
        if (stream) {
          requestURL = baseUrl.replace(':generateContent', ':streamGenerateContent');
          if (!requestURL.includes(':streamGenerateContent')) {
            requestURL = baseUrl.replace(':streamGenerateContent', ':streamGenerateContent');
          }
          if (!requestURL.includes('alt=sse')) {
            requestURL += requestURL.includes('?') ? '&alt=sse' : '?alt=sse';
          }
        } else {
          requestURL = baseUrl.replace(':streamGenerateContent', ':generateContent');
          // 移除 alt=sse 参数（如果存在）
          requestURL = requestURL.replace(/[&?]alt=sse/, '');
        }
      } else if (baseUrl) {
        // 如果提供了 baseURL，拼接完整路径
        const url = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        requestURL = `${url}/v1beta/models/${requestModel}:${endpoint}?key=${providerConfig.apiKey}${streamParam}`;
      } else {
        // 如果没有提供 baseURL，使用默认的 Google Generative AI 端点
        requestURL = `https://generativelanguage.googleapis.com/v1beta/models/${requestModel}:${endpoint}?key=${providerConfig.apiKey}${streamParam}`;
      }
    } else {
      // OpenAI 兼容格式
      requestPayload = {
        model: requestModel,
        messages,
        temperature,
        max_tokens,
        stream
      };
      requestURL = providerConfig.baseURL;
    }

    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 创建带超时的 fetch 请求
        const controller = new AbortController();
        // 如果是流式，不需要设置总超时，而是应该设置 socket 读超时（fetch 不支持直接设置，这里先保持 10 分钟总超时）
        const timeoutId = setTimeout(() => controller.abort(), 600000); 
        
        const response = await fetch(requestURL, {
          method: 'POST',
          headers: providerConfig.headers,
          body: JSON.stringify(requestPayload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          if (stream) {
            // 处理流式响应
            if (isQenda) {
              return this.handleQendaStreamResponse(response, provider || this.defaultProvider, requestModel);
            } else {
              return this.handleStreamResponse(response, provider || this.defaultProvider, requestModel);
            }
          } else {
            const responseText = await response.text();
            
            let data;
            try {
              data = JSON.parse(responseText);
            } catch (parseError) {
              throw new Error(`Failed to parse response: ${parseError.message}`);
            }
            
            // 根据提供商格式解析响应
            if (isQenda) {
              // Gemini 格式响应转换为统一格式
              const candidates = data.candidates || [];
              
              // 提取内容：跳过 thought parts，只提取实际的文本内容
              const parts = candidates[0]?.content?.parts || [];
              
              let content = '';
              for (const part of parts) {
                // 跳过 thought 部分（思考过程）
                if (part.thought === true) {
                  continue;
                }
                // 提取文本内容
                if (part.text) {
                  content += part.text;
                }
              }
              
              const usageMetadata = data.usageMetadata || {};
              
              return {
                provider: provider || this.defaultProvider,
                model: requestModel,
                response: data,
                content: content,
                usage: {
                  prompt_tokens: usageMetadata.promptTokenCount || 0,
                  completion_tokens: usageMetadata.candidatesTokenCount || 0,
                  total_tokens: usageMetadata.totalTokenCount || 0
                },
                created: Math.floor(Date.now() / 1000),
                id: data.modelVersion || `qenda-${Date.now()}`
              };
            } else {
              // OpenAI 兼容格式响应
              return {
                provider: provider || this.defaultProvider,
                model: requestModel,
                response: data,
                content: data.choices?.[0]?.message?.content,
                usage: data.usage,
                created: data.created,
                id: data.id
              };
            }
          }
        }

        // 处理错误响应
        const errorText = await response.text();
        const errorMessage = `${providerConfig.name} API request failed: ${response.status} ${response.statusText} - ${errorText}`;
        
        // 检查是否是429错误（并发限制）
        if (response.status === 429) {
          // 尝试从错误信息中提取等待时间
          let waitTime = 1000; // 默认等待1秒
          
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error && errorData.error.message) {
              const message = errorData.error.message;
              const match = message.match(/try again after (\d+) seconds?/i);
              if (match) {
                waitTime = parseInt(match[1]) * 1000;
              }
            }
          } catch (parseError) {
            // 如果解析失败，使用默认等待时间
          }
          
          if (attempt < maxRetries) {
            console.log(`${providerConfig.name} API rate limited, retrying after ${waitTime}ms (${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        // 如果不是429错误或已达到最大重试次数，抛出错误
        lastError = new Error(errorMessage);
        clearTimeout(timeoutId);
        break;
        
      } catch (error) {
        // 检查是否是超时错误
        if (error.name === 'AbortError') {
          lastError = new Error('API request timeout (10 minutes)');
        } else {
          lastError = error;
        }
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 指数退避
          console.log(`${providerConfig.name} API request error, retrying after ${waitTime}ms (${attempt + 1}/${maxRetries}):`, error.message);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * 处理 QENDA (Gemini) SSE 流式响应
   * @param {Response} response - fetch 响应对象
   * @param {string} provider - 提供商名称
   * @param {string} model - 模型名称
   * @returns {AsyncGenerator} 异步生成器，yield 文本片段
   */
  async *handleQendaStreamResponse(response, provider, model) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 保留最后一个可能不完整的行

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
          
          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonStr = trimmedLine.slice(6);
              const data = JSON.parse(jsonStr);
              
              // Gemini SSE 格式：提取 candidates[0].content.parts[0].text
              const candidates = data.candidates || [];
              if (candidates.length > 0) {
                const parts = candidates[0].content?.parts || [];
                for (const part of parts) {
                  // 跳过 thought 部分
                  if (part.thought === true) continue;
                  
                  // 提取文本增量
                  if (part.text) {
                    yield {
                      content: part.text,
                      provider,
                      model,
                      id: data.modelVersion || `qenda-${Date.now()}`,
                      created: Math.floor(Date.now() / 1000),
                      usage: data.usageMetadata || null
                    };
                  }
                }
              }
            } catch (e) {
              console.warn('Failed to parse QENDA stream data:', trimmedLine, e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 处理流式响应（OpenAI 兼容格式）
   * @param {Response} response - fetch 响应对象
   * @param {string} provider - 提供商名称
   * @param {string} model - 模型名称
   * @returns {AsyncGenerator} 异步生成器，yield 文本片段
   */
  async *handleStreamResponse(response, provider, model) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 保留最后一个可能不完整的行

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
          if (trimmedLine.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmedLine.slice(6));
              // Handle both OpenAI format and potentially direct text delta
              const content = data.choices?.[0]?.delta?.content || data.content || '';
              const usage = data.usage; // Capture usage info if present
              
              // Always yield, even if content is empty (for usage info in final chunk)
              if (content || usage) {
                yield {
                  content: content || '',
                  provider,
                  model,
                  id: data.id,
                  created: data.created,
                  usage: usage || null // Include usage if available
                };
              }
            } catch (e) {
              console.warn('Failed to parse stream data:', trimmedLine, e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 测试提供商连接
   * @param {string} providerName - 提供商名称
   * @returns {Promise<Object>} 测试结果
   */
  async testProvider(providerName = null) {
    try {
      const provider = this.getProvider(providerName);
      
      const testMessages = [
        { role: 'system', content: '你是一个AI助手。' },
        { role: 'user', content: '请回复"连接测试成功"。' }
      ];

      const result = await this.createChatCompletion({
        provider: providerName,
        messages: testMessages,
        max_tokens: 50
      });

      return {
        success: true,
        provider: provider.name,
        model: result.model,
        response: result.content,
        latency: Date.now() - (result.created * 1000)
      };
    } catch (error) {
      return {
        success: false,
        provider: providerName || this.defaultProvider,
        error: error.message
      };
    }
  }
}

module.exports = AIProviderFactory;

