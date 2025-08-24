'use client';

import React, { useState, useRef, useCallback } from 'react';
import { generateDataURL, SandboxContent } from '../utils/sandboxGenerator';

interface WeChatCompatibleRendererProps {
  html: string;
  css: string;
  js: string;
  externalLinks: string | string[];
  onError?: (error: string) => void;
  onLoad?: () => void;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

/**
 * 微信兼容渲染器
 * 使用Data URL方式，避免srcDoc的兼容性问题
 */
export default function WeChatCompatibleRenderer({
  html,
  css,
  js,
  externalLinks,
  onError,
  onLoad,
  className,
  style,
  title = 'Sandbox Preview'
}: WeChatCompatibleRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // 生成Data URL
  const generateIframeSrc = useCallback(() => {
    const content: SandboxContent = {
      html,
      css,
      js,
      externalLinks,
      title
    };
    
    return generateDataURL(content);
  }, [html, css, js, externalLinks, title]);

  // 重新加载
  const refresh = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    
    // 强制iframe重新加载
    if (iframeRef.current) {
      iframeRef.current.src = generateIframeSrc();
    }
  }, [generateIframeSrc]);

  // 下载HTML文件
  const downloadHTML = useCallback(() => {
    const content: SandboxContent = {
      html,
      css,
      js,
      externalLinks,
      title
    };
    
    // 这里需要导入downloadSandboxHTML函数
    // 暂时使用简单的下载方式
    const htmlContent = generateIframeSrc().replace('data:text/html;charset=utf-8,', '');
    const blob = new Blob([decodeURIComponent(htmlContent)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wechat-sandbox.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }, [html, css, js, externalLinks, title, generateIframeSrc]);

  return (
    <div className={`relative ${className || ''}`} style={style}>
      {/* 微信兼容性提示 */}
      <div className="absolute top-0 left-0 bg-green-600 text-white text-xs p-2 z-40 max-w-xs">
        <div className="font-bold mb-1">✅ 微信兼容模式</div>
        <div>使用Data URL方式</div>
        <div>加载状态: {isLoading ? '🔄 加载中' : '✅ 已完成'}</div>
        <div className="mt-2 space-y-1">
          <button
            onClick={refresh}
            className="w-full px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
          >
            🔄 重新加载
          </button>
          <button
            onClick={downloadHTML}
            className="w-full px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
          >
            💾 下载HTML
          </button>
        </div>
      </div>

      {/* 加载状态指示 */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">微信兼容模式加载中...</p>
            <p className="text-xs text-gray-500 mt-1">使用Data URL方式，微信完全兼容</p>
          </div>
        </div>
      )}

      {/* 错误显示 */}
      {hasError && (
        <div className="absolute inset-0 bg-red-50 border-2 border-red-200 rounded-lg flex items-center justify-center z-20">
          <div className="text-center p-4">
            <div className="text-red-600 text-lg font-semibold mb-2">加载错误</div>
            <div className="text-red-500 text-sm mb-4">{errorMessage}</div>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* 微信兼容的iframe */}
      <iframe
        ref={iframeRef}
        src={generateIframeSrc()}
        title={title}
        className="w-full h-full border-0 bg-white"
        style={{
          border: 'none',
          outline: 'none',
          minHeight: '100%',
          height: '100%',
          width: '100%',
          overflow: 'auto'
        }}
        onLoad={() => {
          console.log('WeChat compatible iframe loaded successfully');
          setIsLoading(false);
          onLoad?.();
        }}
        onError={() => {
          const errorMsg = '微信兼容iframe加载失败';
          console.error('WeChat iframe error:', errorMsg);
          setHasError(true);
          setErrorMessage(errorMsg);
          setIsLoading(false);
          onError?.(errorMsg);
        }}
      />
    </div>
  );
} 