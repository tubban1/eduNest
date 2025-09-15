"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { enforceSingleAccount, detectSessionConflict, clearAllSessions } from '@/utils/sessionManager';

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
      console.log('尝试重发验证邮件到:', email);
      console.log('重定向URL:', `${window.location.origin}/auth/callback`);
      
      // 注意：admin API 需要服务端权限，前端无法直接调用
      // 这里暂时跳过用户状态检查，直接尝试重发邮件
      console.log('准备重发验证邮件，跳过用户状态检查（前端无法访问admin API）');
      
      // 记录重发与注册的差异
      console.log('重发邮件与注册邮件的差异：');
      console.log('- 注册使用: supabase.auth.signUp()');
      console.log('- 重发使用: supabase.auth.resend()');
      console.log('- 重发响应: {user: null, session: null}');
      console.log('- 注册响应: {user: {...}, session: null 或 {...}}');
      
      // 尝试多种方式重发邮件
      let lastError = null;
      
      // 方式1: 使用 signup 类型
      const { data: data1, error: error1 } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { 
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      console.log('方式1 - signup类型响应:', { data: data1, error: error1 });
      
      if (!error1) {
        console.log('邮件重发成功（方式1），响应数据:', data1);
        return { error: null };
      }
      
      lastError = error1;
      console.log('方式1失败，尝试方式2...');
      
      // 方式2: 使用 email_change 类型
      const { data: data2, error: error2 } = await supabase.auth.resend({
        type: 'email_change',
        email,
        options: { 
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      console.log('方式2 - 自动类型响应:', { data: data2, error: error2 });
      
      if (!error2) {
        console.log('邮件重发成功（方式2），响应数据:', data2);
        return { error: null };
      }
      
      lastError = error2;
      console.log('方式2也失败，尝试方式3...');
      
      // 方式3: 使用 signup 类型但不指定重定向URL
      const { data: data3, error: error3 } = await supabase.auth.resend({
        type: 'signup',
        email
      });
      
      console.log('方式3 - 无重定向URL响应:', { data: data3, error: error3 });
      
      if (!error3) {
        console.log('邮件重发成功（方式3），响应数据:', data3);
        return { error: null };
      }
      
      // 所有方式都失败了
      console.error('所有重发方式都失败，最后错误:', error3);
      return { 
        error: `重发失败: ${error3.message || '未知错误'}。请检查邮箱是否已注册，或稍后重试。如果问题持续，请联系管理员。` 
      };
      
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