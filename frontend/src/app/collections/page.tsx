'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/Sidebar';
import MobileHeader from '@/components/MobileHeader';
import Logo from '@/components/Logo';
import LoginRequired from '@/components/LoginRequired';
import CollectionCard from '@/components/CollectionCard';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';

interface CollectionList {
  id: string;
  name: string;
  visibility: string;
  created_at: string;
  short_id?: string;
  pricing_mode?: string;
  price?: number;
  currency?: string;
  description?: string;
}

interface CollectionContent {
  id: string;
  content: {
    id: string;
    short_id?: string;
    title: string;
    language_code: string;
    tags?: string[];
    knowledge_point?: string[];
    created_at: string;
  };
  added_at: string;
  list_id?: string;
  list_name?: string;
  is_liked?: boolean;
}

export default function CollectionsPage() {
  const { t } = useTranslation(['content', 'common', 'navigation']);
  const { user, loading: authLoading } = useAuth();
  const [collectionLists, setCollectionLists] = useState<CollectionList[]>([]);
  const [collections, setCollections] = useState<CollectionContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeList, setActiveList] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // 获取收藏列表
  const fetchCollectionLists = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.get('/collection_lists');
      
      if (response.success) {
        setCollectionLists(response.data);
        // 默认选择"全部收藏"
        setActiveList('all');
      } else {
        throw new Error((response as any).error || '获取收藏列表失败');
      }
    } catch (error: any) {
      const errorMessage = error.message || '获取收藏列表失败';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 获取指定列表的收藏内容
  const fetchCollections = async (listId: string) => {
    try {
      setLoading(true);
      setError('');
      
      let response;
      
      if (listId === 'liked') {
        // 获取喜欢的内容
        response = await api.getLikedContent();
      } else {
        // 获取收藏的内容
        response = await api.get(`/user_collections/group/${listId}`);
      }
      
      if (response.success) {
        setCollections(response.data);
      } else {
        throw new Error((response as any).error || '获取收藏内容失败');
      }
    } catch (error: any) {
      const errorMessage = error.message || '获取收藏内容失败';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 处理收藏操作
  const handleCollectionAction = async (action: string, contentId: string, listId?: string) => {
    try {
      if (action === 'remove' && !listId) {
        // 移除操作需要 listId
        return;
      }

      let result;
      if (action === 'like') {
        const likeResult = await api.likeContent(contentId);
        if (likeResult.success) {
          // 更新本地状态
          setCollections(prev => prev.map(item => 
            item.id === contentId ? { ...item, is_liked: true } : item
          ));
        }
      } else if (action === 'unlike') {
        const unlikeResult = await api.unlikeContent(contentId);
        if (unlikeResult.success) {
          // 更新本地状态
          setCollections(prev => prev.map(item => 
            item.id === contentId ? { ...item, is_liked: false } : item
          ));
        }
      } else if (action === 'remove' && listId) {
        result = await api.removeContentFromList(contentId, listId);
        if (result.success) {
          // 从本地状态中移除
          setCollections(prev => prev.filter(item => item.id !== contentId));
        }
      }

      // 刷新收藏列表
      fetchCollections(activeList);
    } catch (error) {
      // 操作失败处理
    }
  };

  // 新建收藏列表函数（可根据实际逻辑实现）
  const createNewList = async (name: string, visibility: string) => {
    // TODO: 实现新建收藏列表逻辑
  };

  useEffect(() => {
    if (user) {
      fetchCollectionLists();
    }
  }, [user]);

  useEffect(() => {
    if (activeList && user) {
      fetchCollections(activeList);
    }
  }, [activeList, user]);

  // 渲染加载状态
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{mounted ? t('verifying', { ns: 'common', defaultValue: '验证中...' }) : 'Verifying...'}</p>
        </div>
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
        <MobileHeader onMenuClick={() => setSidebarOpen(true)} className="bg-card" />
        
        {/* 顶部预留占位，避免内容被固定头部遮挡 */}
        <div className="lg:hidden h-14" />

        {/* 未登录用户引导注册登录 */}
        {!user ? (
          <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-md mx-auto px-4">
              <div className="mb-6">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  {mounted ? t('loginToViewCollections', { ns: 'auth', defaultValue: '登录查看我的收藏' }) : 'Login to view My Collections'}
                </h1>
                <p className="text-muted-foreground">
                  {mounted ? t('loginToViewCollectionsDesc', { ns: 'auth', defaultValue: '登录后可以查看和管理您的所有收藏内容' }) : 'Login to view and manage all your collections'}
                </p>
              </div>
              <div className="space-y-3">
                <a
                  href="/login"
                  className="ai-gradient-btn inline-block px-6 py-3 rounded-lg font-medium w-full"
                >
                  {mounted ? t('login', { ns: 'auth', defaultValue: '登录' }) : 'Login'}
                </a>
                <a
                  href="/signup"
                  className="inline-block bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium w-full"
                >
                  {mounted ? t('signup', { ns: 'auth', defaultValue: '注册' }) : 'Sign Up'}
                </a>
              </div>
            </div>
          </div>
        ) : (
        <div className="px-4 py-8 sm:px-6 lg:p-8">
          {/* 页面标题 */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">{mounted ? t('myCollections', { ns: 'navigation', defaultValue: 'My Collections' }) : 'My Collections'}</h1>
              <p className="text-muted-foreground">{mounted ? t('manageCollections', { ns: 'content', defaultValue: 'Manage all your collected content' }) : 'Manage all your collected content'}</p>
            </div>
            {/* 列表管理按钮 */}
            <div className="flex gap-2">
              <a
                href="/collections/manage"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors text-sm font-medium"
              >
                📋 {mounted ? t('collections:list.manageListsButton', { ns: 'collections', defaultValue: 'Manage Lists' }) : 'Manage Lists'}
              </a>
            </div>
          </div>
          
          {/* 收藏列表选择 */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-card rounded-lg p-1 shadow-sm overflow-x-auto">
              {/* 全部收藏 Tab */}
              <button
                onClick={() => setActiveList('all')}
                className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeList === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {mounted ? t('allCollections', { ns: 'navigation', defaultValue: 'All Collections' }) : 'All Collections'}
              </button>
              {/* 我的喜欢 Tab */}
              <button
                onClick={() => setActiveList('liked')}
                className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeList === 'liked'
                    ? 'bg-destructive text-destructive-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {mounted ? t('myLikes', { ns: 'content', defaultValue: 'My Likes' }) : 'My Likes'}
              </button>
              {/* 各个收藏夹 Tab */}
              {collectionLists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => setActiveList(list.id)}
                  className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeList === list.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {list.name}
                </button>
              ))}
            </div>
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* 加载状态 */}
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {/* 内容网格 */}
          {!loading && collections.length > 0 && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {collections.map((item) => (
                <div key={item.id} className="bg-card border border-border shadow-sm rounded-xl p-4 flex flex-col gap-2">
                  <CollectionCard
                    content={item.content}
                    collectionInfo={{
                      id: item.id,
                      added_at: item.added_at,
                      list_id: item.list_id,
                      list_name: item.list_name,
                      is_liked: item.is_liked
                    }}
                    onAction={handleCollectionAction}
                    refreshLists={async () => {}}
                  />
                </div>
              ))}
            </div>
          )}

          {/* 空状态 */}
          {!loading && collections.length === 0 && activeList && (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                {activeList === 'all'
                  ? (mounted ? t('noCollections', { ns: 'content', defaultValue: 'No collections yet' }) : 'No collections yet')
                  : activeList === 'liked'
                  ? (mounted ? t('noLikes', { ns: 'content', defaultValue: 'No likes yet' }) : 'No likes yet')
                  : (mounted ? t('noCollectionsListDesc', { ns: 'content', defaultValue: 'This collection list is empty' }) : 'This collection list is empty')}
              </h3>
              <p className="text-muted-foreground">
                {activeList === 'all'
                  ? (mounted ? t('noCollectionsDesc', { ns: 'content', defaultValue: 'You have not collected any content yet, go discover something!' }) : 'You have not collected any content yet, go discover something!')
                  : activeList === 'liked'
                  ? (mounted ? t('noLikesDesc', { ns: 'content', defaultValue: 'You have not liked any content yet, go like something!' }) : 'You have not liked any content yet, go like something!')
                  : (mounted ? t('noCollectionsListDesc', { ns: 'content', defaultValue: 'This collection list is empty' }) : 'This collection list is empty')}
              </p>
            </div>
          )}
        </div>
        )}
      </main>
    </div>
  );
} 