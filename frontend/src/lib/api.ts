import { config } from './config';
import { errorHandler, logError } from './errorHandler';
import { supabase } from './supabase';

// 统一的API客户端
class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = config.API_BASE_URL) {
    this.baseUrl = baseUrl;
    
    // 添加调试信息
    console.log('API客户端初始化:', {
      baseUrl: this.baseUrl,
      isProduction: process.env.NODE_ENV === 'production',
      configApiUrl: config.API_BASE_URL
    });
    
    if (typeof window !== 'undefined') {
      // 修复：使用与 useAuth 相同的 token 存储 key
      const sessionStr = localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token');
      if (sessionStr) {
        try {
          const parsed = JSON.parse(sessionStr);
          // 兼容不同结构：session.access_token 或 currentSession.access_token 或 session.session.access_token
          const possibleToken = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token;
          if (possibleToken) {
            this.token = possibleToken as string;
          }
        } catch (error) {
          // 静默处理解析失败
        }
      }
    }
  }

  setToken(token: string) {
    this.token = token;
    // 注意：这里不直接存储到 localStorage，因为 useAuth 已经存储了
    // 我们只需要在内存中保存 token 引用
  }

  clearToken() {
    this.token = null;
    // 注意：这里不直接清除 localStorage，因为 useAuth 会处理
  }

  private async ensureToken(): Promise<void> {
    if (this.token || typeof window === 'undefined') return;
    try {
      const { data } = await supabase.auth.getSession();
      const t = data?.session?.access_token;
      if (t) {
        this.token = t;
        return;
      }
      // 再次兜底读取本地存储
      const sessionStr = localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token');
      if (sessionStr) {
        const parsed = JSON.parse(sessionStr);
        const possibleToken = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token;
        if (possibleToken) this.token = possibleToken as string;
      }
    } catch (e) {
      // 忽略，维持无token状态
    }
  }

  // 公共请求方法
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this._request<T>(endpoint, options);
  }

  private async _request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // 确保在请求前拥有最新的访问令牌
    await this.ensureToken();
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        const error = new Error(errorData.message || `HTTP ${response.status}`);
        
        // 处理特定HTTP状态码
        if (response.status === 401) {
          this.clearToken();
          // 对于 /auth/me 端点，401 是正常的未登录状态
          if (endpoint === '/auth/me') {
            throw error; // 直接抛出错误，不通过错误处理器
          }
          throw errorHandler.handleAuthError(error);
        }
        
        if (response.status === 403) {
          throw errorHandler.handlePermissionError(error);
        }
        
        throw error;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // 对于 /auth/me 端点的错误，不通过错误处理器重新包装
      if (endpoint === '/auth/me') {
        throw error;
      }
      logError(error, `API Request: ${endpoint}`);
      throw errorHandler.handleApiError(error);
    }
  }

  // Auth API
  auth = {
    login: async (email: string, password: string) => {
      const data = await this._request<{ success: boolean; data: { user: any; token: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (data.success && data.data.token) {
        this.setToken(data.data.token);
      }
      return data;
    },

    me: async () => {
      return this._request<{ success: boolean; data: any }>('/auth/me');
    },

    refresh: async () => {
      const data = await this._request<{ success: boolean; data: { token: string } }>('/auth/refresh');
      if (data.success && data.data.token) {
        this.setToken(data.data.token);
      }
      return data;
    },

    register: async (email: string, password: string) => {
      return this._request<{ success: boolean; data: any; message?: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
  };

  // Content API
  content = {
    getAll: async () => {
      const data = await this._request<{ success: boolean; data: any[] }>('/content');
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

      const data = await this._request<{ success: boolean; data: any[] }>(`/content?${params}`);
      return data.success ? data.data : [];
    },

    getById: async (id: string) => {
      const data = await this._request<{ success: boolean; data: any }>(`/content/${id}`);
      return data.success ? data.data : null;
    },

    getByShortId: async (shortId: string) => {
      const data = await this._request<{ success: boolean; data: any }>(`/content/short/${shortId}`);
      return data.success ? data.data : null;
    },

    create: async (content: any) => {
      const data = await this._request<{ success: boolean; data: any }>('/content', {
        method: 'POST',
        body: JSON.stringify(content),
      });
      return data.success ? data.data : null;
    },

    update: async (id: string, updates: any) => {
      const data = await this._request<{ success: boolean; data: any }>(`/content/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      return data.success ? data.data : null;
    },

    delete: async (id: string) => {
      await this._request(`/content/${id}`, {
        method: 'DELETE',
      });
    },
  };

  // Collection API
  async createCollection({ name, visibility }: { name: string; visibility: string }) {
    return this._request<{ success: boolean; data: any }>('/collection_lists', {
      method: 'POST',
      body: JSON.stringify({ name, visibility }),
    });
  }

  async deleteCollection(id: string) {
    return this._request<{ success: boolean; deleted: string }>(`/collection_lists/${id}`, {
      method: 'DELETE',
    });
  }

  async addContentToList(contentId: string, listId: string) {
    return this._request<{ success: boolean; data: any }>('/user_collections', {
      method: 'POST',
      body: JSON.stringify({ content_id: contentId, list_id: listId }),
    });
  }

  async removeContentFromList(contentId: string, listId: string) {
    return this._request<{ success: boolean; deleted: string }>(`/user_collections/${contentId}/${listId}`, {
      method: 'DELETE',
    });
  }

  async getUserCollections(userId: string) {
    return this._request<{ success: boolean; data: any[] }>(`/user_collections/group/${userId}`);
  }

  async getCollectionLists() {
    return this._request<{ success: boolean; data: any[] }>('/collection_lists');
  }

  async updateCollectionOrder(orders: { id: string; order: number }[]) {
    return this._request<{ success: boolean; data: any }>('/collection_lists/order', {
      method: 'PUT',
      body: JSON.stringify({ orders }),
    });
  }

  async deleteCollectionList(id: string) {
    return this._request<{ success: boolean; deleted: string }>(`/collection_lists/${id}`, {
      method: 'DELETE',
    });
  }

  // User Content API
  async likeContent(contentId: string) {
    return this._request<{ success: boolean; data: any }>(`/user_content/${contentId}/like`, {
      method: 'POST',
    });
  }

  async unlikeContent(contentId: string) {
    return this._request<{ success: boolean; data: any }>(`/user_content/${contentId}/like`, {
      method: 'DELETE',
    });
  }

  async getLikedContent() {
    return this._request<{ success: boolean; data: any[] }>('/user_content/liked');
  }

  // Rating API
  async rateContent(contentId: string, rating: number) {
    return this._request<{ success: boolean; data: any }>(`/ratings/${contentId}`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    });
  }

  async getContentRating(contentId: string) {
    return this._request<{ success: boolean; data: any }>(`/ratings/${contentId}`);
  }

  async getUserRating(contentId: string) {
    return this._request<{ success: boolean; data: any }>(`/ratings/${contentId}/user`);
  }

  // AI API
  async generateContent(prompt: string, options: any = {}) {
    return this._request<{ success: boolean; data: any }>('/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, ...options }),
    });
  }

  async fixContent(contentId: string, issue: string) {
    return this._request<{ success: boolean; data: any }>(`/ai/fix/${contentId}`, {
      method: 'POST',
      body: JSON.stringify({ issue }),
    });
  }

  async simplifyContent(contentId: string) {
    return this._request<{ success: boolean; data: any }>(`/ai/simplify/${contentId}`, {
      method: 'POST',
    });
  }

  async getCollectionsByContent(contentId: string) {
    return this._request<{ success: boolean; data: any[] }>(`/user_collections/content/${contentId}`);
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
  code_html?: string;
  code_css?: string;
  code_js?: string;
  external_links?: string[];
  language_code?: string;
  content_type?: string;
  created_by?: string;
  rating?: number;
  user_rating?: number;
} 