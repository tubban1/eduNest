'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SandboxRendererProps {
  html: string;
  css: string;
  js: string;
  externalLinks: string | string[];
  onError?: (error: string) => void;
  onLoad?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

interface ExternalResource {
  url: string;
  type: 'css' | 'js';
  loaded: boolean;
  error: boolean;
}

export default function SandboxRenderer({
  html,
  css,
  js,
  externalLinks,
  onError,
  onLoad,
  className,
  style
}: SandboxRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [resources, setResources] = useState<ExternalResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState(0);

  // 验证和解析外部链接
  const parseExternalLinks = useCallback((links: string | string[]): ExternalResource[] => {
    // 确保links是字符串
    const linksStr = Array.isArray(links) ? links.join('\n') : String(links || '');
    
    if (!linksStr.trim()) return [];
    
    const urls = linksStr
      .split(/\n|,|;/)
      .map(link => link.trim())
      .filter(Boolean);
    
    return urls.map(url => ({
      url,
      type: url.endsWith('.css') ? 'css' : 'js',
      loaded: false,
      error: false
    }));
  }, []);

  // 验证JavaScript语法
  const validateJavaScript = useCallback((code: string): { valid: boolean; error?: string } => {
    try {
      // 使用Function构造函数验证语法
      new Function(code);
      return { valid: true };
    } catch (err) {
      return { 
        valid: false, 
        error: err instanceof Error ? err.message : 'JavaScript语法错误' 
      };
    }
  }, []);

  // 验证URL安全性
  const validateUrl = useCallback((url: string): boolean => {
    try {
      const urlObj = new URL(url);
      // 只允许HTTPS和常见的CDN域名
      const allowedDomains = [
        'unpkg.com',
        'cdn.jsdelivr.net',
        'cdnjs.cloudflare.com',
        'cdn.jsdelivr.net',
        'code.jquery.com',
        'maxcdn.bootstrapcdn.com',
        'cdnjs.cloudflare.com'
      ];
      
      return urlObj.protocol === 'https:' && 
             allowedDomains.some(domain => urlObj.hostname.endsWith(domain));
    } catch {
      return false;
    }
  }, []);

  // 生成安全的HTML文档
  const generateSafeHtml = useCallback((
    html: string,
    css: string,
    js: string,
    externalResources: ExternalResource[]
  ): string => {
    const validResources = externalResources.filter(r => !r.error);
    const cssResources = validResources.filter(r => r.type === 'css');
    const jsResources = validResources.filter(r => r.type === 'js');

    // 分离Vue相关资源和其他资源
    const vueResources = jsResources.filter(r => r.url.includes('vue'));
    const otherResources = jsResources.filter(r => !r.url.includes('vue'));
    const sortedJsResources = [...vueResources, ...otherResources];

    const cssLinks = cssResources
      .map(r => `<link rel="stylesheet" href="${r.url}" crossorigin="anonymous">`)
      .join('\n');
    
    const jsScripts = sortedJsResources
      .map(r => `<script src="${r.url}" crossorigin="anonymous"></script>`)
      .join('\n');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' https:;">
  ${cssLinks}
  <style>
    /* 基础重置样式 */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      width: 100%;
      min-height: 100vh;
      border: none;
      outline: none;
      overflow-x: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    /* 根元素样式 */
    #root, #app, [data-v-app] {
      width: 100%;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    /* 游戏容器优化 */
    .game-container {
      max-width: 100%;
      overflow-x: auto;
    }
    
    .game-content {
      flex-wrap: wrap;
      justify-content: center;
      gap: 15px;
    }
    
    .game-board {
      max-width: 100%;
      height: auto;
      min-height: 400px;
    }
    
    .side-panel {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .game-title {
      font-size: 2rem !important;
    }
    
    .game-subtitle {
      font-size: 0.9rem !important;
    }
    
    /* 响应式设计 */
    @media (max-width: 768px) {
      .game-container {
        transform: scale(0.9);
      }
      
      .game-content {
        flex-direction: column;
      }
      
      .game-board {
        width: 100%;
        max-width: 300px;
      }
      
      .side-panel {
        flex-direction: row;
        justify-content: center;
      }
    }
    
    /* 错误提示样式 */
    .sandbox-error {
      position: fixed;
      top: 10px;
      right: 10px;
      background: #fee;
      border: 1px solid #fcc;
      padding: 10px;
      border-radius: 4px;
      z-index: 10000;
      max-width: 300px;
      font-size: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .sandbox-error .close-btn {
      float: right;
      cursor: pointer;
      font-weight: bold;
      color: #999;
    }
    
    .sandbox-error .close-btn:hover {
      color: #666;
    }
    
    /* 用户自定义样式 */
    ${css}
  </style>
</head>
<body>
  ${html}
  
  <script>
    // 全局错误处理
    window.addEventListener('error', function(e) {
      // 静默处理沙盒错误
    });
    
    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', function(e) {
      // 静默处理未处理的 Promise 拒绝
    });
    
    // 安全执行用户代码
    function executeUserCode(code) {
      try {
        // 语法验证
        new Function(code);
        
        // 创建新的执行上下文
        const userFunction = new Function(code);
        userFunction();
      } catch (error) {
        // 静默处理用户代码执行错误
      }
    }
    
    // 初始化音频上下文
    function initAudioContext() {
      if (typeof Tone !== 'undefined') {
        const startAudioContext = () => {
          if (Tone.context.state !== 'running') {
            Tone.context.resume();
          }
        };
        
        ['click', 'touchstart', 'keydown', 'mousedown'].forEach(event => {
          document.addEventListener(event, startAudioContext, { once: true });
        });
      }
    }
    
    // 等待资源加载完成
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          // 初始化音频上下文
          initAudioContext();
          
          // 检查Vue是否加载
          if (typeof Vue !== 'undefined') {
            window.GlobalVue = Vue;
            
            // 检查VueKinesis
            if (typeof VueKinesis !== 'undefined') {
              try {
                Vue.use(VueKinesis);
              } catch (error) {
                // VueKinesis 注册失败
              }
            }
          }
          
          // 安全执行用户代码
          executeUserCode(\`${js.replace(/`/g, '\\`')}\`);
          
          // 通知父窗口加载完成
          parent.postMessage({ type: 'SANDBOX_LOADED' }, '*');
        } catch (error) {
          // 初始化错误处理
          parent.postMessage({ type: 'SANDBOX_ERROR', error: error.message }, '*');
        }
      }, 100);
    });
  </script>
  
  ${jsScripts}
</body>
</html>`;
  }, []);

  // 处理iframe消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SANDBOX_LOADED') {
        setIsLoading(false);
        setError(null);
        onLoad?.();
      } else if (event.data?.type === 'SANDBOX_ERROR') {
        setIsLoading(false);
        const errorMsg = event.data.error || '渲染错误';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLoad, onError]);

  // 验证和加载外部资源
  useEffect(() => {
    const parsedResources = parseExternalLinks(externalLinks);
    const validatedResources = parsedResources.map(resource => ({
      ...resource,
      error: !validateUrl(resource.url)
    }));
    
    setResources(validatedResources);
  }, [externalLinks, parseExternalLinks, validateUrl]);

  // 验证JavaScript代码
  useEffect(() => {
    const validation = validateJavaScript(js);
    if (!validation.valid) {
      const errorMsg = validation.error || 'JavaScript语法错误';
      setError(errorMsg);
      onError?.(errorMsg);
    } else {
      setError(null);
    }
  }, [js, validateJavaScript, onError]);

  // 重新渲染
  const refresh = useCallback(() => {
    setRenderKey(prev => prev + 1);
    setIsLoading(true);
    setError(null);
  }, []);

  // 生成安全的HTML文档
  const safeHtml = generateSafeHtml(html, css, js, resources);

  return (
    <div className={`relative ${className || ''}`} style={style}>
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">加载中...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute top-2 right-2 bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded text-sm z-20">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
            <button 
              onClick={refresh}
              className="text-red-500 hover:text-red-700"
            >
              重试
            </button>
          </div>
        </div>
      )}
      
      <iframe
        ref={iframeRef}
        key={renderKey}
        srcDoc={safeHtml}
        title="沙盒预览"
        sandbox="allow-scripts allow-forms allow-same-origin"
        className="w-full h-full border-0 bg-white"
        style={{
          minHeight: '400px',
          height: '100%',
          width: '100%',
          overflow: 'auto'
        }}
      />
    </div>
  );
} 