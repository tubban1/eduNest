'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';

/**
 * FullHTMLRenderer - 稳定版
 * 
 * 核心策略：
 * - 不使用动态高度检测（避免抖动）
 * - iframe 加载后一次性设置高度
 * - 使用 scrolling="auto" 让 iframe 自己处理滚动
 */

interface FullHTMLRendererProps {
  fullHTML?: string;
  externalUrl?: string;
  useExternalUrl?: boolean;
  onError?: (error: string) => void;
  onLoad?: () => void;
  className?: string;
  style?: React.CSSProperties;
  fixedHeight?: boolean;
  autoHeight?: boolean;
  enableHeightListener?: boolean;
  codepenMode?: boolean;
  title?: string;
}

export default function FullHTMLRenderer({
  fullHTML,
  externalUrl,
  useExternalUrl = false,
  onError,
  onLoad,
  className,
  style,
  fixedHeight = false,
  autoHeight = true,
  enableHeightListener = true,
  codepenMode = false,
  title
}: FullHTMLRendererProps) {
  const iframeTitle = useMemo(() => {
    if (title && title.trim()) return title.trim();
    if (fullHTML) {
      const match = fullHTML.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (match && match[1]) return match[1].trim();
    }
    if (externalUrl) {
      try {
        const parsed = new URL(externalUrl, typeof window !== 'undefined' ? window.location.origin : undefined);
        return parsed.hostname || 'EduNest AI';
      } catch { /* ignore */ }
    }
    return 'EduNest AI';
  }, [title, fullHTML, externalUrl]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [iframeHeight, setIframeHeight] = useState<number>(600);
  

  const isWeChat = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /MicroMessenger|WeChat|X5Browser/i.test(ua);
  }, []);
  const forceExternalInWechat = isWeChat && !!externalUrl;

  const handleError = useCallback((error: string) => {
    setHasError(true);
    setErrorMessage(error);
    setIsLoading(false);
    onError?.(error);
  }, [onError]);

  /**
   * 设置高度（只增不减，防止抖动）
   */
  const applyHeight = useCallback((height: number) => {
    if (!autoHeight || fixedHeight || forceExternalInWechat) return;
    if (height < 100 || height > 15000) return;
    
    const bufferedHeight = height + 50;
    
    // 只增不减：只有当新高度大于当前高度时才更新
    setIframeHeight(prev => {
      if (bufferedHeight > prev) {
        return bufferedHeight;
      }
      return prev;
    });
  }, [autoHeight, fixedHeight, forceExternalInWechat]);

  // 监听 iframe 消息
  useEffect(() => {
    if (!autoHeight || fixedHeight || forceExternalInWechat) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'IFRAME_HEIGHT_CHANGE') {
        const { height } = event.data.data;
        applyHeight(height);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [autoHeight, fixedHeight, forceExternalInWechat, applyHeight]);

  // 重新渲染
  const refresh = useCallback(() => {
    setPreviewKey(prev => prev + 1);
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    setIframeHeight(600);
  }, []);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleIframeError = useCallback(() => {
    const errorMsg = useExternalUrl
      ? `外部 URL 加载失败: ${externalUrl}`
      : 'HTML 内容加载失败';
    handleError(errorMsg);
  }, [useExternalUrl, externalUrl, handleError]);

  /**
   * 注入高度检测脚本（只发送一次）
   */
  const processedHTML = useMemo(() => {
    if (forceExternalInWechat || !fullHTML) {
      return fullHTML;
    }

    // 高度检测脚本：加载完成后发送一次，点击后重新计算
    const heightScript = `
<script>
(function() {
  var lastSentHeight = 0;
  
  function getContentHeight() {
    var body = document.body;
    var html = document.documentElement;
    if (!body) return 0;
    
    // 检测全屏应用
    var bodyStyle = window.getComputedStyle(body);
    var htmlStyle = window.getComputedStyle(html);
    if (bodyStyle.overflow === 'hidden' || 
        bodyStyle.height === '100vh' ||
        htmlStyle.height === '100vh') {
      return window.innerHeight;
    }
    
    return Math.max(
      body.scrollHeight || 0,
      body.offsetHeight || 0,
      html.scrollHeight || 0,
      html.offsetHeight || 0
    );
  }
  
  function sendHeight() {
    var height = getContentHeight();
    if (height < 100) return;
    
    // 只有当高度增加时才发送（只增不减）
    if (height <= lastSentHeight) return;
    
    lastSentHeight = height;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'IFRAME_HEIGHT_CHANGE',
        data: { height: height }
      }, '*');
    }
  }
  
  // 延迟发送，等待内容完全渲染
  if (document.readyState === 'complete') {
    setTimeout(sendHeight, 500);
  } else {
    window.addEventListener('load', function() {
      setTimeout(sendHeight, 500);
    });
  }
  
  // 点击事件后重新计算高度（延迟执行，等待 DOM 更新）
  document.addEventListener('click', function() {
    setTimeout(sendHeight, 300);
  }, true);
})();
</script>`;

    if (fullHTML.includes('</body>')) {
      return fullHTML.replace('</body>', `${heightScript}</body>`);
    } else if (fullHTML.includes('</html>')) {
      return fullHTML.replace('</html>', `${heightScript}</html>`);
    } else {
      return fullHTML + heightScript;
    }
  }, [fullHTML, forceExternalInWechat]);

  useEffect(() => {
    if (useExternalUrl && !externalUrl) {
      handleError('使用外部 URL 模式时必须提供 externalUrl');
      return;
    }
    if (!useExternalUrl && !fullHTML) {
      handleError('必须提供 fullHTML 或使用外部 URL 模式');
      return;
    }
  }, [useExternalUrl, externalUrl, fullHTML, handleError]);

  useEffect(() => {
    if (forceExternalInWechat && !fixedHeight) {
      setIframeHeight(window.innerHeight);
    }
  }, [forceExternalInWechat, fixedHeight]);

  // iframe 样式 - 简单稳定
  const iframeStyle: React.CSSProperties = {
    border: 'none',
    outline: 'none',
    margin: 0,
    padding: 0,
    display: 'block',
    width: '100%',
    height: fixedHeight ? '100%' : `${iframeHeight}px`,
    overflow: 'hidden',
    WebkitOverflowScrolling: 'touch',
  };

  return (
    <div 
      className={`relative ${className || ''}`} 
      style={{
        width: '100%',
        height: fixedHeight ? '100%' : 'auto',
        minHeight: fixedHeight ? '100%' : `${iframeHeight}px`,
        border: 'none',
        outline: 'none',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        ...style
      }}
    >
      {/* 加载指示器 */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-30">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">加载中...</p>
            <p className="text-sm text-gray-500 mt-2">请稍候，内容正在渲染</p>
          </div>
        </div>
      )}

      {/* 错误显示 */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-30">
          <div className="text-center max-w-md mx-4">
            <div className="text-red-600 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">渲染失败</h3>
            <p className="text-red-600 mb-4">{errorMessage}</p>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* 微信提示 */}
      {forceExternalInWechat && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-yellow-50 border border-yellow-300 text-yellow-700 rounded-md text-sm shadow">
          为获得完整体验，请点击右上角菜单并选择"在浏览器中打开"。
        </div>
      )}

      {/* 主 iframe */}
      {forceExternalInWechat ? (
        externalUrl ? (
          <iframe
            key={`${previewKey}-wechat`}
            ref={iframeRef}
            src={externalUrl}
            title={iframeTitle}
            className="w-full h-full border-0 bg-white"
            style={iframeStyle}
            scrolling="auto"
            onLoad={() => {
              setIsLoading(false);
              onLoad?.();
            }}
            onError={() => {
              handleError('微信环境下加载 externalUrl 失败，请确认链接可访问');
            }}
          />
        ) : null
      ) : useExternalUrl && externalUrl ? (
        <iframe
          key={previewKey}
          ref={iframeRef}
          src={externalUrl}
          title={iframeTitle}
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
          className="w-full h-full border-0 bg-white"
          style={iframeStyle}
          scrolling={fixedHeight ? 'auto' : 'no'}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      ) : processedHTML ? (
        <iframe
          key={previewKey}
          ref={iframeRef}
          srcDoc={processedHTML}
          title={iframeTitle}
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
          className="w-full h-full border-0 bg-white"
          style={iframeStyle}
          scrolling={fixedHeight ? 'auto' : 'no'}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      ) : null}
    </div>
  );
}
