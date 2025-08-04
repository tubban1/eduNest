import { config } from './config';
import { errorHandler, logError } from './errorHandler';

// 统一的API客户端
class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = config.API_BASE_URL) {
    this.baseUrl = baseUrl;
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        this.token = token;
      }
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
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
    return this._request<{ success: boolean }>(`/user_collections/${contentId}/${listId}`, {
      method: 'DELETE',
    });
  }

  async getContentCollections(contentId: string) {
    const data = await this._request<{ success: boolean; data: any[] }>(`/user_collections/content/${contentId}`);
    return data.success ? data.data : [];
  }

  async getCollectionGroups() {
    const data = await this._request<{ success: boolean; data: any[] }>('/user_collections/groups');
    return data.success ? data.data : [];
  }

  async getCollectionsByGroup(groupId: string) {
    const data = await this._request<{ success: boolean; data: any[] }>(`/user_collections/group/${groupId}`);
    return data.success ? data.data : [];
  }

  async likeContent(contentId: string) {
    return this._request<{ success: boolean; data: any }>(`/user_content/${contentId}/like`, {
      method: 'POST',
    });
  }

  async unlikeContent(contentId: string) {
    return this._request<{ success: boolean }>(`/user_content/${contentId}/like`, {
      method: 'DELETE',
    });
  }

  async getContentLikeStatus(contentId: string) {
    return this._request<{ success: boolean; data: { isLiked: boolean } }>(`/user_content/${contentId}/like`);
  }

  async getLikedContent() {
    return this._request<{ success: boolean; data: any[] }>('/user_content/liked');
  }

  async getUserCollections(userId: string) {
    const data = await this._request<{ success: boolean; data: any[] }>(`/collections/user/${userId}`);
    return data.success ? data.data : [];
  }

  async addToCollection(collection: any) {
    const data = await this._request<{ success: boolean; data: any }>('/collections', {
      method: 'POST',
      body: JSON.stringify(collection),
    });
    return data.success ? data.data : null;
  }

  async removeFromCollection(id: string) {
    await this._request(`/collections/${id}`, {
      method: 'DELETE',
    });
  }

  // Rating API
  rating = {
    getContentRatings: async (contentId: string) => {
      const data = await this._request<{ success: boolean; data: any[] }>(`/ratings/content/${contentId}`);
      return data.success ? data.data : [];
    },

    addRating: async (rating: any) => {
      const data = await this._request<{ success: boolean; data: any }>('/ratings', {
        method: 'POST',
        body: JSON.stringify(rating),
      });
      return data.success ? data.data : null;
    },

    getRatingStats: async (contentId: string) => {
      const data = await this._request<{ success: boolean; data: any }>(`/ratings/stats/${contentId}`);
      return data.success ? data.data : null;
    },
  };

  // AI相关API
  ai = {
    generate: async (data: { knowledgePoint: string; learningStage: string; description?: string }) => {
      return this._request<{ success: boolean; data: any }>('/ai/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getLearningStages: async () => {
      return this._request<{ success: boolean; data: any[] }>('/ai/learning-stages');
    },

    getLearningStageDescription: async (stage: string) => {
      return this._request<{ success: boolean; data: any }>(`/ai/learning-stage/${stage}/description`);
    },
  };

  // 用户收藏相关API
}

// 创建API实例
export const api = new ApiClient();

// 类型定义
export interface Content {
  id: string;
  short_id?: string;
  title: string;
  grade?: string;
  subject?: string;
  knowledge_point: string[];
  tags?: string[];
  language: string;
  content_type: string;
  content_data: any;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface UserCollection {
  id: string;
  user_id: string;
  content_id: string;
  created_at: string;
}

export interface Rating {
  id: string;
  user_id: string;
  content_id: string;
  rating: number;
  comment?: string;
  created_at: string;
} 