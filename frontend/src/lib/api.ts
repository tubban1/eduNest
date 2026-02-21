import { supabase } from './supabase';
import { cache, generateCacheKey, CACHE_CONFIG } from './cache';
import { getVisitorId } from '../utils/visitorId';
import i18n from '@/i18n/config';

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

  getToken(): string | null {
    return this.token;
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

  private async request(
    endpoint: string, 
    options: RequestInit = {}, 
    retryCount = 0,
    maxRetries = 3,
    timeoutMs = 30000
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // 检查网络状态（仅在浏览器环境）
    if (typeof window !== 'undefined' && 'navigator' in window && !navigator.onLine) {
      throw new Error(i18n.t('common:network.offline', { defaultValue: '网络连接已断开，请检查网络设置' }));
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // 动态获取最新token
    const token = await this.getLatestToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // 无论是否登录，都尝试添加 Visitor ID 头
    // 这样后端可以根据内容的所有者（user_id 或 visitor_id）来验证权限
    if (typeof window !== 'undefined') {
      try {
        const visitorId = getVisitorId();
        if (visitorId) {
          headers['X-Visitor-Id'] = visitorId;
        }
      } catch (error) {
        // 静默处理 Visitor ID 获取错误
      }
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      // 创建超时 Promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(i18n.t('common:network.requestTimeout', { seconds: timeoutMs / 1000, defaultValue: `请求超时（${timeoutMs / 1000}秒）` })));
        }, timeoutMs);
      });

      // 创建 fetch Promise
      const fetchPromise = fetch(url, config);

      // 使用 Promise.race 实现超时控制
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // 如果是401错误，进行最多两次刷新重试
        if (response.status === 401 && retryCount < 2) {
          try {
            // 短暂退避以避免与其他刷新竞态
            await new Promise(r => setTimeout(r, 200 * (retryCount + 1)));
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (!refreshError && refreshData?.session?.access_token) {
              return await this.request(endpoint, options, retryCount + 1, maxRetries, timeoutMs);
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
        const err = new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
        (err as any).errorCode = errorData.error; // 供前端 i18n 使用
        if (errorData.details && Array.isArray(errorData.details)) {
          (err as any).details = errorData.details;
        }
        throw err;
      }

      return await response.json();
    } catch (error: any) {
      console.error('API请求失败:', { url, error, config, retryCount });
      
      // 判断是否为网络错误（可重试的错误）
      const isNetworkError = 
        error instanceof TypeError && 
        (error.message?.includes('fetch') || error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) ||
        error.message?.includes('网络连接') ||
        error.message?.includes('请求超时');
      
      // 如果是网络错误且还有重试次数，进行自动重试
      if (isNetworkError && retryCount < maxRetries) {
        // 指数退避：1秒、2秒、4秒
        const delay = Math.min(1000 * Math.pow(2, retryCount), 4000);
        const delaySeconds = delay / 1000;
        console.log(i18n.t('common:network.retrying', { 
          delay: delaySeconds, 
          current: retryCount + 1, 
          max: maxRetries,
          defaultValue: `网络错误，${delaySeconds}秒后自动重试 (${retryCount + 1}/${maxRetries})...`
        }));
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return await this.request(endpoint, options, retryCount + 1, maxRetries, timeoutMs);
      }
      
      // 提供更详细的错误信息
      if (isNetworkError) {
        throw new Error(i18n.t('common:network.requestFailed', { defaultValue: '请求失败，请检查网络连接和后端服务状态。' }));
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
    /**
     * 更新当前登录用户的角色（student / parent / teacher）
     */
    updateRole: async (role: 'student' | 'parent' | 'teacher') => {
      return this.request('/auth/me/role', {
        method: 'PATCH',
        body: JSON.stringify({ role }),
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
      language_code?: string; // 添加 language_code 支持
      created_by?: string; // 添加 created_by 支持
      limit?: number; // 添加 limit 支持
      offset?: number; // 添加 offset 支持
    }) => {
      // 生成缓存键
      const cacheKey = generateCacheKey('content:filtered', filters);
      
      // 尝试从缓存获取
      const cached = cache.get<any[]>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            // 将 number 类型转换为 string
            params.append(key, String(value));
          }
        }
      });

      const data = await this.get(`/content?${params}`);
      const result = data.success ? data.data : [];
      
      // 存入缓存
      cache.set(cacheKey, result, CACHE_CONFIG.CONTENT_LIST);
      
      return result;
    },

    getById: async (id: string) => {
      const data = await this.get(`/content/${id}`);
      return data.success ? data.data : null;
    },

    getByShortId: async (shortId: string) => {
      // 生成缓存键
      const cacheKey = `content:short:${shortId}`;
      
      // 尝试从缓存获取
      const cached = cache.get<any>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      const data = await this.get(`/content/short/${shortId}`);
      const result = data.success ? data.data : null;
      
      // 存入缓存
      if (result) {
        cache.set(cacheKey, result, CACHE_CONFIG.CONTENT_DETAIL);
      }
      
      return result;
    },

    create: async (content: any) => {
      const data = await this.post('/content', content);
      if (data.success && data.data) {
        // 清除内容列表缓存
        cache.deletePattern('content:filtered*');
        // 如果新内容有 short_id，也清除对应的缓存
        if (data.data.short_id) {
          cache.delete(`content:short:${data.data.short_id}`);
        }
      }
      return data.success ? data.data : null;
    },

    update: async (id: string, updates: any) => {
      const data = await this.put(`/content/${id}`, updates);
      if (data.success && data.data) {
        // 清除内容列表缓存
        cache.deletePattern('content:filtered*');
        // 清除该内容的缓存
        if (data.data.short_id) {
          cache.delete(`content:short:${data.data.short_id}`);
        }
        cache.delete(`content:id:${id}`);
      }
      return data.success ? data.data : null;
    },

    delete: async (id: string) => {
      await this.delete(`/content/${id}`);
      // 清除所有内容相关缓存
      cache.deletePattern('content:*');
    },

    generateThumbnail: async (contentId: string, usePlaywright: boolean = false) => {
      const data = await this.post(`/content/${contentId}/generate-thumbnail`, {
        usePlaywright
      });
      return data;
    },

    regenerateAllThumbnails: async () => {
      const data = await this.post('/content/regenerate-thumbnails');
      return data;
    },

    fix: async (fixData: any) => {
      // 生成唯一的request_id
      const requestId = crypto.randomUUID();
      
      // AI修复可能需要较长时间，使用90秒超时
      const data = await this.request('/content/fix', {
        method: 'POST',
        body: JSON.stringify({
          ...fixData,
          requestId
        }),
      }, 0, 3, 90000); // timeoutMs = 90000 (90秒)
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
    const result = await this.post('/user_collections', {
      content_id: contentId, list_id: listId,
    });
    // 清除收藏相关缓存
    cache.delete('collection_lists:all');
    cache.delete(`user_collections:group:${listId}`);
    cache.delete(`user_collections:content:${contentId}`);
    return result;
  }

  async removeContentFromList(contentId: string, listId: string) {
    const result = await this.delete(`/user_collections/${contentId}/${listId}`);
    // 清除收藏相关缓存
    cache.delete('collection_lists:all');
    cache.delete(`user_collections:group:${listId}`);
    cache.delete(`user_collections:content:${contentId}`);
    return result;
  }

  async getUserCollections(userId: string) {
    return this.get(`/user_collections/group/${userId}`);
  }

  async getCollectionLists() {
    const cacheKey = 'collection_lists:all';
    
    // 尝试从缓存获取
    const cached = cache.get<any>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const data = await this.get('/collection_lists');
    
    // 存入缓存
    cache.set(cacheKey, data, CACHE_CONFIG.COLLECTION_LIST);
    
    return data;
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
    const cacheKey = 'user_content:liked';
    
    // 尝试从缓存获取
    const cached = cache.get<any[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const data = await this.get('/user_content/liked');
    const result = data.success ? data.data : [];
    
    // 存入缓存
    cache.set(cacheKey, result, CACHE_CONFIG.USER_STATUS);
    
    return result;
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
    output_type?: 'interactive' | 'animated';
    description?: string;
    language_code?: string;
    provider?: string;
    image?: {
      mime_type: string;
      data: string;
    };
    idempotency_key?: string;
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

  // 免费内容生成接口（无需认证，需要 visitor_id）
  async generateContentFree(params: {
    knowledgePoint: string;
    output_type?: 'interactive' | 'animated';
    description?: string;
    language_code?: string;
    provider?: string;
    image?: {
      mime_type: string;
      data: string;
    };
    idempotency_key?: string;
  }) {
    return this.post('/ai/generate-free', params);
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
    const cacheKey = `user_collections:content:${contentId}`;
    
    // 尝试从缓存获取
    const cached = cache.get<any[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const data = await this.get(`/user_collections/content/${contentId}`);
    const result = data.success ? data.data : [];
    
    // 存入缓存
    cache.set(cacheKey, result, CACHE_CONFIG.USER_STATUS);
    
    return result;
  }

  // Collection Lists API
  collectionList = {
    /**
     * 根据 short_id 获取 collection_list
     */
    getByShortId: async (shortId: string) => {
      // 先取 token，再决定缓存键，避免「未登录时缓存的 is_owner:false」在登录后仍被命中
      const token = await this.getLatestToken();
      const cacheKey = `collection_list:short:${shortId}${token ? ':auth' : ':anon'}`;

      const cached = cache.get<any>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (typeof window !== 'undefined') {
        try {
          const visitorId = getVisitorId();
          if (visitorId) headers['X-Visitor-Id'] = visitorId;
        } catch (_) {}
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

      const listData = data.data;
      cache.set(cacheKey, listData, CACHE_CONFIG.COLLECTION_DETAIL);
      return listData;
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
      language_code?: string | null;
    }) => {
      return this.put(`/collection_lists/${listId}/settings`, settings);
    },

    /** 批量生成密钥（仅创建者） */
    batchGenerateKeys: async (listId: string, params: { channel_name?: string; count: number; max_devices?: number }) => {
      const res = await this.post(`/collection_lists/${listId}/access-keys/batch`, params);
      return res;
    },

    /** 获取密钥列表（仅创建者） */
    getAccessKeys: async (listId: string) => {
      const res = await this.get(`/collection_lists/${listId}/access-keys`);
      return res;
    },

    /** 验证并绑定密钥（公开，用于用户输入密钥解锁） */
    validateAccessKey: async (listId: string, key: string, deviceId: string) => {
      const res = await this.post(`/collection_lists/${listId}/access-keys/validate`, { key, device_id: deviceId });
      return res;
    },

    /** 使列表缓存失效（密钥解锁/设置变更后调用），同时清除 :auth / :anon 两种 key */
    invalidateCache: (shortId: string) => {
      cache.deletePattern(`collection_list:short:${shortId}*`);
    },

    /**
     * 批量导入 HTML 内容到列表（仅列表创建者）
     * @param listId 列表 UUID
     * @param items 每条必填 full_html；其它字段建议由同名 JSON manifest 提供并直传后端。
     *              兼容：若未传 title/description/tags/language_code/content_type，后端仍会尝试从 HTML 内 edu-meta 解析。
     */
    importItems: async (
      listId: string,
      items: Array<{
        full_html: string;
        title?: string;
        description?: string;
        tags?: string[];
        knowledge_points?: string[];
        language_code?: string;
        content_type?: string;
        svg_thumbnail?: string;
        metadata_json?: any;
        tech_stack?: any;
      }>
    ) => {
      return this.post(`/collection_lists/${listId}/import`, { items });
    },
  };

  // Visitor API
  visitor = {
    // 检查免费试用状态
    checkTrial: async () => {
      return this.get('/visitor/check-trial');
    },
    // 注册后合并游客数据（或仅发放初始积分）
    // visitorId 是可选的，如果没有则只发放初始积分
    mergeOnLogin: async (visitorId?: string) => {
      return this.post('/visitor/merge-on-login', visitorId ? { visitor_id: visitorId } : {});
    },
  };

  // Onboard API（初始化身份与偏好）
  onboard = {
    /** 登录用户：保存到 user_init_context */
    saveContext: async (context: { role: string; region: string; subjects: string[]; age?: number; teachingAgeRanges?: string[] }) => {
      return this.post('/onboard/context', { context });
    },
    /** 访客：保存到 visitor_init_context（注册后 merge-on-login 会并入 user） */
    saveVisitorContext: async (context: { role: string; region?: string; subjects: string[]; age?: number; teachingAgeRanges?: string[] }) => {
      return this.post('/onboard/visitor-context', { context });
    },
  };

  // Page Views API
  pageViews = {
    // 记录页面访问
    record: async (contentId: string, referer?: string) => {
      const data = await this.post('/page-views/record', {
        content_id: contentId,
        referer: referer || (typeof window !== 'undefined' ? document.referrer : undefined)
      });
      return data.success ? data.data : null;
    },
    // 获取内容访问统计
    getStats: async (contentId: string, days: number = 30) => {
      const data = await this.get(`/page-views/stats/${contentId}?days=${days}`);
      return data.success ? data.data : null;
    },
    // 获取热门内容
    getPopular: async (limit: number = 20, days: number = 7) => {
      const data = await this.get(`/page-views/popular?limit=${limit}&days=${days}`);
      return data.success ? data.data : [];
    },
  };

  // AI Guided Learning API
  aiGuide = {
    init: async (contentId: string, forceNew = false) => {
      const data = await this.post('/ai-guide/init', { content_id: contentId, force_new: forceNew });
      return data.success ? data.data : null;
    },
    // 免费初始化会话（无需认证，需要 visitor_id）
    initFree: async (contentId: string, forceNew = false) => {
      const data = await this.post('/ai-guide/init-free', { content_id: contentId, force_new: forceNew });
      return data.success ? data.data : null;
    },
    chatStream: async (conversationId: string, message: string, uiState?: any, onChunk?: (text: string) => void, images?: Array<{ mime_type: string; data: string }>) => {
      const token = await new ApiClient().getLatestToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        // 如果未登录，添加 Visitor ID 头
        if (typeof window !== 'undefined') {
          try {
            const visitorId = getVisitorId();
            if (visitorId) {
              headers['X-Visitor-Id'] = visitorId;
            }
          } catch (error) {
            // 静默处理 Visitor ID 获取错误
          }
        }
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api'}/ai-guide/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ conversation_id: conversationId, message, ui_state: uiState, images: images || undefined }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to send message');
      }

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          // Process complete lines from buffer
          const lines = buffer.split('\n\n');
          // Keep the last part in buffer as it might be incomplete
          buffer = lines.pop() || ''; 

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6);
              if (data === '[DONE]') return;
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.content && onChunk) {
                  onChunk(parsed.content);
                }
              } catch (e) {
                // Ignore parse errors for partial chunks
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
    getConversations: async (contentId: string) => {
      const data = await this.get(`/ai-guide/conversations?content_id=${contentId}`);
      return data.success ? data.data.conversations : [];
    },
    /** 从数据库 ai_conversations 表查询最近一次 conversation */
    getLastConversation: async () => {
      const data = await this.get('/ai-guide/last-conversation');
      return data.success ? data.data : null;
    },
    /** 获取当前用户/访客在 ai_conversations 中的对话数（3 次以上不显示气泡提示） */
    getConversationCount: async () => {
      const data = await this.get('/ai-guide/conversation-count');
      return data?.success ? (data.data?.count ?? 0) : 0;
    },
    getMessages: async (conversationId: string) => {
      const data = await this.get(`/ai-guide/messages?conversation_id=${conversationId}`);
      return data.success ? data.data.messages : [];
    },
    // 免费对话接口（无需认证，需要 visitor_id）
    chatStreamFree: async (conversationId: string, message: string, uiState?: any, onChunk?: (text: string) => void, images?: Array<{ mime_type: string; data: string }>) => {
      const visitorId = typeof window !== 'undefined' ? getVisitorId() : null;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api'}/ai-guide/chat-free`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(visitorId ? { 'X-Visitor-Id': visitorId } : {}),
        },
        body: JSON.stringify({ conversation_id: conversationId, message, ui_state: uiState, images: images || undefined }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to send message');
      }

      if (!response.body) return { freeTrialUsed: false };

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let freeTrialUsed = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          // Process complete lines from buffer
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                return { freeTrialUsed };
              }
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.freeTrialUsed) {
                  freeTrialUsed = true;
                }
                if (parsed.content && onChunk) {
                  onChunk(parsed.content);
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return { freeTrialUsed };
    },
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

  // 记录登录相关日志到后端
  async logAuth(level: 'error' | 'warn' | 'info' | 'debug', message: string, data?: any) {
    try {
      await fetch(`${this.baseUrl}/auth/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level,
          message,
          data,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {
        // 静默处理日志发送失败，避免影响登录流程
      });
    } catch (error) {
      // 静默处理日志发送失败
    }
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
  visitor_id?: string; // 游客 ID（未登录用户创建的内容）
  rating?: number;
  user_rating?: number;
  // 生成状态相关字段
  generation_status?: 'pending' | 'processing' | 'done' | 'failed';
  generation_progress?: number;
  retry_count?: number;
  generation_error?: string;
  generation_updated_at?: string;
  user_query?: string;
  image_url?: string; // AI生成时上传的图片URL
  // 精选内容相关字段（从 admin 账号自动提取）
  likes_count?: number;
  collections_count?: number;
  quality_score?: number;
  // 缩略图相关字段
  svg_thumbnail?: string; // SVG 代码（优先使用）
  thumbnail_url?: string; // 图片 URL（备用）
  thumbnail_status?: 'pending' | 'generating' | 'ready' | 'failed';
  thumbnail_updated_at?: string;
  // AI Guide 相关字段
  metadata_json?: any; // 页面元数据（用于 AI Guide 分析）
} 
