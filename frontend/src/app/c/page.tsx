'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar, { MobileMenuButton } from '@/components/Sidebar';
import ContentCard from '@/components/ContentCard';
import { useAuth } from '@/hooks/useAuth';
import { api, Content } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import ContentAIGenerator from '@/components/ContentAIGenerator';

function FullHTMLContentList({ lists, refreshLists, userId, refreshKey }: { lists: any[], refreshLists: () => Promise<void>, userId?: string, refreshKey?: number }) {
  const { t } = useTranslation(['content', 'common']);
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => { setMounted(true); }, []);
  
  // 刷新内容列表的函数 - 只获取有 full_html 的内容
  // 使用 useCallback 稳定函数引用，避免触发子组件不必要的重新渲染
  const refreshContent = useCallback(async () => {
    setLoading(true);
    try {
      // 如果用户已登录，传递 created_by 参数以获取生成状态
      // 否则获取所有内容（不限制用户，但不包含生成状态）
      const filters: any = {};
      if (userId) {
        filters.created_by = userId;
      }
      const data: any = await api.content.getFiltered(filters);
      const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      
      // 拆分进行中和已完成内容，进行中内容即使没有 full_html 也保留用于状态卡片展示
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

      // 合并后为了避免重复，同一内容可能同时符合两个条件（理论上不会，但做个保险）
      const mergedMap = new Map<string, any>();
      [...inProgressContent, ...completedContent].forEach((item) => {
        mergedMap.set(item.id, item);
      });

      const finalContent = Array.from(mergedMap.values());
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
          onContentUpdate={refreshContent}
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

