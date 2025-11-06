'use client';

import { useState, useEffect } from 'react';
import Sidebar, { MobileMenuButton } from '@/components/Sidebar';
import ContentCard from '@/components/ContentCard';
import Logo from '@/components/Logo';
import { useAuth } from '@/hooks/useAuth';
import { api, Content } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import LoginRequired from '@/components/LoginRequired';

function FullHTMLContentList({ lists, refreshLists }: { lists: any[], refreshLists: () => Promise<void> }) {
  const { t } = useTranslation(['content', 'common']);
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => { setMounted(true); }, []);
  
  // 刷新内容列表的函数 - 只获取有 full_html 的内容
  const refreshContent = async () => {
    setLoading(true);
    try {
      // 获取所有内容（不限制用户）
      const data: any = await api.content.getFiltered({} as any);
      const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      
      // 过滤出有 full_html 字段的内容
      const fullHTMLContent = list.filter((item: any) => 
        item.full_html && item.full_html.trim().length > 0
      );
      
      setContent(fullHTMLContent);
    } catch (e: any) {
      // 不强制重定向，允许未登录用户查看
      setError(e.message || t('fetchContentError', { ns: 'content', defaultValue: '获取内容失败' }));
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    refreshContent();
  }, []);
  
  if (loading) return <div className="text-gray-400">{mounted ? t('loading', { ns: 'common', defaultValue: '加载中...' }) : 'Loading...'}</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!content.length) return <div className="text-gray-400">{mounted ? t('noContent', { ns: 'content', defaultValue: '暂无完整 HTML 内容' }) : 'No full HTML content yet'}</div>;
  
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {content.map(item => (
        <ContentCard 
          key={item.id}
          content={{ 
            ...item, 
            language_code: item.language_code || 'zh-CN',
          }}
          isAuthenticated={true} 
          editMode={false} 
          lists={lists} 
          refreshLists={refreshLists}
          linkPathPrefix="/c"
        />
      ))}
    </div>
  );
}

export default function FullHTMLContentListPage() {
  const { t } = useTranslation(['content', 'common', 'navigation']);
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  useEffect(() => { setMounted(true); }, []);
  
  const [lists, setLists] = useState<any[]>([]);
  
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
            <h2 className="text-2xl font-bold">{mounted ? t('fullHTMLContent', { ns: 'navigation', defaultValue: '完整 HTML 内容' }) : 'Full HTML Content'}</h2>
          </div>

          <FullHTMLContentList lists={lists} refreshLists={fetchLists} />
        </div>
      </main>
    </div>
  );
}

