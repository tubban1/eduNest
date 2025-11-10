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
        console.log('=== Auth Callback Debug ===');
        console.log('Current URL:', window.location.href);

        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const errorDesc = url.searchParams.get('error_description') || url.searchParams.get('error');

        console.log('URL params:', { code: code?.substring(0, 20) + '...', errorDesc });

        // 1) 优先处理 PKCE code flow
        if (errorDesc) {
          console.error('OAuth error:', errorDesc);
          setStatus('认证失败: ' + errorDesc);
          setTimeout(() => router.push('/login?error=oauth_error'), 1500);
          return;
        }

        if (code) {
          console.log('Processing PKCE code flow...');
          // 通过 Supabase 交换 code 为 session
          const { error, data } = await supabase.auth.exchangeCodeForSession(window.location.href);
          console.log('exchangeCodeForSession result:', { error, hasData: !!data });
          
          if (error) {
            console.error('exchangeCodeForSession error:', error);
            setStatus('认证失败: 无法交换会话');
            setTimeout(() => router.push('/login?error=exchange_failed'), 1500);
            return;
          }

          console.log('Getting session...');
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          console.log('getSession result:', { 
            sessionError, 
            hasSession: !!sessionData?.session,
            hasAccessToken: !!sessionData?.session?.access_token 
          });

          if (sessionError) {
            console.error('getSession error:', sessionError);
            setStatus('认证失败: 获取会话失败');
            setTimeout(() => router.push('/login?error=session_failed'), 1500);
            return;
          }

          const accessToken = sessionData.session?.access_token || '';
          if (!accessToken) {
            console.error('No access token in session');
            setStatus('认证失败: 会话为空');
            setTimeout(() => router.push('/login?error=no_session'), 1500);
            return;
          }

          console.log('Setting API token and dispatching event...');
          // 同步API客户端token
          api.setToken(accessToken);
          window.dispatchEvent(new Event('sessionChanged'));
          setStatus('登录成功，正在跳转...');
          setTimeout(() => { window.location.href = '/c'; }, 800);
          return;
        }

        // 2) 兼容旧的 hash fragment 流程（#access_token=...）
        console.log('Falling back to hash fragment flow...');
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token') || '';

        console.log('Hash params:', { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken 
        });

        if (!accessToken) {
          console.error('No access token in hash');
          setStatus('认证失败: 未找到访问令牌');
          setTimeout(() => { router.push('/login?error=no_token'); }, 1500);
          return;
        }

        // 新增：没有refresh_token则不建立不可续期会话
        if (!refreshToken) {
          console.error('Missing refresh token in hash');
          setStatus('认证失败: 缺少刷新令牌');
          setTimeout(() => { router.push('/login?error=missing_refresh_token'); }, 1500);
          return;
        }

        // 设置 Supabase 会话
        console.log('Setting Supabase session...');
        const { error: setErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        if (setErr) {
          console.error('setSession error:', setErr);
          setStatus('认证失败: 无法建立会话');
          setTimeout(() => router.push('/login?error=set_session_failed'), 1500);
          return;
        }

        // 获取用户信息
        setStatus('正在获取用户信息...');
        console.log('Getting user info...');
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes?.user) {
          console.error('getUser error:', userErr, 'user:', userRes?.user);
          setStatus('认证失败: 无法获取用户信息');
          setTimeout(() => router.push('/login?error=user_fetch_failed'), 1500);
          return;
        }

        console.log('User info retrieved successfully');
        // 同步设置 API 客户端的 token
        api.setToken(accessToken);
        window.dispatchEvent(new Event('sessionChanged'));

        setStatus('登录成功，正在跳转...');
        setTimeout(() => { window.location.href = '/c'; }, 800);
      } catch (error) {
        console.error('Auth callback error:', error);
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