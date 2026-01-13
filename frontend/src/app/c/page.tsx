'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar, { MobileMenuButton } from '@/components/Sidebar';
import ContentCard from '@/components/ContentCard';
import { useAuth } from '@/hooks/useAuth';
import { api, Content } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import ContentAIGenerator from '@/components/ContentAIGenerator';
import { cache, generateCacheKey } from '@/lib/cache';

function FullHTMLContentList({ lists, refreshLists, userId, refreshKey }: { lists: any[], refreshLists: () => Promise<void>, userId?: string, refreshKey?: number }) {
  const { t } = useTranslation(['content', 'common']);
  const searchParams = useSearchParams();
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [pollingContents, setPollingContents] = useState<Set<string>>(new Set());
  
  useEffect(() => { setMounted(true); }, []);
  
  // 刷新内容列表的函数 - 只获取有 full_html 的内容
  // 使用 useCallback 稳定函数引用，避免触发子组件不必要的重新渲染
  const refreshContent = useCallback(async (forceRefresh = false) => {
    // 先检查缓存，如果有缓存就不显示 loading
    const filters: any = {};
    if (userId) {
      filters.created_by = userId;
    }
    
    const cacheKey = generateCacheKey('content:filtered', filters);
    
    // 如果强制刷新，清除缓存
    if (forceRefresh) {
      cache.delete(cacheKey);
    }
    
    const cached = cache.get<any[]>(cacheKey);
    
    // 处理列表数据的辅助函数
    const processListData = (list: any[]) => {
      const inProgressStatuses = ['pending', 'processing', 'failed'];
      const inProgressContent = list.filter(
        (item: any) => inProgressStatuses.includes(item.generation_status)
      );
      const completedContent = list.filter(
        (item: any) =>
          !inProgressStatuses.includes(item.generation_status) &&
          item.full_html &&
          item.full_html.trim().length > 0
      );
      const mergedMap = new Map<string, any>();
      [...inProgressContent, ...completedContent].forEach((item) => {
        mergedMap.set(item.id, item);
      });
      return Array.from(mergedMap.values());
    };
    
    // 如果有缓存，直接使用，不显示 loading
    if (cached !== null) {
      const list = Array.isArray(cached) ? cached : [];
      const finalContent = processListData(list);
      setContent(finalContent);
      setLoading(false);
      return;
    }
    
    // 没有缓存，显示 loading 并请求数据
    setLoading(true);
    try {
      const data: any = await api.content.getFiltered(filters);
      // API 返回的已经是数组，不需要再取 data.data
      const list = Array.isArray(data) ? data : [];
      
      // 处理列表数据
      const finalContent = processListData(list);
      setContent(finalContent);
    } catch (e: any) {
      // 不强制重定向，允许未登录用户查看
      setError(e.message || '获取内容失败');
    } finally {
      setLoading(false);
    }
  }, [userId]); // 移除 t 依赖，使用硬编码的错误消息
  
  // 使用 ref 来防止重复刷新和存储 refreshContent
  const isRefreshingRef = useRef(false);
  const lastRefreshKeyRef = useRef<number | undefined>(undefined); // 初始化为 undefined，确保第一次能执行
  const refreshContentRef = useRef(refreshContent);
  const hasInitializedRef = useRef(false); // 标记是否已经初始化过
  
  // 更新 ref
  useEffect(() => {
    refreshContentRef.current = refreshContent;
  }, [refreshContent]);
  
  // 检测是否需要强制刷新（从生成页面跳转过来）
  useEffect(() => {
    const shouldRefresh = searchParams.get('refresh') === 'true';
    if (shouldRefresh && userId && refreshContentRef.current) {
      // 清除缓存，确保获取最新数据
      const filters: any = { created_by: userId };
      const cacheKey = generateCacheKey('content:filtered', filters);
      cache.delete(cacheKey);
      // 强制刷新内容
      refreshContentRef.current(true);
      // 清除 URL 参数，避免重复刷新
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/c');
      }
    }
  }, [searchParams, userId]);
  
  useEffect(() => {
    // 如果正在刷新中，且 refreshKey 没有变化，则跳过
    if (isRefreshingRef.current && refreshKey === lastRefreshKeyRef.current) {
      return;
    }
    
    // 如果 refreshKey 没有变化，且已经初始化过，则跳过（避免重复刷新）
    // 但第一次加载时（hasInitializedRef.current === false）应该执行
    if (hasInitializedRef.current && refreshKey === lastRefreshKeyRef.current) {
      return;
    }
    
    lastRefreshKeyRef.current = refreshKey;
    hasInitializedRef.current = true;
    isRefreshingRef.current = true;
    
    refreshContentRef.current().finally(() => {
      isRefreshingRef.current = false;
    });
  }, [refreshKey]); // 只依赖 refreshKey，不依赖 refreshContent

  // 检测需要轮询的内容
  // 1. thumbnail_status === 'generating' 的内容
  // 2. 内容生成完成但没有 svg_thumbnail 的内容（等待 AI 生成 SVG）
  useEffect(() => {
    const pollingIds = new Set<string>();
    content.forEach(item => {
      // 情况1：缩略图正在生成中
      if (item.thumbnail_status === 'generating') {
        pollingIds.add(item.id);
      }
      // 情况2：内容生成完成（没有生成中状态），但没有 svg_thumbnail 和 thumbnail_url
      // 且 thumbnail_status 不是 'failed'（失败的不需要轮询）
      // 注意：即使 thumbnail_status 是 'ready'，如果没有 svg_thumbnail 和 thumbnail_url，也需要轮询
      else if (
        !item.generation_status || 
        (item.generation_status !== 'pending' && item.generation_status !== 'processing')
      ) {
        const hasSvgThumbnail = item.svg_thumbnail && typeof item.svg_thumbnail === 'string' && item.svg_thumbnail.trim().length > 0;
        const hasThumbnailUrl = item.thumbnail_url && typeof item.thumbnail_url === 'string' && item.thumbnail_url.trim().length > 0;
        const isNotFailed = item.thumbnail_status !== 'failed';
        
        // 如果既没有 svg_thumbnail 也没有 thumbnail_url，且状态不是 failed，需要轮询
        // 即使 thumbnail_status 是 'ready'，如果没有实际的缩略图，也需要继续轮询
        if (!hasSvgThumbnail && !hasThumbnailUrl && isNotFailed) {
          pollingIds.add(item.id);
        }
      }
    });
    
    // 更新轮询集合
    setPollingContents(prev => {
      const next = new Set(prev);
      // 添加需要轮询的内容
      pollingIds.forEach(id => next.add(id));
      // 移除已完成的内容（有 svg_thumbnail 或 thumbnail_url，或状态为 failed）
      prev.forEach(id => {
        if (!pollingIds.has(id)) {
          next.delete(id);
        }
      });
      return next;
    });
  }, [content]);

  // 自动轮询生成中的缩略图状态
  useEffect(() => {
    if (pollingContents.size === 0) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        // 获取所有内容的最新状态（轮询时清除缓存，确保获取最新数据）
        const filters: any = {};
        if (userId) {
          filters.created_by = userId;
        }
        const cacheKey = generateCacheKey('content:filtered', filters);
        cache.delete(cacheKey); // 清除缓存，确保获取最新数据
        const data: any = await api.content.getFiltered(filters);
        const updatedContents = Array.isArray(data) ? data : [];
        
        setContent(prev => {
          const newContents = prev.map(prevContent => {
            const updated = updatedContents.find((c: any) => c.id === prevContent.id);
            if (updated) {
              // 检查是否有 svg_thumbnail 或 thumbnail_url
              const hasSvgThumbnail = updated.svg_thumbnail && typeof updated.svg_thumbnail === 'string' && updated.svg_thumbnail.trim().length > 0;
              const hasThumbnailUrl = updated.thumbnail_url && typeof updated.thumbnail_url === 'string' && updated.thumbnail_url.trim().length > 0;
              
              // 如果有 svg_thumbnail 或 thumbnail_url，或者状态为 failed，停止轮询
              if (hasSvgThumbnail || hasThumbnailUrl || updated.thumbnail_status === 'failed') {
                setPollingContents(prevPolling => {
                  const next = new Set(prevPolling);
                  next.delete(prevContent.id);
                  return next;
                });
              }
              return updated;
            }
            return prevContent;
          });
          return newContents;
        });
      } catch (error) {
        console.error('轮询缩略图状态失败:', error);
      }
    }, 3000); // 每3秒轮询一次

    return () => clearInterval(interval);
  }, [pollingContents.size, userId]);
  
  if (loading) return <div className="text-gray-400">{mounted ? t('loading', { ns: 'common', defaultValue: '加载中...' }) : 'Loading...'}</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!content.length) return <div className="text-gray-400 text-center py-8">{mounted ? t('noContent', { ns: 'content', defaultValue: '暂无完整 HTML 内容' }) : 'No full HTML content yet'}</div>;
  
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {content.map(item => (
        <ContentCard 
          key={item.id}
          content={{ 
            ...item, 
            language_code: item.language_code || 'zh-CN',
          }}
          isAuthenticated={!!userId} 
          editMode={!!(userId && item.created_by === userId)} 
          lists={lists} 
          refreshLists={refreshLists}
          linkPathPrefix="/c"
          onContentUpdate={() => refreshContent(true)}
        />
      ))}
    </div>
  );
}

export default function FullHTMLContentListPage() {
  const { t } = useTranslation(['content', 'common', 'navigation']);
  const { user, loading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  useEffect(() => { setMounted(true); }, []);
  
  const [lists, setLists] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const fetchLists = async () => {
    if (!user) {
      setLists([]);
      return;
    }
    try {
      const res = await api.get('/collection_lists');
      const listsData = (res as any)?.success ? (res as any).data : [];
      setLists(listsData);
    } catch (error: any) {
      // 不强制重定向，允许未登录用户查看
      setLists([]);
    }
  };
  
  useEffect(() => {
    fetchLists();
  }, [user]);
  
  // 刷新内容列表
  const handleContentGenerated = () => {
    setRefreshKey(prev => prev + 1);
    fetchLists();
  };
  
  if (authLoading) {
    return (
      <div className="text-center text-gray-400 py-12">
        <div>{mounted ? t('loading', { ns: 'common', defaultValue: '加载中...' }) : 'Loading...'}</div>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      {/* 桌面端侧边栏 */}
      <div className="hidden lg:block h-screen sticky top-0 left-0 z-30">
        <Sidebar variant="desktop" />
      </div>
      
      {/* 移动端侧边栏 */}
      <Sidebar 
        variant="mobile" 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <main className="flex-1 bg-white overflow-y-auto">
        {/* 移动端头部（固定） */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <MobileMenuButton onClick={() => setSidebarOpen(true)} />
          <div className="w-10" /> {/* 占位，保持居中 */}
        </div>
        
        {/* 顶部预留占位，避免内容被固定头部遮挡 */}
        <div className="lg:hidden h-14" />

        <div className="p-8 lg:p-8">
          {/* AI 生成表单 - 仅登录用户可见 */}
          {user && (
            <div className="mb-6">
              <ContentAIGenerator className="mb-6" onGenerated={handleContentGenerated} />
            </div>
          )}

          <FullHTMLContentList key={refreshKey} lists={lists} refreshLists={fetchLists} userId={user?.id} refreshKey={refreshKey} />
        </div>
      </main>
    </div>
  );
}

