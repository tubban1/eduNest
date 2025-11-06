'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ContentActionButtons from '@/components/ui/ContentActionButtons';
import { api, Content } from '@/lib/api';
import FullHTMLRenderer from '@/components/FullHTMLRenderer';
import SandboxRenderer from '@/components/SandboxRenderer';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useSmartBack } from '@/utils/navigation';

export default function FullHTMLContentPage() {
  const params = useParams();
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const { handleSmartBack } = useSmartBack();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isCollected, setIsCollected] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [collectionCount, setCollectionCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);

  useEffect(() => {
    // 保存原始标题，用于组件卸载时恢复
    const originalTitle = document.title;
    
    // 组件卸载时恢复原始标题
    return () => {
      document.title = originalTitle;
    };
  }, []);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        const shortId = params.short_id as string;
        const response = await api.content.getByShortId(shortId);
        setContent(response);
        
        // 动态设置浏览器标题
        if (response.title) {
          document.title = `${response.title} - EduNest AI`;
        } else {
          document.title = '内容详情 - EduNest AI';
        }
        
        // 设置计数（无论是否登录都显示）
        setLikeCount(response.likes_count || 0);
        setCollectionCount(response.collections_count || 0);
        
        // 只有在用户已登录时才获取点赞和收藏状态
        if (response.id && user) {
          try {
            const [likedResponse, collectionsResponse] = await Promise.all([
              api.getLikedContent(),
              api.getCollectionsByContent(response.id)
            ]);
            
            // 检查是否已点赞
            const isUserLiked = likedResponse.some((item: any) => item.content_id === response.id);
            setIsLiked(isUserLiked);
            
            // 检查是否已收藏
            const isUserCollected = collectionsResponse.length > 0;
            setIsCollected(isUserCollected);
          } catch (err) {
            // 静默处理错误
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
        document.title = '加载失败 - EduNest AI';
      } finally {
        setLoading(false);
      }
    };

    if (params.short_id) {
      fetchContent();
    }
  }, [params.short_id, user]);

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

  // 判断使用哪个渲染器：如果有 full_html 字段，使用 FullHTMLRenderer
  const hasFullHTML = content.full_html && content.full_html.trim().length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* 第一行：返回按钮、标题、logo */}
          <div className="flex items-center mb-3">
            {/* 左侧：返回按钮 */}
            <button
              onClick={handleSmartBack}
              className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors mr-3"
            >
              ← {t('back')}
            </button>
            
            {/* 中间：标题 */}
            <h1 className="flex-1 font-bold text-gray-900 text-lg sm:text-xl md:text-2xl truncate">
              {content.title}
            </h1>
            
            {/* 右侧：favicon logo链接到首页 */}
            <Link href="/" className="ml-3">
              <Image
                src="/favicon.png"
                alt="EduNest AI"
                width={32}
                height={32}
                className="w-8 h-8 hover:opacity-80 transition-opacity"
              />
            </Link>
          </div>
          
          {/* 第二行：description */}
          {content.description && (
            <div className="mb-3">
              <p className="text-gray-600 text-sm sm:text-base">
                {content.description}
              </p>
            </div>
          )}
          
          {/* 第三行：点赞收藏按钮 + 标签 */}
          <div className="flex items-center">
            {/* 左侧：点赞收藏分享按钮 - 使用统一控件 */}
            <div className="mr-4">
              <ContentActionButtons
                contentId={content.id}
                shortId={content.short_id}
                title={content.title}
                initialLiked={user ? isLiked : false}
                initialCollected={user ? isCollected : false}
                initialLikeCount={likeCount}
                initialCollectionCount={collectionCount}
                size="md"
                showCount={true}
                showText={false}
                disabled={!user}
                onLikeChange={(liked, count) => {
                  if (user) {
                    setIsLiked(liked);
                    setLikeCount(count);
                  }
                }}
                onCollectChange={(collected, count) => {
                  if (user) {
                    setIsCollected(collected);
                    setCollectionCount(count);
                  }
                }}
              />
            </div>
            
            {/* 右侧：标签一行显示，超出显示+号 */}
            <div className="flex-1 min-w-0">
              {content.tags && content.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {(() => {
                    const maxVisibleTags = 3;
                    const visibleTags = showAllTags ? content.tags : content.tags.slice(0, maxVisibleTags);
                    const remainingCount = content.tags.length - maxVisibleTags;
                    
                    return (
                      <>
                        {visibleTags.map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full whitespace-nowrap">
                            {tag}
                          </span>
                        ))}
                        
                        {!showAllTags && remainingCount > 0 && (
                          <button
                            onClick={() => setShowAllTags(true)}
                            className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-full hover:bg-blue-200 transition-colors"
                            title={`还有 ${remainingCount} 个标签`}
                          >
                            +{remainingCount}
                          </button>
                        )}
                        
                        {showAllTags && content.tags.length > maxVisibleTags && (
                          <button
                            onClick={() => setShowAllTags(false)}
                            className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full hover:bg-gray-300 transition-colors"
                            title="收起标签"
                          >
                            收起
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="w-full">
        <div className="w-full">
          {hasFullHTML ? (
            // 使用 FullHTMLRenderer 渲染完整 HTML
            <FullHTMLRenderer
              fullHTML={content.full_html!}
              autoHeight={true}
              enableHeightListener={true}
              className="w-full"
              style={{ 
                width: '100%',
                height: 'auto',
                minHeight: 'calc(100vh - 160px)',
                border: 'none',
                margin: '0',
                padding: '0'
              }}
              onError={(error) => {
                console.error('FullHTMLRenderer error:', error);
                setError(error);
              }}
              onLoad={() => {
                console.log('FullHTMLRenderer loaded');
              }}
            />
          ) : (
            // 使用 SandboxRenderer 渲染分离的 HTML/CSS/JS
            <SandboxRenderer
              html={content.code_html || ''}
              css={content.code_css || ''}
              js={content.code_js || ''}
              externalLinks={content.external_links || []}
              enableLibrarySupport={true}
              enablePerformance={true}
              enableErrorBoundary={true}
              className="w-full"
              style={{ 
                width: '100%',
                height: 'auto',
                minHeight: 'calc(100vh - 160px)',
                border: 'none',
                margin: '0',
                padding: '0'
              }}
              onError={(error) => {
                console.error('SandboxRenderer error:', error);
                setError(error);
              }}
              onLoad={() => {
                console.log('SandboxRenderer loaded');
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

