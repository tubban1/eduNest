import { createClient } from '@supabase/supabase-js';
import { config } from './config';

// 获取环境变量，带默认值
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (!value && !defaultValue) {
    console.error(`环境变量 ${key} 未设置`);
    throw new Error(`环境变量 ${key} 未设置`);
  }
  return value || defaultValue || '';
};

// 使用config中的值，确保有默认值
const supabaseUrl = config.SUPABASE_URL;
const supabaseAnonKey = config.SUPABASE_ANON_KEY;

// 检查配置
if (!supabaseUrl || !supabaseAnonKey) {
  if (process.env.NODE_ENV === 'development') {
    console.error('Supabase 配置无效:', {
      url: supabaseUrl,
      keyLength: supabaseAnonKey?.length || 0
    });
  }
  throw new Error('Supabase配置无效');
}

// 安全 storage：localStorage 不可用时（Android WebView 等）回退到内存，避免 session 读取失败
const STORAGE_KEY = 'sb-zayoczhybuegvtpcsgso-auth-token';
const memoryStore: Record<string, string> = {};
const safeStorage = typeof window !== 'undefined' ? {
  getItem: (key: string): string | null => {
    try {
      return window.localStorage.getItem(key) ?? memoryStore[key] ?? null;
    } catch {
      return memoryStore[key] ?? null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memoryStore[key] = value;
    }
  },
  removeItem: (key: string): void => {
    try {
      window.localStorage.removeItem(key);
    } catch { /* ignore */ }
    delete memoryStore[key];
  },
} : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,        // 启用自动刷新
    persistSession: true,          // 持久化session
    detectSessionInUrl: true,      // 检测URL中的session
    storage: safeStorage,
    storageKey: STORAGE_KEY,
    debug: false  // 关闭调试日志
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js/2.38.0'
    }
  }
});

// 认证类型
export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
};

// 认证状态
export type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}; 