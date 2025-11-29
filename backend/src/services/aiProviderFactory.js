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
      }
    };
    
    this.defaultProvider = process.env.DEFAULT_AI_PROVIDER || 'ark';
  }

  /**
   * 获取指定的AI提供商配置
   * @param {string} providerName - 提供商名称 (ark, kimi)
   * @returns {Object} 提供商配置
   */
  getProvider(providerName = null) {
    const provider = providerName || this.defaultProvider;
    
    
    if (!this.providers[provider]) {
      throw new Error(`不支持的AI提供商: ${provider}`);
    }
    
    const config = this.providers[provider];
    
    
    if (!config.apiKey || config.apiKey === 'your-api-key-here') {
      throw new Error(`${config.name} API密钥未配置或使用默认值`);
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
    
    const requestPayload = {
      model: requestModel,
      messages,
      temperature,
      max_tokens,
      stream
    };

    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 创建带超时的 fetch 请求
        const controller = new AbortController();
        // 如果是流式，不需要设置总超时，而是应该设置 socket 读超时（fetch 不支持直接设置，这里先保持 10 分钟总超时）
        const timeoutId = setTimeout(() => controller.abort(), 600000); 
        
        const response = await fetch(providerConfig.baseURL, {
          method: 'POST',
          headers: providerConfig.headers,
          body: JSON.stringify(requestPayload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          if (stream) {
            // 处理流式响应
            return this.handleStreamResponse(response, provider || this.defaultProvider, requestModel);
          } else {
            const data = await response.json();
            
            // 统一响应格式
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

        // 处理错误响应
        const errorText = await response.text();
        const errorMessage = `${providerConfig.name} API请求失败: ${response.status} ${response.statusText} - ${errorText}`;
        
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
            console.log(`${providerConfig.name} API并发限制，等待${waitTime}ms后重试 (${attempt + 1}/${maxRetries})`);
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
          lastError = new Error('API请求超时(10分钟)');
        } else {
          lastError = error;
        }
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 指数退避
          console.log(`${providerConfig.name} API请求异常，${waitTime}ms后重试 (${attempt + 1}/${maxRetries}):`, error.message);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * 处理流式响应
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
              console.warn('解析流式数据失败:', trimmedLine, e);
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

