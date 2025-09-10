'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Logo from '@/components/Logo';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '@/components/LanguageSelector';

function LoginForm() {
  const { t } = useTranslation(['auth', 'common', 'home']);
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // 避免SSR/CSR文案不一致的水合报错：首屏使用SSR语言，挂载后再切换为当前语言
  useEffect(() => {
    setMounted(true);
  }, []);

  // 处理URL参数中的消息
  useEffect(() => {
    const messageParam = searchParams.get('message');
    if (messageParam === 'signup_success') {
      setMessage('注册成功！请检查您的邮箱完成验证。');
    } else if (messageParam === 'reset_email_sent') {
      setMessage('重置密码邮件已发送，请检查您的邮箱。');
    } else if (messageParam === 'password_updated') {
      setMessage('密码更新成功！现在可以使用新密码登录。');
    }
  }, [searchParams]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await signInWithGoogle();
      if (result.error) {
        setError(result.error);
      }
    } catch (error: any) {
      setError(error.message || t('loginFailed', { ns: 'auth', defaultValue: 'Google登录失败' }));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const result = await signInWithEmail(email, password);
      
      if (result.error) {
        setError(result.error);
        // 针对未验证邮箱的提示（基于常见提示关键字）
        const lower = result.error.toLowerCase();
        if (lower.includes('email') && (lower.includes('not confirmed') || lower.includes('not verified') || lower.includes('verify'))) {
          setMessage('检测到邮箱尚未验证，您可以点击下方按钮重发验证邮件。');
        }
      } else {
        // 登录成功，跳转到内容页面
        router.push('/content');
      }
    } catch (error: any) {
      setError(error.message || t('loginFailed', { ns: 'auth', defaultValue: '登录失败' }));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const { resendVerificationEmail } = require('@/hooks/useAuth').useAuth();
      const res = await resendVerificationEmail(email);
      setMessage(res.error ? res.error : (res.message || '验证邮件已重发'));
    } catch (e: any) {
      setMessage('重发失败，请稍后重试');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-8" suppressHydrationWarning>
      <button onClick={() => router.push('/')} className="absolute left-8 top-8 text-gray-400 hover:text-black text-sm">← {mounted ? t('home', { ns: 'navigation', defaultValue: 'Home' }) : 'Home'}</button>
      
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8 flex flex-col gap-6">
        <div className="text-center mb-2">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Logo size="md" />
            <LanguageSelector variant="button" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{mounted ? t('login', { ns: 'auth', defaultValue: 'Login' }) : 'Login'}</h1>
          <p className="text-gray-500 text-sm">{mounted ? t('loginWith', { ns: 'auth', defaultValue: 'Sign in with email/password or Google' }) : 'Sign in with email/password or Google'}</p>
        </div>
        
        <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
          <div>
            <input
              type="email"
              id="email"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              placeholder={mounted ? t('email', { ns: 'auth', defaultValue: 'Email' }) : 'Email'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div>
            <input
              type="password"
              id="password"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              placeholder={mounted ? t('password', { ns: 'auth', defaultValue: 'Password' }) : 'Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 rounded-full bg-black text-white font-medium shadow hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {mounted ? (loading ? t('loggingIn', { ns: 'auth', defaultValue: 'Logging in...' }) : t('login', { ns: 'auth', defaultValue: 'Login' })) : (loading ? 'Logging in...' : 'Login')}
          </button>
        </form>
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">{mounted ? t('or', { ns: 'common', defaultValue: 'or' }) : 'or'}</span>
          </div>
        </div>
        
        <button
          onClick={handleGoogleLogin}
          className="w-full py-2 px-4 rounded-full border border-gray-300 bg-white text-gray-700 font-medium shadow hover:bg-gray-50 transition flex items-center justify-center gap-2"
          disabled={loading}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {mounted ? t('loginWithGoogle', { ns: 'auth', defaultValue: 'Sign in with Google' }) : 'Sign in with Google'}
        </button>
        
        <div className="flex justify-between text-sm">
          <button 
            onClick={() => router.push('/signup')}
            className="text-black hover:underline font-medium"
          >
            {mounted ? t('signup', { ns: 'auth', defaultValue: 'Create account' }) : 'Create account'}
          </button>
          <button 
            onClick={() => router.push('/auth/forgot')}
            className="text-gray-500 hover:text-black"
          >
            {mounted ? t('forgotPassword', { ns: 'auth', defaultValue: 'Forgot password?' }) : 'Forgot password?'}
          </button>
        </div>
        
        {error && (
          <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}
        
        {message && (
          <div className="text-green-600 text-sm text-center bg-green-50 p-3 rounded-lg">
            {message}
          </div>
        )}
        {message.includes('未验证') && (
          <button
            onClick={handleResend}
            className="w-full mt-2 py-2 px-4 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            disabled={loading || !email}
          >
            {mounted ? t('resendVerification', { ns: 'auth', defaultValue: 'Resend verification email' }) : 'Resend verification email'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-8">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8 flex flex-col gap-6">
          <div className="text-center mb-2">
            <Logo size="md" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">登录</h1>
            <p className="text-gray-500 text-sm">加载中...</p>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
} 