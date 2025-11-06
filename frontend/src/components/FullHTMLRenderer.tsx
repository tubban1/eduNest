'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

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
  title?: string; // iframe title
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
  title = 'HTML 预览'
}: FullHTMLRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [iframeHeight, setIframeHeight] = useState<string>('100%');

  // 错误处理
  const handleError = useCallback((error: string) => {
    setHasError(true);
    setErrorMessage(error);
    setIsLoading(false);
    onError?.(error);
  }, [onError]);

  // 监听 iframe 消息（用于高度自适应）
  useEffect(() => {
    if (!autoHeight || fixedHeight) return;

    const handleMessage = (event: MessageEvent) => {
      // 监听高度变化消息
      if (event.data && event.data.type === 'IFRAME_HEIGHT_CHANGE') {
        const { height } = event.data.data;
        
        // 只在高度合理范围内调整
        if (iframeRef.current && height > 0 && height < 10000) {
          const iframe = iframeRef.current;
          const newHeight = Math.max(100, Math.min(height, 8000)); // 限制在100-8000px之间
          
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
  }, [autoHeight, fixedHeight]);

  // 动态调整 iframe 高度
  const adjustIframeHeight = useCallback(() => {
    if (!autoHeight || fixedHeight || !iframeRef.current) return;

    try {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (iframeDoc && iframeDoc.body) {
        const bodyEl = iframeDoc.body as HTMLElement;
        const docEl = iframeDoc.documentElement as HTMLElement | null;
        
        const contentHeight = bodyEl.scrollHeight;
        const docScrollHeight = docEl ? docEl.scrollHeight : 0;
        
        // 使用最大的高度值
        const maxHeight = Math.max(contentHeight, docScrollHeight);
        const extraSpace = 20; // 额外空间
        const newHeight = Math.max(100, maxHeight + extraSpace);
        
        iframe.style.height = `${newHeight}px`;
        iframe.style.minHeight = `${newHeight}px`;
        setIframeHeight(`${newHeight}px`);
      }
    } catch (error) {
      // 跨域限制，无法访问 iframe 内容
      // 这种情况下依赖 postMessage 机制
    }
  }, [autoHeight, fixedHeight]);

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
      setTimeout(adjustIframeHeight, 100);
      setTimeout(adjustIframeHeight, 300);
      setTimeout(adjustIframeHeight, 1000);
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
    if (!fullHTML || !enableHeightListener) {
      return fullHTML; // 不注入，保持纯渲染
    }

    // 轻量级高度监听脚本
    const heightListenerScript = `
<script>
  (function() {
    var lastHeight = 0;
    var isNotifying = false;
    var notificationCount = 0;
    var maxNotifications = 10;
    
    function notifyHeightChange() {
      if (isNotifying || notificationCount >= maxNotifications) return;
      
      var newHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      
      if (Math.abs(newHeight - lastHeight) > 50) {
        lastHeight = newHeight;
        isNotifying = true;
        notificationCount++;
        
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'IFRAME_HEIGHT_CHANGE',
            data: { height: newHeight, count: notificationCount }
          }, '*');
        }
        
        setTimeout(function() {
          isNotifying = false;
        }, 1000);
      }
    }
    
    function debounce(func, wait) {
      var timeout;
      return function() {
        clearTimeout(timeout);
        timeout = setTimeout(func, wait);
      };
    }
    
    var debouncedCheck = debounce(notifyHeightChange, 500);
    
    ['load', 'resize', 'DOMContentLoaded'].forEach(function(event) {
      window.addEventListener(event, debouncedCheck);
    });
    
    if (window.MutationObserver) {
      var observer = new MutationObserver(debounce(function() {
        setTimeout(debouncedCheck, 100);
      }, 300));
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false
      });
    }
    
    setTimeout(notifyHeightChange, 1000);
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
  }, [fullHTML, enableHeightListener]);

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

      {/* 主 iframe 渲染 */}
      {useExternalUrl && externalUrl ? (
        <iframe
          key={previewKey}
          ref={iframeRef}
          src={externalUrl}
          title={title}
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
          className="w-full h-full border-0 bg-white"
          style={{
            border: 'none',
            outline: 'none',
            margin: '0',
            padding: '0',
            display: 'block',
            width: '100%',
            height: fixedHeight ? '100%' : iframeHeight,
            minHeight: fixedHeight ? '100%' : '100%',
            overflow: fixedHeight ? 'auto' : 'visible',
            position: 'relative',
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
          title={title}
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
          className="w-full h-full border-0 bg-white"
          style={{
            border: 'none',
            outline: 'none',
            margin: '0',
            padding: '0',
            display: 'block',
            width: '100%',
            height: fixedHeight ? '100%' : iframeHeight,
            minHeight: fixedHeight ? '100%' : '100%',
            overflow: fixedHeight ? 'auto' : 'visible',
            position: 'relative',
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

