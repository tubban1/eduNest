'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import ContentCard from '@/components/ContentCard';
import FilterBar from '@/components/FilterBar';
import LoginRequired from '@/components/LoginRequired';
import Logo from '@/components/Logo';
import { useAuth } from '@/hooks/useAuth';
import { api, Content } from '@/lib/api';

function MyContentList({ userId, lists, refreshLists }: { userId: string, lists: any[], refreshLists: () => Promise<void> }) {
  const [myContent, setMyContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    // 使用any类型绕过TypeScript检查，因为getFiltered的参数类型不完整
    api.content.getFiltered({ created_by: userId } as any).then((data: any) => {
      const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      setMyContent(list);
      setLoading(false);
    }).catch((e: any) => {
      setError(e.message || '获取内容失败');
      setLoading(false);
    });
  }, [userId]);
  if (loading) return <div className="text-gray-400">加载中...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!myContent.length) return <div className="text-gray-400">暂无创作内容</div>;
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {myContent.map(item => (
        <div key={item.id} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 flex flex-col gap-2">
          <ContentCard 
            content={item} 
            isAuthenticated={true} 
            editMode={true} 
            lists={lists} 
            refreshLists={refreshLists} 
          />
        </div>
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
  const [lists, setLists] = useState<CollectionList[]>([]);
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      api.request<{ success: boolean; data: CollectionList[] }>('/collection_lists'),
      api.getUserCollections(userId)
    ]).then(([listRes, colRes]) => {
      setLists(listRes.success ? listRes.data : []);
      setCollections(colRes as UserCollection[]);
      setLoading(false);
    }).catch((e: any) => {
      setError(e.message || '获取收藏失败');
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
                content={c.content} 
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
  if (loading) return <div className="text-gray-400">加载中...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!lists.length) return <div className="text-gray-400">暂无收藏列表</div>;
  return <div>{renderTree(buildTree(lists))}</div>;
}

export default function ContentPage() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<'my-content' | 'my-collections'>('my-content');
  const [lists, setLists] = useState<any[]>([]);

  // 获取收藏夹列表
  const fetchLists = async () => {
    if (!user) return;
    try {
      const res = await api.request('/collection_lists', {
        method: 'GET'
      });
      // 修复：正确处理 API 响应格式
      const listsData = (res as any)?.success ? (res as any).data : [];
      setLists(listsData);
    } catch (error) {
      console.error('获取收藏列表失败:', error);
      setLists([]);
    }
  };

  useEffect(() => {
    if (user) fetchLists();
  }, [user]);

  if (authLoading) return <div className="text-center text-gray-400 py-12">加载中...</div>;
  if (!user) return (
    <LoginRequired 
      title="请先登录"
      description="登录后查看您的内容"
      showSidebar={true}
    />
  );
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />
      <main className="flex-1 p-8 bg-white">
        <div className="flex justify-center mb-6">
          <Logo size="md" />
        </div>
        {tab === 'my-content' && (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">我创作的内容</h2>
              <a href="/content/create" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">新建内容</a>
            </div>
            <MyContentList userId={user.id} lists={lists} refreshLists={fetchLists} />
          </>
        )}
        {tab === 'my-collections' && (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">我的收藏列表</h2>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">新建分组</button>
            </div>
            <CollectionTree userId={user.id} />
          </>
        )}
      </main>
    </div>
  );
} 