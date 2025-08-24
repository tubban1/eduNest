'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, Content } from '@/lib/api';
import SandboxRenderer from '@/components/SandboxRenderer';
import { downloadStandalonePage, generateStandaloneContentPage, ContentPageData } from '@/utils/contentPageGenerator';

export default function ContentPage() {
  const params = useParams();
  const router = useRouter();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useStandaloneMode, setUseStandaloneMode] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        const shortId = params.short_id as string;
        const response = await api.content.getByShortId(shortId);
        setContent(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    if (params.short_id) {
      fetchContent();
    }
  }, [params.short_id]);

  const handleDownloadStandalone = () => {
    if (!content) return;
    
    const pageData: ContentPageData = {
      html: content.code_html || '',
      css: content.code_css || '',
      js: content.code_js || '',
      externalLinks: content.external_links || [],
      title: content.title || 'Interactive Content',
      description: content.description || 'AI Generated Interactive Content',
      keywords: 'interactive, content, ai, education',
      author: 'AI Education Platform'
    };
    
    downloadStandalonePage(pageData, `${content.short_id}-standalone.html`);
  };

  const handleOpenStandalone = () => {
    if (!content) return;
    
    const pageData: ContentPageData = {
      html: content.code_html || '',
      css: content.code_css || '',
      js: content.code_js || '',
      externalLinks: content.external_links || [],
      title: content.title || 'Interactive Content',
      description: content.description || 'AI Generated Interactive Content',
      keywords: 'interactive, content, ai, education',
      author: 'AI Education Platform'
    };
    
    // 生成独立页面并在新窗口打开
    const html = generateStandaloneContentPage(pageData);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const newWindow = window.open(url, '_blank');
    if (newWindow) {
      // 清理URL对象
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">加载失败</div>
          <p className="text-gray-600 mb-4">{error || '内容不存在'}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <div className={`bg-white shadow-sm border-b transition-all duration-300 ${
        useStandaloneMode ? 'py-4' : 'py-2'
      }`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h1 className={`font-bold text-gray-900 transition-all duration-300 ${
                useStandaloneMode ? 'text-2xl' : 'text-lg'
              } truncate`}>{content.title}</h1>
              {content.description && (
                <p className={`text-gray-600 mt-1 transition-all duration-300 ${
                  useStandaloneMode ? 'text-base' : 'text-sm'
                } line-clamp-2`}>{content.description}</p>
              )}
              {!useStandaloneMode && (
                <div className="flex items-center space-x-4 mt-2">
                  {/* Tags */}
                  {content.tags && content.tags.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">标签:</span>
                      {content.tags.slice(0, 3).map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {tag}
                        </span>
                      ))}
                      {content.tags.length > 3 && (
                        <span className="text-xs text-gray-500">+{content.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                  
                  {/* Knowledge Points */}
                  {content.knowledge_point && content.knowledge_point.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">知识点:</span>
                      {content.knowledge_point.slice(0, 2).map((point, index) => (
                        <span key={index} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          {point}
                        </span>
                      ))}
                      {content.knowledge_point.length > 2 && (
                        <span className="text-xs text-gray-500">+{content.knowledge_point.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-3 ml-4">
              {!useStandaloneMode && (
                <>
                  {/* Rating */}
                  {content.rating && (
                    <div className="flex items-center space-x-1">
                      <span className="text-yellow-500">⭐</span>
                      <span className="text-sm text-gray-600">{content.rating.toFixed(1)}</span>
                    </div>
                  )}
                  
                  {/* Like Button */}
                  <button className="px-3 py-1 bg-red-100 text-red-600 text-xs rounded-full hover:bg-red-200 transition-colors">
                    ❤️ 点赞
                  </button>
                  
                  {/* Collect Button */}
                  <button className="px-3 py-1 bg-blue-100 text-blue-600 text-xs rounded-full hover:bg-blue-200 transition-colors">
                    📚 收藏
                  </button>
                </>
              )}
              
              <button
                onClick={() => setUseStandaloneMode(!useStandaloneMode)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  useStandaloneMode
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {useStandaloneMode ? '📱 独立页面模式' : '📄 嵌入模式'}
              </button>
              
              {useStandaloneMode && (
                <>
                  <button
                    onClick={handleDownloadStandalone}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    💾 下载独立页面
                  </button>
                  <button
                    onClick={handleOpenStandalone}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                  >
                    🚀 直接打开
                  </button>
                  <a
                    href={`/api/content/${content.short_id}/standalone`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors inline-block"
                  >
                    🌐 独立页面链接
                  </a>
                </>
              )}
              
              {!useStandaloneMode && (
                <button
                  onClick={() => {
                    if (document.documentElement.requestFullscreen) {
                      document.documentElement.requestFullscreen();
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  🖥️ 全屏模式
                </button>
              )}
              
              <button
                onClick={() => router.back()}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                ← 返回
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="w-full">
        {useStandaloneMode ? (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">独立页面模式</h2>
              <p className="text-gray-600 mb-4">
                生成完整的HTML页面，避免iframe兼容性问题，微信完全兼容
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={handleDownloadStandalone}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  💾 下载独立页面
                </button>
                <button
                  onClick={handleOpenStandalone}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  🚀 直接打开
                </button>
                <a
                  href={`/api/content/${content.short_id}/standalone`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors inline-block"
                >
                  🌐 独立页面链接
                </a>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">独立页面优势：</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 微信完全兼容，无iframe限制</li>
                <li>• 独立运行，性能更好</li>
                <li>• 支持所有浏览器和设备</li>
                <li>• 可以单独部署和分享</li>
                <li>• SEO友好，搜索引擎可索引</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="w-full h-screen">
            <SandboxRenderer
              html={content.code_html || ''}
              css={content.code_css || ''}
              js={content.code_js || ''}
              externalLinks={content.external_links || []}
              enableLibrarySupport={true}
              enablePerformance={true}
              enableErrorBoundary={true}
              className="w-full h-full"
              style={{ 
                width: '100%',
                height: 'calc(100vh + 20px)',
                border: 'none',
                margin: '0 0 16px 0',
                padding: '0'
              }}
              onError={(error) => {
                console.log('Content render error:', error);
              }}
              onLoad={() => {
                console.log('Content loaded successfully');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
} 