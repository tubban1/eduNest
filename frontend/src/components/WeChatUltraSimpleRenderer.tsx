'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface WeChatUltraSimpleRendererProps {
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
 * 微信超简化渲染器
 * 使用Blob URL方式，避免Data URL的长度和编码问题
 */
export default function WeChatUltraSimpleRenderer({
  html,
  css,
  js,
  externalLinks,
  onError,
  onLoad,
  className,
  style,
  title = 'WeChat Sandbox'
}: WeChatUltraSimpleRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');

  // 生成超简化的HTML
  const generateSimpleHTML = useCallback(() => {
    const simpleHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <meta name="x5-orientation" content="portrait">
  <meta name="x5-fullscreen" content="true">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; font-family: -apple-system, 'PingFang SC', sans-serif; }
    #app { width: 100%; min-height: 100vh; display: block; }
    ${css}
  </style>
</head>
<body>
  <div id="wechat-status" style="position: fixed; top: 10px; left: 10px; background: rgba(0,0,0,0.8); color: white; padding: 10px; font-size: 12px; z-index: 9999;">
    超简化模式: 加载中...
  </div>
  
  ${html}
  
  <script>
    // 微信检测
    var isWeChat = /MicroMessenger/i.test(navigator.userAgent);
    var statusDiv = document.getElementById('wechat-status');
    
    if (isWeChat) {
      statusDiv.textContent = '超简化模式: 微信已检测到';
      console.log('WeChat detected in ultra-simple mode');
    }
    
    // 执行用户代码
    try {
      ${js}
      statusDiv.textContent = '超简化模式: 执行成功';
      console.log('Ultra-simple mode: User script executed successfully');
    } catch (error) {
      statusDiv.textContent = '超简化模式: 执行错误 - ' + error.message;
      console.error('Ultra-simple mode: User script error:', error);
    }
    
    // 页面加载完成
    document.addEventListener('DOMContentLoaded', function() {
      console.log('Ultra-simple mode: DOM loaded');
      statusDiv.textContent = '超简化模式: 页面加载完成';
    });
    
    // 微信特殊处理
    if (isWeChat) {
      document.addEventListener('WeixinJSBridgeReady', function() {
        console.log('WeixinJSBridge ready in ultra-simple mode');
        statusDiv.textContent = '超简化模式: JSBridge就绪';
      });
    }
  </script>
</body>
</html>`;

    return simpleHTML;
  }, [html, css, js, title]);

  // 生成Data URL (确保HTTPS兼容性)
  const generateDataURL = useCallback(() => {
    const htmlContent = generateSimpleHTML();
    const dataURL = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
    
    setDebugInfo(`Data URL长度: ${dataURL.length} 字符`);
    return dataURL;
  }, [generateSimpleHTML]);

  // 重新加载
  const refresh = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    
    if (iframeRef.current) {
      // 创建新的Data URL
      const newURL = generateDataURL();
      iframeRef.current.src = newURL;
    }
  }, [generateDataURL]);

  // 下载HTML文件
  const downloadHTML = useCallback(() => {
    const htmlContent = generateSimpleHTML();
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wechat-ultra-simple.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }, [generateSimpleHTML]);

  // 清理Data URL (无需清理，Data URL是内联的)
  useEffect(() => {
    return () => {
      // Data URL是内联的，无需清理
    };
  }, []);

  return (
    <div className={`relative ${className || ''}`} style={style}>
      {/* 微信兼容性提示 */}
      <div className="absolute top-0 left-0 bg-blue-600 text-white text-xs p-2 z-40 max-w-xs">
        <div className="font-bold mb-1">🔧 微信超简化模式</div>
        <div>无外部依赖，纯内联内容</div>
        <div>加载状态: {isLoading ? '🔄 加载中' : '✅ 已完成'}</div>
        <div className="text-xs opacity-75">{debugInfo}</div>
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">微信超简化模式加载中...</p>
            <p className="text-xs text-gray-500 mt-1">无外部依赖，纯内联内容，确保微信兼容性</p>
            <p className="text-xs text-gray-400 mt-1">{debugInfo}</p>
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

      {/* 超简化iframe */}
      <iframe
        ref={iframeRef}
        src={generateDataURL()}
        title={title}
        className="w-full h-full border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        style={{
          border: 'none',
          outline: 'none',
          minHeight: '100%',
          height: '100%',
          width: '100%',
          overflow: 'auto'
        }}
        onLoad={() => {
          console.log('WeChat ultra-simple iframe loaded successfully');
          setIsLoading(false);
          onLoad?.();
        }}
        onError={() => {
          const errorMsg = '微信超简化iframe加载失败';
          console.error('WeChat ultra-simple iframe error:', errorMsg);
          setHasError(true);
          setErrorMessage(errorMsg);
          setIsLoading(false);
          onError?.(errorMsg);
        }}
      />
    </div>
  );
} 