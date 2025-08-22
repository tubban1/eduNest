'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Logo from '@/components/Logo';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '@/components/LanguageSelector';

export default function UpdatePasswordPage() {
  const { t } = useTranslation(['auth', 'common', 'home']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { updatePassword } = useAuth();
  const router = useRouter();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('密码长度至少6位');
      setLoading(false);
      return;
    }
    
    try {
      const result = await updatePassword(newPassword);
      
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login?message=password_updated');
        }, 3000);
      }
    } catch (error: any) {
      setError(error.message || '更新密码失败');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-8">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">密码更新成功！</h1>
          <p className="text-gray-600 text-sm mb-4">
            您的密码已经成功更新，现在可以使用新密码登录了。
          </p>
          <p className="text-gray-500 text-xs">
            即将跳转到登录页面...
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">设置新密码</h1>
          <p className="text-gray-500 text-sm">请输入您的新密码</p>
        </div>
        
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <input
              type="password"
              id="newPassword"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="新密码（至少6位）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div>
            <input
              type="password"
              id="confirmPassword"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="确认新密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 rounded-full bg-black text-white font-medium shadow hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? '更新中...' : '更新密码'}
          </button>
        </form>
        
        {error && (
          <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
