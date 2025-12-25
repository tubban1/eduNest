'use client';

import { useTranslation } from 'react-i18next';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api, Content } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Sidebar, { MobileMenuButton } from '@/components/Sidebar';
import ContentCard from '@/components/ContentCard';
import ContentAIGenerator from '@/components/ContentAIGenerator';
import { cache, generateCacheKey } from '@/lib/cache';

// 定义内容类型
interface Content {
  id: string;
  short_id: string;
  title: string;
  description?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  full_html?: string;
  language?: string;
  content_type?: string;
  created_by?: string;
}

export default function HomePage() {
  const { t, i18n } = useTranslation(['home', 'common', 'content', 'navigation']);
  const [mounted, setMounted] = useState(false);
  const { user, signOut, loading: authLoading } = useAuth();
  const [contents, setContents] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lists, setLists] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { setMounted(true); }, []);

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
    setRefreshKey(prev => prev + 1);
    fetchLists();
  };

  // 获取内容列表 - 根据登录状态和语言筛选
  const refreshContent = useCallback(async () => {
    const filters: any = {};
    
    // 未登录用户：按当前语言筛选，只获取有 full_html 的内容
    if (!user) {
      const currentLang = i18n.language || 'zh-CN';
      // 标准化语言代码（zh -> zh-CN, en -> en-US）
      const normalizedLang = currentLang === 'zh' ? 'zh-CN' : 
                            currentLang === 'en' ? 'en-US' :
                            currentLang === 'de' ? 'de-DE' :
                            currentLang === 'fr' ? 'fr-FR' : currentLang;
      filters.language_code = normalizedLang;
    } else {
      // 已登录用户：显示自己的内容
      filters.created_by = user.id;
    }
    
    const cacheKey = generateCacheKey('content:filtered', filters);
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
    
    // 如果有缓存，直接使用
    if (cached !== null) {
      const list = Array.isArray(cached) ? cached : [];
      const finalContent = processListData(list);
      setContents(finalContent);
      setIsLoading(false);
      return;
    }
    
    // 没有缓存，显示 loading 并请求数据
    setIsLoading(true);
    try {
      const data: any = await api.content.getFiltered(filters);
      const list = Array.isArray(data) ? data : [];
      
      // 处理列表数据 - 只保留有 full_html 的内容
      const finalContent = processListData(list);
      setContents(finalContent);
    } catch (e: any) {
      console.error('Failed to fetch content:', e);
      setContents([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, i18n.language]);

  // 监听语言变化和用户变化
  useEffect(() => {
    refreshContent();
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
      
      <main className="flex-1 bg-background overflow-y-auto">
        {/* 移动端头部（固定） */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-card/80 backdrop-blur-sm border-b border-border">
          <MobileMenuButton onClick={() => setSidebarOpen(true)} />
          <div className="w-10" /> {/* 占位，保持居中 */}
        </div>
        
        {/* 顶部预留占位，避免内容被固定头部遮挡 */}
        <div className="lg:hidden h-14" />

        <div className="p-8 lg:p-8">
          {/* 标题 */}
          <div className="mb-6">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
              {t('make_learning', { ns: 'home', defaultValue: 'Make Learning' })}
              <span className="text-primary">
                {' '}
                {t('dynamic_and_interesting', { ns: 'home', defaultValue: 'Dynamic and Interesting' })}
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
              <div className="flex justify-center items-center py-12">
                <LoadingSpinner />
              </div>
            ) : contents.length > 0 ? (
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
                    onContentUpdate={refreshContent}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📚</div>
                <p className="text-muted-foreground text-lg mb-4">
                  {mounted ? t('noContent', { ns: 'content', defaultValue: '暂无内容' }) : 'No content yet'}
                </p>
                {!user && (
                  <p className="text-sm text-muted-foreground">
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
