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
      // 首先尝试从localStorage获取
      const sessionStr = localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session?.access_token) {
          // 将Supabase token转换为后端API需要的格式
          return this.convertSupabaseToken(session.access_token);
        }
      }
      
      // 如果localStorage没有，从Supabase获取
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        // 将Supabase token转换为后端API需要的格式
        return this.convertSupabaseToken(session.access_token);
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

  private async request(endpoint: string, options: RequestInit = {}) {
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
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
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
    return this.post('/ai/generate', {
      prompt,
      ...options,
    });
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