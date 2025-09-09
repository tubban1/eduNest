'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, Content } from '@/lib/api';
import ContentForm from '@/components/ContentForm';
import { downloadStandalonePage, generateStandaloneContentPage, ContentPageData } from '@/utils/contentPageGenerator';
import { useTranslation } from 'react-i18next';
import { useSmartBack } from '@/utils/navigation';

export default function EditContentPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation('common');
  const { handleSmartBack } = useSmartBack();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useStandaloneMode, setUseStandaloneMode] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        const uuid = params.uuid as string;
        const response = await api.content.getById(uuid);
        setContent(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    if (params.uuid) {
      fetchContent();
    }
  }, [params.uuid]);

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
    
    downloadStandalonePage(pageData, `${content.short_id}-edit-standalone.html`);
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
            onClick={handleSmartBack}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {t('back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      
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
                  className="px-6 py-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors inline-block"
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
            <ContentForm
              initialContent={content}
              mode="edit"
              contentId={content.id}
              className="w-full h-full"
              style={{ 
                width: '100%',
                height: '100vh',
                border: 'none',
                margin: '0',
                padding: '0'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
} 