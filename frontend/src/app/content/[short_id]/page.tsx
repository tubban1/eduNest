'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, Content } from '@/lib/api';
import SandboxRenderer from '@/components/SandboxRenderer';

export default function ContentPage() {
  const params = useParams();
  const router = useRouter();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isCollected, setIsCollected] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [collectionCount, setCollectionCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        const shortId = params.short_id as string;
        const response = await api.content.getByShortId(shortId);
        setContent(response);
        
        // 获取点赞和收藏状态
        if (response.id) {
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
            
            // 设置计数
            setLikeCount(response.likes_count || 0);
            setCollectionCount(response.collections_count || 0);
          } catch (err) {
            console.log('Failed to fetch user interaction status:', err);
          }
        }
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

  const handleLike = async () => {
    if (!content || isProcessing) return;
    
    setIsProcessing(true);
    try {
      if (isLiked) {
        await api.unlikeContent(content.id);
        setLikeCount(prev => Math.max(0, prev - 1));
        setIsLiked(false);
      } else {
        await api.likeContent(content.id);
        setLikeCount(prev => prev + 1);
        setIsLiked(true);
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCollect = async () => {
    if (!content || isProcessing) return;
    
    setIsProcessing(true);
    try {
      if (isCollected) {
        // 获取用户的收藏列表，找到对应的收藏记录并删除
        const collections = await api.getCollectionsByContent(content.id);
        if (collections.length > 0) {
          await api.removeContentFromList(content.id, collections[0].list_id);
          setCollectionCount(prev => Math.max(0, prev - 1));
          setIsCollected(false);
        }
      } else {
        // 添加到默认收藏列表
        const lists = await api.getCollectionLists();
        if (lists.length > 0) {
          await api.addContentToList(content.id, lists[0].id);
          setCollectionCount(prev => prev + 1);
          setIsCollected(true);
        }
      }
    } catch (err) {
      console.error('Failed to toggle collection:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenInBrowser = () => {
    if (!content) return;
    
    // 在新窗口打开当前页面
    const currentUrl = window.location.href;
    window.open(currentUrl, '_blank');
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
      {/* 页面头部 - 移动端优化 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col space-y-3">
            {/* 标题和描述 */}
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-900 text-lg sm:text-xl md:text-2xl truncate">
                {content.title}
              </h1>
              {content.description && (
                <p className="text-gray-600 mt-1 text-sm sm:text-base line-clamp-2">
                  {content.description}
                </p>
              )}
            </div>
            
            {/* 标签和知识点 - 移动端优化 */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Tags */}
              {content.tags && content.tags.length > 0 && (
                <>
                  <span className="text-gray-500">标签:</span>
                  {content.tags.slice(0, 3).map((tag, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                      {tag}
                    </span>
                  ))}
                  {content.tags.length > 3 && (
                    <span className="text-gray-500">+{content.tags.length - 3}</span>
                  )}
                </>
              )}
              
              {/* Knowledge Points */}
              {content.knowledge_point && content.knowledge_point.length > 0 && (
                <>
                  <span className="text-gray-500 ml-2">知识点:</span>
                  {content.knowledge_point.slice(0, 2).map((point, index) => (
                    <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                      {point}
                    </span>
                  ))}
                  {content.knowledge_point.length > 2 && (
                    <span className="text-gray-500">+{content.knowledge_point.length - 2}</span>
                  )}
                </>
              )}
            </div>
            
            {/* 操作按钮区域 - 移动端优化 */}
            <div className="flex items-center justify-between">
              {/* 左侧：评分和统计 */}
              <div className="flex items-center space-x-4">
                {content.rating && (
                  <div className="flex items-center space-x-1">
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-sm text-gray-600">{content.rating.toFixed(1)}</span>
                  </div>
                )}
                
                {/* 点赞统计 */}
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <span>❤️ {likeCount}</span>
                </div>
                
                {/* 收藏统计 */}
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <span>📚 {collectionCount}</span>
                </div>
              </div>
              
              {/* 右侧：操作按钮 */}
              <div className="flex items-center space-x-2">
                {/* 点赞按钮 */}
                <button 
                  onClick={handleLike}
                  disabled={isProcessing}
                  className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                    isLiked 
                      ? 'bg-red-500 text-white hover:bg-red-600' 
                      : 'bg-red-100 text-red-600 hover:bg-red-200'
                  } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLiked ? '❤️ 已点赞' : '🤍 点赞'}
                </button>
                
                {/* 收藏按钮 */}
                <button 
                  onClick={handleCollect}
                  disabled={isProcessing}
                  className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                    isCollected 
                      ? 'bg-blue-500 text-white hover:bg-blue-600' 
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isCollected ? '📚 已收藏' : '📖 收藏'}
                </button>
                
                {/* 用浏览器打开按钮 */}
                <button
                  onClick={handleOpenInBrowser}
                  className="px-3 py-1.5 bg-green-100 text-green-600 text-xs rounded-full hover:bg-green-200 transition-colors"
                >
                  🌐 用浏览器打开
                </button>
                
                {/* 返回按钮 */}
                <button
                  onClick={() => router.back()}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-full hover:bg-gray-200 transition-colors"
                >
                  ← 返回
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="w-full">
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
              height: 'calc(100vh - 120px)', // 调整高度以适应新的头部
              border: 'none',
              margin: '0',
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
      </div>
    </div>
  );
} 