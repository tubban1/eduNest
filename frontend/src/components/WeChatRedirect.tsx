'use client';

import React, { useState, useEffect } from 'react';

interface WeChatRedirectProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 微信重定向组件
 * 检测微信环境，引导用户打开浏览器
 */
export default function WeChatRedirect({
  children,
  fallback,
  className = '',
  style
}: WeChatRedirectProps) {
  const [isWeChat, setIsWeChat] = useState(false);
  const [showRedirect, setShowRedirect] = useState(false);

  useEffect(() => {
    // 检测微信环境
    const userAgent = navigator.userAgent;
    const isWeChatBrowser = /MicroMessenger/i.test(userAgent);
    
    setIsWeChat(isWeChatBrowser);
    
    if (isWeChatBrowser) {
      // 延迟显示重定向提示，避免闪烁
      const timer = setTimeout(() => {
        setShowRedirect(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, []);

  // 如果不是微信环境，直接显示内容
  if (!isWeChat) {
    return <>{children}</>;
  }

  // 如果是微信环境，显示重定向提示
  if (!showRedirect) {
    return (
      <div className={`flex items-center justify-center min-h-[200px] ${className}`} style={style}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">检测到微信环境，正在加载...</p>
        </div>
      </div>
    );
  }

  // 显示重定向提示
  return (
    <div className={`bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-8 text-center ${className}`} style={style}>
      <div className="max-w-md mx-auto">
        {/* 图标 */}
        <div className="mb-6">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        {/* 标题 */}
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          请在浏览器中打开
        </h2>

        {/* 说明 */}
        <p className="text-gray-600 mb-6 leading-relaxed">
          当前页面在微信中可能无法正常显示，建议在手机浏览器中打开以获得最佳体验
        </p>

        {/* 操作按钮 */}
        <div className="space-y-3">
          {/* 复制链接按钮 */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              // 显示复制成功提示
              const btn = document.querySelector('#copy-btn');
              if (btn) {
                const originalText = btn.textContent;
                btn.textContent = '✅ 链接已复制';
                btn.classList.add('bg-green-600');
                setTimeout(() => {
                  btn.textContent = originalText;
                  btn.classList.remove('bg-green-600');
                }, 2000);
              }
            }}
            id="copy-btn"
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            📋 复制链接
          </button>

          {/* 打开浏览器按钮 */}
          <button
            onClick={() => {
              // 尝试打开外部浏览器
              const url = window.location.href;
              window.location.href = url;
            }}
            className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            🌐 打开浏览器
          </button>
        </div>

        {/* 额外提示 */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            💡 <strong>小贴士</strong>: 长按链接选择"在浏览器中打开"，或复制链接到浏览器地址栏
          </p>
        </div>

        {/* 可选：显示原始内容预览 */}
        {fallback && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">内容预览：</p>
            <div className="text-left">
              {fallback}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 