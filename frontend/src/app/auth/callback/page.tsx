'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('处理中...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setStatus('正在验证登录状态...');

        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const errorDesc = url.searchParams.get('error_description') || url.searchParams.get('error');

        // 1) 优先处理 PKCE code flow
        if (errorDesc) {
          setStatus('认证失败: ' + errorDesc);
          setTimeout(() => router.push('/login?error=oauth_error'), 1500);
          return;
        }

        if (code) {
          // 通过 Supabase 交换 code 为 session
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) {
            setStatus('认证失败: 无法交换会话');
            setTimeout(() => router.push('/login?error=exchange_failed'), 1500);
            return;
          }
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token || '';
          if (!accessToken) {
            setStatus('认证失败: 会话为空');
            setTimeout(() => router.push('/login?error=no_session'), 1500);
            return;
          }
          // 同步API客户端token
          api.setToken(accessToken);
          window.dispatchEvent(new Event('sessionChanged'));
          setStatus('登录成功，正在跳转...');
          setTimeout(() => { window.location.href = '/content'; }, 800);
          return;
        }

        // 2) 兼容旧的 hash fragment 流程（#access_token=...）
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token') || '';

        if (!accessToken) {
          setStatus('认证失败: 未找到访问令牌');
          setTimeout(() => { router.push('/login?error=no_token'); }, 1500);
          return;
        }

        // 设置 Supabase 会话
        const { error: setErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        if (setErr) {
          setStatus('认证失败: 无法建立会话');
          setTimeout(() => router.push('/login?error=set_session_failed'), 1500);
          return;
        }

        // 获取用户信息
        setStatus('正在获取用户信息...');
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes?.user) {
          setStatus('认证失败: 无法获取用户信息');
          setTimeout(() => router.push('/login?error=user_fetch_failed'), 1500);
          return;
        }

        // 同步设置 API 客户端的 token
        api.setToken(accessToken);
        window.dispatchEvent(new Event('sessionChanged'));

        setStatus('登录成功，正在跳转...');
        setTimeout(() => { window.location.href = '/content'; }, 800);
      } catch (error) {
        setStatus('处理登录时出错: ' + (error as Error).message);
        setTimeout(() => { router.push('/login?error=callback_failed'); }, 1500);
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
        <p className="text-gray-600">{status}</p>
        <p className="text-gray-400 text-sm mt-2">请稍候...</p>
      </div>
    </div>
  );
} 