/**
 * 简单的内存缓存工具
 * 用于缓存 API 请求结果，减少数据库查询
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) {
    // 默认 5 分钟
    this.defaultTTL = defaultTTL;
    
    // 定期清理过期缓存
    setInterval(() => this.cleanExpired(), 60 * 1000); // 每分钟清理一次
  }

  /**
   * 获取缓存数据
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * 设置缓存数据
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: ttl || this.defaultTTL,
    });
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 删除匹配模式的缓存（支持通配符）
   */
  deletePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const keysToDelete: string[] = [];
    
    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * 清理过期缓存
   */
  private cleanExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;

    this.cache.forEach((entry) => {
      if (now - entry.timestamp > entry.ttl) {
        expiredCount++;
      } else {
        validCount++;
      }
    });

    return {
      total: this.cache.size,
      valid: validCount,
      expired: expiredCount,
    };
  }
}

// 创建全局缓存实例
export const cache = new MemoryCache(5 * 60 * 1000); // 默认 5 分钟

/**
 * 生成缓存键
 */
export function generateCacheKey(prefix: string, params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) {
    return prefix;
  }

  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&');

  return `${prefix}?${sortedParams}`;
}

/**
 * 缓存配置
 */
export const CACHE_CONFIG = {
  // 内容列表缓存时间（较短，因为内容可能频繁更新）
  CONTENT_LIST: 2 * 60 * 1000, // 2 分钟
  
  // 单个内容缓存时间（较长，因为单个内容变化较少）
  CONTENT_DETAIL: 10 * 60 * 1000, // 10 分钟
  
  // 收藏列表缓存时间
  COLLECTION_LIST: 5 * 60 * 1000, // 5 分钟
  
  // 收藏详情缓存时间
  COLLECTION_DETAIL: 10 * 60 * 1000, // 10 分钟
  
  // 用户点赞/收藏状态缓存时间（较短，因为可能频繁变化）
  USER_STATUS: 1 * 60 * 1000, // 1 分钟
};

