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
  const [runtimeFullScreen, setRuntimeFullScreen] = useState(false);

  // 检测是否为 3D/WebGL 应用或全屏应用
  const isStaticFullScreenApp = useMemo(() => {
    if (!fullHTML) return false;
    const lower = fullHTML.toLowerCase();
    return lower.includes('three.js') || 
           lower.includes('three.min.js') || 
           lower.includes('webgl') ||
           lower.includes('height: 100vh') || 
           lower.includes('height:100vh') ||
           lower.includes('overflow: hidden') ||
           lower.includes('overflow:hidden') ||
           // 检测全屏 canvas 样式特征
           (lower.includes('<canvas') && (lower.includes('height: 100%') || lower.includes('height:100%')));
  }, [fullHTML]);

  const effectiveCodepenMode = codepenMode || isStaticFullScreenApp || runtimeFullScreen;

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
   * 设置高度
   */
  const applyHeight = useCallback((height: number) => {
    if (!autoHeight || fixedHeight || forceExternalInWechat || effectiveCodepenMode) return;
    if (height < 100 || height > 15000) return;
    
    const bufferedHeight = height + 50;
    
    // 直接设置高度，允许高度减少
    setIframeHeight(bufferedHeight);
  }, [autoHeight, fixedHeight, forceExternalInWechat, effectiveCodepenMode]);

  // 监听 iframe 消息
  useEffect(() => {
    if (!autoHeight || fixedHeight || forceExternalInWechat) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'IFRAME_HEIGHT_CHANGE') {
        const { height, isFullScreen } = event.data.data;
        
        if (isFullScreen) {
          setRuntimeFullScreen(true);
        } else if (!effectiveCodepenMode) {
          applyHeight(height);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [autoHeight, fixedHeight, forceExternalInWechat, applyHeight, effectiveCodepenMode]);

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
   * 注入高度检测脚本（使用 ResizeObserver 和 postMessage）
   */
  const processedHTML = useMemo(() => {
    // 始终注入脚本，除非必须使用外部链接
    // 我们不再在 React 侧判断是否为 3D 应用，而是将判断逻辑下放到 iframe 内部的运行时脚本中
    // 这样能更准确地检测动态生成的 Canvas
    if (forceExternalInWechat || !fullHTML) {
      return fullHTML;
    }

    const heightScript = `
<script>
(function() {
  var lastHeight = 0;
  var throttleTimer = null;
  // 运行时检测：页面是否包含 Canvas
  // 如果包含，通常意味着这是一个 3D/图表应用，应该由容器控制高度，而不是内容撑开高度
  var is3DApp = !!document.querySelector('canvas'); 
  var observer = null;

  function getHeight() {
    var body = document.body;
    if (!body) return 0;
    
    // 获取精确高度
    var rect = body.getBoundingClientRect();
    var height = rect.height;
    var style = window.getComputedStyle(body);
    height += (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
    return Math.ceil(height);
  }

  function sendHeight() {
    // 运行时全屏检测策略
    if (is3DApp) {
        var bodyHeight = getHeight();
        
        // 如果内容高度与视口高度非常接近（误差 20px 内），或者是 100vh 这种
        // 我们认为这是全屏应用，通知父窗口切换到全屏模式
        if (Math.abs(bodyHeight - window.innerHeight) < 20) {
           if (window.parent) {
              window.parent.postMessage({
                type: "IFRAME_HEIGHT_CHANGE",
                data: { height: bodyHeight, isFullScreen: true }
              }, "*");
           }
           return;
        }
    }

    var height = getHeight();
    
    // Jitter 处理：忽略 4px 以内的微小变化
    if (Math.abs(height - lastHeight) <= 4) return;

    lastHeight = height;
    if (window.parent) {
      window.parent.postMessage({
        type: "IFRAME_HEIGHT_CHANGE",
        data: { height: height, isFullScreen: false }
      }, "*");
    }
  }

  function onResize() {
    // 3D 应用依然需要响应 resize，但我们会过滤掉全屏的情况
    if (throttleTimer) return;
    throttleTimer = setTimeout(function() {
      sendHeight();
      throttleTimer = null;
    }, 100);
  }

  function checkAppType() {
    is3DApp = !!document.querySelector('canvas');
  }

  // 初始化
  if (document.readyState === 'complete') {
    checkAppType();
    onResize();
  } else {
    window.addEventListener('load', function() {
       checkAppType();
       onResize();
    });
  }

  // 延迟启动观察者，并再次检查 App 类型
  setTimeout(function() {
      checkAppType();
      if (document.body) {
        observer = new ResizeObserver(onResize);
        observer.observe(document.body);
      }
  }, 500);

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
    // 在 Flex 容器中，使用 flex: 1 确保填满剩余空间
    // 如果不是全屏模式，则使用固定高度
    flex: (fixedHeight || effectiveCodepenMode) ? '1 1 0%' : 'none',
    height: (fixedHeight || effectiveCodepenMode) ? '100%' : `${iframeHeight}px`,
    overflow: 'hidden',
    WebkitOverflowScrolling: 'touch',
  };

  return (
    <div 
      className={`relative ${className || ''}`} 
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        border: 'none',
        outline: 'none',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        ...style,
        // 确保关键样式不被外部 style (如 height: auto) 覆盖
        height: (fixedHeight || effectiveCodepenMode) ? '100%' : (style?.height || 'auto'),
        minHeight: (fixedHeight || effectiveCodepenMode) 
          ? (style?.minHeight || '100%') 
          : (style?.minHeight || `${iframeHeight}px`),
        paddingBottom: 0, // 强制移除底部内边距
        marginBottom: 0,  // 强制移除底部外边距
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
          scrolling={(fixedHeight || effectiveCodepenMode) ? 'auto' : 'no'}
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
          scrolling={(fixedHeight || effectiveCodepenMode) ? 'auto' : 'no'}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      ) : null}
    </div>
  );
}


