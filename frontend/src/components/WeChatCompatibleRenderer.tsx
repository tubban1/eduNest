'use client';

import React, { useMemo } from 'react';
import SandboxRenderer from './SandboxRenderer';

interface WeChatCompatibleRendererProps {
  html: string;
  css: string;
  js: string;
  externalLinks: string | string[];
  externalUrl?: string; // 部署在独立服务器上的可公开访问URL
  title?: string; // 为兼容旧调用保留（当前不直接使用）
  className?: string;
  style?: React.CSSProperties;
  onError?: (error: string) => void;
  onLoad?: () => void;
}

/**
 * 微信兼容渲染器（精简版，无调试UI）
 * - 检测到微信环境时，优先使用原生 iframe 并加载 externalUrl（需预先部署静态HTML）。
 * - 非微信环境则走标准 srcDoc 渲染。
 */
export default function WeChatCompatibleRenderer({
  html,
  css,
  js,
  externalLinks,
  externalUrl,
  title, // 占位以兼容调用方
  className,
  style,
  onError,
  onLoad,
}: WeChatCompatibleRendererProps) {
  const isWeChat = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /MicroMessenger/i.test(ua) || /X5Browser/i.test(ua);
  }, []);

  // 在微信中：如果提供了 externalUrl，则使用原生 iframe 加载该 URL
  if (isWeChat && externalUrl) {
    return (
      <SandboxRenderer
        html={html}
        css={css}
        js={js}
        externalLinks={externalLinks}
        useNativeIframe={true}
        externalUrl={externalUrl}
        enableLibrarySupport={true}
        className={className}
        style={style}
        onError={onError}
        onLoad={onLoad}
      />
    );
  }

  // 其它环境：使用标准渲染
  return (
    <SandboxRenderer
      html={html}
      css={css}
      js={js}
      externalLinks={externalLinks}
      enableLibrarySupport={true}
      className={className}
      style={style}
      onError={onError}
      onLoad={onLoad}
    />
  );
}