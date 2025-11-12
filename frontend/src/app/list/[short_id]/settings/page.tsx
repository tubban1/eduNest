'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useSmartBack } from '@/utils/navigation';

interface ListSettings {
  name: string;
  description?: string;
  visibility: 'public' | 'private';
  pricing_mode: 'free' | 'premium' | 'free_preview';
  price?: number;
  currency?: string;
}

export default function ListSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation(['common', 'collections']);
  const { handleSmartBack } = useSmartBack();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listData, setListData] = useState<any>(null);
  const [settings, setSettings] = useState<ListSettings>({
    name: '',
    description: '',
    visibility: 'public',
    pricing_mode: 'free',
    price: undefined,
    currency: 'USD',
  });

  useEffect(() => {
    const fetchListData = async () => {
      // 检查用户是否已登录
      if (!user) {
        setError(t('collections:list.pleaseLogin'));
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        const shortId = params.short_id as string;
        const data = await api.collectionList.getByShortId(shortId);
        
        // 检查是否为创建者
        if (!data || !data.user_access || !data.user_access.is_owner) {
          setError(`${t('collections:list.noPermission')}。${t('collections:list.noPermissionDesc')}`);
          console.error('权限检查失败:', {
            user_id: user?.id,
            list_user_id: data?.list?.user_id,
            is_owner: data?.user_access?.is_owner,
            data: data
          });
          return;
        }
        
        setListData(data);
        setSettings({
          name: data.list.name || '',
          description: data.list.description || '',
          visibility: data.list.visibility || 'public',
          pricing_mode: data.list.pricing_mode || 'free',
          price: data.list.price || undefined,
          currency: data.list.currency || 'USD',
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : t('collections:list.loadFailed');
        setError(errorMessage);
        console.error('获取列表数据失败:', err);
      } finally {
        setLoading(false);
      }
    };

    if (params.short_id && user) {
      fetchListData();
    } else if (params.short_id && !user) {
      setLoading(false);
      setError(t('collections:list.pleaseLogin'));
    }
  }, [params.short_id, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!listData) return;
    
    // 验证价格（如果设置为付费）
    if (settings.pricing_mode === 'premium') {
      if (!settings.price || settings.price <= 0) {
        setError(t('collections:settings.priceRequired'));
        return;
      }
    }
    
    try {
      setSaving(true);
      setError(null);
      
      const response = await api.collectionList.updateSettings(listData.list.id, {
        name: settings.name,
        description: settings.description,
        visibility: settings.visibility,
        pricing_mode: settings.pricing_mode,
        price: settings.pricing_mode === 'premium' ? settings.price : undefined,
        currency: settings.pricing_mode === 'premium' ? settings.currency : undefined,
      });
      
      // 检查响应
      if (response && response.success !== false) {
        // 保存成功后返回列表页面
        router.push(`/list/${params.short_id}`);
      } else {
        throw new Error(response?.error || t('collections:settings.saveFailed'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('collections:settings.saveFailed');
      setError(errorMessage);
      console.error('保存设置失败:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('collections:list.loading')}</p>
          <p className="text-sm text-gray-400 mt-2">{t('collections:list.loadingListInfo')}</p>
        </div>
      </div>
    );
  }

  if (error && !listData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-4">
          <div className="text-6xl mb-4">😕</div>
          <div className="text-red-600 text-xl font-semibold mb-2">{t('collections:list.loadFailed')}</div>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleSmartBack}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              {t('back')}
            </button>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                const shortId = params.short_id as string;
                api.collectionList.getByShortId(shortId)
                  .then(data => {
                    if (!data.user_access.is_owner) {
                      setError(`${t('collections:list.noPermission')}。${t('collections:list.noPermissionDesc')}`);
                      setLoading(false);
                      return;
                    }
                    setListData(data);
                    setSettings({
                      name: data.list.name || '',
                      description: data.list.description || '',
                      visibility: data.list.visibility || 'public',
                      pricing_mode: data.list.pricing_mode || 'free',
                      price: data.list.price || undefined,
                      currency: data.list.currency || 'USD',
                    });
                    setLoading(false);
                  })
                  .catch(err => {
                    setError(err instanceof Error ? err.message : t('collections:list.loadFailed'));
                    setLoading(false);
                  });
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('collections:list.retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center mb-4">
            <button
              onClick={() => router.push(`/list/${params.short_id}`)}
              className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors mr-3"
            >
              ← {t('collections:list.backToList')}
            </button>
            
            <h1 className="flex-1 font-bold text-gray-900 text-xl">{t('collections:list.listSettingsTitle')}</h1>
            
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
        </div>
      </div>

      {/* 表单内容 */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* 列表名称 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('collections:settings.listNameRequired')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              placeholder={t('collections:settings.listNamePlaceholder')}
            />
          </div>

          {/* 列表描述 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('collections:settings.listDescription')}
            </label>
            <textarea
              value={settings.description}
              onChange={(e) => setSettings({ ...settings, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
              placeholder={t('collections:settings.listDescriptionPlaceholder')}
            />
          </div>

          {/* 可见性 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('collections:settings.visibility')}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="public"
                  checked={settings.visibility === 'public'}
                  onChange={(e) => setSettings({ ...settings, visibility: e.target.value as 'public' | 'private' })}
                  className="mr-2"
                />
                <span>{t('collections:settings.public')}</span>
                <span className="ml-2 text-xs text-gray-500">{t('collections:settings.publicDesc')}</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="private"
                  checked={settings.visibility === 'private'}
                  onChange={(e) => setSettings({ ...settings, visibility: e.target.value as 'public' | 'private' })}
                  className="mr-2"
                />
                <span>{t('collections:settings.private')}</span>
                <span className="ml-2 text-xs text-gray-500">{t('collections:settings.privateDesc')}</span>
              </label>
            </div>
          </div>

          {/* 定价模式 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('collections:settings.pricingMode')}
            </label>
            <div className="space-y-3">
              <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="free"
                  checked={settings.pricing_mode === 'free'}
                  onChange={(e) => setSettings({ ...settings, pricing_mode: e.target.value as 'free' | 'premium' | 'free_preview', price: undefined })}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium">{t('collections:settings.free')}</div>
                  <div className="text-sm text-gray-500">{t('collections:settings.freeDesc')}</div>
                </div>
              </label>
              
              <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="premium"
                  checked={settings.pricing_mode === 'premium'}
                  onChange={(e) => setSettings({ ...settings, pricing_mode: e.target.value as 'free' | 'premium' | 'free_preview' })}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium">{t('collections:settings.premium')}</div>
                  <div className="text-sm text-gray-500">{t('collections:settings.premiumDesc')}</div>
                  {settings.pricing_mode === 'premium' && (
                    <div className="mt-3 flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-1">{t('collections:settings.price')}</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={settings.price || ''}
                          onChange={(e) => setSettings({ ...settings, price: parseFloat(e.target.value) || undefined })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0.00"
                          required={settings.pricing_mode === 'premium'}
                        />
                      </div>
                      <div className="w-32">
                        <label className="block text-xs text-gray-600 mb-1">{t('collections:settings.currency')}</label>
                        <select
                          value={settings.currency}
                          onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="USD">USD</option>
                          <option value="CNY">CNY</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </label>
              
              <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="free_preview"
                  checked={settings.pricing_mode === 'free_preview'}
                  onChange={(e) => setSettings({ ...settings, pricing_mode: e.target.value as 'free' | 'premium' | 'free_preview', price: undefined })}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium">{t('collections:settings.preview')}</div>
                  <div className="text-sm text-gray-500">{t('collections:settings.previewDesc')}</div>
                </div>
              </label>
            </div>
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => router.push(`/list/${params.short_id}`)}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('collections:settings.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t('collections:settings.saving') : t('collections:settings.saveSettings')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

