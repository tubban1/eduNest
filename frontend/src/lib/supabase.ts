import { createClient } from '@supabase/supabase-js';

// 获取环境变量，带默认值
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (!value && !defaultValue) {
    console.error(`环境变量 ${key} 未设置`);
    throw new Error(`环境变量 ${key} 未设置`);
  }
  return value || defaultValue || '';
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'https://zayoczhybuegvtpcsgso.supabase.co');
const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpheW9jeWh5YnVlZ3Z0cGNzZ3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NTA1MDksImV4cCI6MjA2MzUyNjUwOX0.ptIKB-kR6q9hvQo5dYiU-wPC5EY2PQf1zidmo9w5nU8');

// 检查环境变量
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase 环境变量未配置:', {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '已设置' : '未设置'
  });
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