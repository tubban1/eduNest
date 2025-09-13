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
   * 发送聊天完成请求
   * @param {Object} params - 请求参数
   * @param {string} params.provider - 提供商名称
   * @param {string} params.model - 模型名称（可选，使用默认模型）
   * @param {Array} params.messages - 消息数组
   * @param {number} params.temperature - 温度参数
   * @param {number} params.max_tokens - 最大token数
   * @returns {Promise<Object>} API响应
   */
  async createChatCompletion({
    provider = null,
    model = null,
    messages = [],
    temperature = 0.6,
    max_tokens = 24000
  }) {
    const providerConfig = this.getProvider(provider);
    const requestModel = model || providerConfig.model;
    
    const requestPayload = {
      model: requestModel,
      messages,
      temperature,
      max_tokens
    };

    const response = await fetch(providerConfig.baseURL, {
      method: 'POST',
      headers: providerConfig.headers,
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${providerConfig.name} API请求失败: ${response.status} ${response.statusText} - ${errorText}`);
    }

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
