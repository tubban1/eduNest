'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/Sidebar';
import Logo from '@/components/Logo';
import LoginRequired from '@/components/LoginRequired';
import CollectionCard from '@/components/CollectionCard';
import { api } from '@/lib/api';

interface CollectionList {
  id: string;
  name: string;
  visibility: string;
  created_at: string;
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
  const { user, loading: authLoading } = useAuth();
  const [collectionLists, setCollectionLists] = useState<CollectionList[]>([]);
  const [collections, setCollections] = useState<CollectionContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeList, setActiveList] = useState<string>('');

  // 获取收藏列表
  const fetchCollectionLists = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.request<{ success: boolean; data: CollectionList[]; error?: string }>('/collection_lists');
      
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
        response = await api.request<{ success: boolean; data: CollectionContent[]; error?: string }>(`/user_collections/group/${listId}`);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">验证中...</p>
        </div>
      </div>
    );
  }

  // 渲染登录要求
  if (!user) {
    return (
      <LoginRequired 
        title="请先登录"
        description="登录后查看您的收藏内容"
        showSidebar={true}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* 左侧栏 */}
        <Sidebar />
        
        {/* 右侧主区 */}
        <div className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <Logo size="md" />
            </div>
            
            {/* 页面标题 */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">我的收藏</h1>
              <p className="text-gray-600">管理您收藏的所有内容</p>
            </div>

            {/* 收藏列表选择 */}
            <div className="mb-6">
              <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
                {/* 全部收藏 Tab */}
                <button
                  onClick={() => setActiveList('all')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeList === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  全部收藏
                </button>
                {/* 我的喜欢 Tab */}
                <button
                  onClick={() => setActiveList('liked')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeList === 'liked'
                      ? 'bg-red-600 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  我的喜欢
                </button>
                {/* 各个收藏夹 Tab */}
                {collectionLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => setActiveList(list.id)}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      activeList === list.id
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}

            {/* 内容网格 */}
            {!loading && collections.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {collections.map((item) => (
                  <CollectionCard
                    key={item.id}
                    content={item.content}
                    collectionInfo={{
                      id: item.id,
                      added_at: item.added_at,
                      list_id: item.list_id,
                      list_name: item.list_name,
                      is_liked: item.is_liked
                    }}
                    onAction={handleCollectionAction}
                  />
                ))}
              </div>
            )}

            {/* 空状态 */}
            {!loading && collections.length === 0 && activeList && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {activeList === 'all' ? '暂无收藏内容' : activeList === 'liked' ? '暂无喜欢内容' : '暂无收藏内容'}
                </h3>
                <p className="text-gray-500">
                  {activeList === 'all' 
                    ? '您还没有收藏任何内容，快去发现精彩内容吧！' 
                    : activeList === 'liked'
                    ? '您还没有喜欢任何内容，快去点赞精彩内容吧！'
                    : '这个收藏列表还没有内容'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 