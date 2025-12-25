'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const { t, ready } = useTranslation('auth');
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState('');

  // 避免 SSR/CSR 文案不一致的水合报错：首屏使用固定文本，挂载后再切换为翻译
  useEffect(() => {
    setMounted(true);
  }, []);

  // 当翻译准备好后，设置初始状态
  useEffect(() => {
    if (mounted && ready && status === '') {
      setStatus(t('callback.processing', { defaultValue: '处理中...' }));
    }
  }, [mounted, ready, t]);

  useEffect(() => {
    if (!mounted || !ready) {
      return;
    }

    const handleAuthCallback = async () => {
      try {
        setStatus(t('callback.verifyingLogin', { defaultValue: '正在验证登录状态...' }));

        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const errorDesc = url.searchParams.get('error_description') || url.searchParams.get('error');

        // 1) 优先处理 PKCE code flow
        if (errorDesc) {
          setStatus(t('callback.authFailed', { defaultValue: '认证失败' }) + ': ' + errorDesc);
          setTimeout(() => {
            router.replace('/login?error=oauth_error');
          }, 1500);
          return;
        }

        if (code) {
          // 通过 Supabase 交换 code 为 session
          const { error, data } = await supabase.auth.exchangeCodeForSession(window.location.href);
          
          if (error) {
            setStatus(t('callback.authFailedExchange', { defaultValue: '认证失败: 无法交换会话' }));
            setTimeout(() => {
              router.replace('/login?error=exchange_failed');
            }, 1500);
            return;
          }

          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

          if (sessionError) {
            setStatus(t('callback.authFailedSession', { defaultValue: '认证失败: 获取会话失败' }));
            setTimeout(() => {
              router.replace('/login?error=session_failed');
            }, 1500);
            return;
          }

          const accessToken = sessionData.session?.access_token || '';
          if (!accessToken) {
            setStatus(t('callback.authFailedEmptySession', { defaultValue: '认证失败: 会话为空' }));
            setTimeout(() => {
              router.replace('/login?error=no_session');
            }, 1500);
            return;
          }

          // 同步API客户端token
          api.setToken(accessToken);
          window.dispatchEvent(new Event('sessionChanged'));
          setStatus(t('callback.loginSuccessRedirecting', { defaultValue: '登录成功，正在跳转...' }));
          // 使用 router.replace 而不是 window.location.href，更可靠
          setTimeout(() => {
            router.replace('/c');
          }, 800);
          return;
        }

        // 2) 兼容旧的 hash fragment 流程（#access_token=...）
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token') || '';

        if (!accessToken) {
          setStatus(t('callback.authFailedNoToken', { defaultValue: '认证失败: 未找到访问令牌' }));
          setTimeout(() => {
            router.replace('/login?error=no_token');
          }, 1500);
          return;
        }

        // 新增：没有refresh_token则不建立不可续期会话
        if (!refreshToken) {
          setStatus(t('callback.authFailedMissingRefresh', { defaultValue: '认证失败: 缺少刷新令牌' }));
          setTimeout(() => {
            router.replace('/login?error=missing_refresh_token');
          }, 1500);
          return;
        }

        // 设置 Supabase 会话
        const { error: setErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        if (setErr) {
          setStatus(t('callback.authFailedSetSession', { defaultValue: '认证失败: 无法建立会话' }));
          setTimeout(() => {
            router.replace('/login?error=set_session_failed');
          }, 1500);
          return;
        }

        // 获取用户信息
        setStatus(t('callback.verifyingLogin', { defaultValue: '正在验证登录状态...' }));
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes?.user) {
          setStatus(t('callback.authFailedUserInfo', { defaultValue: '认证失败: 无法获取用户信息' }));
          setTimeout(() => {
            router.replace('/login?error=user_fetch_failed');
          }, 1500);
          return;
        }

        // 同步设置 API 客户端的 token
        api.setToken(accessToken);
        window.dispatchEvent(new Event('sessionChanged'));

        setStatus(t('callback.loginSuccessRedirecting', { defaultValue: '登录成功，正在跳转...' }));
        // 使用 router.replace 而不是 window.location.href，更可靠
        setTimeout(() => {
          router.replace('/c');
        }, 800);
      } catch (error) {
        setStatus(t('callback.errorOccurred', { defaultValue: '处理登录时出错' }) + ': ' + (error as Error).message);
        setTimeout(() => {
          router.replace('/login?error=callback_failed');
        }, 1500);
      }
    };

    handleAuthCallback();
  }, [router, t, ready, mounted]);

  // 在挂载前显示固定文本，避免 hydration 错误
  // 使用通用的 "Processing..." 作为初始文本，避免语言不一致
  // 一旦翻译准备好，就使用翻译后的文本
  const displayStatus = status || (mounted && ready ? t('callback.processing', { defaultValue: '处理中...' }) : 'Processing...');
  const displayWaitText = mounted && ready ? t('callback.pleaseWait', { defaultValue: '请稍候...' }) : 'Please wait...';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
        <p className="text-gray-600">{displayStatus}</p>
        <p className="text-gray-400 text-sm mt-2">{displayWaitText}</p>
      </div>
    </div>
  );
} 