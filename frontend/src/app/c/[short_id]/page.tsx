'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import AiLoadingAnimation from '@/components/AiLoadingAnimation';
import FailedCard from '@/components/generation/FailedCard';
import { HybridStatusManager } from '@/utils/generationStatus';
import { getVisitorId } from '@/utils/visitorId';

export default function FullHTMLContentPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation(['common', 'content']);
  const { handleSmartBack } = useSmartBack();
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isCollected, setIsCollected] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [collectionCount, setCollectionCount] = useState(0);
  
  // 生成状态相关
  const [generationStatus, setGenerationStatus] = useState<'pending' | 'processing' | 'done' | 'failed' | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [userQuery, setUserQuery] = useState<string>('');
  const [queuedAt, setQueuedAt] = useState<string>('');
  const [startedAt, setStartedAt] = useState<string>('');
  const [elapsedTime, setElapsedTime] = useState<number>(0); // 计时器（秒）
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState(false);
  const hybridStatusManagerRef = useRef<HybridStatusManager | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 避免 SSR/CSR 文案不一致的水合报错
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // 保存原始标题，用于组件卸载时恢复
    const originalTitle = document.title;
    
    // 组件卸载时恢复原始标题
    return () => {
      document.title = originalTitle;
    };
  }, []);

  // 记录页面访问（异步，不阻塞页面渲染）
  // 注意：只在生产环境或明确启用时记录（避免开发环境产生测试数据）
  useEffect(() => {
    if (!content?.id) return;

    // 检查是否应该记录访问
    // 生产环境或明确启用时记录，开发环境默认不记录
    const shouldRecord = 
      process.env.NODE_ENV === 'production' || 
      process.env.NEXT_PUBLIC_ENABLE_PAGE_VIEWS === 'true';

    if (!shouldRecord) {
      return;
    }

    // 异步记录访问，静默处理错误
    api.pageViews.record(content.id).catch(() => {
      // 静默处理错误，不影响用户体验
    });
  }, [content?.id]);

  // 获取内容（只在 short_id 变化时执行）
  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        const shortId = params.short_id as string;
        const response = await api.content.getByShortId(shortId);
        setContent(response);
        
        // 设置生成状态
        if (response.generation_status) {
          // 后端已返回生成状态
          setGenerationStatus(response.generation_status);
          setGenerationProgress(response.generation_progress || 0);
          setRetryCount(response.retry_count || 0);
          setErrorMessage(response.generation_error || '');
          setUserQuery(response.user_query || response.title || '');
          setQueuedAt(response.created_at || '');
          setStartedAt(response.generation_started_at || '');
          // 初始化计时器
          if (response.created_at) {
            const startTime = new Date(response.created_at).getTime();
            const now = Date.now();
            const initialElapsed = Math.max(0, Math.floor((now - startTime) / 1000));
            setElapsedTime(initialElapsed);
          }
        } else if (response.id && (!response.full_html || response.full_html.trim().length === 0)) {
          // 如果没有 generation_status，但内容没有 full_html，说明可能正在生成
          // 主动查询一次状态
          try {
            const statusResponse = await api.getContentGenerationStatus(response.id);
            if (statusResponse.success && statusResponse.data) {
              const statusData = statusResponse.data;
              setGenerationStatus(statusData.status);
              setGenerationProgress(statusData.progress || 0);
              setRetryCount(statusData.retry_count || 0);
              setErrorMessage(statusData.error_message || '');
              setUserQuery(statusData.user_query || response.title || '');
              setQueuedAt(statusData.created_at || response.created_at || '');
              setStartedAt(statusData.started_at || '');
              // 初始化计时器
              if (statusData.created_at || response.created_at) {
                const startTime = new Date(statusData.created_at || response.created_at).getTime();
                const now = Date.now();
                const initialElapsed = Math.max(0, Math.floor((now - startTime) / 1000));
                setElapsedTime(initialElapsed);
              }
            } else {
              // 如果查询失败，假设是 pending 状态
              console.warn('查询生成状态失败，假设为 pending 状态');
              setGenerationStatus('pending');
              setUserQuery(response.title || '');
              setQueuedAt(response.created_at || '');
              if (response.created_at) {
                const startTime = new Date(response.created_at).getTime();
                const now = Date.now();
                const initialElapsed = Math.max(0, Math.floor((now - startTime) / 1000));
                setElapsedTime(initialElapsed);
              }
            }
          } catch (err) {
            console.error('查询生成状态失败:', err);
            // 查询失败，假设是 pending 状态
            setGenerationStatus('pending');
            setUserQuery(response.title || '');
            setQueuedAt(response.created_at || '');
            if (response.created_at) {
              const startTime = new Date(response.created_at).getTime();
              const now = Date.now();
              const initialElapsed = Math.max(0, Math.floor((now - startTime) / 1000));
              setElapsedTime(initialElapsed);
            }
          }
        }
        
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

  // 计时器逻辑
  useEffect(() => {
    if (generationStatus !== 'pending' && generationStatus !== 'processing') {
      // 停止计时器
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    // 启动计时器
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    // 清理函数
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [generationStatus]);

  // SSE + 轮询混合状态管理逻辑
  useEffect(() => {
    if (!content?.id || !generationStatus || (generationStatus !== 'pending' && generationStatus !== 'processing')) {
      return;
    }

    // 获取 visitor_id
    // 优先使用内容的 visitor_id（如果内容是由游客创建的）
    // 否则，如果当前用户未登录，使用当前的 visitor_id
    const visitorId = content?.visitor_id || (user ? null : getVisitorId());

    // 初始化混合管理器
    if (!hybridStatusManagerRef.current) {
      hybridStatusManagerRef.current = new HybridStatusManager(
        content.id,
        (statusData) => {
          setGenerationStatus(statusData.status);
          setGenerationProgress(statusData.progress || 0);
          setRetryCount(statusData.retry_count || 0);
          setErrorMessage(statusData.error_message || '');
          if (statusData.user_query) setUserQuery(statusData.user_query);
          if (statusData.created_at) setQueuedAt(statusData.created_at);
          if (statusData.started_at) {
            setStartedAt(statusData.started_at);
            // 更新计时器起始时间
            const startTime = new Date(statusData.started_at).getTime();
            const now = Date.now();
            const elapsed = Math.max(0, Math.floor((now - startTime) / 1000));
            setElapsedTime(elapsed);
          }

          // 如果生成完成，刷新页面内容
          if (statusData.status === 'done') {
            hybridStatusManagerRef.current?.stop();
            // 停止计时器
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            // 立即清除生成状态，停止动画
            setGenerationStatus(null);
            // 重新获取内容并刷新页面
            const refreshContent = async () => {
              try {
                const shortId = params.short_id as string;
                // 清除缓存，确保获取最新内容
                const cacheKey = `content:short:${shortId}`;
                const { cache } = await import('@/lib/cache');
                cache.delete(cacheKey);
                // 获取最新内容
                const response = await api.content.getByShortId(shortId);
                setContent(response);
                // 使用 router.replace 强制导航到当前页面，确保页面完全刷新
                router.replace(`/c/${shortId}`);
                // 如果 router.replace 没有触发刷新，使用 window.location 强制刷新
                setTimeout(() => {
                  if (document.visibilityState === 'visible') {
                    window.location.href = `/c/${shortId}`;
                  }
                }, 100);
              } catch (err) {
                console.error('Failed to refresh content:', err);
                // 如果刷新失败，尝试重新加载页面
                window.location.reload();
              }
            };
            refreshContent();
          }

          // 如果生成失败，停止
          if (statusData.status === 'failed') {
            hybridStatusManagerRef.current?.stop();
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
          }
        },
        (contentId: string) => api.getContentGenerationStatus(contentId),
        visitorId
      );
    }

    const hybridManager = hybridStatusManagerRef.current;

    // 开始 SSE + 轮询混合监听
    hybridManager.start();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hybridManager.stop();
        return;
      }
      if (document.visibilityState === 'visible') {
        if (generationStatus === 'pending' || generationStatus === 'processing') {
          hybridManager.stop();
          hybridManager.start();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 清理函数
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      hybridManager.stop();
    };
  }, [content?.id, generationStatus, params.short_id, router, user]);

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {mounted ? t('generation.loadingContent', { ns: 'content', defaultValue: '加载中...' }) : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-destructive text-xl mb-4">
            {mounted ? t('generation.loadFailed', { ns: 'content', defaultValue: '加载失败' }) : 'Load Failed'}
          </div>
          <p className="text-muted-foreground mb-4">
            {error || (mounted ? t('generation.contentNotFound', { ns: 'content', defaultValue: '内容不存在' }) : 'Content not found')}
          </p>
          <button
            onClick={handleSmartBack}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
          >
            {mounted ? t('back', { defaultValue: '返回' }) : 'Back'}
          </button>
        </div>
      </div>
    );
  }

  // 格式化计时器显示
  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 重试处理函数 - 让正常的SSE监听effect来处理状态更新
  const handleRetry = async () => {
    if (!content?.id) {
      return;
    }

    // 检查是否需要登录（retry API目前需要登录）
    if (!user?.id) {
      // 游客无法retry，提示登录
      router.push('/login');
      return;
    }

    setIsRetrying(true);
    try {
      // 先停止现有的管理器
      if (hybridStatusManagerRef.current) {
        hybridStatusManagerRef.current.stop();
        hybridStatusManagerRef.current = null;
      }
      
      // 使用重试API，后端会自动使用相同的生成参数
      const response = await api.retryFailedTask(content.id);
      if (response.success) {
        // 重置状态，开始新的生成流程
        // 设置状态为pending会触发正常的SSE监听effect，让它来处理后续的状态更新
        setGenerationStatus('pending');
        setGenerationProgress(0);
        setRetryCount(0);
        setErrorMessage('');
        setStartedAt('');
        setQueuedAt(new Date().toISOString());
        
        // 等待一小段时间确保后端状态更新
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 正常的SSE监听effect会在generationStatus变为'pending'时自动启动
        // 不需要在这里手动创建HybridStatusManager
      }
    } catch (error) {
      setIsRetrying(false);
    } finally {
      setIsRetrying(false);
    }
  };

  // 如果内容正在生成中，显示生成动画
  if (generationStatus === 'pending' || generationStatus === 'processing') {
    return (
      <>
        {/* 显示生成动画 */}
        <AiLoadingAnimation
          isActive={true}
          knowledgePoint={userQuery || content?.title || t('generation.contentGenerating', { ns: 'content', defaultValue: '内容生成中...' })}
          onComplete={() => {
            // 动画完成回调（当生成完成时，会自动刷新页面）
            console.log('Generation animation completed');
          }}
        />
        
        {/* 显示计时器（在动画上方，小字显示） */}
        <div className="fixed top-4 right-4 z-[10000] bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border border-border">
          <div className="text-sm text-muted-foreground">
            <span className="font-mono text-lg font-bold text-primary">{formatElapsedTime(elapsedTime)}</span>
            <span className="ml-2 text-xs">
              {generationStatus === 'pending' 
                ? (mounted ? t('generation.pending', { ns: 'content', defaultValue: '等待生成中...' }) : 'Pending...')
                : (mounted ? t('generation.generating', { ns: 'content', defaultValue: '生成中...' }) : 'Generating...')}
            </span>
          </div>
        </div>
      </>
    );
  }

  // 如果生成失败，显示失败卡片（带retry按钮）
  if (generationStatus === 'failed' && content) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <FailedCard
            content={content}
            errorMessage={errorMessage}
            retryCount={retryCount}
            userQuery={userQuery}
            onRetry={handleRetry}
            isRetrying={isRetrying}
          />
        </div>
      </div>
    );
  }

  // c 页面只显示 full_html
  if (!content.full_html || !content.full_html.trim()) {
    // 如果状态是pending或processing，已经在上面处理了
    // 如果状态是failed，也已经在上面处理了
    // 这里只处理没有full_html且状态是done或null的情况
    if (generationStatus === 'done' || generationStatus === null) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-destructive text-xl mb-4">
              {mounted ? t('generation.contentNotFound', { ns: 'content', defaultValue: '内容不存在' }) : 'Content not found'}
            </div>
            <p className="text-muted-foreground mb-4">
              {mounted ? '该内容没有完整的 HTML 内容' : 'This content does not have complete HTML content'}
            </p>
            <button
              onClick={handleSmartBack}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
            >
              {mounted ? t('back', { defaultValue: '返回' }) : 'Back'}
            </button>
          </div>
        </div>
      );
    }
  }

  const HEADER_HEIGHT = 64;

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {/* 顶栏：固定一行 */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-sm shadow-sm border-b border-border h-16">
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
              isNewContent={(() => {
                // 判断是否是新生成的内容（最近5分钟内）
                if (!content.created_at) return false;
                const createdAt = new Date(content.created_at);
                const now = new Date();
                const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
                return diffMinutes < 5;
              })()}
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
      <div className="w-full flex-1 flex flex-col bg-background min-h-0 overflow-hidden">
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
          contentId={content.id}
          userQuery={content.user_query || undefined}
          imageUrl={content.image_url || undefined}
          canEdit={!!(user && (content.created_by === user.id || user.role === 'admin'))}
          onError={(error) => {
            console.error('FullHTMLRenderer error:', error);
            setError(error);
          }}
        />
        {/* AI Guided Learning - Hide for animated content type */}
        {content?.id && content?.content_type !== 'animated' && (
          <AIGuidedLearning 
            contentId={content.id}
            content={content}
            onUIStateChange={(state) => console.log('UI State:', state)} 
          />
        )}
      </div>
    </div>
  );
}
