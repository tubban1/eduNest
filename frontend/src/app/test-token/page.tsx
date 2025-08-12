'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

export default function TestTokenPage() {
  const { user, loading: authLoading } = useAuth();
  const [localStorageStatus, setLocalStorageStatus] = useState<string>('');
  const [apiCallResult, setApiCallResult] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    // 检查 localStorage 中的 token
    const sessionStr = localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        setLocalStorageStatus(`✅ Token 存在: ${session.access_token ? '有' : '无'} access_token`);
      } catch (error) {
        setLocalStorageStatus('❌ Token 解析失败');
      }
    } else {
      setLocalStorageStatus('❌ 没有找到 token');
    }

    // 收集调试信息
    const debug = {
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      localStorageKeys: Object.keys(localStorage),
      sessionStorageKeys: Object.keys(sessionStorage)
    };
    setDebugInfo(JSON.stringify(debug, null, 2));
  }, []);

  const testApiCall = async () => {
    try {
      setApiCallResult('正在测试 API 调用...');
      const result = await api.content.getAll();
      setApiCallResult(`✅ API 调用成功，返回 ${result.length} 条内容`);
    } catch (error: any) {
      setApiCallResult(`❌ API 调用失败: ${error.message}`);
    }
  };

  const clearTokens = () => {
    localStorage.removeItem('sb-zayoczhybuegvtpcsgso-auth-token');
    setLocalStorageStatus('❌ Token 已清除');
    setApiCallResult('');
  };

  if (authLoading) {
    return <div className="p-8">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Token 测试页面</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 用户登录状态 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">用户认证状态</h2>
            <div className="space-y-2">
              <p><strong>登录状态:</strong> {user ? '✅ 已登录' : '❌ 未登录'}</p>
              {user && (
                <>
                  <p><strong>用户ID:</strong> {user.id}</p>
                  <p><strong>邮箱:</strong> {user.email}</p>
                  <p><strong>姓名:</strong> {user.name || '未设置'}</p>
                  <p><strong>角色:</strong> {user.role || 'user'}</p>
                </>
              )}
            </div>
          </div>

          {/* localStorage Token 状态 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">localStorage Token 状态</h2>
            <div className="space-y-2">
              <p>{localStorageStatus}</p>
              <button 
                onClick={clearTokens}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                清除 Token
              </button>
            </div>
          </div>

          {/* API 调用测试 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">API 调用测试</h2>
            <div className="space-y-2">
              <button 
                onClick={testApiCall}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                测试 API 调用
              </button>
              {apiCallResult && (
                <p className="text-sm">{apiCallResult}</p>
              )}
            </div>
          </div>

          {/* 调试信息 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">调试信息</h2>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
              {debugInfo}
            </pre>
          </div>
        </div>

        {/* 说明 */}
        <div className="mt-8 bg-blue-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">使用说明</h3>
          <ul className="text-blue-800 space-y-1 text-sm">
            <li>• 此页面用于测试 token 同步和 API 调用功能</li>
            <li>• 如果用户已登录但显示"未登录"，说明 token 同步有问题</li>
            <li>• 如果 API 调用失败，可能是 token 无效或过期</li>
            <li>• 使用"清除 Token"按钮可以测试重新登录流程</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 