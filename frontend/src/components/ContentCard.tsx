'use client';

import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState, memo } from 'react';
import Link from 'next/link';
import CollectionListDialog from './CollectionListDialog';
import ContentActionButtons from './ui/ContentActionButtons';
import EditButton from './ui/EditButton';
import PendingCard from './generation/PendingCard';
import ProcessingCard from './generation/ProcessingCard';
import FailedCard from './generation/FailedCard';
import { api } from '@/lib/api';
import { 
  GenerationStatus, 
  GenerationStatusResponse,
  statusPollingManager,
  HybridStatusManager,
  isGenerating,
  isFinalStatus
} from '@/utils/generationStatus';
import { getVisitorId } from '@/utils/visitorId';
import { useAuth } from '@/hooks/useAuth';

// 发送浏览器通知的辅助函数
function sendNotification(title: string, body: string) {
  if (typeof window === 'undefined') return;
  
  // 检查浏览器是否支持通知
  if (!('Notification' in window)) {
    return;
  }

  // 如果权限已授予，直接发送通知
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/icon.png',
      tag: 'content-generation', // 使用 tag 避免重复通知
    });
  } 
  // 如果权限未确定，请求权限
  else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icon.png',
          tag: 'content-generation',
        });
      }
    });
  }
}

interface ContentCardProps {
  content: {
    id: string;
    short_id?: string;
    title: string;
    language_code: string;
    tags?: string[];
    knowledge_point?: string[];
    created_at: string;
    full_html?: string; // 添加 full_html 字段用于生成缩略图
    // 生成状态相关字段
    generation_status?: GenerationStatus & {
      started_at?: string;
    };
    generation_progress?: number;
    retry_count?: number;
    generation_error?: string;
    user_query?: string;
    // 缩略图相关字段
    svg_thumbnail?: string; // SVG 代码（优先使用）
    thumbnail_url?: string; // 图片 URL（备用）
    thumbnail_status?: 'pending' | 'generating' | 'ready' | 'failed';
    thumbnail_updated_at?: string;
    // 权限相关字段
    visitor_id?: string | null; // 内容的 visitor_id（如果是游客创建的）
    created_by?: string | null; // 内容的 created_by（如果是用户创建的）
  };
  isAuthenticated: boolean;
  editMode: boolean;
  lists: { id: string; name: string; visibility: string }[];
  refreshLists: () => Promise<void>;
  // 可选的回调函数，用于刷新内容列表
  onContentUpdate?: () => void;
  // 可选的链接路径前缀，默认为 '/c'
  linkPathPrefix?: string;
}

function ContentCard({ 
  content, 
  isAuthenticated, 
  editMode, 
  lists, 
  refreshLists, 
  onContentUpdate,
  linkPathPrefix = '/c'
}: ContentCardProps) {
  const { t } = useTranslation(['content', 'common']);
  const { user } = useAuth();
  // 使用 ref 存储 onContentUpdate，避免函数引用变化导致 effect 重新执行
  const onContentUpdateRef = useRef(onContentUpdate);
  useEffect(() => {
    onContentUpdateRef.current = onContentUpdate;
  }, [onContentUpdate]);
  const [showDialog, setShowDialog] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus | null>(
    content.generation_status || null
  );
  const [generationProgress, setGenerationProgress] = useState<number>(
    content.generation_progress || 0
  );
  const [retryCount, setRetryCount] = useState<number>(content.retry_count || 0);
  const [errorMessage, setErrorMessage] = useState<string>(content.generation_error || '');
  const [userQuery, setUserQuery] = useState<string>(content.user_query || '');
  const [startedAt, setStartedAt] = useState<string>('');
  const [queuedAt, setQueuedAt] = useState<string>(content.created_at);
  const [isRetrying, setIsRetrying] = useState(false);
  const hasAutoRefreshedRef = useRef(false);
  // 记录上一次的状态，用于检测状态变化
  const prevStatusRef = useRef<GenerationStatus | null | undefined>(content.generation_status);
  // HybridStatusManager ref
  const hybridStatusManagerRef = useRef<HybridStatusManager | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Determine thumbnail display state
  // 优先使用 svg_thumbnail，然后使用 thumbnail_url，最后显示默认水印
  const svgThumbnail = content.svg_thumbnail;
  const thumbnailUrl = content.thumbnail_url;
  const thumbnailStatus = content.thumbnail_status;
  const isThumbnailGenerating = thumbnailStatus === 'generating';
  
  // 检查 svg_thumbnail 是否有效（如果存在且有效，直接使用，不依赖 thumbnail_status）
  const hasValidSvgThumbnail = svgThumbnail && typeof svgThumbnail === 'string' && svgThumbnail.trim().length > 0;
  
  // 优先使用 svg_thumbnail，然后使用 thumbnail_url
  // svg_thumbnail 如果存在且有效，直接显示（不依赖 thumbnail_status）
  // thumbnail_url 需要 thumbnail_status === 'ready' 才显示
  const isThumbnailReady = hasValidSvgThumbnail || (thumbnailStatus === 'ready' && thumbnailUrl);
  const showThumbnailPlaceholder = !hasValidSvgThumbnail && (!thumbnailUrl || thumbnailStatus === 'pending' || thumbnailStatus === 'failed');

  // 监听生成状态变化
  useEffect(() => {
    setQueuedAt(content.created_at);
    const initialTimes = (content as unknown as { generation_started_at?: string; started_at?: string });
    if (initialTimes?.generation_started_at) {
      setStartedAt(initialTimes.generation_started_at);
    } else if (initialTimes?.started_at) {
      setStartedAt(initialTimes.started_at);
    }
  }, [content.id, content.created_at]);

  // 同步 content.generation_status 到本地状态
  useEffect(() => {
    if (content.generation_status !== undefined) {
      const prevStatus = prevStatusRef.current;
      const currentStatus = content.generation_status || null;
      
      // 检测状态变化：从非 done 变为 done
      const statusChangedToDone = prevStatus !== 'done' && currentStatus === 'done';
      
      setGenerationStatus(currentStatus);
      setGenerationProgress(content.generation_progress || 0);
      setRetryCount(content.retry_count || 0);
      setErrorMessage(content.generation_error || '');
      setUserQuery(content.user_query || '');
      
      // 更新 prevStatusRef
      prevStatusRef.current = currentStatus;
      
      // 如果状态从非 done 变为 done，且还没有刷新过，则触发刷新
      if (statusChangedToDone && !hasAutoRefreshedRef.current && onContentUpdateRef.current) {
        hasAutoRefreshedRef.current = true;
        onContentUpdateRef.current();
      }
    } else {
      // 如果没有 generation_status 字段，设置为 null
      setGenerationStatus(null);
    }
  }, [content.generation_status, content.generation_progress, content.retry_count, content.generation_error, content.user_query, content.id]);

  // SSE + 轮询混合状态管理逻辑
  useEffect(() => {
    const status = content.generation_status;
    
    if (!content.id || !status || !isGenerating(status)) {
      // 如果不是生成中状态，清理 HybridStatusManager
      if (hybridStatusManagerRef.current) {
        hybridStatusManagerRef.current.stop();
        hybridStatusManagerRef.current = null;
      }
      // 也停止旧的轮询（向后兼容）
      if (statusPollingManager.isPolling(content.id)) {
        statusPollingManager.stopPolling(content.id);
      }
      return;
    }

    // 获取 visitor_id
    // 优先使用内容的 visitor_id（如果内容是由游客创建的）
    // 否则，如果当前用户未登录，使用当前的 visitor_id
    // 注意：即使用户已登录，如果内容是由游客创建的，也需要使用内容的 visitor_id
    const visitorId = content.visitor_id || (user ? null : getVisitorId());

    // 如果还没有 HybridStatusManager，创建一个新的
    if (!hybridStatusManagerRef.current) {
      hasAutoRefreshedRef.current = false;
      
      hybridStatusManagerRef.current = new HybridStatusManager(
        content.id,
        (statusData: GenerationStatusResponse) => {
          setGenerationStatus(statusData.status);
          setGenerationProgress(statusData.progress);
          setRetryCount(statusData.retry_count);
          setErrorMessage(statusData.error_message || '');
          setUserQuery(statusData.user_query || '');
          setQueuedAt((prev) => statusData.created_at || statusData.updated_at || prev);
          if (statusData.started_at) {
            setStartedAt(statusData.started_at);
          }

          if (!isFinalStatus(statusData.status)) {
            hasAutoRefreshedRef.current = false;
          }

          // 如果生成完成（done），刷新内容列表并发送通知
          if (statusData.status === 'done') {
            hybridStatusManagerRef.current?.stop();
            if (!hasAutoRefreshedRef.current) {
              hasAutoRefreshedRef.current = true;
              if (onContentUpdateRef.current) {
                onContentUpdateRef.current();
              }
            }
            // 发送浏览器通知
            sendNotification('内容生成完成', `"${content.title}" 已生成完成`);
            return;
          }
          
          // failed 状态停止，但不刷新
          if (statusData.status === 'failed') {
            hybridStatusManagerRef.current?.stop();
            return;
          }
        },
        (contentId: string) => api.getContentGenerationStatus(contentId),
        visitorId
      );
    }

    const hybridManager = hybridStatusManagerRef.current;

    // 开始 SSE + 轮询混合监听
    hybridManager.start();

    // 页面可见性监听：应用从后台恢复时重新启动
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentStatus = content.generation_status;
        if (currentStatus && isGenerating(currentStatus)) {
          // 如果任务仍在进行中但管理器已停止，重新启动
          if (hybridStatusManagerRef.current && !hybridStatusManagerRef.current.isRunning()) {
            hybridStatusManagerRef.current.start();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 清理函数
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // 注意：不在这里停止管理器，因为组件可能只是重新渲染
      // 管理器的停止由状态变化或组件卸载时处理
    };
  }, [content.id, content.generation_status, user]); // 移除 onContentUpdate 依赖，使用 ref 来避免不必要的重新执行

  // 重试处理函数 - 使用 HybridStatusManager（SSE+轮询混合）
  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      // 使用重试API，后端会自动使用相同的生成参数
      const response = await api.retryFailedTask(content.id);
      if (response.success) {
        // 先停止现有的管理器
        if (hybridStatusManagerRef.current) {
          hybridStatusManagerRef.current.stop();
          hybridStatusManagerRef.current = null;
        }
        // 也停止旧的轮询（向后兼容）
        if (statusPollingManager.isPolling(content.id)) {
          statusPollingManager.stopPolling(content.id);
        }
        
        // 重置状态，开始新的生成流程
        setGenerationStatus('pending');
        setGenerationProgress(0);
        setRetryCount(0); // 重置重试计数
        setErrorMessage('');
        setStartedAt(''); // 重置开始时间
        setQueuedAt(new Date().toISOString());
        hasAutoRefreshedRef.current = false;
        
        // 等待一小段时间确保后端状态更新
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 获取 visitor_id
        // 优先使用内容的 visitor_id（如果内容是由游客创建的）
        // 否则，如果当前用户未登录，使用当前的 visitor_id
        const visitorId = content.visitor_id || (user ? null : getVisitorId());
        
        // 创建新的 HybridStatusManager
        hybridStatusManagerRef.current = new HybridStatusManager(
          content.id,
          (statusData: GenerationStatusResponse) => {
            setGenerationStatus(statusData.status);
            setGenerationProgress(statusData.progress);
            setRetryCount(statusData.retry_count);
            setErrorMessage(statusData.error_message || '');
            setUserQuery(statusData.user_query || '');
            setQueuedAt((prev) => statusData.created_at || statusData.updated_at || prev);
            if (statusData.started_at) {
              setStartedAt(statusData.started_at);
            }
            
            // 如果生成完成，触发内容更新并发送通知
            if (statusData.status === 'done') {
              hybridStatusManagerRef.current?.stop();
              if (!hasAutoRefreshedRef.current) {
                hasAutoRefreshedRef.current = true;
                if (onContentUpdateRef.current) {
                  onContentUpdateRef.current();
                }
              }
              sendNotification('内容生成完成', `"${content.title}" 已生成完成`);
              return;
            }
            
            // failed 状态停止，但不刷新
            if (statusData.status === 'failed') {
              hybridStatusManagerRef.current?.stop();
              return;
            }
          },
          (contentId: string) => api.getContentGenerationStatus(contentId),
          visitorId
        );
        
        // 启动 SSE + 轮询混合监听
        hybridStatusManagerRef.current.start();
      }
    } catch (error) {
      setIsRetrying(false);
    } finally {
      setIsRetrying(false);
    }
  };

  // 新增：语言标签映射（仅按主语言，使用当前系统语言翻译）
  const getLanguageLabel = (codeRaw: string): string => {
    const primary = (codeRaw || '').trim().toLowerCase().split('-')[0];

    // 使用 i18n key，按主语言码映射到通用名称，由当前 UI 语言决定显示
    const keyMap: Record<string, { key: string; fallback: string }> = {
      zh: { key: 'languageNames.zh', fallback: 'Chinese' },
      en: { key: 'languageNames.en', fallback: 'English' },
      ja: { key: 'languageNames.ja', fallback: 'Japanese' },
      ko: { key: 'languageNames.ko', fallback: 'Korean' },
      es: { key: 'languageNames.es', fallback: 'Spanish' },
      fr: { key: 'languageNames.fr', fallback: 'French' },
      de: { key: 'languageNames.de', fallback: 'German' },
      pt: { key: 'languageNames.pt', fallback: 'Portuguese' },
      it: { key: 'languageNames.it', fallback: 'Italian' },
      ru: { key: 'languageNames.ru', fallback: 'Russian' },
      ar: { key: 'languageNames.ar', fallback: 'Arabic' },
      hi: { key: 'languageNames.hi', fallback: 'Hindi' },
      nl: { key: 'languageNames.nl', fallback: 'Dutch' },
      sv: { key: 'languageNames.sv', fallback: 'Swedish' },
    };

    if (keyMap[primary]) {
      const { key, fallback } = keyMap[primary];
      return mounted ? t(key, { ns: 'content', defaultValue: fallback }) : fallback;
    }

    // 兜底：显示原始 code
    return codeRaw || 'N/A';
  };

  // 新增：实现handleCreateList并传递给CollectionListDialog
  const handleCreateList = async ({ name, visibility }: { name: string; visibility: string }) => {
    try {
      await api.createCollection({ name, visibility });
      if (refreshLists) await refreshLists(); // 新建后刷新
    } catch (error) {
      // 创建收藏列表失败处理
      throw error; // 重新抛出错误，让 NewListDialog 处理
    }
  };



  // 使用short_id，如果没有则回退到id，支持自定义路径前缀
  const contentUrl = content.short_id ? `${linkPathPrefix}/${content.short_id}` : `${linkPathPrefix}/${content.id}`;

  // 如果内容正在生成中，显示对应的状态卡片
  if (generationStatus && generationStatus !== 'done') {
    switch (generationStatus) {
      case 'pending':
        return <PendingCard content={content} userQuery={userQuery} queuedAt={queuedAt} />;
      case 'processing':
        return (
          <ProcessingCard 
            content={content} 
            progress={generationProgress} 
            retryCount={retryCount}
            userQuery={userQuery}
            startedAt={startedAt}
          />
        );
      case 'failed':
        return (
          <FailedCard 
            content={content} 
            errorMessage={errorMessage}
            retryCount={retryCount}
            userQuery={userQuery}
            onRetry={handleRetry}
            isRetrying={isRetrying}
          />
        );
    }
  }

  // 根据标签获取 emoji（作为缩略图备用）
  const getEmojiByTags = (tags?: string[]) => {
    if (!tags || !Array.isArray(tags)) return '📚';
    const tagString = tags.join(' ').toLowerCase();
    if (tagString.includes('数学') || tagString.includes('math')) return '🔢';
    if (tagString.includes('物理') || tagString.includes('physics')) return '⚡';
    if (tagString.includes('化学') || tagString.includes('chemistry')) return '🧪';
    if (tagString.includes('生物') || tagString.includes('biology')) return '🧬';
    if (tagString.includes('几何') || tagString.includes('geometry')) return '📐';
    return '📚';
  };

  return (
    <div className="bg-card rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow w-full">
      {/* 缩略图区域 */}
      <Link href={contentUrl} prefetch={false} className="block">
        <div className="relative w-full aspect-video bg-gradient-to-br from-primary/10 to-secondary/10 overflow-hidden">
          {isThumbnailReady ? (
            hasValidSvgThumbnail ? (
              // 优先显示 SVG（内联渲染，支持动画）
              <div 
                className="w-full h-full"
                dangerouslySetInnerHTML={{ __html: svgThumbnail! }}
              />
            ) : (
              // 备用：显示图片 URL
              <img
                src={thumbnailUrl}
                alt={content.title}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  // 如果图片加载失败，显示占位符
                  (e.target as HTMLImageElement).style.display = 'none';
                  const placeholder = (e.target as HTMLImageElement).nextElementSibling;
                  if (placeholder) {
                    (placeholder as HTMLElement).classList.remove('hidden');
                  }
                }}
              />
            )
          ) : isThumbnailGenerating ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="text-xs text-muted-foreground">
                  {mounted ? t('thumbnailGenerating', { ns: 'content', defaultValue: '生成中...' }) : '生成中...'}
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 relative overflow-hidden">
              <span className="text-4xl z-10">{getEmojiByTags(content.tags)}</span>
              {/* 水印 */}
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <div className="text-6xl font-bold text-primary rotate-[-45deg] select-none pointer-events-none">
                  EduNest AI
                </div>
              </div>
            </div>
          )}
          {/* 占位符（图片加载失败时显示） */}
          <div className="hidden w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 relative overflow-hidden">
            <span className="text-4xl z-10">{getEmojiByTags(content.tags)}</span>
            {/* 水印 */}
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <div className="text-6xl font-bold text-primary rotate-[-45deg] select-none pointer-events-none">
                EduNest AI
              </div>
            </div>
          </div>
        </div>
      </Link>

      <div className="p-5">
        {/* 标题 - 可点击跳转，限制长度 */}
        <Link href={contentUrl} prefetch={false} className="block mb-4">
          <h3 className="text-lg font-semibold text-foreground line-clamp-2 hover:text-primary transition-colors cursor-pointer" title={content.title}>
            {content.title}
          </h3>
        </Link>
        
        {/* 操作按钮区域 - 所有用户都可以看到 */}
        <div className="flex items-center justify-between">
          <ContentActionButtons
            contentId={content.id}
            shortId={content.short_id}
            title={content.title}
            initialLiked={false}
            initialCollected={false}
            initialLikeCount={0}
            initialCollectionCount={0}
            size="md"
            showCount={false}
            showText={false}
            disabled={!isAuthenticated} // 未登录用户禁用点赞和收藏，但可以分享
            onCollectChange={() => {
              // 更新父组件的状态
              if (refreshLists) {
                refreshLists();
              }
            }}
          />
          {editMode && (
            <EditButton contentId={content.id} size="md" />
          )}
        </div>
      </div>
      
      <CollectionListDialog 
        open={showDialog} 
        onClose={() => setShowDialog(false)} 
        onCreateList={handleCreateList} 
        lists={lists || []} 
        refreshLists={refreshLists}
        contentId={content.id}
        onSave={async (lists) => {
          // 这里可以处理保存逻辑
        }}
      />
    </div>
  );
}

// 使用 React.memo 优化，避免不必要的重新渲染
export default memo(ContentCard, (prevProps, nextProps) => {
  // 自定义比较逻辑：只比较关键字段
  return (
    prevProps.content.id === nextProps.content.id &&
    prevProps.content.thumbnail_url === nextProps.content.thumbnail_url &&
    prevProps.content.svg_thumbnail === nextProps.content.svg_thumbnail &&
    prevProps.content.thumbnail_status === nextProps.content.thumbnail_status &&
    prevProps.content.generation_status === nextProps.content.generation_status &&
    prevProps.content.title === nextProps.content.title &&
    prevProps.isAuthenticated === nextProps.isAuthenticated &&
    prevProps.editMode === nextProps.editMode &&
    prevProps.lists.length === nextProps.lists.length
  );
}); 