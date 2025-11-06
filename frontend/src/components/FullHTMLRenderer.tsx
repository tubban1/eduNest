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
  const [iframeHeight, setIframeHeight] = useState<string>('calc(100% + 20px)');

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

  // 动态调整 iframe 高度（参考 SandboxRenderer 的实现）
  const adjustIframeHeight = useCallback(() => {
    if (!autoHeight || fixedHeight || !iframeRef.current) return;

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
        
        // 使用最大的高度值，确保内容不被裁切（参考 SandboxRenderer）
        const maxHeight = Math.max(
          contentHeight,
          clientHeight,
          offsetHeight,
          docScrollHeight,
          docClientHeight,
          docOffsetHeight
        );
        
        const extraSpace = 80; // 额外空间（与 SandboxRenderer 保持一致）
        const newHeight = Math.max(0, maxHeight + extraSpace);
        
        iframe.style.height = `${newHeight}px`;
        iframe.style.minHeight = `${newHeight}px`;
        
        setIframeHeight(`${newHeight}px`);
        
        // 触发重排（参考 SandboxRenderer）
        iframe.style.display = 'none';
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        (iframe as any).offsetHeight;
        iframe.style.display = 'block';
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

    // 增强的高度监听脚本（支持 Vue 响应式更新、tab 切换等）
    const heightListenerScript = `
<script>
  (function() {
    var lastHeight = 0;
    var checkCount = 0;
    var maxCheckCount = 1000; // 允许持续检查，不设上限
    var throttleDelay = 100; // 节流延迟（毫秒）
    var lastCheckTime = 0;
    
    function getCurrentHeight() {
      return Math.max(
        document.body.scrollHeight || 0,
        document.body.offsetHeight || 0,
        document.documentElement.scrollHeight || 0,
        document.documentElement.offsetHeight || 0,
        document.documentElement.clientHeight || 0
      );
    }
    
    function notifyHeightChange(force) {
      var now = Date.now();
      // 节流：避免过于频繁的检查
      if (!force && now - lastCheckTime < throttleDelay) {
        return;
      }
      lastCheckTime = now;
      
      var newHeight = getCurrentHeight();
      checkCount++;
      
      // 如果高度变化超过 10px 或者强制更新，则通知父窗口
      if (force || Math.abs(newHeight - lastHeight) > 10) {
        lastHeight = newHeight;
        
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'IFRAME_HEIGHT_CHANGE',
            data: { height: newHeight, count: checkCount }
          }, '*');
        }
      }
    }
    
    // 立即检查一次（强制）
    function forceCheck() {
      setTimeout(function() {
        notifyHeightChange(true);
      }, 50);
    }
    
    // 监听各种可能影响高度的事件
    ['load', 'resize', 'DOMContentLoaded'].forEach(function(event) {
      window.addEventListener(event, function() {
        setTimeout(forceCheck, 100);
      });
    });
    
    // 增强的 MutationObserver：监听所有可能的变化
    if (window.MutationObserver) {
      var observer = new MutationObserver(function() {
        // DOM 变化时延迟检查，确保渲染完成
        setTimeout(function() {
          notifyHeightChange(false);
        }, 50);
      });
      
      // 监听整个文档的变化，包括属性、子节点、文本内容
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true, // 监听属性变化（如 style、class）
        attributeFilter: ['style', 'class', 'hidden'], // 重点监听这些属性
        characterData: true
      });
      
      // 也监听 documentElement 的变化
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }
    
    // 监听点击事件（tab 切换等）并检查高度
    // 使用事件委托，避免性能问题
    document.addEventListener('click', function(e) {
      var target = e.target;
      if (!target) return;
      
      // 检查是否是 tab 相关的点击
      var isTabClick = false;
      var checkElement = target;
      
      // 向上遍历查找 tab 相关元素（最多3层）
      for (var i = 0; i < 3 && checkElement; i++) {
        if (checkElement.classList && (
            checkElement.classList.contains('tab') ||
            checkElement.classList.contains('tab-header') ||
            checkElement.getAttribute && checkElement.getAttribute('role') === 'tab'
        )) {
          isTabClick = true;
          break;
        }
        checkElement = checkElement.parentElement;
      }
      
      if (isTabClick) {
        // Tab 切换后延迟检查高度，确保 Vue 更新完成
        setTimeout(forceCheck, 150);
        setTimeout(forceCheck, 300);
        setTimeout(forceCheck, 500);
      }
    }, true);
    
    // 定期检查（作为兜底机制）
    var periodicCheck = setInterval(function() {
      if (checkCount < maxCheckCount) {
        notifyHeightChange(false);
      } else {
        clearInterval(periodicCheck);
      }
    }, 1000);
    
    // 拦截 Vue 的响应式更新（如果存在 Vue）
    // 注意：这可能会影响 Vue 的正常运行，所以采用更安全的方式
    try {
      if (window.Vue) {
        // 监听 Vue 应用实例的创建
        var originalCreateApp = window.Vue.createApp;
        if (typeof originalCreateApp === 'function') {
          window.Vue.createApp = function() {
            var app = originalCreateApp.apply(this, arguments);
            // 拦截 mount 方法，在挂载后添加高度检查
            var originalMount = app.mount;
            if (typeof originalMount === 'function') {
              app.mount = function() {
                var result = originalMount.apply(this, arguments);
                setTimeout(forceCheck, 200);
                return result;
              };
            }
            return app;
          };
        }
      }
    } catch (e) {
      // 静默处理错误，不影响页面正常功能
    }
    
    // 初始检查
    setTimeout(function() {
      notifyHeightChange(true);
      // 多次检查，确保内容完全渲染
      setTimeout(forceCheck, 300);
      setTimeout(forceCheck, 600);
      setTimeout(forceCheck, 1000);
    }, 100);
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

