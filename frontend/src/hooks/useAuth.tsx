"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 检查用户认证状态
  const checkAuthStatus = async () => {
    try {
      const sessionStr = localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token');
      
      if (!sessionStr) {
        setUser(null);
        setLoading(false);
        // 清除 API 客户端的 token
        api.clearToken();
        return;
      }

      const session = JSON.parse(sessionStr);
      
      if (!session.access_token) {
        localStorage.removeItem('sb-zayoczhybuegvtpcsgso-auth-token');
        setUser(null);
        setLoading(false);
        // 清除 API 客户端的 token
        api.clearToken();
        return;
      }

      // 验证token并获取用户信息
      const response = await fetch('https://zayoczhybuegvtpcsgso.supabase.co/auth/v1/user', {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        localStorage.removeItem('sb-zayoczhybuegvtpcsgso-auth-token');
        setUser(null);
        setLoading(false);
        // 清除 API 客户端的 token
        api.clearToken();
        return;
      }

      const userData = await response.json();

      // 获取用户角色信息
      const roleResponse = await fetch(`https://zayoczhybuegvtpcsgso.supabase.co/rest/v1/users?id=eq.${userData.id}&select=role`, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      let role = 'user';
      if (roleResponse.ok) {
        const roleData = await roleResponse.json();
        role = roleData[0]?.role || 'user';
      }

      const authUser: AuthUser = {
        id: userData.id,
        email: userData.email,
        name: userData.user_metadata?.full_name || userData.user_metadata?.name,
        avatar_url: userData.user_metadata?.avatar_url,
        role: role
      };

      setUser(authUser);
      
      // 重要：同步设置 API 客户端的 token
      api.setToken(session.access_token);

    } catch (error: any) {
      localStorage.removeItem('sb-zayoczhybuegvtpcsgso-auth-token');
      setUser(null);
      // 清除 API 客户端的 token
      api.clearToken();
    } finally {
      setLoading(false);
    }
  };

  // 监听 localStorage 变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sb-zayoczhybuegvtpcsgso-auth-token') {
        if (e.newValue) {
          // 有新的 session，重新检查
          checkAuthStatus();
        } else {
          // session 被清除，清除用户状态
          setUser(null);
          api.clearToken();
        }
      }
    };

    // 监听其他标签页的 localStorage 变化
    window.addEventListener('storage', handleStorageChange);

    // 监听当前页面的 localStorage 变化（通过自定义事件）
    const handleCustomStorageChange = () => {
      checkAuthStatus();
    };

    window.addEventListener('sessionChanged', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sessionChanged', handleCustomStorageChange);
    };
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // 邮箱密码登录
  const signInWithEmail = async (email: string, password: string) => {
    try {
      const response = await fetch('https://zayoczhybuegvtpcsgso.supabase.co/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { error: errorData.error_description || '登录失败' };
      }

      const loginData = await response.json();

      // 保存session
      const sessionData = {
        access_token: loginData.access_token,
        refresh_token: loginData.refresh_token,
        expires_in: loginData.expires_in,
        expires_at: loginData.expires_at,
        token_type: loginData.token_type
      };
      localStorage.setItem('sb-zayoczhybuegvtpcsgso-auth-token', JSON.stringify(sessionData));

      // 重新检查认证状态
      await checkAuthStatus();

      return { error: null };
    } catch (error: any) {
      return { error: error.message || '登录失败' };
    }
  };

  // Google登录
  const signInWithGoogle = async () => {
    try {
      const oauthUrl = `https://zayoczhybuegvtpcsgso.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.origin + '/auth/callback')}`;
      
      window.location.href = oauthUrl;
      
      return { error: null };
    } catch (error: any) {
      return { error: error.message || '登录失败' };
    }
  };

  // 退出登录
  const signOut = async () => {
    try {
      const sessionStr = localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        
        // 调用退出登录API
        try {
          await fetch('https://zayoczhybuegvtpcsgso.supabase.co/auth/v1/logout', {
            method: 'POST',
            headers: {
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              'Authorization': `Bearer ${session.access_token}`
            }
          });
        } catch (error) {
          // 静默处理退出登录API调用失败
        }
      }
      
      // 清除本地数据
      localStorage.removeItem('sb-zayoczhybuegvtpcsgso-auth-token');
      setUser(null);
      // 清除 API 客户端的 token
      api.clearToken();
      
      return { error: null };
    } catch (error: any) {
      // 即使API调用失败，也要清除本地数据
      localStorage.removeItem('sb-zayoczhybuegvtpcsgso-auth-token');
      setUser(null);
      // 清除 API 客户端的 token
      api.clearToken();
      
      return { error: error.message || '退出登录失败' };
    }
  };

  const value = {
    user,
    loading,
    signInWithEmail,
    signInWithGoogle,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 