'use client';

import { useTranslation } from 'react-i18next';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api, Content } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Sidebar, { MobileMenuButton } from '@/components/Sidebar';
import ContentCard from '@/components/ContentCard';
import ContentAIGenerator from '@/components/ContentAIGenerator';
import { cache, generateCacheKey } from '@/lib/cache';

export default function HomePage() {
  const { t, i18n } = useTranslation(['home', 'common', 'content', 'navigation']);
  const [mounted, setMounted] = useState(false);
  const { user, signOut, loading: authLoading } = useAuth();
  const [contents, setContents] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lists, setLists] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [pollingContents, setPollingContents] = useState<Set<string>>(new Set());
  const [gradientPhase, setGradientPhase] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  
  const ITEMS_PER_PAGE = 18; // 每页加载 18 个卡片
  const MAX_CONTENT_COUNT = 100; // 最多显示 100 个内容

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktop('matches' in e ? e.matches : (e as MediaQueryList).matches);
    };
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      if (!last) last = now;
      const dt = Math.min((now - last) / 4000, 1 / 30);
      last = now;
      setGradientPhase((p) => (p + dt) % 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isDesktop]);

  // 获取收藏列表
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
      setLists([]);
    }
  };

  useEffect(() => {
    fetchLists();
  }, [user]);

  // 刷新内容列表
  const handleContentGenerated = () => {
    setPage(1);
    setHasMore(true);
    setRefreshKey(prev => prev + 1);
    fetchLists();
  };

  // 处理列表数据的辅助函数
  const processListData = useCallback((list: any[]) => {
    const inProgressStatuses = ['pending', 'processing', 'failed'];
    const completedContent = list.filter(
      (item: any) => {
        // 必须有 full_html 且不为空
        const hasFullHtml = item.full_html && typeof item.full_html === 'string' && item.full_html.trim().length > 0;
        if (!hasFullHtml) {
          return false;
        }
        
        // 如果 generation_status 存在，则不能是进行中的状态
        // 如果 generation_status 是 null/undefined，只要有 full_html 就显示（可能是旧数据或手动创建的内容）
        if (item.generation_status === null || item.generation_status === undefined) {
          return true; // 有 full_html 但没有状态，认为是已完成的内容
        }
        
        // 有状态时，只显示非进行中的内容
        return !inProgressStatuses.includes(item.generation_status);
      }
    );
    // 未登录用户：只显示已完成的内容
    if (!user) {
      return completedContent;
    }
    // 登录用户显示所有用户的内容时：只显示已完成的内容
    // 不显示进行中的内容，因为那些可能是其他用户的
    return completedContent;
  }, [user]);

  // 获取内容列表 - 根据登录状态和语言筛选（支持分页）
  const refreshContent = useCallback(async (pageNum = 1, append = false, forceRefresh = false) => {
    const filters: any = {
      limit: ITEMS_PER_PAGE,
      offset: (pageNum - 1) * ITEMS_PER_PAGE
    };
    
    // 所有用户（包括已登录用户）：按当前语言筛选内容
    const currentLang = i18n.language || 'zh-CN';
    // 标准化语言代码（zh -> zh-CN, en -> en-US）
    const normalizedLang = currentLang === 'zh' ? 'zh-CN' : 
                          currentLang === 'en' ? 'en-US' :
                          currentLang === 'de' ? 'de-DE' :
                          currentLang === 'fr' ? 'fr-FR' : currentLang;
    filters.language_code = normalizedLang;
    
    // 已登录用户：不设置 created_by，显示所有用户的内容（按时间排序，最近的在最上面）
    
    // 如果是第一页，检查缓存
    if (pageNum === 1 && !append) {
      const cacheKey = generateCacheKey('content:filtered', filters);
      
      // 如果强制刷新，清除缓存
      if (forceRefresh) {
        cache.delete(cacheKey);
      }
      
      const cached = cache.get<any[]>(cacheKey);
      
      if (cached !== null) {
        const list = Array.isArray(cached) ? cached : [];
        const finalContent = processListData(list);
        // 确保缓存数据也没有重复（双重保险）
        const uniqueContent = finalContent.filter((item, index, self) => 
          index === self.findIndex((t) => t.id === item.id)
        );
        // 限制最多显示 MAX_CONTENT_COUNT 个
        const limitedContent = uniqueContent.slice(0, MAX_CONTENT_COUNT);
        setContents(limitedContent);
        // 检查是否还有更多内容：使用缓存数据的原始长度来判断
        // 注意：缓存数据可能不是完整的一页，所以这里需要特殊处理
        // 如果缓存数据刚好是一页，说明可能还有更多
        const hasMoreContent = list.length === ITEMS_PER_PAGE && limitedContent.length < MAX_CONTENT_COUNT;
        setHasMore(hasMoreContent);
        setIsLoading(false);
        return;
      }
    }
    
    // 没有缓存或加载更多，显示 loading 并请求数据
    if (!append) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      const data: any = await api.content.getFiltered(filters);
      const list = Array.isArray(data) ? data : [];
      
      // 处理列表数据 - 只保留有 full_html 的内容
      const finalContent = processListData(list);
      
      if (append) {
        // 追加时去重，避免重复的 key
        setContents(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newContent = finalContent.filter(c => !existingIds.has(c.id));
          const combined = [...prev, ...newContent];
          // 限制最多显示 MAX_CONTENT_COUNT 个
          const limitedContent = combined.slice(0, MAX_CONTENT_COUNT);
          // 检查是否还有更多内容：
          // 1. 后端返回了完整一页（说明可能还有更多数据）
          // 2. 且未达到最大限制
          const hasMoreContent = list.length === ITEMS_PER_PAGE && limitedContent.length < MAX_CONTENT_COUNT;
          setHasMore(hasMoreContent);
          return limitedContent;
        });
      } else {
        // 即使不是追加模式，也确保没有重复（双重保险）
        const uniqueContent = finalContent.filter((item, index, self) => 
          index === self.findIndex((t) => t.id === item.id)
        );
        // 限制最多显示 MAX_CONTENT_COUNT 个
        const limitedContent = uniqueContent.slice(0, MAX_CONTENT_COUNT);
        setContents(limitedContent);
        // 检查是否还有更多内容：
        // 1. 后端返回了完整一页（说明可能还有更多数据）
        // 2. 且未达到最大限制
        const hasMoreContent = list.length === ITEMS_PER_PAGE && limitedContent.length < MAX_CONTENT_COUNT;
        setHasMore(hasMoreContent);
      }
      
      setPage(pageNum);
    } catch (e: any) {
      console.error('Failed to fetch content:', e);
      if (!append) {
        setContents([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [user, i18n.language, processListData]);

  // 加载更多内容
  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || isLoading) return;
    // 检查是否已达到最大数量限制
    if (contents.length >= MAX_CONTENT_COUNT) {
      setHasMore(false);
      return;
    }
    refreshContent(page + 1, true);
  }, [hasMore, isLoadingMore, isLoading, page, refreshContent, contents.length]);

  // 无限滚动检测
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || isLoadingMore || isLoading) return;
    // 检查是否已达到最大数量限制
    if (contents.length >= MAX_CONTENT_COUNT) {
      setHasMore(false);
      return;
    }
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading && contents.length < MAX_CONTENT_COUNT) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' } // 提前 100px 开始加载
    );
    
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading, loadMore, contents.length]);

  // 检测需要轮询的内容
  // 1. thumbnail_status === 'generating' 的内容
  // 2. 内容生成完成但没有 svg_thumbnail 的内容（等待 AI 生成 SVG）
  useEffect(() => {
    const pollingIds = new Set<string>();
    contents.forEach(item => {
      // 情况1：缩略图正在生成中
      if (item.thumbnail_status === 'generating') {
        pollingIds.add(item.id);
      }
      // 情况2：内容生成完成（没有生成中状态），但没有 svg_thumbnail 和 thumbnail_url
      // 且 thumbnail_status 不是 'failed'（失败的不需要轮询）
      else if (
        !item.generation_status || 
        (item.generation_status !== 'pending' && item.generation_status !== 'processing')
      ) {
        const hasSvgThumbnail = item.svg_thumbnail && typeof item.svg_thumbnail === 'string' && item.svg_thumbnail.trim().length > 0;
        const hasThumbnailUrl = item.thumbnail_url && typeof item.thumbnail_url === 'string' && item.thumbnail_url.trim().length > 0;
        const isNotFailed = item.thumbnail_status !== 'failed';
        
        // 如果既没有 svg_thumbnail 也没有 thumbnail_url，且状态不是 failed，需要轮询
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
  }, [contents]);

  // 自动轮询生成中的缩略图状态
  useEffect(() => {
    if (pollingContents.size === 0) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        // 获取所有内容的最新状态（轮询时清除缓存，确保获取最新数据）
        const filters: any = {};
        // 所有用户（包括已登录用户）：按当前语言筛选内容
        const currentLang = i18n.language || 'zh-CN';
        const normalizedLang = currentLang === 'zh' ? 'zh-CN' : 
                              currentLang === 'en' ? 'en-US' :
                              currentLang === 'de' ? 'de-DE' :
                              currentLang === 'fr' ? 'fr-FR' : currentLang;
        filters.language_code = normalizedLang;
        
        // 登录用户：不设置 created_by，获取所有用户的内容
        filters.limit = ITEMS_PER_PAGE;
        filters.offset = (page - 1) * ITEMS_PER_PAGE;
        
        const cacheKey = generateCacheKey('content:filtered', filters);
        cache.delete(cacheKey); // 清除缓存，确保获取最新数据
        const data: any = await api.content.getFiltered(filters);
        const updatedContents = Array.isArray(data) ? data : [];
        
        setContents(prev => {
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
  }, [pollingContents.size, user, i18n.language, page]);

  // 监听语言变化和用户变化
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    refreshContent(1, false);
  }, [refreshContent, refreshKey]);

  // 为避免 SSR 与客户端语言检测不一致导致的水合错误，使用 loading 状态
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <div>{mounted ? t('loading', { ns: 'common', defaultValue: '加载中...' }) : 'Loading...'}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
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
      
      <main className="flex-1 bg-background lg:bg-gradient-to-br lg:from-slate-950 lg:via-slate-900/98 lg:to-slate-950 overflow-y-auto scrollbar-dark">
        {/* 移动端头部（固定） */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-background/90 backdrop-blur-sm border-b border-border">
          <MobileMenuButton onClick={() => setSidebarOpen(true)} />
          <div className="w-10" /> {/* 占位，保持居中 */}
        </div>
        
        {/* 顶部预留占位，避免内容被固定头部遮挡 */}
        <div className="lg:hidden h-14" />

        <div className="px-4 py-8 sm:px-6 lg:p-8">
          {/* 标题：桌面端动态渐变，移动端静态渐变（降级） */}
          <div className="mb-6">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground lg:text-white/95 leading-tight">
              {t('make_learning', { ns: 'home', defaultValue: 'Make Learning' })}
              {' '}
              {/* 移动端：静态渐变 */}
              <span className="lg:hidden inline-block bg-gradient-to-r from-[#a78bfa] via-[#ec4899] to-[#f59e0b] bg-clip-text text-transparent">
                {mounted ? t('dynamic_and_interesting', { ns: 'home', defaultValue: 'Dynamic and Interesting' }) : 'Dynamic and Interesting'}
              </span>
              {/* 桌面端：动态渐变 + 微动效 */}
              <span className="hidden lg:inline-block whitespace-pre">
                {(() => {
                  const raw = mounted ? t('dynamic_and_interesting', { ns: 'home', defaultValue: 'Dynamic and Interesting' }) : 'Dynamic and Interesting';
                  const chars = [...raw];
                  const stops = ['#a78bfa', '#ec4899', '#f59e0b', '#a78bfa'] as const;
                  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
                  const hex = (r: number, g: number, b: number) => `rgb(${r},${g},${b})`;
                  const parseRgb = (h: string) => {
                    const n = parseInt(h.slice(1), 16);
                    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff] as const;
                  };
                  return chars.map((char, i) => {
                    const pos = chars.length <= 1 ? 0 : i / (chars.length - 1);
                    const t = (pos + gradientPhase) % 1;
                    const si = Math.min(Math.floor(t * 3), 2);
                    const st = t * 3 - si;
                    const [r1, g1, b1] = parseRgb(stops[si]);
                    const [r2, g2, b2] = parseRgb(stops[si + 1]);
                    const r = lerp(r1, r2, st);
                    const g = lerp(g1, g2, st);
                    const b = lerp(b1, b2, st);
                    const color = hex(r, g, b);
                    const isSpace = /\s/.test(char);
                    return (
                      <span
                        key={i}
                        className="inline-block"
                        style={{
                          color,
                          transform: isSpace ? 'none' : `rotate(${[-2, 1, 2, -1, 0, 1, -2, 1, 0, -1, 2, -2, 1, 0, -1, 2][i % 16]}deg) translateY(${[0, 1, -1, 0, 1, -1, 0, 1, -1, 0, 1, -1, 0, 1, -1, 0][i % 16] * 2}px)`,
                          marginRight: isSpace ? '0.28em' : undefined,
                        }}
                      >
                        {isSpace ? '\u00A0' : char}
                      </span>
                    );
                  });
                })()}
              </span>
            </h1>
          </div>

          {/* AI 生成表单 */}
          <div className="mb-6">
            <ContentAIGenerator className="mb-6" onGenerated={handleContentGenerated} />
          </div>

          {/* 内容展示区域 */}
          <div className="mb-16">
            
            {isLoading ? (
              <div className="flex justify-center items-center py-12 text-foreground lg:text-white/80">
                <LoadingSpinner />
              </div>
            ) : contents.length > 0 ? (
              <>
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                  {contents.map((content) => (
                    <ContentCard 
                      key={content.id}
                      content={{ 
                        ...content, 
                        language_code: content.language_code || i18n.language || 'zh-CN',
                      }}
                      isAuthenticated={!!user} 
                      editMode={!!(user && content.created_by === user.id)} 
                      lists={lists} 
                      refreshLists={fetchLists}
                      linkPathPrefix="/c"
                      glass={isDesktop}
                      onContentUpdate={() => {
                        setPage(1);
                        setHasMore(true);
                        refreshContent(1, false, true); // 强制刷新，清除缓存
                      }}
                    />
                  ))}
                </div>
                
                {/* 无限滚动触发器 */}
                {hasMore && (
                  <div ref={loadMoreRef} className="flex justify-center items-center py-8">
                    {isLoadingMore ? (
                      <div className="flex flex-col items-center gap-2">
                        <LoadingSpinner />
                        <span className="text-sm text-muted-foreground lg:text-white/60">
                          {mounted ? t('loadingMore', { ns: 'content', defaultValue: '加载更多...' }) : 'Loading more...'}
                        </span>
                      </div>
                    ) : (
                      <div className="h-20" /> // 占位，触发 Intersection Observer
                    )}
                  </div>
                )}
                
                {/* 没有更多内容提示 */}
                {!hasMore && contents.length > 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground lg:text-white/60">
                      {mounted ? t('noMoreContent', { ns: 'content', defaultValue: '没有更多内容了' }) : 'No more content'}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-foreground lg:text-white/90">
                <div className="text-6xl mb-4">📚</div>
                <p className="text-muted-foreground lg:text-white/70 text-lg mb-4">
                  {mounted ? t('noContent', { ns: 'content', defaultValue: '暂无内容' }) : 'No content yet'}
                </p>
                {!user && (
                  <p className="text-sm text-muted-foreground lg:text-white/60">
                    {t('tryGeneratingContent', { ns: 'home', defaultValue: 'Try generating content above!' })}
                  </p>
                )}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
