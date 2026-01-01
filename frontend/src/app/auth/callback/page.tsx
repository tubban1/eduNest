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
        await api.logAuth('info', '开始处理认证回调', { url: window.location.href });

        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const errorDesc = url.searchParams.get('error_description') || url.searchParams.get('error');

        // 1) 优先处理 PKCE code flow
        if (errorDesc) {
          await api.logAuth('error', 'OAuth 回调包含错误', { error: errorDesc });
          setStatus(t('callback.authFailed', { defaultValue: '认证失败' }) + ': ' + errorDesc);
          setTimeout(() => {
            router.replace('/login?error=oauth_error');
          }, 1500);
          return;
        }

        if (code) {
          // 通过 Supabase 交换 code 为 session
          await api.logAuth('info', '开始处理 OAuth callback，收到 code');
          const { error, data } = await supabase.auth.exchangeCodeForSession(window.location.href);
          
          if (error) {
            await api.logAuth('error', 'exchangeCodeForSession 错误', { error: error.message, code: error.code });
            setStatus(t('callback.authFailedExchange', { defaultValue: '认证失败: 无法交换会话' }) + ': ' + error.message);
            setTimeout(() => {
              router.replace('/login?error=exchange_failed');
            }, 1500);
            return;
          }

          // 检查返回的数据结构
          if (!data || !data.session) {
            await api.logAuth('error', 'exchangeCodeForSession 返回数据无效', { hasData: !!data, hasSession: !!(data?.session) });
            // 尝试从 localStorage 获取 session
            let accessToken = '';
            let retries = 0;
            const maxRetries = 5; // 增加重试次数
            while (!accessToken && retries < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 300)); // 增加等待时间到300ms
              const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
              
              if (sessionError) {
                await api.logAuth('warn', `getSession 重试 ${retries + 1}/${maxRetries} 失败`, { error: sessionError.message });
              }
              
              if (!sessionError && sessionData?.session?.access_token) {
                accessToken = sessionData.session.access_token;
                await api.logAuth('info', '从 getSession 获取到 token', { retryCount: retries + 1 });
                break;
              }
              retries++;
            }
            
            if (!accessToken) {
              await api.logAuth('error', '所有重试后仍无法获取 access_token', { maxRetries });
              setStatus(t('callback.authFailedEmptySession', { defaultValue: '认证失败: 会话为空' }));
              setTimeout(() => {
                router.replace('/login?error=no_session');
              }, 1500);
              return;
            }
            
            // 同步API客户端token
            api.setToken(accessToken);
            window.dispatchEvent(new Event('sessionChanged'));
            
            // 等待确保 session 已完全设置
            await new Promise(resolve => setTimeout(resolve, 200));
            
            setStatus(t('callback.loginSuccessRedirecting', { defaultValue: '登录成功，正在跳转...' }));
            await api.logAuth('info', '登录成功，准备跳转（通过 getSession 获取 token）');
            setTimeout(() => {
              router.replace('/c');
            }, 800);
            return;
          }

          // 优先使用 exchangeCodeForSession 返回的 session
          let accessToken = data.session.access_token || '';
          
          // 如果返回的 session 没有 token，等待并重试获取（最多5次，每次等待300ms）
          if (!accessToken) {
            await api.logAuth('warn', 'exchangeCodeForSession 返回的 session 没有 access_token，开始重试');
            let retries = 0;
            const maxRetries = 5;
            while (!accessToken && retries < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 300));
              const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
              
              if (sessionError) {
                await api.logAuth('warn', `getSession 重试 ${retries + 1}/${maxRetries} 失败`, { error: sessionError.message });
              }
              
              if (!sessionError && sessionData?.session?.access_token) {
                accessToken = sessionData.session.access_token;
                await api.logAuth('info', '从 getSession 获取到 token', { retryCount: retries + 1 });
                break;
              }
              retries++;
            }
          } else {
            await api.logAuth('info', '从 exchangeCodeForSession 直接获取到 token');
          }

          if (!accessToken) {
            await api.logAuth('error', '所有重试后仍无法获取 access_token', { maxRetries: 5 });
            setStatus(t('callback.authFailedEmptySession', { defaultValue: '认证失败: 会话为空' }));
            setTimeout(() => {
              router.replace('/login?error=no_session');
            }, 1500);
            return;
          }

          // 同步API客户端token
          api.setToken(accessToken);
          window.dispatchEvent(new Event('sessionChanged'));
          
          // 等待确保 session 已完全设置到 localStorage
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // 验证 session 是否已正确设置到 Supabase
          const { data: verifySession, error: verifyError } = await supabase.auth.getSession();
          if (verifyError || !verifySession?.session?.access_token) {
            await api.logAuth('warn', 'session 验证失败，但继续跳转', { error: verifyError?.message });
          } else {
            await api.logAuth('info', 'session 验证成功');
          }
          
          setStatus(t('callback.loginSuccessRedirecting', { defaultValue: '登录成功，正在跳转...' }));
          // 使用 router.replace 而不是 window.location.href，更可靠
          setTimeout(() => {
            router.replace('/c');
          }, 800);
          return;
        }

        // 2) 兼容旧的 hash fragment 流程（#access_token=...）
        await api.logAuth('info', '处理旧的 hash fragment 流程');
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token') || '';

        if (!accessToken) {
          await api.logAuth('error', 'hash fragment 流程中未找到 access_token');
          setStatus(t('callback.authFailedNoToken', { defaultValue: '认证失败: 未找到访问令牌' }));
          setTimeout(() => {
            router.replace('/login?error=no_token');
          }, 1500);
          return;
        }

        // 新增：没有refresh_token则不建立不可续期会话
        if (!refreshToken) {
          await api.logAuth('error', 'hash fragment 流程中缺少 refresh_token');
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
          await api.logAuth('error', 'setSession 失败', { error: setErr.message });
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
          await api.logAuth('error', 'getUser 失败', { error: userErr?.message });
          setStatus(t('callback.authFailedUserInfo', { defaultValue: '认证失败: 无法获取用户信息' }));
          setTimeout(() => {
            router.replace('/login?error=user_fetch_failed');
          }, 1500);
          return;
        }

        // 同步设置 API 客户端的 token
        api.setToken(accessToken);
        window.dispatchEvent(new Event('sessionChanged'));
        await api.logAuth('info', 'hash fragment 流程登录成功', { userId: userRes.user.id });

        setStatus(t('callback.loginSuccessRedirecting', { defaultValue: '登录成功，正在跳转...' }));
        // 使用 router.replace 而不是 window.location.href，更可靠
        setTimeout(() => {
          router.replace('/c');
        }, 800);
      } catch (error) {
        const errorMessage = (error as Error).message || '未知错误';
        await api.logAuth('error', '处理登录时发生异常', { error: errorMessage, stack: (error as Error).stack });
        setStatus(t('callback.errorOccurred', { defaultValue: '处理登录时出错' }) + ': ' + errorMessage);
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