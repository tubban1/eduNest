
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Logo from '@/components/Logo';
import { api } from '@/lib/api';

function SignupPageInner() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const { signUpWithEmail } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [refCode, setRefCode] = useState<string>('');
  const [refValid, setRefValid] = useState<boolean | null>(null);
  const [refChecking, setRefChecking] = useState(false);
  const [refMessage, setRefMessage] = useState('');

  // 读取并校验邀请码（如果存在）
  useEffect(() => {
    const code = (searchParams?.get('ref') || '').toString().trim().toUpperCase();
    if (!code) { setRefCode(''); setRefValid(null); return; }
    setRefCode(code);
    const validate = async () => {
      try {
        setRefChecking(true);
        setRefMessage('');
        const res = await api.post('/referrals/validate', { code });
        if ((res as any)?.success) {
          setRefValid(true);
          setRefMessage(`邀请码 ${code} 已验证`);
          // 记录待发放的邀请码，等待首次有效登录时发放
          try { localStorage.setItem('pending_ref_code', code); } catch {}
        } else {
          setRefValid(false);
          setRefMessage('邀请码无效');
          try { localStorage.removeItem('pending_ref_code'); } catch {}
        }
      } catch (e: any) {
        setRefValid(false);
        setRefMessage(e?.message || '邀请码无效');
        try { localStorage.removeItem('pending_ref_code'); } catch {}
      } finally {
        setRefChecking(false);
      }
    };
    validate();
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // 验证密码
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('密码长度至少6位');
      setLoading(false);
      return;
    }
    
    try {
      const result = await signUpWithEmail(email, password, name);
      
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        // 奖励将在首次有效登录时发放（避免机器人注册）
        // TODO: 后续在注册成功后，将 refCode 传给后端记录 referral_logs 与奖励发放
        // 如果有消息，显示消息
        if (result.message) {
          setSuccessMessage(result.message);
        }
        // 3秒后跳转到登录页
        setTimeout(() => {
          router.push('/login?message=signup_success');
        }, 3000);
      }
    } catch (error: any) {
      console.error('注册处理异常:', error);
      setError(error.message || '注册失败');
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
          <h1 className="text-xl font-semibold text-gray-900 mb-2">注册成功！</h1>
          <p className="text-gray-600 text-sm mb-4">
            {successMessage || '我们已向您的邮箱发送了验证邮件，请点击邮件中的链接完成验证。'}
          </p>
          <div className="flex items-center justify-center gap-3 mb-2">
            <button
              onClick={async () => {
                try {
                  const emailInput = (document.getElementById('email') as HTMLInputElement)?.value || '';
                  if (!emailInput) return;
                  const { resendVerificationEmail } = require('@/hooks/useAuth').useAuth();
                  const res = await resendVerificationEmail(emailInput);
                  alert(res.error ? res.error : (res.message || '验证邮件已重发'));
                } catch (e) {
                  alert('重发失败，请稍后重试');
                }
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              重发验证邮件
            </button>
          </div>
          <p className="text-gray-500 text-xs">
            验证完成后，您就可以使用邮箱和密码登录了。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-8">
      <button onClick={() => router.push('/')} className="absolute left-8 top-8 text-gray-400 hover:text-black text-sm">← 返回首页</button>
      
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8 flex flex-col gap-6">
        <div className="text-center mb-2">
          <Logo size="md" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">注册账号</h1>
          <p className="text-gray-500 text-sm">创建您的教育内容管理账号</p>
        </div>

        {/* 邀请码提示 */}
        {refCode && (
          <div className={`text-sm rounded-lg p-3 ${refChecking ? 'bg-gray-50 text-gray-600' : refValid ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
            {refChecking ? '正在验证邀请码…' : (refMessage || `邀请码 ${refCode}`)}
          </div>
        )}
        
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <input
              type="text"
              id="name"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="昵称（可选）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <input
              type="email"
              id="email"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="邮箱"
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
              placeholder="密码（至少6位）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div>
            <input
              type="password"
              id="confirmPassword"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="确认密码"
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
            {loading ? '注册中...' : '注册账号'}
          </button>
        </form>
        
        <div className="text-center">
          <p className="text-gray-500 text-sm">
            已有账号？{' '}
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

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">加载中...</div>}>
      <SignupPageInner />
    </Suspense>
  );
}