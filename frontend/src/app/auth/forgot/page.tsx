'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Logo from '@/components/Logo';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '@/components/LanguageSelector';

export default function ForgotPasswordPage() {
  const { t } = useTranslation(['auth', 'common', 'home']);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { sendResetPasswordEmail } = useAuth();
  const router = useRouter();

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const result = await sendResetPasswordEmail(email);
      
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login?message=reset_email_sent');
        }, 5000);
      }
    } catch (error: any) {
      setError(error.message || '发送重置邮件失败');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-8">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">重置邮件已发送</h1>
          <p className="text-gray-600 text-sm mb-4">
            我们已向 <strong>{email}</strong> 发送了重置密码邮件。
          </p>
          <p className="text-gray-500 text-xs">
            请检查您的邮箱，点击邮件中的链接来重置密码。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-8">
      <button onClick={() => router.push('/login')} className="absolute left-8 top-8 text-gray-400 hover:text-black text-sm">← 返回登录</button>
      
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8 flex flex-col gap-6">
        <div className="text-center mb-2">
          <Logo size="md" />
          <LanguageSelector variant="button" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">忘记密码</h1>
          <p className="text-gray-500 text-sm">输入您的邮箱，我们将发送重置密码链接</p>
        </div>
        
        <form onSubmit={handleSendResetEmail} className="space-y-4">
          <div>
            <input
              type="email"
              id="email"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="请输入您的邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 rounded-full bg-black text-white font-medium shadow hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? '发送中...' : '发送重置邮件'}
          </button>
        </form>
        
        <div className="text-center">
          <p className="text-gray-500 text-sm">
            想起密码了？{' '}
            <button 
              onClick={() => router.push('/login')}
              className="text-black hover:underline font-medium"
            >
              立即登录
            </button>
          </p>
        </div>
        
        {error && (
          <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
