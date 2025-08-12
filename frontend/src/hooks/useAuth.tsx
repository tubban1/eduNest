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
      console.log('检查session:', sessionStr ? '存在' : '不存在');
      console.log('Session内容:', sessionStr);
      
      if (!sessionStr) {
        console.log('没有session，设置用户为null');
        setUser(null);
        setLoading(false);
        return;
      }

      const session = JSON.parse(sessionStr);
      console.log('解析的session:', session);
      
      if (!session.access_token) {
        console.log('session中没有access_token，清除session');
        localStorage.removeItem('sb-zayoczhybuegvtpcsgso-auth-token');
        setUser(null);
        setLoading(false);
        return;
      }

      console.log('开始验证token...');
      // 验证token并获取用户信息
      const response = await fetch('https://zayoczhybuegvtpcsgso.supabase.co/auth/v1/user', {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      console.log('Token验证响应状态:', response.status);
      console.log('Token验证响应:', response);

      if (!response.ok) {
        console.log('Token验证失败，清除session');
        localStorage.removeItem('sb-zayoczhybuegvtpcsgso-auth-token');
        setUser(null);
        setLoading(false);
        return;
      }

      const userData = await response.json();
      console.log('用户验证成功:', userData.email);
      console.log('完整用户数据:', userData);

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
        console.log('用户角色:', role);
      }

      const authUser: AuthUser = {
        id: userData.id,
        email: userData.email,
        name: userData.user_metadata?.full_name || userData.user_metadata?.name,
        avatar_url: userData.user_metadata?.avatar_url,
        role: role
      };

      console.log('设置用户状态:', authUser);
      setUser(authUser);
      api.setToken(session.access_token);
      console.log('用户状态已设置');

    } catch (error: any) {
      console.error('认证检查错误:', error);
      localStorage.removeItem('sb-zayoczhybuegvtpcsgso-auth-token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // 邮箱密码登录
  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log('开始邮箱登录...');
      console.log('登录邮箱:', email);
      
      const response = await fetch('https://zayoczhybuegvtpcsgso.supabase.co/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      console.log('登录响应状态:', response.status);
      console.log('登录响应:', response);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('登录失败:', errorData);
        return { error: errorData.error_description || '登录失败' };
      }

      const loginData = await response.json();
      console.log('登录成功，获取到的数据:', loginData);
      console.log('保存session');

      // 保存session
      const sessionData = {
        access_token: loginData.access_token,
        refresh_token: loginData.refresh_token,
        expires_in: loginData.expires_in,
        expires_at: loginData.expires_at,
        token_type: loginData.token_type
      };
      console.log('要保存的session数据:', sessionData);
      localStorage.setItem('sb-zayoczhybuegvtpcsgso-auth-token', JSON.stringify(sessionData));
      console.log('Session已保存到localStorage');

      // 重新检查认证状态
      console.log('重新检查认证状态...');
      await checkAuthStatus();

      return { error: null };
    } catch (error: any) {
      console.error('邮箱登录错误:', error);
      return { error: error.message || '登录失败' };
    }
  };

  // Google登录
  const signInWithGoogle = async () => {
    try {
      console.log('开始Google登录流程...');
      
      const oauthUrl = `https://zayoczhybuegvtpcsgso.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.origin + '/auth/callback')}`;
      
      console.log('跳转到Google OAuth:', oauthUrl);
      window.location.href = oauthUrl;
      
      return { error: null };
    } catch (error: any) {
      console.error('Google登录错误:', error);
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
          console.warn('退出登录API调用失败:', error);
        }
      }
      
      // 清除本地数据
      localStorage.removeItem('sb-zayoczhybuegvtpcsgso-auth-token');
      setUser(null);
      api.clearToken();
      
      return { error: null };
    } catch (error: any) {
      console.error('退出登录错误:', error);
      
      // 即使API调用失败，也要清除本地数据
      localStorage.removeItem('sb-zayoczhybuegvtpcsgso-auth-token');
      setUser(null);
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