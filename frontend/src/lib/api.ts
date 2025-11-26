import { supabase } from './supabase';

// 统一的API客户端
class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
    
    // 初始化时尝试获取现有会话的 token
    this.initializeToken();
  }

  private async initializeToken() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        this.token = session.access_token;
      }
    } catch (error) {
      // 静默处理初始化错误
    }
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async getLatestToken(): Promise<string | null> {
    try {
      // 首先尝试从Supabase获取当前session（这会自动刷新过期的token）
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('获取session失败:', error);
        return null;
      }
      
      if (session?.access_token) {
        // 检查token是否即将过期（提前5分钟刷新）
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = session.expires_at || 0;
        const timeUntilExpiry = expiresAt - now;
        
        
        // 如果token即将过期，尝试刷新
        if (timeUntilExpiry < 300) {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error('Token刷新失败:', refreshError);
            // 如果刷新失败，清除本地存储并重定向到登录页
            localStorage.removeItem('sb-zayoczhybuegvtpcsgso-auth-token');
            this.clearToken();
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            return null;
          }
          
          if (refreshData?.session?.access_token) {
            return this.convertSupabaseToken(refreshData.session.access_token);
          }
        }
        
        return this.convertSupabaseToken(session.access_token);
      }
      
      // 如果Supabase没有session，尝试从localStorage获取（兼容旧版本）
      const sessionStr = localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session?.access_token) {
          return this.convertSupabaseToken(session.access_token);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }

  private async convertSupabaseToken(supabaseToken: string): Promise<string> {
    // 直接返回原始的Supabase token，因为后端API期望这种格式
    return supabaseToken;
  }

  private async request(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // 动态获取最新token
    const token = await this.getLatestToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // 如果是401错误，进行最多两次刷新重试
        if (response.status === 401 && retryCount < 2) {
          try {
            // 短暂退避以避免与其他刷新竞态
            await new Promise(r => setTimeout(r, 200 * (retryCount + 1)));
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (!refreshError && refreshData?.session?.access_token) {
              return await this.request(endpoint, options, retryCount + 1);
            }
            console.warn('Token刷新失败，准备下一次尝试或退出', { refreshError, retryCount });
          } catch (e) {
            console.error('刷新流程异常:', e);
          }
        }
        
        // 连续重试后仍401，交给上层处理（不要立即强制跳登录）
        if (response.status === 401) {
          throw new Error('认证失败或已过期');
        }
        
        // 优先使用后端返回的 error 字段或 message 字段
        throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('API请求失败:', { url, error, config, retryCount });
      
      // 提供更详细的错误信息
      if (error instanceof TypeError && error.message && error.message.includes('fetch')) {
        throw new Error(`网络连接失败: ${error.message}。请检查网络连接和后端服务状态。`);
      }
      
      throw error;
    }
  }

  async get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Auth API
  auth = {
    login: async (email: string, password: string) => {
      const data = await this.post('/auth/login', {
        email, password,
      });
      if (data.success && data.data.token) {
        this.setToken(data.data.token);
      }
      return data;
    },

    me: async () => {
      return this.get('/auth/me');
    },

    refresh: async () => {
      const data = await this.post('/auth/refresh');
      if (data.success && data.data.token) {
        this.setToken(data.data.token);
      }
      return data;
    },

    register: async (email: string, password: string) => {
      return this.post('/auth/register', {
        email, password,
      });
    },
  };

  // Content API
  content = {
    getAll: async () => {
      const data = await this.get('/content');
      return data.success ? data.data : [];
    },

    getFiltered: async (filters: {
      knowledge_point?: string[];
      language?: string;
      created_by?: string; // 添加 created_by 支持
    }) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, value);
          }
        }
      });

      const data = await this.get(`/content?${params}`);
      return data.success ? data.data : [];
    },

    getById: async (id: string) => {
      const data = await this.get(`/content/${id}`);
      return data.success ? data.data : null;
    },

    getByShortId: async (shortId: string) => {
      const data = await this.get(`/content/short/${shortId}`);
      return data.success ? data.data : null;
    },

    create: async (content: any) => {
      const data = await this.post('/content', content);
      return data.success ? data.data : null;
    },

    update: async (id: string, updates: any) => {
      const data = await this.put(`/content/${id}`, updates);
      return data.success ? data.data : null;
    },

    delete: async (id: string) => {
      await this.delete(`/content/${id}`);
    },

    fix: async (fixData: any) => {
      // 生成唯一的request_id
      const requestId = crypto.randomUUID();
      
      const data = await this.post('/content/fix', {
        ...fixData,
        requestId
      });
      return data.success ? data : null;
    },

    // 获取精选内容（自动从 admin 账号提取，公开接口）
    getFeaturedContents: async (options?: {
      limit?: number;
      offset?: number;
      category?: string;
      sortBy?: 'quality_score' | 'created_at' | 'likes_count' | 'collections_count';
      tags?: string[];
      language_code?: string;
    }) => {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      if (options?.category) params.append('category', options.category);
      if (options?.sortBy) params.append('sortBy', options.sortBy);
      if (options?.tags) {
        options.tags.forEach(tag => params.append('tags', tag));
      }
      if (options?.language_code) params.append('language_code', options.language_code);
      
      // 这是公开接口，不需要认证
      const response = await fetch(`${this.baseUrl}/content/featured?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.success ? data.data : [];
    },

    // 获取精选内容的分类统计（公开接口）
    getFeaturedContentCategories: async () => {
      const response = await fetch(`${this.baseUrl}/content/featured/categories`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.success ? data.data : [];
    },

    // 获取指定收藏列表的公开内容（公开接口）
    getCollectionListContent: async (listId: string, options?: { limit?: number; offset?: number }) => {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      
      const response = await fetch(`${this.baseUrl}/content/collection-list/${listId}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.success ? data.data : [];
    },
  };

  // Collection API
  async createCollection({ name, visibility }: { name: string; visibility: string }) {
    return this.post('/collection_lists', {
      name, visibility,
    });
  }

  async deleteCollection(id: string) {
    return this.delete(`/collection_lists/${id}`);
  }

  async addContentToList(contentId: string, listId: string) {
    return this.post('/user_collections', {
      content_id: contentId, list_id: listId,
    });
  }

  async removeContentFromList(contentId: string, listId: string) {
    return this.delete(`/user_collections/${contentId}/${listId}`);
  }

  async getUserCollections(userId: string) {
    return this.get(`/user_collections/group/${userId}`);
  }

  async getCollectionLists() {
    return this.get('/collection_lists');
  }

  async updateCollectionOrder(orders: { id: string; order: number }[]) {
    return this.put('/collection_lists/order', {
      orders,
    });
  }

  async deleteCollectionList(id: string) {
    return this.delete(`/collection_lists/${id}`);
  }

  // User Content API
  async likeContent(contentId: string) {
    return this.post(`/user_content/${contentId}/like`);
  }

  async unlikeContent(contentId: string) {
    return this.delete(`/user_content/${contentId}/like`);
  }

  async getLikedContent() {
    return this.get('/user_content/liked');
  }

  // Rating API
  async rateContent(contentId: string, rating: number) {
    return this.post(`/ratings/${contentId}`, {
      rating,
    });
  }

  async getContentRating(contentId: string) {
    return this.get(`/ratings/${contentId}`);
  }

  async getUserRating(contentId: string) {
    return this.get(`/ratings/${contentId}/user`);
  }

  // AI API
  async generateContent(prompt: string, options: any = {}) {
    // 生成唯一的request_id
    const requestId = crypto.randomUUID();
    
    
    const response = await this.post('/ai/generate', {
      prompt,
      requestId,
      ...options,
    });
    
    // 将request_id附加到响应中，方便前端使用
    return { ...response, requestId };
  }

  // 通过request_id查询AI生成日志
  async getAiLogByRequestId(requestId: string) {
    return this.get(`/ai/logs/${requestId}`);
  }

  // 重新加载AI生成结果
  async reloadAiResult(requestId: string) {
    return this.get(`/ai/reload?request_id=${requestId}`);
  }

  // 异步生成内容
  async generateContentAsync(contentId: string, params: {
    knowledge_point: string;
    learning_stage?: string;
    description?: string;
    language_code?: string;
    provider?: string;
  }) {
    return this.post('/ai/generate-async', {
      content_id: contentId,
      ...params
    });
  }

  // 获取内容生成状态
  async getContentGenerationStatus(contentId: string) {
    return this.get(`/ai/generation-status/${contentId}`);
  }

  // 批量获取生成状态
  async getBatchGenerationStatus(contentIds: string[]) {
    const ids = contentIds.join(',');
    return this.get(`/ai/generation-status?ids=${ids}`);
  }

  // 手动重试失败的任务
  async retryFailedTask(contentId: string) {
    return this.post(`/ai/retry/${contentId}`, {});
  }

  // 获取队列状态（管理员）
  async getQueueStatus() {
    return this.get('/ai/queue-status');
  }

  // Payments API
  async getPaymentMethods() {
    return this.get('/payments/payment-methods');
  }

  async createPaymentSession(planType: string, options?: {
    success_url?: string;
    cancel_url?: string;
    payment_methods?: string[];
    region?: string;
  }) {
    return this.post('/payments/create-session', {
      plan_type: planType,
      ...options,
    });
  }

  // Subscriptions API
  async getSubscriptionStatus() {
    return this.get('/subscriptions/status');
  }

  async upgradeSubscription(planType: string, stripeSessionId: string) {
    return this.post('/subscriptions/upgrade', {
      plan_type: planType,
      stripe_session_id: stripeSessionId,
    });
  }

  async cancelSubscription() {
    return this.post('/subscriptions/cancel');
  }

  async fixContent(contentId: string, issue: string) {
    return this.post(`/ai/fix/${contentId}`, {
      issue,
    });
  }

  async simplifyContent(contentId: string) {
    return this.post(`/ai/simplify/${contentId}`);
  }

  async getCollectionsByContent(contentId: string) {
    return this.get(`/user_collections/content/${contentId}`);
  }

  // Collection Lists API
  collectionList = {
    /**
     * 根据 short_id 获取 collection_list
     */
    getByShortId: async (shortId: string) => {
      // 获取认证 token
      const token = await this.getLatestToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${this.baseUrl}/collection_lists/by-short-id/${shortId}`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('列表不存在');
        }
        if (response.status === 403) {
          throw new Error('无权限访问此列表');
        }
        throw new Error('获取列表失败');
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || '获取列表失败');
      }
      
      return data.data;
    },

    /**
     * 更新列表设置（仅创建者）
     */
    updateSettings: async (listId: string, settings: {
      name?: string;
      description?: string;
      visibility?: 'public' | 'private';
      pricing_mode?: 'free' | 'premium' | 'free_preview';
      price?: number;
      currency?: string;
    }) => {
      return this.put(`/collection_lists/${listId}/settings`, settings);
    },
  };

  // AI Guided Learning API
  aiGuide = {
    init: async (contentId: string) => {
      const data = await this.post('/ai-guide/init', { content_id: contentId });
      return data.success ? data.data : null;
    },
    chat: async (conversationId: string, message: string, uiState?: any) => {
      const data = await this.post('/ai-guide/chat', { conversation_id: conversationId, message, ui_state: uiState });
      return data.success ? data.data : null;
    },
    getConversations: async (contentId: string) => {
      const data = await this.get(`/ai-guide/conversations?content_id=${contentId}`);
      return data.success ? data.data.conversations : [];
    },
    getMessages: async (conversationId: string) => {
      const data = await this.get(`/ai-guide/messages?conversation_id=${conversationId}`);
      return data.success ? data.data.messages : [];
    }
  };

  // Admin API
  async getAdminUsers() {
    return this.get('/credits/admin/users');
  }

  async addCreditsToUser(email: string, amount: number, reason: string) {
    return this.post('/credits/admin/credits/add', {
      email,
      amount,
      reason,
    });
  }
}

// 创建并导出 API 实例
export const api = new ApiClient();

// 导出类型
export interface Content {
  id: string;
  short_id: string;
  title: string;
  description?: string;
  tags?: string[];
  knowledge_point?: string[];
  created_at: string;
  updated_at: string;
  // 代码块字段已废弃，只使用 full_html
  // code_html?: string;
  // code_css?: string;
  // code_js?: string;
  full_html?: string; // 完整的 HTML 文件内容（必填）
  // external_links?: string[];
  language_code?: string;
  content_type?: string;
  created_by?: string;
  rating?: number;
  user_rating?: number;
  // 生成状态相关字段
  generation_status?: 'pending' | 'processing' | 'done' | 'failed';
  generation_progress?: number;
  retry_count?: number;
  generation_error?: string;
  generation_updated_at?: string;
  user_query?: string;
  // 精选内容相关字段（从 admin 账号自动提取）
  likes_count?: number;
  collections_count?: number;
  quality_score?: number;
} 