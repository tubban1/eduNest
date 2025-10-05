"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { enforceSingleAccount, detectSessionConflict, clearAllSessions } from '@/utils/sessionManager';
import { tokenMonitor } from '@/utils/tokenMonitor';

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
  resendVerificationEmail: (email: string) => Promise<{ error: string | null; message?: string }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 检查用户认证状态 - 简化版本，依赖Supabase自动刷新
  const checkAuthStatus = async () => {
    try {
      // 使用Supabase的getSession方法，它会自动处理token刷新
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session check error:', error);
        setUser(null);
        setLoading(false);
        api.clearToken();
        return;
      }

      if (!session) {
        setUser(null);
        setLoading(false);
        api.clearToken();
        return;
      }

      // 注入 API 客户端令牌
      api.setToken(session.access_token);

      // 获取用户信息
      const userData = session.user;

      // 获取用户角色信息
      let role = 'user';
      try {
      const roleResponse = await fetch(`https://zayoczhybuegvtpcsgso.supabase.co/rest/v1/users?id=eq.${userData.id}&select=role`, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (roleResponse.ok) {
        const roleData = await roleResponse.json();
        role = roleData?.[0]?.role || 'user';
        }
      } catch (roleError) {
        console.warn('Failed to get user role:', roleError);
      }

      const authUser: AuthUser = {
        id: userData.id,
        email: userData.email || '',
        name: userData.user_metadata?.name,
        avatar_url: userData.user_metadata?.avatar_url,
        role,
      };
      setUser(authUser);
      
      // 首次有效登录奖励发放（仅一次）
      try {
        const rewardedKey = `ref_rewarded_${authUser.id}`;
        const already = localStorage.getItem(rewardedKey);
        if (!already) {
          const pendingCode = localStorage.getItem('pending_ref_code') || undefined;
          // 调用推荐奖励API，后端会检查是否已发放
          const response = await api.post('/referrals/reward', { code: pendingCode });
          if (response.success) {
            // 标记为已处理，无论是否实际发放了积分
            localStorage.setItem(rewardedKey, '1');
            if (pendingCode) localStorage.removeItem('pending_ref_code');
          }
        }
      } catch (e) {
        // 静默失败，不影响登录流程
        console.warn('推荐奖励发放失败:', e);
      }
      setLoading(false);
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
      setLoading(false);
      api.clearToken();
    }
  };

  useEffect(() => {
    // 检测并处理session冲突
    const handleSessionConflict = async () => {
      if (detectSessionConflict()) {
        console.warn('Session conflict detected, enforcing single account...');
        await enforceSingleAccount();
      }
    };

    handleSessionConflict();
    checkAuthStatus();
    
    // 启动token监控（每1分钟检查一次）
    tokenMonitor.startMonitoring(60 * 1000);

    // 页面可见时，主动触发一次会话刷新
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        try {
          await supabase.auth.getSession();
        } catch (e) {
          // 忽略
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // 监听会话变化，实时注入/清除 token
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // 登录成功或token自动刷新成功
      if (session?.access_token) {
        // 新session创建时，强制清除冲突session
        await enforceSingleAccount();
        api.setToken(session.access_token);
          
          // 获取用户信息并设置状态
          try {
            const userData = await fetch('https://zayoczhybuegvtpcsgso.supabase.co/auth/v1/user', {
              headers: {
                'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
                'Authorization': `Bearer ${session.access_token}`
              }
            });
            
            if (userData.ok) {
              const user = await userData.json();
              
              // 获取用户角色信息
              const roleResponse = await fetch(`https://zayoczhybuegvtpcsgso.supabase.co/rest/v1/users?id=eq.${user.id}&select=role`, {
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

              const authUser = {
                id: user.id,
                email: user.email || '',
                name: user.user_metadata?.name,
                avatar_url: user.user_metadata?.avatar_url,
                role,
              };
              setUser(authUser);
              setLoading(false);
            }
          } catch (error) {
            console.error('Failed to get user info after auth state change:', error);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        // 登出或刷新失败
        
        // 清除所有可能的session存储
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.includes('sb-') && key.includes('-auth-token')) {
            localStorage.removeItem(key);
          }
        });
        
        const sessionKeys = Object.keys(sessionStorage);
        sessionKeys.forEach(key => {
          if (key.includes('sb-') && key.includes('-auth-token')) {
            sessionStorage.removeItem(key);
          }
        });
        
        setUser(null);
        setLoading(false);
        api.clearToken();
        
        // 只有在非登录页面时才重定向
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      // 停止token监控
      tokenMonitor.stopMonitoring();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      // 登录前强制清除所有可能的冲突session
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('sb-') && key.includes('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
      
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(key => {
        if (key.includes('sb-') && key.includes('-auth-token')) {
          sessionStorage.removeItem(key);
        }
      });
      
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
      // 登录前强制清除所有可能的冲突session
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('sb-') && key.includes('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
      
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(key => {
        if (key.includes('sb-') && key.includes('-auth-token')) {
          sessionStorage.removeItem(key);
        }
      });
      
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
      // 注册前强制清除所有可能的冲突session
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('sb-') && key.includes('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
      
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(key => {
        if (key.includes('sb-') && key.includes('-auth-token')) {
          sessionStorage.removeItem(key);
        }
      });
      
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

  const resendVerificationEmail = async (email: string) => {
    try {
      
      // 根据Supabase官方文档，重发验证邮件需要重新调用signUp
      // 对于已存在的用户，Supabase会重新发送验证邮件
      const { data, error } = await supabase.auth.signUp({
        email,
        password: 'temporary_password_for_resend', // 临时密码，仅用于重发
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      
      if (error) {
        console.error('重发邮件错误:', error);
        
        // 检查是否是用户已存在的错误（这通常是正常的）
        if (error.message.includes('already registered') || 
            error.message.includes('already been registered') ||
            error.message.includes('User already registered') ||
            error.message.includes('already signed up')) {
          return { error: null };
        }
        
        return { error: error.message };
      }
      
      
      return { error: null };
      
    } catch (e: any) {
      console.error('重发邮件异常:', e);
      return { error: e.message || '重发验证邮件失败' };
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
      
      // 强制清除所有可能的session存储
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('sb-') && key.includes('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
      
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(key => {
        if (key.includes('sb-') && key.includes('-auth-token')) {
          sessionStorage.removeItem(key);
        }
      });
      
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
      resendVerificationEmail,
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