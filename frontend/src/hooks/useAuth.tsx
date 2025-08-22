"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<{ error: string | null; message?: string }>;
  sendResetPasswordEmail: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
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

      // 注入 API 客户端令牌（关键修复）
      api.setToken(session.access_token);

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
        role = roleData?.[0]?.role || 'user';
      }

      setUser({
        id: userData.id,
        email: userData.email,
        name: userData.user_metadata?.name,
        avatar_url: userData.user_metadata?.avatar_url,
        role,
      });
      setLoading(false);
    } catch (error) {
      setUser(null);
      setLoading(false);
      api.clearToken();
    }
  };

  useEffect(() => {
    checkAuthStatus();

    // 监听会话变化，实时注入/清除 token（关键修复）
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.access_token) {
        api.setToken(session.access_token);
      } else {
        api.clearToken();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      // 登录成功后刷新状态与 token
      await checkAuthStatus();
      return { error: null };
    } catch (e: any) {
      return { error: e.message || '登录失败' };
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: 'select_account' }
        }
      });
      return { error: null };
    } catch (error: any) {
      return { error: error.message || '登录失败' };
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: name ? { name } : undefined
        }
      });
      
      if (error) {
        return { error: error.message };
      }
      
      // 检查是否需要邮件确认
      if (data?.user && !data?.session) {
        return { error: null, message: '注册成功！请检查您的邮箱完成验证。' };
      }
      
      // 如果直接创建了会话（不需要邮件确认）
      if (data?.session) {
        return { error: null, message: '注册成功！您已自动登录。' };
      }
      
      return { error: null, message: '注册完成，请检查您的邮箱。' };
    } catch (e: any) {
      return { error: e.message || '注册失败' };
    }
  };

  const sendResetPasswordEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`
      });
      
      if (error) return { error: error.message };
      
      return { error: null };
    } catch (e: any) {
      return { error: e.message || '发送重置邮件失败' };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) return { error: error.message };
      
      return { error: null };
    } catch (e: any) {
      return { error: e.message || '设置新密码失败' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      api.clearToken();
      setUser(null);
      router.push('/login');
      return { error: null };
    } catch (error: any) {
      return { error: error.message || '登出失败' };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signInWithEmail, 
      signInWithGoogle, 
      signUpWithEmail,
      sendResetPasswordEmail,
      updatePassword,
      signOut 
    }}>
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