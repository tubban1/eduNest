'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { generateCodePenDataURL, CodePenContent } from '../utils/codepenStyleGenerator';

interface CodePenStyleRendererProps {
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
 * CodePen风格渲染器
 * 模仿CodePen的简单结构，解决微信兼容性问题
 */
export default function CodePenStyleRenderer({
  html,
  css,
  js,
  externalLinks,
  onError,
  onLoad,
  className,
  style,
  title = 'CodePen Style Sandbox'
}: CodePenStyleRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');

  // 生成CodePen风格的Data URL
  const generateIframeSrc = useCallback(() => {
    const content: CodePenContent = {
      html,
      css,
      js,
      externalLinks,
      title
    };
    
    const dataURL = generateCodePenDataURL(content);
    console.log('CodePen style: Data URL length:', dataURL.length);
    
    return dataURL;
  }, [html, css, js, externalLinks, title]);

  // 更新调试信息
  useEffect(() => {
    const content: CodePenContent = {
      html,
      css,
      js,
      externalLinks,
      title
    };
    
    const dataURL = generateCodePenDataURL(content);
    setDebugInfo(`Data URL长度: ${dataURL.length} 字符`);
  }, [html, css, js, externalLinks, title]);

  // 重新加载
  const refresh = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    
    if (iframeRef.current) {
      iframeRef.current.src = generateIframeSrc();
    }
  }, [generateIframeSrc]);

  // 下载HTML文件
  const downloadHTML = useCallback(() => {
    const content: CodePenContent = {
      html,
      css,
      js,
      externalLinks,
      title
    };
    
    const { downloadCodePenHTML } = require('../utils/codepenStyleGenerator');
    downloadCodePenHTML(content, 'codepen-style-sandbox.html');
  }, [html, css, js, externalLinks, title]);

  return (
    <div className={`relative ${className || ''}`} style={style}>
      {/* CodePen风格提示 */}
      <div className="absolute top-0 left-0 bg-purple-600 text-white text-xs p-2 z-40 max-w-xs">
        <div className="font-bold mb-1">🎨 CodePen风格模式</div>
        <div>模仿CodePen的简单结构</div>
        <div>加载状态: {isLoading ? '🔄 加载中' : '✅ 已完成'}</div>
        <div className="text-xs opacity-75">{debugInfo}</div>
        <div className="mt-2 space-y-1">
          <button
            onClick={refresh}
            className="w-full px-2 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">CodePen风格模式加载中...</p>
            <p className="text-xs text-gray-500 mt-1">模仿CodePen的简单结构，提高微信兼容性</p>
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

      {/* CodePen风格的iframe */}
      <iframe
        ref={iframeRef}
        src={generateIframeSrc()}
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
          console.log('CodePen style iframe loaded successfully');
          setIsLoading(false);
          onLoad?.();
        }}
        onError={() => {
          const errorMsg = 'CodePen风格iframe加载失败';
          console.error('CodePen style iframe error:', errorMsg);
          setHasError(true);
          setErrorMessage(errorMsg);
          setIsLoading(false);
          onError?.(errorMsg);
        }}
      />
    </div>
  );
} 