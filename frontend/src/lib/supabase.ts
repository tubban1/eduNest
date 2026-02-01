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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,        // 启用自动刷新
    persistSession: true,          // 持久化session
    detectSessionInUrl: true,      // 检测URL中的session
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'sb-zayoczhybuegvtpcsgso-auth-token',
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