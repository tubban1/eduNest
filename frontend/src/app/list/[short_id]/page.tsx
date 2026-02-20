'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useSmartBack } from '@/utils/navigation';
import MathText from '@/components/MathText';
import { getVisitorId } from '@/utils/visitorId';

interface CollectionListData {
  list: {
    id: string;
    name: string;
    short_id: string;
    visibility: string;
    user_id: string;
    created_at: string;
    pricing_mode?: string;
    price?: number;
    currency?: string;
    description?: string;
    language_code?: string | null;
  };
  contents: Array<{
    id: string;
    content: {
      id: string;
      short_id: string;
      title: string;
      description?: string;
      tags?: string[];
      language_code?: string;
      created_at: string;
    };
    added_at: string;
    index: number;
    is_accessible: boolean;
    requires_payment: boolean;
    is_free_preview: boolean;
  }>;
  total: number;
  free_count: number;
  premium_count: number;
  user_access: {
    is_owner: boolean;
    is_platform_premium: boolean;
    has_purchased_list: boolean;
    can_access_all: boolean;
  };
  pricing: {
    mode: string;
    price?: number;
    currency: string;
    formatted_price?: string;
  };
}

export default function CollectionListPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation(['common', 'collections']);
  const { handleSmartBack } = useSmartBack();
  const [listData, setListData] = useState<CollectionListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const originalTitle = document.title;
    return () => {
      document.title = originalTitle;
    };
  }, []);

  useEffect(() => {
    const fetchListData = async () => {
      try {
        setLoading(true);
        const shortId = params.short_id as string;
        const data = await api.collectionList.getByShortId(shortId);
        
        // 验证数据结构
        if (!data || !data.list) {
          throw new Error('列表数据格式错误');
        }
        
        setListData(data);
        
        // 动态设置浏览器标题和 Meta 标签
        if (data.list?.name) {
          document.title = `${data.list.name} - ${mounted ? t('collections:list.title') : 'List'} - EduNest AI`;
          
          // 设置 meta description
          const metaDescription = document.querySelector('meta[name="description"]');
          if (metaDescription && mounted) {
            metaDescription.setAttribute(
              'content',
              `${t('collections:list.shareList')} ${data.list.name}, ${t('collections:list.totalContents', { count: data.total || 0 })}. ${t('collections:list.freePreview', { count: data.free_count || 0 })}.`
            );
          }
        } else {
          document.title = `${mounted ? t('collections:list.title') : 'List'} - EduNest AI`;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : (mounted ? t('collections:list.loadFailed') : 'Load failed');
        setError(errorMsg);
        document.title = `${mounted ? t('collections:list.loadFailed') : 'Load failed'} - EduNest AI`;
      } finally {
        setLoading(false);
      }
    };

    if (params.short_id && mounted) {
      fetchListData();
    }
  }, [params.short_id, mounted, t]);

  const handleContentClick = (item: CollectionListData['contents'][0]) => {
    if (!item.is_accessible) {
      // 未解锁：显示密钥输入弹窗
      setKeyError(null);
      setKeyInput('');
      setShowKeyModal(true);
      return;
    }
    router.push(`/c/${item.content.short_id}`);
  };

  const handleKeySubmit = async () => {
    if (!listData?.list?.id || !keyInput.trim()) return;
    try {
      setValidating(true);
      setKeyError(null);
      const deviceId = getVisitorId();
      const res = await api.collectionList.validateAccessKey(listData.list.id, keyInput.trim(), deviceId);
      if (res?.success) {
        api.collectionList.invalidateCache(listData.list.short_id);
        const data = await api.collectionList.getByShortId(listData.list.short_id);
        setListData(data);
        setShowKeyModal(false);
        setKeyInput('');
      } else {
        setKeyError(res?.error || t('collections:content.keyInvalid'));
      }
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : t('collections:content.keyInvalid'));
    } finally {
      setValidating(false);
    }
  };

  const handlePurchaseClick = () => {
    if (listData?.pricing?.mode === 'premium') {
      alert(`${mounted ? t('collections:content.purchaseNotAvailable') : 'Purchase not available'}\n${mounted ? t('collections:content.price') : 'Price'}：${listData.pricing?.formatted_price || (mounted ? t('collections:content.pricePending') : 'Pending')}`);
      // router.push(`/purchase/list/${listData?.list?.short_id}`);
    } else if (listData?.pricing?.mode === 'free_preview') {
      alert(mounted ? t('collections:content.subscribeNotAvailable') : 'Subscribe not available');
      // router.push(`/subscription?source=list&list_id=${listData?.list?.short_id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{mounted ? t('collections:list.loading') : 'Loading...'}</p>
          <p className="text-sm text-muted-foreground/70 mt-2">{mounted ? t('collections:list.loadingListInfo') : 'Loading list information'}</p>
        </div>
      </div>
    );
  }

  if (error || !listData || !listData.list) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <div className="text-6xl mb-4">😕</div>
          <div className="text-destructive text-xl font-semibold mb-2">{mounted ? t('collections:list.loadFailed') : 'Load failed'}</div>
          <p className="text-muted-foreground mb-6">{error || (mounted ? t('collections:list.listNotFound') : 'List not found')}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleSmartBack}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
            >
              {mounted ? t('back') : 'Back'}
            </button>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                const shortId = params.short_id as string;
                api.collectionList.getByShortId(shortId)
                  .then(data => {
                    if (!data || !data.list) {
                      throw new Error('列表数据格式错误');
                    }
                    setListData(data);
                    setLoading(false);
                  })
                  .catch(err => {
                    setError(err instanceof Error ? err.message : (mounted ? t('collections:list.loadFailed') : 'Load failed'));
                    setLoading(false);
                  });
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
            >
              {mounted ? t('collections:list.retry') : 'Retry'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 安全解构，确保 list 存在
  if (!listData?.list) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <div className="text-6xl mb-4">😕</div>
          <div className="text-destructive text-xl font-semibold mb-2">{mounted ? t('collections:list.loadFailed') : 'Load failed'}</div>
          <p className="text-muted-foreground mb-6">{mounted ? t('collections:list.listNotFound') : 'List not found'}</p>
          <button
            onClick={handleSmartBack}
            className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
          >
            {mounted ? t('back') : 'Back'}
          </button>
        </div>
      </div>
    );
  }

  const { list, contents, total, free_count, premium_count, user_access, pricing } = listData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* 第一行：返回按钮、标题、操作按钮、logo */}
          <div className="flex items-center mb-3">
            <button
              onClick={handleSmartBack}
              className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors mr-3"
            >
              ← {mounted ? t('back') : 'Back'}
            </button>
            
            <h1 className="flex-1 font-bold text-gray-900 text-lg sm:text-xl md:text-2xl truncate">
              {list?.name || (mounted ? t('collections:list.title') : 'List')}
            </h1>
            
            {/* 操作按钮区域 */}
            <div className="flex items-center gap-2 mr-3">
              {/* 分享按钮 */}
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/list/${list?.short_id || params.short_id}`;
                  const shareData = {
                    title: list?.name || '',
                    text: list?.description || (mounted ? `查看 ${list?.name || ''} 收藏列表，包含 ${total || 0} 个内容` : `View list with ${total || 0} items`),
                    url: url,
                  };
                  
                  try {
                    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                      await navigator.share(shareData);
                    } else {
                      // 降级方案：复制到剪贴板
                      await navigator.clipboard.writeText(url);
                      // 使用更友好的提示
                      const toast = document.createElement('div');
                      toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in';
                      toast.textContent = `✓ ${t('collections:list.linkCopied')}`;
                      document.body.appendChild(toast);
                      setTimeout(() => {
                        toast.remove();
                      }, 2000);
                    }
                  } catch (err: any) {
                    // 用户取消分享或其他错误，静默处理
                    if (err.name !== 'AbortError') {
                      // 如果不是用户取消，尝试复制
                      try {
                        await navigator.clipboard.writeText(url);
                        const toast = document.createElement('div');
                        toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
                        toast.textContent = `✓ ${t('collections:list.linkCopied')}`;
                        document.body.appendChild(toast);
                        setTimeout(() => {
                          toast.remove();
                        }, 2000);
                      } catch (copyErr) {
                        // 复制也失败，显示错误
                        console.error('分享失败:', copyErr);
                      }
                    }
                  }
                }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                title={t('collections:list.shareList')}
              >
                🔗 {t('collections:list.share')}
              </button>
              
              {/* 设置按钮（仅创建者可见） */}
              {user_access?.is_owner && (
                <button
                  onClick={() => router.push(`/list/${list?.short_id || params.short_id}/settings`)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  title={mounted ? t('collections:list.listSettings') : 'Settings'}
                >
                  ⚙️ {mounted ? t('collections:list.settings') : 'Settings'}
                </button>
              )}
            </div>
            
            <Link href="/" className="ml-3">
              <Image
                src="/favicon.png"
                alt="EduNest AI"
                width={32}
                height={32}
                className="w-8 h-8 hover:opacity-80 transition-opacity"
              />
            </Link>
          </div>
          
          {/* 第二行：描述和统计信息 */}
          <div className="mb-3">
            {list?.description && (
              <p className="text-gray-600 text-sm sm:text-base mb-2">
                {list.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{mounted ? t('collections:list.totalContents', { count: total || 0 }) : `Total: ${total || 0}`}</span>
              {pricing?.mode !== 'free' && (
                <span>
                  {mounted ? t('collections:list.freePreview', { count: free_count || 0 }) : `Free: ${free_count || 0}`}
                  {premium_count > 0 && `，${mounted ? t('collections:list.premiumContents', { count: premium_count }) : `Premium: ${premium_count}`}`}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 购买/升级提示横幅 */}
      {premium_count > 0 && !user_access?.can_access_all && (
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-primary/20">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💎</span>
                <div>
                  {pricing?.mode === 'premium' ? (
                    <>
                      <p className="font-semibold text-foreground">
                        {mounted ? t('collections:purchase.purchaseList', { count: premium_count || 0 }) : `Purchase ${premium_count || 0} items`}
                      </p>
                      {pricing?.formatted_price && (
                        <p className="text-sm text-muted-foreground">{mounted ? t('collections:purchase.price') : 'Price'}：{pricing.formatted_price}</p>
                      )}
                    </>
                  ) : (
                    <p className="font-semibold text-foreground">
                      {mounted ? t('collections:purchase.upgradePro', { count: premium_count || 0 }) : `Upgrade for ${premium_count || 0} items`}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setKeyError(null); setKeyInput(''); setShowKeyModal(true); }}
                  className="px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors font-medium whitespace-nowrap"
                >
                  🔑 {t('collections:content.enterAccessKey')}
                </button>
                <button
                  onClick={handlePurchaseClick}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors font-medium whitespace-nowrap"
                >
                  {pricing?.mode === 'premium' ? (mounted ? t('collections:purchase.buyNow') : 'Buy Now') : (mounted ? t('collections:purchase.upgradeNow') : 'Upgrade Now')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 密钥输入弹窗 */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !validating && setShowKeyModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">{t('collections:content.enterAccessKey')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('collections:content.enterAccessKeyDesc')}</p>
            <input
              type="text"
              value={keyInput}
              onChange={(e) => { setKeyInput(e.target.value); setKeyError(null); }}
              placeholder={t('collections:content.accessKeyPlaceholder')}
              className="w-full px-4 py-2 border border-input rounded-lg mb-2 font-mono"
              autoFocus
            />
            {keyError && <p className="text-sm text-red-600 mb-2">{keyError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => !validating && setShowKeyModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                {t('collections:settings.cancel')}
              </button>
              <button
                onClick={handleKeySubmit}
                disabled={validating || !keyInput.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-60"
              >
                {validating ? t('collections:content.unlocking') : t('collections:content.unlock')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 内容网格 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {contents.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-muted-foreground text-lg mb-2">{t('collections:list.emptyList')}</p>
            <p className="text-muted-foreground/70 text-sm">{t('collections:list.emptyListDesc')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {contents.map((item) => {
              const isDisabled = !item.is_accessible;
              
              return (
                <div
                  key={item.id}
                  onClick={() => handleContentClick(item)}
                    className={`
                    relative bg-card rounded-lg shadow-sm border border-border p-4
                    transition-all duration-200
                    ${isDisabled 
                      ? 'opacity-60 cursor-not-allowed filter grayscale-30' 
                      : 'cursor-pointer hover:shadow-md hover:scale-[1.02] hover:border-primary/30'
                    }
                  `}
                  title={isDisabled 
                    ? (pricing.mode === 'premium' ? t('collections:content.needPurchase') : t('collections:content.needSubscribe'))
                    : item.content.title
                  }
                >
                  {/* 锁定图标覆盖层 */}
                  {isDisabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900/40 to-gray-800/40 rounded-lg z-10 backdrop-blur-sm">
                      <div className="text-center transform transition-transform hover:scale-105">
                        <div className="text-4xl mb-2 animate-pulse">🔒</div>
                        <div className="text-white text-sm font-medium px-4 py-2 bg-black/70 rounded-lg shadow-lg">
                          🔑 {t('collections:content.enterAccessKey')}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* 内容信息 */}
                  <div className="relative z-0">
                    <MathText
                      as="h3"
                      text={item.content.title}
                      className="font-semibold text-foreground mb-2 line-clamp-2"
                    />
                    {item.content.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {item.content.description}
                      </p>
                    )}
                    {item.content.tags && item.content.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.content.tags.slice(0, 2).map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                        {item.content.tags.length > 2 && (
                          <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">
                            +{item.content.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                    {item.is_free_preview && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-secondary/10 text-secondary text-xs rounded-full font-medium">
                        ✓ {t('collections:content.freePreview')}
                      </span>
                    )}
                    {!item.is_free_preview && !isDisabled && pricing.mode !== 'free' && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">
                        💎 {t('collections:content.unlocked')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

