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
  console.error('Supabase 配置无效:', {
    url: supabaseUrl,
    keyLength: supabaseAnonKey?.length || 0
  });
  throw new Error('Supabase配置无效');
}

// 添加调试信息
console.log('Supabase客户端配置:', {
  url: supabaseUrl,
  keyLength: supabaseAnonKey?.length || 0,
  keyPrefix: supabaseAnonKey?.substring(0, 20) + '...'
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'sb-zayoczhybuegvtpcsgso-auth-token'
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js/2.38.0'
    }
  }
});

// 添加Supabase客户端调试
console.log('Supabase客户端创建完成:', {
  hasAuth: !!supabase.auth,
  hasStorage: typeof window !== 'undefined',
  storageKey: 'sb-zayoczhybuegvtpcsgso-auth-token'
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