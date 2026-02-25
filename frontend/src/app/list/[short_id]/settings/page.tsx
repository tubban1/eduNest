'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useSmartBack } from '@/utils/navigation';
import { SUPPORTED_LANGUAGES } from '@/i18n/config';

const LIST_LINK_PREFIX = 'https://www.edunest.app';

interface ListSettings {
  name: string;
  description?: string;
  visibility: 'public' | 'private';
  pricing_mode: 'free' | 'one_time' | 'subscription';
  price?: number;
  currency?: string;
  language_code?: string | null;
}

export default function ListSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation(['common', 'collections']);
  const { handleSmartBack } = useSmartBack();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listData, setListData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<ListSettings>({
    name: '',
    description: '',
    visibility: 'public',
    pricing_mode: 'free',
    price: undefined,
    currency: 'USD',
    language_code: null,
  });

  // 密钥管理
  const [channelName, setChannelName] = useState('');
  const [keyCount, setKeyCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [accessKeys, setAccessKeys] = useState<Array<{ id: string; key_display: string; channel_name?: string; max_devices: number; bound_device_count: number; status: string; created_at: string }>>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchListData = async () => {
      if (!mounted) return;

      try {
        setLoading(true);
        setError(null);
        const shortId = params.short_id as string;
        const data = await api.collectionList.getByShortId(shortId);

        if (!data || !data.user_access || data.user_access.is_owner !== true) {
          const errorMsg = mounted
            ? `${t('collections:list.noPermission')}。${t('collections:list.noPermissionDesc')}`
            : 'No permission';
          setError(errorMsg);
          if (data && !data.list) {
            console.error('权限检查失败: API 返回数据缺少 list 字段，请清除缓存后重试', { keys: data ? Object.keys(data) : [] });
          }
          setLoading(false);
          return;
        }

        setListData(data);

        const rawMode = (data.list.pricing_mode as string) || 'free';
        const normalizedMode: ListSettings['pricing_mode'] =
          rawMode === 'premium'
            ? 'one_time'
            : rawMode === 'free_preview'
            ? 'subscription'
            : (rawMode as ListSettings['pricing_mode']);

        setSettings({
          name: data.list.name || '',
          description: data.list.description || '',
          visibility: data.list.visibility || 'public',
          pricing_mode: normalizedMode,
          price: data.list.price || undefined,
          currency: data.list.currency || 'USD',
          language_code: data.list.language_code ?? null,
        });
        if (data.list && (normalizedMode === 'one_time' || normalizedMode === 'subscription')) {
          fetchAccessKeys(data.list.id);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : (mounted ? t('collections:list.loadFailed') : 'Load failed');
        setError(errorMessage);
        console.error('获取列表数据失败:', err);
      } finally {
        setLoading(false);
      }
    };

    const shortId = params.short_id as string | undefined;
    if (!shortId || !mounted) return;

    // 等 auth 状态稳定后再请求，避免用「未登录缓存」导致设置页一直显示无权限
    if (authLoading) {
      setLoading(true);
      setError(null);
      return;
    }
    if (!user?.id) {
      setLoading(false);
      setError(mounted ? t('collections:list.pleaseLogin') : 'Please login');
      return;
    }
    fetchListData();
  }, [params.short_id, user?.id, mounted, authLoading, t]);

  const fetchAccessKeys = async (listId: string) => {
    try {
      setKeysLoading(true);
      const res = await api.collectionList.getAccessKeys(listId);
      if (res?.success && res.keys) {
        setAccessKeys(res.keys);
      }
    } catch (_) {
      setAccessKeys([]);
    } finally {
      setKeysLoading(false);
    }
  };

  const handleBatchGenerate = async () => {
    if (!listData?.list?.id) return;
    const cnt = Math.min(Math.max(keyCount, 1), 100);
    try {
      setGenerating(true);
      setError(null);
      const res = await api.collectionList.batchGenerateKeys(listData.list.id, {
        channel_name: channelName.trim() || undefined,
        count: cnt,
        max_devices: 3,
      });
      if (res?.success && res.keys?.length) {
        setAccessKeys(prev => [...(res.keys || []), ...prev]);
        setError(null);
      } else {
        throw new Error(res?.error || '生成失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const copyKey = (keyId: string, keyDisplay: string) => {
    const listName = listData?.list?.name || settings.name || '';
    const link = `${LIST_LINK_PREFIX}/list/${params.short_id || ''}`;
    const nameLabel = t('collections:settings.listNameLabel', '列表');
    const keyLabel = t('collections:settings.keyLabel', '密钥');
    const linkLabel = t('collections:settings.linkLabel', '链接');
    const text = `${nameLabel}：${listName}\n${linkLabel}：${link}\n${keyLabel}：${keyDisplay}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 1800);
    });
  };

  // 按渠道复制：选中的渠道（__all__ = 全部，'' = 未分类，其它 = 渠道名）
  const [copyChannelFilter, setCopyChannelFilter] = useState<string>('__all__');
  const channelOptions = React.useMemo(() => {
    const set = new Set<string>();
    accessKeys.forEach((k) => set.add(k.channel_name ?? ''));
    return ['__all__', ...Array.from(set).sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))];
  }, [accessKeys]);

  const copyKeysByChannel = () => {
    const filtered =
      copyChannelFilter === '__all__'
        ? accessKeys
        : accessKeys.filter((k) => (k.channel_name ?? '') === copyChannelFilter);
    if (filtered.length === 0) return;
    const text = filtered.map((k) => k.key_display).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      toast.textContent = t('collections:settings.copiedAll', { count: filtered.length });
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    });
  };

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
        language_code: settings.language_code === '' ? null : settings.language_code,
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{mounted ? t('collections:list.loading') : 'Loading...'}</p>
          <p className="text-sm text-muted-foreground/70 mt-2">{mounted ? t('collections:list.loadingListInfo') : 'Loading list information'}</p>
        </div>
      </div>
    );
  }

  if (error && !listData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <div className="text-6xl mb-4">😕</div>
          <div className="text-destructive text-xl font-semibold mb-2">{mounted ? t('collections:list.loadFailed') : 'Load failed'}</div>
          <p className="text-muted-foreground mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleSmartBack}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
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
                      language_code: data.list.language_code ?? null,
                    });
                    setLoading(false);
                  })
                  .catch(err => {
                    setError(err instanceof Error ? err.message : (mounted ? t('collections:list.loadFailed') : 'Load failed'));
                    setLoading(false);
                  });
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
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

            <Link
              href={`/list/${params.short_id}/import`}
              className="px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors mr-2"
            >
              📥 {t('collections:settings.batchImport')}
            </Link>
            
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

          {/* 访问密钥（仅付费/预览模式显示，放在最上方便于频繁配置） */}
          {(settings.pricing_mode === 'premium' || settings.pricing_mode === 'free_preview') && listData?.list?.id && (
            <div className="mb-6 pt-6 border-t">
              <h3 className="text-base font-semibold text-gray-800 mb-2">{t('collections:settings.accessKeys')}</h3>
              <p className="text-sm text-gray-500 mb-4">{t('collections:settings.accessKeysDesc')}</p>
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs text-gray-600 mb-1">{t('collections:settings.channelName')}</label>
                  <input
                    type="text"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    placeholder={t('collections:settings.channelNamePlaceholder')}
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs text-gray-600 mb-1">{t('collections:settings.keyCount')}</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={keyCount}
                    onChange={(e) => setKeyCount(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleBatchGenerate}
                    disabled={generating}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 disabled:opacity-60"
                  >
                    {generating ? t('collections:settings.generating') : t('collections:settings.batchGenerate')}
                  </button>
                </div>
              </div>
              {keysLoading ? (
                <p className="text-sm text-gray-500 py-4">加载中...</p>
              ) : accessKeys.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">{t('collections:settings.noKeys')}</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    <span className="text-sm text-gray-600">{t('collections:settings.copyByChannel')}</span>
                    <select
                      value={copyChannelFilter}
                      onChange={(e) => setCopyChannelFilter(e.target.value)}
                      className="text-sm px-3 py-1.5 border border-input rounded-lg bg-white"
                    >
                      <option value="__all__">{t('collections:settings.channelAll')}</option>
                      {channelOptions
                        .filter((c) => c !== '__all__')
                        .map((ch) => (
                          <option key={ch || '__empty__'} value={ch}>
                            {ch === '' ? t('collections:settings.channelUnset') : ch}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={copyKeysByChannel}
                      disabled={
                        copyChannelFilter === '__all__'
                          ? accessKeys.length === 0
                          : !accessKeys.some((k) => (k.channel_name ?? '') === copyChannelFilter)
                      }
                      className="text-sm px-3 py-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      📋 {t('collections:settings.copyAllKeys')}
                    </button>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm table-fixed">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium w-[28%] min-w-0">{t('collections:settings.keyDisplay')}</th>
                        <th className="text-left px-3 py-2 font-medium w-[18%] min-w-0">{t('collections:settings.channelName')}</th>
                        <th className="text-left px-3 py-2 font-medium w-[14%] min-w-0">{t('collections:settings.boundDevices')}</th>
                        <th className="text-left px-3 py-2 font-medium w-[14%] min-w-0">{t('collections:settings.keyStatus')}</th>
                        <th className="text-left px-3 py-2 font-medium w-[26%] min-w-[5.5rem]">{t('collections:settings.copyKey')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessKeys.map((k) => (
                        <tr key={k.id} className="border-t">
                          <td className="px-3 py-2 font-mono truncate min-w-0" title={k.key_display}>{k.key_display}</td>
                          <td className="px-3 py-2 text-gray-600 min-w-0">{k.channel_name || '-'}</td>
                          <td className="px-3 py-2 min-w-0">{k.bound_device_count} / {k.max_devices}</td>
                          <td className="px-3 py-2 min-w-0">{k.status === 'active' ? t('collections:settings.keyStatusActive') : t('collections:settings.keyStatusRevoked')}</td>
                          <td className="px-3 py-2 min-w-[5.5rem]">
                            <button
                              type="button"
                              onClick={() => copyKey(k.id, k.key_display)}
                              className="text-xs px-2 py-1 rounded transition-all duration-200 text-primary hover:bg-primary/10 active:scale-95"
                            >
                              {copiedKeyId === k.id ? (t('common:copied', '已复制') || '已复制') : (t('collections:settings.copyKey') || '复制')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
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
                className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
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
                className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              rows={4}
              placeholder={t('collections:settings.listDescriptionPlaceholder')}
            />
          </div>

          {/* 列表语言 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('collections:settings.listLanguage')}
            </label>
            <select
              value={settings.language_code ?? ''}
              onChange={(e) => setSettings({ ...settings, language_code: e.target.value || null })}
              className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="">{t('collections:settings.listLanguageOptional')}</option>
              {SUPPORTED_LANGUAGES.map(({ code, label }) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
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
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    pricing_mode: e.target.value as 'free' | 'one_time' | 'subscription',
                    price: undefined,
                  })
                }
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
                  value="one_time"
                  checked={settings.pricing_mode === 'one_time'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      pricing_mode: e.target.value as 'free' | 'one_time' | 'subscription',
                    })
                  }
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium">{t('collections:settings.premium')}</div>
                  <div className="text-sm text-gray-500">{t('collections:settings.premiumDesc')}</div>
                  {settings.pricing_mode === 'one_time' && (
                    <div className="mt-3 flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-1">{t('collections:settings.price')}</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={settings.price || ''}
                          onChange={(e) => setSettings({ ...settings, price: parseFloat(e.target.value) || undefined })}
                          className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                          placeholder="0.00"
                          required={settings.pricing_mode === 'one_time'}
                        />
                      </div>
                      <div className="w-32">
                        <label className="block text-xs text-gray-600 mb-1">{t('collections:settings.currency')}</label>
                        <select
                          value={settings.currency}
                          onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                          className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
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
                  value="subscription"
                  checked={settings.pricing_mode === 'subscription'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      pricing_mode: e.target.value as 'free' | 'one_time' | 'subscription',
                      price: undefined,
                    })
                  }
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium">
                    {t('collections:settings.preview', '订阅模式')}
                  </div>
                  <div className="text-sm text-gray-500">
                    {t(
                      'collections:settings.previewDesc',
                      '订阅 Pro 等会员可解锁整个列表，可为部分内容设置「免费试看」，方便公开分享链接给学生/家长使用。'
                    )}
                    <span className="ml-1 text-xs text-gray-400">（订阅模式）</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => router.push(`/list/${params.short_id}`)}
                className="px-6 py-2 border border-input rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              {t('collections:settings.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t('collections:settings.saving') : t('collections:settings.saveSettings')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

