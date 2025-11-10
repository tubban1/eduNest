'use client';

import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
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
  isGenerating,
  isFinalStatus
} from '@/utils/generationStatus';
import { generateThumbnailFromHTML, extractThumbnailFromHTML } from '@/utils/thumbnailGenerator';

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

export default function ContentCard({ 
  content, 
  isAuthenticated, 
  editMode, 
  lists, 
  refreshLists, 
  onContentUpdate,
  linkPathPrefix = '/c'
}: ContentCardProps) {
  const { t } = useTranslation(['content', 'common']);
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
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const hasAutoRefreshedRef = useRef(false);
  // 记录上一次的状态，用于检测状态变化
  const prevStatusRef = useRef<GenerationStatus | null | undefined>(content.generation_status);

  useEffect(() => { setMounted(true); }, []);

  // 生成缩略图
  useEffect(() => {
    const generateThumbnail = async () => {
      if (!content.full_html) {
        setThumbnail(null);
        return;
      }

      setThumbnailLoading(true);
      try {
        // 首先尝试快速提取 SVG（不需要渲染）
        const extracted = extractThumbnailFromHTML(content.full_html);
        if (extracted.type === 'svg' && extracted.data) {
          setThumbnail(extracted.data);
          setThumbnailLoading(false);
          return;
        }

        // 如果有 Canvas，需要渲染 HTML 来生成缩略图
        if (extracted.type === 'canvas' && mounted) {
          const thumbnailData = await generateThumbnailFromHTML(content.full_html, {
            width: 400,
            height: 300,
            quality: 0.7,
            timeout: 3000
          });
          setThumbnail(thumbnailData);
        } else {
          setThumbnail(null);
        }
      } catch (error) {
        setThumbnail(null);
      } finally {
        setThumbnailLoading(false);
      }
    };

    if (mounted && content.full_html) {
      generateThumbnail();
    }
  }, [content.full_html, content.id, mounted]);

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
    }
  }, [content.generation_status, content.generation_progress, content.retry_count, content.generation_error, content.user_query, content.id]);

  useEffect(() => {
    const status = content.generation_status;
    
    if (status && isGenerating(status)) {
      hasAutoRefreshedRef.current = false;
      // 如果已经在轮询，先停止再重新开始，确保状态同步
      if (statusPollingManager.isPolling(content.id)) {
        statusPollingManager.stopPolling(content.id);
      }
      
      // 开始轮询状态
      statusPollingManager.startPolling(
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

          // 如果生成完成（done），刷新内容列表
          // failed 状态不触发自动刷新，避免无限循环
          if (statusData.status === 'done') {
            statusPollingManager.stopPolling(content.id);
            if (!hasAutoRefreshedRef.current) {
              hasAutoRefreshedRef.current = true;
              if (onContentUpdateRef.current) {
                onContentUpdateRef.current();
              }
            }
            return;
          }
          
          // failed 状态停止轮询，但不刷新
          if (statusData.status === 'failed') {
            statusPollingManager.stopPolling(content.id);
            return;
          }
        },
        (contentId: string) => api.getContentGenerationStatus(contentId)
      );
    } else if (status && isFinalStatus(status)) {
      // 最终状态，停止轮询
      statusPollingManager.stopPolling(content.id);
    }

    // 清理函数
    return () => {
      statusPollingManager.stopPolling(content.id);
    };
  }, [content.id, content.generation_status]); // 移除 onContentUpdate 依赖，使用 ref 来避免不必要的重新执行

  // 重试处理函数 - 基于测试页面的成功逻辑优化
  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      // 使用重试API，后端会自动使用相同的生成参数
      const response = await api.retryFailedTask(content.id);
      if (response.success) {
        // 先停止现有的轮询
        statusPollingManager.stopPolling(content.id);
        
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
        
        // 重新开始轮询
        statusPollingManager.startPolling(
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
            
            // 如果生成完成，触发内容更新
            if (statusData.status === 'done') {
              statusPollingManager.stopPolling(content.id);
              if (!hasAutoRefreshedRef.current) {
                hasAutoRefreshedRef.current = true;
                if (onContentUpdateRef.current) {
                  onContentUpdateRef.current();
                }
              }
              return;
            }
          },
          (contentId: string) => api.getContentGenerationStatus(contentId)
        );
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
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow w-full sm:w-64 sm:min-w-56 sm:max-w-xs mx-auto">
      {/* 缩略图区域 */}
      <div className="relative w-full h-40 bg-gradient-to-br from-blue-100 to-purple-100 overflow-hidden">
        {thumbnailLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : thumbnail ? (
          <img
            src={thumbnail}
            alt={content.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              // 如果图片加载失败，显示 emoji
              (e.target as HTMLImageElement).style.display = 'none';
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent) {
                parent.innerHTML = `<div class="flex items-center justify-center h-full"><span class="text-6xl">${getEmojiByTags(content.tags)}</span></div>`;
              }
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-6xl">{getEmojiByTags(content.tags)}</span>
          </div>
        )}
      </div>

      <div className="p-4">
        {/* 标题 - 可点击跳转 */}
        <Link href={contentUrl} prefetch={false} className="block">
          <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2 hover:text-blue-600 transition-colors cursor-pointer">
            {content.title}
          </h3>
        </Link>
        
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
            {getLanguageLabel(content.language_code)}
          </span>
        </div>
        
        {/* 标签块状显示，优先显示tags，没有则回退knowledge_point */}
        <div className="flex flex-wrap gap-1 mb-2">
          {(content.tags && content.tags.length > 0 ? content.tags : content.knowledge_point)?.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
            >
              {tag}
            </span>
          ))}
        </div>
        
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-500">
            {new Date(content.created_at).toLocaleDateString()}
          </span>
        </div>
        
        {/* 操作按钮区域 */}
        {isAuthenticated && (
          <div className="mt-3 pt-3 border-t border-gray-100">
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
        )}
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