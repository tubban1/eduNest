'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';

/**
 * FullHTMLRenderer - 纯 HTML 渲染器
 * 
 * 用于直接渲染完整的 HTML 文件，不进行任何代码注入或修改。
 * 性能最优，保持原始执行顺序和样式。
 * 
 * 使用示例：
 * 
 * // 基础用法
 * <FullHTMLRenderer
 *   fullHTML={htmlContent}
 *   onError={(error) => console.error(error)}
 *   onLoad={() => console.log('Loaded')}
 * />
 * 
 * // 带高度自适应
 * <FullHTMLRenderer
 *   fullHTML={htmlContent}
 *   autoHeight={true}
 *   fixedHeight={false}
 * />
 * 
 * // 使用外部 URL（类似 CodePen）
 * <FullHTMLRenderer
 *   externalUrl="/math/cross-product.html"
 *   useExternalUrl={true}
 * />
 * 
 * // 启用高度监听（可选，会注入轻量级脚本）
 * <FullHTMLRenderer
 *   fullHTML={htmlContent}
 *   autoHeight={true}
 *   enableHeightListener={true}
 * />
 */

interface FullHTMLRendererProps {
  fullHTML?: string; // 完整的 HTML 字符串
  externalUrl?: string; // 外部 URL（当 useExternalUrl 为 true 时使用）
  useExternalUrl?: boolean; // 是否使用外部 URL 模式
  onError?: (error: string) => void;
  onLoad?: () => void;
  className?: string;
  style?: React.CSSProperties;
  fixedHeight?: boolean; // 预览页固定高度，超出出现滚动条
  autoHeight?: boolean; // 自动调整高度（仅在 fixedHeight 为 false 时生效）
  enableHeightListener?: boolean; // 是否注入高度监听脚本（可选，默认 false，保持纯渲染）
  codepenMode?: boolean; // CodePen 样式：仅在加载完成后测量一次高度
  title?: string; // iframe title（可覆盖自动解析的标题）
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
  enableHeightListener = false, // 默认不注入，保持纯渲染
  codepenMode = false,
  title
}: FullHTMLRendererProps) {
  const iframeTitle = useMemo(() => {
    if (title && title.trim()) {
      return title.trim();
    }

    if (fullHTML) {
      const match = fullHTML.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    if (externalUrl) {
      try {
        const parsed = new URL(externalUrl, typeof window !== 'undefined' ? window.location.origin : undefined);
        return parsed.hostname || 'EduNest AI';
      } catch {
        // ignore
      }
    }

    return 'EduNest AI';
  }, [title, fullHTML, externalUrl]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [iframeHeight, setIframeHeight] = useState<string>('calc(100% + 20px)');

  const isWeChat = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /MicroMessenger|WeChat|X5Browser/i.test(ua);
  }, []);
  const forceExternalInWechat = isWeChat && !!externalUrl;

  // 错误处理
  const handleError = useCallback((error: string) => {
    setHasError(true);
    setErrorMessage(error);
    setIsLoading(false);
    onError?.(error);
  }, [onError]);

  // 监听 iframe 消息（用于高度自适应）
  useEffect(() => {
    if (codepenMode) return; // CodePen 模式不做持续监听
    if (!autoHeight || fixedHeight || forceExternalInWechat) return;

    const handleMessage = (event: MessageEvent) => {
      // 监听高度变化消息
      if (event.data && event.data.type === 'IFRAME_HEIGHT_CHANGE') {
        const { height, count } = event.data.data;
        const currentHeight = iframeRef.current?.style.height;
        // 只在高度合理范围内调整
        if (iframeRef.current && height > 0 && height < 10000) {
          const iframe = iframeRef.current;
          const newHeight = Math.max(100, Math.min(height, 8000)); // 限制在100-8000px之间
          const previousHeight = parseFloat(currentHeight || '0') || 0;
          const diff = newHeight - previousHeight;
          if (Math.abs(diff) < 2) {
            return;
          }
          
          iframe.style.height = `${newHeight}px`;
          iframe.style.minHeight = `${newHeight}px`;
          setIframeHeight(`${newHeight}px`);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [autoHeight, fixedHeight, forceExternalInWechat, codepenMode]);

  // 动态调整 iframe 高度
  const adjustIframeHeight = useCallback(() => {
    if (!autoHeight || fixedHeight || forceExternalInWechat || !iframeRef.current) {
      return;
    }

    try {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (iframeDoc && iframeDoc.body) {
        const bodyEl = iframeDoc.body as HTMLElement;
        const docEl = iframeDoc.documentElement as HTMLElement | null;
        
        const contentHeight = bodyEl.scrollHeight;
        const contentWidth = bodyEl.scrollWidth;
        const clientHeight = bodyEl.clientHeight;
        const offsetHeight = bodyEl.offsetHeight;
        const docScrollHeight = docEl ? docEl.scrollHeight : 0;
        const docClientHeight = docEl ? docEl.clientHeight : 0;
        const docOffsetHeight = docEl ? docEl.offsetHeight : 0;
        
        // 使用最大的高度值，确保内容不被裁切
        const maxHeight = Math.max(
          contentHeight,
          clientHeight,
          offsetHeight,
          docScrollHeight,
          docClientHeight,
          docOffsetHeight
        );
        
        const extraSpace = 80; // 额外空间
        const newHeight = Math.max(0, maxHeight + extraSpace);
        const previousHeight = parseFloat(iframe.style.height || '0') || 0;
        
        iframe.style.height = `${newHeight}px`;
        iframe.style.minHeight = `${newHeight}px`;
        
        setIframeHeight(`${newHeight}px`);
        
        // 触发重排
        iframe.style.display = 'none';
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        (iframe as any).offsetHeight;
        iframe.style.display = 'block';
      }
    } catch (error) {
      // 跨域限制，无法访问 iframe 内容
      // 这种情况下依赖 postMessage 机制
    }
  }, [autoHeight, fixedHeight, forceExternalInWechat]);

  // 重新渲染
  const refresh = useCallback(() => {
    setPreviewKey(prev => prev + 1);
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
  }, []);

  // 处理 iframe 加载完成
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    
    // 延迟调整高度，确保内容已渲染
    if (autoHeight && !fixedHeight) {
      const shouldRelyOnListener = enableHeightListener && !forceExternalInWechat && !codepenMode;
      if (!shouldRelyOnListener) {
        setTimeout(adjustIframeHeight, 100);
        if (!codepenMode) {
          setTimeout(adjustIframeHeight, 300);
          setTimeout(adjustIframeHeight, 1000);
        } else {
          setTimeout(adjustIframeHeight, 500);
        }
      }
    }
    
    onLoad?.();
  }, [autoHeight, fixedHeight, adjustIframeHeight, onLoad]);

  // 处理 iframe 加载错误
  const handleIframeError = useCallback(() => {
    const errorMsg = useExternalUrl
      ? `外部 URL 加载失败: ${externalUrl}`
      : 'HTML 内容加载失败';
    handleError(errorMsg);
  }, [useExternalUrl, externalUrl, handleError]);

  // 处理 HTML 内容（可选注入高度监听脚本）
  const processedHTML = React.useMemo(() => {
    if (!fullHTML || !enableHeightListener || forceExternalInWechat || codepenMode) {
      return fullHTML; // 不注入，保持纯渲染
    }

    // 增强的高度监听脚本（支持 Vue 响应式更新、tab 切换等）
    const heightListenerScript = `
<script>
  (function() {
    var lastHeight = 0;
    var checkCount = 0;
    var MIN_DIFF = 20;
    var debounceTimer = null;
    var initialSent = false;

    function getCurrentHeight() {
      return Math.max(
        document.body.scrollHeight || 0,
        document.body.offsetHeight || 0,
        document.documentElement.scrollHeight || 0,
        document.documentElement.offsetHeight || 0,
        document.documentElement.clientHeight || 0
      );
    }

    function postHeight(force) {
      var current = getCurrentHeight();
      if (!force && Math.abs(current - lastHeight) < MIN_DIFF) return;
      lastHeight = current;
      checkCount++;
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'IFRAME_HEIGHT_CHANGE',
          data: { height: current, count: checkCount }
        }, '*');
      }
    }

    function schedulePost(delay, force) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        debounceTimer = null;
        postHeight(!!force);
      }, delay || 150);
    }

    function sendInitial() {
      if (initialSent) return;
      initialSent = true;
      postHeight(true);
    }

    if (document.readyState === 'complete') {
      sendInitial();
    } else {
      window.addEventListener('load', sendInitial, { once: true });
      document.addEventListener('DOMContentLoaded', sendInitial, { once: true });
    }

    document.addEventListener('click', function() {
      schedulePost(250, false);
    }, true);

    window.addEventListener('message', function(event) {
      if (!event || !event.data) return;
      if (event.data.type === 'REQUEST_IFRAME_HEIGHT_CHECK') {
        schedulePost(0, true);
      }
    });
  })();
</script>`;

    // 在 </body> 标签前注入脚本
    if (fullHTML.includes('</body>')) {
      return fullHTML.replace('</body>', `${heightListenerScript}</body>`);
    } else if (fullHTML.includes('</html>')) {
      return fullHTML.replace('</html>', `${heightListenerScript}</html>`);
    } else {
      // 如果没有 body 或 html 标签，直接追加
      return fullHTML + heightListenerScript;
    }
  }, [fullHTML, enableHeightListener, forceExternalInWechat, codepenMode]);

  // 验证 props
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
      setIframeHeight('100vh');
    }
  }, [forceExternalInWechat, fixedHeight]);

  return (
    <div 
      className={`relative ${className || ''}`} 
      style={{
        width: '100%',
        height: '100%',
        minHeight: '100%',
        border: 'none',
        outline: 'none',
        margin: '0',
        padding: '0',
        overflow: 'hidden',
        position: 'relative',
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
          为获得完整体验，请点击右上角菜单并选择“在浏览器中打开”。
        </div>
      )}

      {/* 主 iframe 渲染 */}
      {forceExternalInWechat ? (
        externalUrl ? (
          <iframe
            key={`${previewKey}-wechat`}
            ref={iframeRef}
            src={externalUrl}
            title={iframeTitle}
            className="w-full h-full border-0 bg-white"
            style={{
              border: 'none',
              outline: 'none',
              margin: '0',
              padding: '0',
              display: 'block',
              width: '100%',
              height: fixedHeight ? '100%' : iframeHeight,
              minHeight: fixedHeight ? undefined : iframeHeight,
              overflow: 'auto',
              position: 'relative',
              WebkitOverflowScrolling: 'touch'
            }}
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
          style={{
            border: 'none',
            outline: 'none',
            margin: '0',
            padding: '0',
            display: 'block',
            width: '100%',
            height: fixedHeight ? '100%' : 'auto',
            minHeight: '100%',
            overflow: fixedHeight ? 'auto' : 'visible',
            position: 'relative',
            // 移动端触摸滚动支持
            WebkitOverflowScrolling: 'touch'
          }}
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
          style={{
            border: 'none',
            outline: 'none',
            margin: '0',
            padding: '0',
            display: 'block',
            width: '100%',
            height: fixedHeight ? '100%' : 'auto',
            minHeight: '100%',
            overflow: fixedHeight ? 'auto' : 'visible',
            position: 'relative',
            // 移动端触摸滚动支持
            WebkitOverflowScrolling: 'touch'
          }}
          scrolling={fixedHeight ? 'auto' : 'no'}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      ) : null}
    </div>
  );
}

