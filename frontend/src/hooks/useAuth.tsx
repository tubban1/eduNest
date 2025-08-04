"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
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
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setUser({
            id: user.id,
            email: user.email!,
            name: user.user_metadata?.full_name || user.user_metadata?.name,
            avatar_url: user.user_metadata?.avatar_url
          });
          
          // 获取Supabase session token并设置到API客户端
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            //console.log('设置API token:', session.access_token.substring(0, 20) + '...');
            api.setToken(session.access_token);
          }
        } else {
          setUser(null);
        }
      } catch (error: any) {
        console.error('认证错误:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        //console.log('认证状态变化:', event, session?.user?.email);

        if (event === 'SIGNED_IN' && session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
            avatar_url: session.user.user_metadata?.avatar_url
          });
          
          // 设置API token
          if (session.access_token) {
            //console.log('设置API token:', session.access_token.substring(0, 20) + '...');
            api.setToken(session.access_token);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          api.clearToken();
        }
        
        setLoading(false);
      }
    );

    getCurrentUser();

    return () => subscription.unsubscribe();
  }, []);

  // 自动跳转到登录页
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (error) {
        console.error('Google登录失败:', error);
        return { error: error.message };
      }
      
      return { error: null };
    } catch (error: any) {
      console.error('Google登录错误:', error);
      return { error: error.message || '登录失败' };
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('登出失败:', error);
        return { error: error.message };
      }
      
      setUser(null);
      api.clearToken();
      return { error: null };
    } catch (error: any) {
      console.error('登出错误:', error);
      return { error: error.message || '登出失败' };
    }
  }

  const value = {
    user,
    loading,
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