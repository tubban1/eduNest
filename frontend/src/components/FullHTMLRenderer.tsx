'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation(['common']);
  const [mounted, setMounted] = useState(false);
  const [runtimeFullScreen, setRuntimeFullScreen] = useState(false);
  // 运行时检测到内容高度远超视口，覆盖静态全屏检测
  const [runtimeOverrideFullScreen, setRuntimeOverrideFullScreen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 检测是否为 3D/WebGL 应用或全屏应用
  const isStaticFullScreenApp = useMemo(() => {
    if (!fullHTML) return false;
    const lower = fullHTML.toLowerCase();
    
    // 检测 3D/WebGL 库
    const has3DLib = lower.includes('three.js') || 
                     lower.includes('three.min.js') || 
                     lower.includes('webgl');
    
    // 更精确的全屏检测：只检测 body 或 html 标签上的样式
    // 匹配 body { ... overflow: hidden ... } 或 html, body { ... overflow: hidden ... }
    const bodyOverflowHiddenRegex = /body\s*\{[^}]*overflow\s*:\s*hidden/i;
    const htmlBodyOverflowRegex = /html\s*,?\s*body\s*\{[^}]*overflow\s*:\s*hidden/i;
    const hasBodyOverflowHidden = bodyOverflowHiddenRegex.test(fullHTML) || htmlBodyOverflowRegex.test(fullHTML);
    
    // 检测 body 上的 height: 100vh
    const bodyHeightVhRegex = /body\s*\{[^}]*height\s*:\s*100vh/i;
    const hasBodyHeightVh = bodyHeightVhRegex.test(fullHTML);
    
    // 全屏 canvas 特征
    const hasFullscreenCanvas = lower.includes('<canvas') && 
                                 (lower.includes('height: 100%') || lower.includes('height:100%'));
    
    const result = has3DLib || hasBodyOverflowHidden || hasBodyHeightVh || hasFullscreenCanvas;
    
    return result;
  }, [fullHTML]);

  // 如果运行时检测到内容高度远超视口，覆盖静态检测
  const effectiveCodepenMode = codepenMode || runtimeFullScreen || (isStaticFullScreenApp && !runtimeOverrideFullScreen);

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
  const heightUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAppliedHeightRef = useRef<number>(0);
  

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
   * 设置高度（带防抖）
   */
  const applyHeight = useCallback((height: number) => {
    if (!autoHeight || fixedHeight || forceExternalInWechat || effectiveCodepenMode) {
      return;
    }
    if (height < 100 || height > 15000) {
      return;
    }
    
    // 如果高度变化小于 20px，忽略（避免微小抖动）
    if (Math.abs(height - lastAppliedHeightRef.current) < 20) {
      return;
    }
    
    // 清除之前的定时器
    if (heightUpdateTimerRef.current) {
      clearTimeout(heightUpdateTimerRef.current);
    }
    
    // 防抖：延迟 200ms 更新
    heightUpdateTimerRef.current = setTimeout(() => {
      const bufferedHeight = height + 50;
      lastAppliedHeightRef.current = height;
      setIframeHeight(bufferedHeight);
      heightUpdateTimerRef.current = null;
    }, 200);
  }, [autoHeight, fixedHeight, forceExternalInWechat, effectiveCodepenMode]);

  // 监听 iframe 消息
  useEffect(() => {
    if (!autoHeight || fixedHeight || forceExternalInWechat) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'IFRAME_HEIGHT_CHANGE') {
        const { height, isFullScreen } = event.data.data;
        
        if (isFullScreen) {
          setRuntimeFullScreen(true);
          setRuntimeOverrideFullScreen(false);
          // 全屏模式也保存高度，用于设置容器 minHeight
          if (height > 0 && height < 15000) {
            setIframeHeight(height);
          }
        } else {
          // 如果之前是全屏模式，现在收到非全屏消息，说明内容变化导致不再满足全屏条件
          // 需要退出全屏模式，切换到普通模式，并直接应用高度
          const wasFullScreen = runtimeFullScreen;
          if (wasFullScreen) {
            setRuntimeFullScreen(false);
            // 直接应用高度，因为状态更新是异步的，applyHeight 可能还会检查旧的 effectiveCodepenMode
            if (height >= 100 && height <= 15000) {
              const bufferedHeight = height + 50;
              setIframeHeight(bufferedHeight);
              lastAppliedHeightRef.current = height;
            }
            return; // 已经处理了，不需要继续
          }
          
          // 如果静态检测认为是全屏应用，但运行时发现内容高度远超视口（超过视口高度 + 200px）
          // 说明这是误判，应该覆盖静态检测，使用自动高度模式
          if (isStaticFullScreenApp && height > window.innerHeight + 200) {
            setRuntimeOverrideFullScreen(true);
            // 直接应用高度，因为我们已经覆盖了全屏模式
            if (height >= 100 && height <= 15000) {
              const bufferedHeight = height + 50;
              setIframeHeight(bufferedHeight);
              lastAppliedHeightRef.current = height;
            }
          } else {
            // 正常情况，使用 applyHeight
            applyHeight(height);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [autoHeight, fixedHeight, forceExternalInWechat, applyHeight, isStaticFullScreenApp, runtimeFullScreen]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (heightUpdateTimerRef.current) {
        clearTimeout(heightUpdateTimerRef.current);
      }
    };
  }, []);

  // 重新渲染
  const refresh = useCallback(() => {
    setPreviewKey(prev => prev + 1);
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    setIframeHeight(600);
    lastAppliedHeightRef.current = 0;
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

  // 检测 HTML 中是否有锚点链接
  const hasAnchorLinks = useMemo(() => {
    if (!fullHTML) return false;
    // 检测 <a href="#..."> 格式的链接
    return /<a[^>]+href=["']#[\w-]+["'][^>]*>/i.test(fullHTML);
  }, [fullHTML]);

  /**
   * 注入高度检测脚本和锚点跳转处理（使用 ResizeObserver 和 postMessage）
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
  var hasSentInitialHeight = false;
  // 运行时检测：页面是否包含 Canvas
  // 如果包含，通常意味着这是一个 3D/图表应用，应该由容器控制高度，而不是内容撑开高度
  var is3DApp = !!document.querySelector('canvas'); 
  var observer = null;

  function getHeight() {
    var body = document.body;
    var html = document.documentElement;
    if (!body) return 0;
    
    // 获取精确高度 - 使用 scrollHeight 作为主要依据
    var scrollHeight = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.scrollHeight,
      html.offsetHeight
    );
    
    return Math.ceil(scrollHeight);
  }

  function sendHeight(force) {
    var height = getHeight();
    var viewportHeight = window.innerHeight;
    
    // 运行时全屏检测策略（仅对 3D 应用）
    if (is3DApp) {
        // 对于 3D 应用，判断是否需要全屏模式：
        // 如果高度 <= 视口高度的 105%（允许 5% 误差），认为是全屏应用
        // 否则，用父容器滚动
        var heightRatio = height / viewportHeight;
        var heightDiff = height - viewportHeight;
        
        if (heightRatio <= 1.05) {
           // 高度接近视口（误差在 5% 内），认为是全屏应用
           if (window.parent) {
              window.parent.postMessage({
                type: "IFRAME_HEIGHT_CHANGE",
                data: { height: height, isFullScreen: true }
              }, "*");
           }
           return;
        } else {
           // 高度明显超过视口（> 5%），用父容器滚动
           // 继续执行下面的普通高度发送逻辑
        }
    }
    
    // 对于普通内容：只在初始加载时发送一次，之后不再发送（避免循环）
    if (!is3DApp && hasSentInitialHeight && !force) {
      return;
    }
    
    // Jitter 处理：忽略 10px 以内的微小变化
    if (!force && Math.abs(height - lastHeight) <= 10) {
      return;
    }

    lastHeight = height;
    hasSentInitialHeight = true;
    
    if (window.parent) {
      window.parent.postMessage({
        type: "IFRAME_HEIGHT_CHANGE",
        data: { height: height, isFullScreen: false }
      }, "*");
    }
  }

  function onResize() {
    // 对于普通内容，不监听 ResizeObserver（避免循环）
    if (!is3DApp) {
      return;
    }
    
    // 3D 应用需要响应 resize，但增加防抖
    if (throttleTimer) return;
    throttleTimer = setTimeout(function() {
      sendHeight();
      throttleTimer = null;
    }, 200);
  }

  function checkAppType() {
    is3DApp = !!document.querySelector('canvas');
  }

  // 处理锚点跳转
  function handleAnchorLinks() {
    // 拦截所有锚点链接的点击事件
    document.addEventListener('click', function(e) {
      var target = e.target;
      // 向上查找 <a> 标签
      while (target && target.tagName !== 'A') {
        target = target.parentElement;
      }
      
      if (target && target.tagName === 'A') {
        var href = target.getAttribute('href');
        // 如果是锚点链接（以 # 开头）
        if (href && href.startsWith('#')) {
          var id = href.substring(1);
          var targetElement = document.getElementById(id) || document.querySelector('[name="' + id + '"]');
          
          if (targetElement) {
            e.preventDefault();
            // 使用 scrollIntoView 平滑滚动到目标元素
            targetElement.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
            // 更新 URL hash（不触发页面跳转）
            if (window.history && window.history.pushState) {
              window.history.pushState(null, '', '#' + id);
            }
          }
        }
      }
    });
    
    // 处理页面加载时的 hash（如果 URL 中有 #）
    if (window.location.hash) {
      setTimeout(function() {
        var id = window.location.hash.substring(1);
        var targetElement = document.getElementById(id) || document.querySelector('[name="' + id + '"]');
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }, 100);
    }
  }

  // 初始化：只在页面加载完成后发送一次高度
  function init() {
    checkAppType();
    // 延迟发送，确保内容已渲染
    setTimeout(function() {
      sendHeight(true); // 强制发送初始高度
    }, 100);
    
    // 处理锚点链接
    handleAnchorLinks();
    
    // 对于 3D 应用，启动 ResizeObserver
    if (is3DApp) {
      setTimeout(function() {
        if (document.body) {
          observer = new ResizeObserver(onResize);
          observer.observe(document.body);
        }
      }, 500);
    }
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', function() {
       init();
    });
  }

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

  const isRuntimeFullscreenLayout = runtimeFullScreen;

  // iframe 样式 - 简单稳定
  const iframeStyle: React.CSSProperties = {
    border: 'none',
    outline: 'none',
    margin: 0,
    padding: 0,
    display: 'block',
    width: '100%',
    // 全屏模式下使用内容高度，避免 100% 导致被父容器截断
    flex: fixedHeight
      ? '1 1 0%'
      : isRuntimeFullscreenLayout
        ? 'none'
        : (effectiveCodepenMode ? '1 1 0%' : 'none'),
    height: fixedHeight
      ? '100%'
      : isRuntimeFullscreenLayout
        ? `${iframeHeight}px`
        : (effectiveCodepenMode ? '100%' : `${iframeHeight}px`),
    overflow: 'hidden',
    WebkitOverflowScrolling: 'touch',
  };

  // 如果有锚点链接，或者外层选择了非自适应高度（如编辑页的固定预览区），允许 iframe 自身滚动
  // 场景：
  // - fixedHeight: 卡片/布局本身固定高度，内部内容需要滚动
  // - hasAnchorLinks: 为支持锚点跳转，必须允许滚动
  // - !autoHeight: 调用方显式关闭自动高度检测（例如编辑页面的 sandbox 预览），此时用滚动来适配超长内容
  const iframeScrolling = fixedHeight || hasAnchorLinks || !autoHeight ? 'auto' : 'no';

  // 计算容器样式
  const containerMinHeight = (() => {
    if (fixedHeight) {
      return style?.minHeight || '100%';
    }
    if (isRuntimeFullscreenLayout) {
      // 运行时全屏：直接使用内容高度，避免被截断
      return `${iframeHeight}px`;
    }
    if (effectiveCodepenMode) {
      return style?.minHeight || '100%';
    }
    // 自动高度模式：使用内容高度
    return style?.minHeight || `${iframeHeight}px`;
  })();

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
        // 全屏模式：使用 minHeight 作为实际高度，因为父容器可能没有高度，100% 不生效
        height: (() => {
          if (fixedHeight) return style?.minHeight || '100%';
          if (isRuntimeFullscreenLayout) return `${iframeHeight}px`;
          if (effectiveCodepenMode) return style?.minHeight || '100%';
          return style?.height || 'auto';
        })(),
        minHeight: containerMinHeight,
        paddingBottom: 0, // 强制移除底部内边距
        marginBottom: 0,  // 强制移除底部外边距
      }}
    >
      {/* 加载指示器 */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-card bg-opacity-90 z-30">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-foreground">
              {mounted ? t('loading', { ns: 'common', defaultValue: '加载中...' }) : '加载中...'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {mounted ? t('pleaseWait', { ns: 'common', defaultValue: '请稍候，内容正在渲染' }) : '请稍候，内容正在渲染'}
            </p>
          </div>
        </div>
      )}

      {/* 错误显示 */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 z-30">
          <div className="text-center max-w-md mx-4">
            <div className="text-destructive text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-destructive mb-2">渲染失败</h3>
            <p className="text-destructive mb-4">{errorMessage}</p>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:opacity-90 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* 微信提示 */}
      {forceExternalInWechat && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-warning/10 border border-warning/30 text-warning rounded-md text-sm shadow">
          为获得完整体验，请点击右上角菜单并选择&nbsp;&quot;在浏览器中打开&quot;。
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
            className="w-full h-full border-0 bg-card"
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
            scrolling={iframeScrolling}
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
          scrolling={iframeScrolling}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      ) : null}
    </div>
  );
}

