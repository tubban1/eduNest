'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/Sidebar';
import MobileHeader from '@/components/MobileHeader';
import LoginRequired from '@/components/LoginRequired';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';

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

export default function CollectionListsManagementPage() {
  const { t } = useTranslation(['content', 'common', 'navigation', 'collections']);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [collectionLists, setCollectionLists] = useState<CollectionList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListVisibility, setNewListVisibility] = useState<'public' | 'private'>('private');
  const [creating, setCreating] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // 获取收藏列表
  const fetchCollectionLists = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.get('/collection_lists');
      
      if (response.success) {
        setCollectionLists(response.data || []);
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

  // 创建新列表
  const handleCreateList = async () => {
    if (!newListName.trim()) {
      setError(t('collections:management.nameRequired'));
      return;
    }

    try {
      setCreating(true);
      setError('');
      
      const response = await api.post('/collection_lists', {
        name: newListName.trim(),
        visibility: newListVisibility,
      });
      
      if (response.success) {
        setNewListName('');
        setNewListVisibility('private');
        setShowCreateDialog(false);
        await fetchCollectionLists();
      } else {
        throw new Error((response as any).error || t('collections:management.createFailed'));
      }
    } catch (error: any) {
      setError(error.message || t('collections:management.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  // 删除列表
  const handleDeleteList = async (listId: string) => {
    if (!confirm(t('collections:management.deleteConfirm'))) {
      return;
    }

    try {
      const response = await api.delete(`/collection_lists/${listId}`);
      if (response.success || response.deleted) {
        await fetchCollectionLists();
      } else {
        throw new Error(t('collections:management.deleteFailed'));
      }
    } catch (error: any) {
      setError(error.message || t('collections:management.deleteFailed'));
    }
  };

  useEffect(() => {
    if (user) {
      fetchCollectionLists();
    }
  }, [user]);

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

  // 渲染登录要求
  if (!user) {
    return (
      <LoginRequired 
        title={mounted ? t('loginRequired', { ns: 'auth', defaultValue: '请先登录' }) : 'Please login'}
        description={mounted ? t('loginRequiredDesc', { ns: 'auth', defaultValue: '登录后查看您的收藏内容' }) : 'Login to view your collections'}
        showSidebar={true}
      />
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
      
      <main className="flex-1 bg-card overflow-y-auto">
        {/* 移动端头部（固定） */}
        <MobileHeader onMenuClick={() => setSidebarOpen(true)} className="bg-card" />
        
        {/* 顶部预留占位，避免内容被固定头部遮挡 */}
        <div className="lg:hidden h-14" />

        <div className="px-4 py-8 sm:px-6 lg:p-8">
          {/* 页面标题 */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">{t('collections:list.myLists')}</h1>
              <p className="text-muted-foreground">{t('collections:list.manageLists')}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateDialog(true)}
                className="ai-gradient-btn px-4 py-2 rounded-lg text-sm font-medium"
              >
                ➕ {t('collections:management.createList')}
              </button>
              <Link
                href="/collections"
                className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm font-medium"
              >
                ← {t('collections:list.backToCollections')}
              </Link>
            </div>
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-destructive">{error}</p>
            </div>
          )}

          {/* 加载状态 */}
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {/* 列表网格 */}
          {!loading && collectionLists.length > 0 && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {collectionLists.map((list) => (
                <div
                  key={list.id}
                  className="bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-foreground text-lg line-clamp-2 flex-1">
                      {list.name}
                    </h3>
                    <div className="flex items-center gap-1 ml-2">
                      {list.visibility === 'public' ? (
                        <span className="text-xs px-2 py-0.5 bg-secondary/10 text-secondary rounded-full">{t('collections:management.public')}</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">{t('collections:management.private')}</span>
                      )}
                    </div>
                  </div>
                  
                  {list.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {list.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    {list.pricing_mode && (
                      <span className="px-2 py-0.5 bg-primary/10 text-primary rounded">
                        {list.pricing_mode === 'free'
                          ? t('collections:management.free')
                          : list.pricing_mode === 'one_time' || list.pricing_mode === 'premium'
                          ? t('collections:management.premium')
                          : t('collections:management.preview')}
                      </span>
                    )}
                    {(list.pricing_mode === 'one_time' || list.pricing_mode === 'premium') && list.price && (
                      <span>
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: list.currency || 'USD'
                        }).format(list.price)}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 pt-3 border-t border-border">
                    {list.short_id ? (
                      <Link
                        href={`/list/${list.short_id}`}
                        className="flex-1 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors text-center"
                      >
                        {t('collections:management.viewList')}
                      </Link>
                    ) : (
                      <span className="flex-1 px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded text-center">
                        {t('collections:management.generating')}
                      </span>
                    )}
                    <Link
                      href={list.short_id ? `/list/${list.short_id}/settings` : '#'}
                      className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                      title={t('collections:list.settings')}
                    >
                      ⚙️
                    </Link>
                    <button
                      onClick={() => handleDeleteList(list.id)}
                      className="px-3 py-1.5 text-sm text-destructive hover:opacity-80 hover:bg-destructive/10 rounded transition-colors"
                      title={t('delete')}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 空状态 */}
          {!loading && collectionLists.length === 0 && (
            <div className="text-center py-16">
              <div className="text-muted-foreground mb-4">
                <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">{t('collections:management.noLists')}</h3>
              <p className="text-muted-foreground mb-6">{t('collections:management.noListsDesc')}</p>
              <button
                onClick={() => setShowCreateDialog(true)}
                className="ai-gradient-btn px-6 py-2 rounded-lg"
              >
                {t('collections:management.createFirstList')}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 创建列表对话框 */}
      {showCreateDialog && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" aria-modal="true" role="dialog" onClick={() => { setShowCreateDialog(false); setNewListName(''); setError(''); }}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4 border border-slate-200 dark:border-slate-600" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('collections:management.createNewList')}</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                {t('collections:settings.listNameRequired')} <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#a78bfa] bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                placeholder={t('collections:settings.listNamePlaceholder')}
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                {t('collections:settings.visibility')}
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="public"
                    checked={newListVisibility === 'public'}
                    onChange={(e) => setNewListVisibility(e.target.value as 'public' | 'private')}
                    className="mr-2"
                  />
                  <span>{t('collections:settings.public')}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{t('collections:settings.publicDesc')}</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="private"
                    checked={newListVisibility === 'private'}
                    onChange={(e) => setNewListVisibility(e.target.value as 'private')}
                    className="mr-2"
                  />
                  <span>{t('collections:settings.private')}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{t('collections:settings.privateDesc')}</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewListName('');
                  setError('');
                }}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                disabled={creating}
              >
                {t('collections:settings.cancel')}
              </button>
              <button
                onClick={handleCreateList}
                disabled={creating || !newListName.trim()}
                className="ai-gradient-btn px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? t('collections:management.creating') : t('create')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
