'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('处理中...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setStatus('正在验证登录状态...');
        
        // 从URL hash中提取token参数
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const expiresAt = params.get('expires_at');
        const expiresIn = params.get('expires_in');
        const tokenType = params.get('token_type');
        
        if (!accessToken) {
          setStatus('认证失败: 未找到访问令牌');
          setTimeout(() => {
            router.push('/login?error=no_token');
          }, 2000);
          return;
        }
        
        // 验证token并获取用户信息
        setStatus('正在获取用户信息...');
        const userResponse = await fetch('https://zayoczhybuegvtpcsgso.supabase.co/auth/v1/user', {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (!userResponse.ok) {
          setStatus('认证失败: 无法获取用户信息');
          setTimeout(() => {
            router.push('/login?error=user_fetch_failed');
          }, 2000);
          return;
        }
        
        const userData = await userResponse.json();
        
        // 保存session到localStorage
        const sessionData = {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: expiresIn,
          expires_at: expiresAt,
          token_type: tokenType
        };
        localStorage.setItem('sb-zayoczhybuegvtpcsgso-auth-token', JSON.stringify(sessionData));
        
        // 重要：同步设置 API 客户端的 token
        api.setToken(accessToken);
        
        // 触发自定义事件，通知 useAuth 重新检查认证状态
        window.dispatchEvent(new Event('sessionChanged'));
        
        // 确保用户信息已保存到数据库
        try {
          const userInsertResponse = await fetch('https://zayoczhybuegvtpcsgso.supabase.co/rest/v1/users', {
            method: 'POST',
            headers: {
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              id: userData.id,
              email: userData.email,
              name: userData.user_metadata?.full_name || userData.user_metadata?.name,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          });
          
          if (userInsertResponse.ok) {
            // 用户信息保存成功
          } else {
            // 即使保存失败，也不影响登录流程
          }
        } catch (profileError) {
          // 即使保存失败，也不影响登录流程
        }
        
        setStatus('登录成功，正在跳转...');
        
        // 延迟跳转，确保状态更新
        setTimeout(() => {
          // 使用 window.location.href 而不是 router.replace，确保完全重新加载
          window.location.href = '/content';
        }, 1500);
        
      } catch (error) {
        setStatus('处理登录时出错: ' + (error as Error).message);
        setTimeout(() => {
          router.push('/login?error=callback_failed');
        }, 2000);
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