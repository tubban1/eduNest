'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ContentActionButtons from '@/components/ui/ContentActionButtons';
import LanguageSelector from '@/components/LanguageSelector';
import { api, Content } from '@/lib/api';
import FullHTMLRenderer from '@/components/FullHTMLRenderer';
import { AIGuidedLearning } from '@/components/AIGuidedLearning';
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

  useEffect(() => {
    // 保存原始标题，用于组件卸载时恢复
    const originalTitle = document.title;
    
    // 组件卸载时恢复原始标题
    return () => {
      document.title = originalTitle;
    };
  }, []);

  // 获取内容（只在 short_id 变化时执行）
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
  }, [params.short_id]);

  // 获取点赞和收藏状态（只在用户 ID 变化时执行，避免 user 对象引用变化导致刷新）
  useEffect(() => {
    const fetchUserStatus = async () => {
      if (!content?.id || !user?.id) {
        setIsLiked(false);
        setIsCollected(false);
        return;
      }

      try {
        const [likedResponse, collectionsResponse] = await Promise.all([
          api.getLikedContent(),
          api.getCollectionsByContent(content.id)
        ]);
        
        // 检查是否已点赞
        const isUserLiked = likedResponse.some((item: any) => item.content_id === content.id);
        setIsLiked(isUserLiked);
        
        // 检查是否已收藏
        const isUserCollected = collectionsResponse.length > 0;
        setIsCollected(isUserCollected);
      } catch (err) {
        // 静默处理错误
      }
    };

    fetchUserStatus();
  }, [content?.id, user?.id]);

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

  // c 页面只显示 full_html
  if (!content.full_html || !content.full_html.trim()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">内容不存在</div>
          <p className="text-gray-600 mb-4">该内容没有完整的 HTML 内容</p>
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

  const HEADER_HEIGHT = 64;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* 顶栏：固定一行 */}
      <div className="sticky top-0 z-40 bg-white shadow-sm border-b h-16">
        <div className="max-w-7xl mx-auto h-full px-4">
          <div className="flex items-center h-full gap-3">
            {/* 返回 */}
            <button
              onClick={handleSmartBack}
              className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              ← {t('back')}
            </button>

            {/* 点赞收藏分享组合 */}
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

            {/* 占位撑开 */}
            <div className="flex-1" />

            {/* 语言切换 */}
            <div className="hidden sm:block">
              <LanguageSelector variant="button" />
            </div>
            <div className="sm:hidden">
              <LanguageSelector variant="button" />
            </div>

            {/* Logo */}
            <Link href="/" className="ml-2">
              <Image
                src="/favicon.png"
                alt="EduNest AI"
                width={32}
                height={32}
                className="w-8 h-8 hover:opacity-80 transition-opacity"
              />
            </Link>
          </div>
        </div>
      </div>
      
      {/* 内容区域：iframe 内滚动，父容器不出现滚动条 */}
      <div className="w-full flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
        <FullHTMLRenderer
          fullHTML={content.full_html}
          externalUrl={`/full-html/${content.short_id}`}
          autoHeight={false}
          fixedHeight={true}
          className="w-full flex-1"
          style={{ 
            width: '100%',
            height: `calc(100vh - ${HEADER_HEIGHT}px)`,
            minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
            border: 'none',
            margin: '0',
            padding: '0'
          }}
          onError={(error) => {
            console.error('FullHTMLRenderer error:', error);
            setError(error);
          }}
        />
        {/* AI Guided Learning - Always show button, even for non-logged-in users */}
        {content?.id && (
          <AIGuidedLearning 
            contentId={content.id} 
            onUIStateChange={(state) => console.log('UI State:', state)} 
          />
        )}
      </div>
    </div>
  );
}

