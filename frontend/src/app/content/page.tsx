'use client';

import { useState, useEffect } from 'react';
import Sidebar, { MobileMenuButton } from '@/components/Sidebar';
import ContentCard from '@/components/ContentCard';
import FilterBar from '@/components/FilterBar';
import LoginRequired from '@/components/LoginRequired';
import Logo from '@/components/Logo';
import { useAuth } from '@/hooks/useAuth';
import { api, Content } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import ContentAIGenerator from '@/components/ContentAIGenerator';

function MyContentList({ userId, lists, refreshLists }: { userId: string, lists: any[], refreshLists: () => Promise<void> }) {
  const { t } = useTranslation(['content', 'common']);
  const [myContent, setMyContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => { setMounted(true); }, []);
  
  // 刷新内容列表的函数
  const refreshContent = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // 使用any类型绕过TypeScript检查，因为getFiltered的参数类型不完整
      const data: any = await api.content.getFiltered({ created_by: userId } as any);
      const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      setMyContent(list);
    } catch (e: any) {
      // 检查是否是认证错误
      if (e.message?.includes('401') || e.message?.includes('无效的访问令牌') || e.message?.includes('访问令牌缺失')) {
        // 强制重定向到登录页
        window.location.href = '/login';
        return;
      }
      setError(e.message || t('fetchContentError', { ns: 'content', defaultValue: '获取内容失败' }));
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    refreshContent();
  }, [userId]);
  if (loading) return <div className="text-gray-400">{mounted ? t('loading', { ns: 'common', defaultValue: '加载中...' }) : 'Loading...'}</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!myContent.length) return <div className="text-gray-400">{mounted ? t('noContent', { ns: 'content', defaultValue: '暂无创作内容' }) : 'No content yet'}</div>;
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {myContent.map(item => (
        <ContentCard 
          key={item.id}
          content={{ 
            ...item, 
            language_code: item.language_code || 'zh-CN',
            generation_status: (item as any).generation_status,
            generation_progress: (item as any).generation_progress,
            retry_count: (item as any).retry_count,
            generation_error: (item as any).generation_error
          }}
          isAuthenticated={true} 
          editMode={true} 
          lists={lists} 
          refreshLists={refreshLists}
          onContentUpdate={refreshContent}
        />
      ))}
    </div>
  );
}

interface CollectionList {
  id: string;
  name: string;
  parent_id: string | null;
  [key: string]: any;
}
interface UserCollection {
  id: string;
  user_id: string;
  content_id: string;
  list_id: string;
  content: Content;
  [key: string]: any;
}

function CollectionTree({ userId }: { userId: string }) {
  const { t } = useTranslation(['content', 'common']);
  const [lists, setLists] = useState<CollectionList[]>([]);
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      api.get('/collection_lists'),
      api.getUserCollections(userId)
    ]).then(([listRes, colRes]) => {
      setLists(listRes.success ? listRes.data : []);
      setCollections(colRes && Array.isArray(colRes.data) ? colRes.data : []);
      setLoading(false);
    }).catch((e: any) => {
      // 检查是否是认证错误
      if (e.message?.includes('401') || e.message?.includes('无效的访问令牌') || e.message?.includes('访问令牌缺失')) {
        // 强制重定向到登录页
        window.location.href = '/login';
        return;
      }
      setError(e.message || t('fetchCollectionsError', { ns: 'content', defaultValue: '获取收藏失败' }));
      setLoading(false);
    });
  }, [userId]);
  // 构建树结构
  function buildTree(list: CollectionList[], parentId: string | null = null): (CollectionList & { children: any[] })[] {
    return list.filter(l => l.parent_id === parentId).map(l => ({
      ...l,
      children: buildTree(list, l.id)
    }));
  }
  function renderTree(nodes: (CollectionList & { children: any[] })[]): JSX.Element[] {
    return nodes.map(node => (
      <div key={node.id} className="mb-4">
        <div className="font-semibold text-gray-800 mb-2">{node.name}</div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-2">
          {collections.filter(c => c.list_id === node.id).map(c => (
            <div key={c.content_id} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 flex flex-col gap-2">
              <ContentCard 
                content={{ ...c.content, language_code: c.content.language_code || 'zh-CN' }}
                isAuthenticated={true} 
                editMode={false}
                lists={[]}
                refreshLists={async () => {}}
              />
            </div>
          ))}
        </div>
        {node.children && node.children.length > 0 && (
          <div className="ml-4 border-l-2 border-gray-200 pl-4">
            {renderTree(node.children)}
          </div>
        )}
      </div>
    ));
  }
  if (loading) return <div className="text-gray-400">{mounted ? t('loading', { ns: 'common', defaultValue: '加载中...' }) : 'Loading...'}</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!lists.length) return <div className="text-gray-400">{mounted ? t('noCollections', { ns: 'content', defaultValue: '暂无收藏列表' }) : 'No collections yet'}</div>;
  return <div>{renderTree(buildTree(lists))}</div>;
}

export default function ContentPage() {
  const { t } = useTranslation(['content', 'common', 'navigation']);
  const { user, loading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 本地乐观插入的生成中内容
  const [optimisticItems, setOptimisticItems] = useState<any[]>([]);
  
  useEffect(() => { setMounted(true); }, []);
  
  const [lists, setLists] = useState<any[]>([]);
  
  const fetchLists = async () => {
    if (!user) return;
    try {
      const res = await api.get('/collection_lists');
      const listsData = (res as any)?.success ? (res as any).data : [];
      setLists(listsData);
    } catch (error: any) {
      // 检查是否是认证错误
      if (error.message?.includes('401') || error.message?.includes('无效的访问令牌') || error.message?.includes('访问令牌缺失')) {
        // 强制重定向到登录页
        window.location.href = '/login';
        return;
      }
      setLists([]);
    }
  };
  
  useEffect(() => {
    if (user) fetchLists();
  }, [user]);

  // 从 sessionStorage 读取新创建的内容，乐观插入并依赖 ContentCard 内部轮询
  useEffect(() => {
    if (!user) return;
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem('new_content');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && data.id) {
        const item = {
          id: data.id,
          title: data.q || data.title || '',
          language_code: data.lang || 'zh-CN',
          created_at: new Date().toISOString(),
          generation_status: 'pending',
          generation_progress: 0,
          retry_count: 0,
          generation_error: '',
          user_query: data.q || '',
        };
        setOptimisticItems(prev => {
          // 去重插入
          if (prev.some(p => p.id === item.id)) return prev;
          return [item, ...prev];
        });
      }
    } catch {}
    finally {
      try { sessionStorage.removeItem('new_content'); } catch {}
    }
  }, [user]);

  // 监听创建事件，当前页面即时插入
  useEffect(() => {
    if (!user) return;
    const handler = (e: any) => {
      const data = e?.detail;
      if (!data?.id) return;
      const item = {
        id: data.id,
        title: data.q || data.title || '',
        language_code: data.lang || 'zh-CN',
        created_at: new Date().toISOString(),
        generation_status: 'pending',
        generation_progress: 0,
        retry_count: 0,
        generation_error: '',
        user_query: data.q || '',
      };
      setOptimisticItems(prev => prev.some(p => p.id === item.id) ? prev : [item, ...prev]);
    };
    window.addEventListener('NEW_CONTENT_CREATED' as any, handler);
    return () => window.removeEventListener('NEW_CONTENT_CREATED' as any, handler);
  }, [user]);
  
  if (authLoading) {
    return (
      <div className="text-center text-gray-400 py-12">
        <div>{mounted ? t('loading', { ns: 'common', defaultValue: '加载中...' }) : 'Loading...'}</div>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
        >
          {mounted ? t('refresh', { ns: 'common', defaultValue: '刷新页面' }) : 'Refresh' }
        </button>
      </div>
    );
  }
  
  if (!user) {
    return (
      <LoginRequired 
        title={mounted ? t('loginRequired', { ns: 'auth', defaultValue: '请先登录' }) : 'Please login'}
        description={mounted ? t('loginRequiredDesc', { ns: 'auth', defaultValue: '登录后查看您的内容' }) : 'Login to view your content'}
        showSidebar={true}
      />
    );
  }
  
  // 只保留"我的创作"内容列表
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
          
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold">{mounted ? t('myContent', { ns: 'navigation', defaultValue: '我创作的内容' }) : 'My Creations'}</h2>
          </div>

          {/* 顶部 AI 智能生成表单 */}
          <ContentAIGenerator className="mb-6" onGenerated={fetchLists} />
          
          {/* 优先渲染乐观插入的生成中项目 */}
          {optimisticItems.length > 0 && (
            <div className="mb-6 grid gap-4 grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {optimisticItems.map(item => (
                <ContentCard 
                  key={`optimistic-${item.id}`}
                  content={item}
                  isAuthenticated={true}
                  editMode={true}
                  lists={lists}
                  refreshLists={fetchLists}
                  onContentUpdate={async () => {
                    // 当生成完成时，移除乐观项并刷新列表
                    setOptimisticItems(prev => prev.filter(p => p.id !== item.id));
                    await fetchLists();
                  }}
                />
              ))}
            </div>
          )}

          <MyContentList userId={user.id} lists={lists} refreshLists={fetchLists} />
        </div>
      </main>
    </div>
  );
} 