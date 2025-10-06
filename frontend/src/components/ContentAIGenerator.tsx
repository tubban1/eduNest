'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import AIProviderSelector from '@/components/AIProviderSelector';
import { SUPPORTED_LANGUAGES } from '@/i18n/config';

interface ContentAIGeneratorProps {
  className?: string;
  onGenerated?: () => void;
  defaultLanguageCode?: string;
}

export default function ContentAIGenerator({
  className,
  onGenerated,
  defaultLanguageCode,
}: ContentAIGeneratorProps) {
  const { t } = useTranslation(['content', 'common', 'aiProvider', 'auth']);
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  // 输入与状态
  const [knowledgePoint, setKnowledgePoint] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('');
  const [aiProvider, setAiProvider] = useState<string>('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [error, setError] = useState('');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const [checking, setChecking] = useState<boolean>(false);

  // 语言弹窗
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [languageSearch, setLanguageSearch] = useState('');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromStorage = localStorage.getItem('output_language_last_used') || '';
    const initial = defaultLanguageCode || fromStorage || 'zh-CN';
    setLanguage(initial);
  }, [defaultLanguageCode]);

  // 拉取用户可用积分与当前待处理任务数
  const fetchPrecheckInfo = async () => {
    if (!user) return;
    try {
      setChecking(true);
      // 1) 获取积分
      const creditRes = await api.get('/credits/balance');
      const balance = (creditRes as any)?.success ? (creditRes as any)?.data?.balance : (creditRes as any)?.data?.balance ?? (creditRes as any)?.balance;
      if (typeof balance === 'number') setCreditsBalance(balance);
      // 2) 获取当前用户未完成的生成任务数量
      const myList: any[] = await api.content.getFiltered({ created_by: user.id } as any);
      const count = Array.isArray(myList) ? myList.filter((c: any) => ['pending', 'processing'].includes((c as any).generation_status)).length : 0;
      setPendingCount(count);
    } catch (e) {
      // 静默失败
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    fetchPrecheckInfo();
  }, [user]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchPrecheckInfo(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user]);

  const isRegularUser = user && user.role !== 'admin';
  const isAiFormDisabled = aiGenerating === true;

  // 选择语言
  const handleSelectLanguage = (code: string) => {
    setLanguage(code);
    if (typeof window !== 'undefined') {
      localStorage.setItem('output_language_last_used', code);
    }
    setShowLanguagePicker(false);
    setLanguageSearch('');
  };

  const filteredLanguages = SUPPORTED_LANGUAGES.filter(l => {
    const kw = languageSearch.trim().toLowerCase();
    if (!kw) return true;
    return l.code.toLowerCase().includes(kw) || (l.label || '').toLowerCase().includes(kw);
  });

  // 提交异步生成
  const handleAsyncAiGenerate = async () => {
    if (!knowledgePoint.trim()) {
      setError(t('pleaseEnterKnowledgePoint', { ns: 'content', defaultValue: 'Please enter a knowledge point' }));
      return;
    }
    // 前置校验：credits 与 pending 队列
    try {
      await fetchPrecheckInfo();
    } catch {}
    if (creditsBalance !== null && creditsBalance <= 0) {
      setError(t('errors.insufficientCredits', { ns: 'content', defaultValue: '积分不足，无法生成' }));
      return;
    }
    if (pendingCount >= 3) {
      setError(t('errors.queueLimitReached', { ns: 'content', defaultValue: '队列不能超过3个任务' }));
      return;
    }
    setAiGenerating(true);
    setError('');
    try {
      const contentData = {
        title: knowledgePoint.trim(),
        description: description || '',
        language_code: language,
        content_type: 'vue',
        code_html: '',
        code_css: '',
        code_js: '',
        external_links: [],
        tags: [],
        created_by: user?.id,
      } as any;

      const contentResponse = await api.content.create(contentData);
      if (!contentResponse || !contentResponse.id) {
        throw new Error('创建内容记录失败');
      }

      const generateResponse = await api.generateContentAsync(contentResponse.id, {
        knowledge_point: knowledgePoint.trim(),
        learning_stage: 'understanding',
        description,
        language_code: language,
        provider: user?.role === 'admin' ? aiProvider : undefined,
      });

      if (!(generateResponse && (generateResponse as any).success)) {
        throw new Error((generateResponse as any)?.error || '启动异步生成失败');
      }

      // 1) 写入 sessionStorage，供跨页面或刷新后拾取
      try {
        const payload = { id: contentResponse.id, q: knowledgePoint.trim(), lang: language };
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('new_content', JSON.stringify(payload));
        }
        // 2) 通过事件通知当前页面即时插入乐观卡片
        window.dispatchEvent(new CustomEvent('NEW_CONTENT_CREATED', { detail: payload }));
        // 本地 pending 计数 +1
        setPendingCount(prev => prev + 1);
      } catch {}

      // 3) 让外部回调进行列表刷新等后续动作（可选）
      if (onGenerated) onGenerated();
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes('401') || msg.includes('无效的访问令牌') || msg.includes('访问令牌缺失')) {
        window.location.href = '/login';
        return;
      }
      setError(msg);
    } finally {
      setAiGenerating(false);
    }
  };

  if (!user) return null;

  return (
    <div className={`flex flex-col gap-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow border border-blue-100 p-4 ${className || ''}`}>
      <h3 className="text-lg font-semibold text-gray-800 mb-1">
        {mounted ? t('aiGenerate', { ns: 'content', defaultValue: '🤖 AI Smart Generation' }) : '🤖 AI Smart Generation'}
      </h3>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block font-semibold mb-1 text-gray-700">
            {mounted ? t('knowledgePoint', { ns: 'content', defaultValue: 'Knowledge Point' }) : 'Knowledge Point'} <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none h-24"
            value={knowledgePoint}
            onChange={e => setKnowledgePoint(e.target.value)}
            placeholder={mounted ? t('knowledgePointPlaceholder', { ns: 'content', defaultValue: 'For example: Fraction operations, cell structure, Newton\'s laws...' }) : 'For example: Fraction operations, cell structure, Newton\'s laws...'}
            required
            disabled={isAiFormDisabled}
            maxLength={1500}
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-500">
              {mounted ? t('knowledgePointHint', { ns: 'content', defaultValue: 'Describe the knowledge point in detail for better AI generation' }) : 'Describe the knowledge point in detail for better AI generation'}
            </span>
            <span className={`text-xs ${knowledgePoint.length > 1350 ? 'text-red-500' : knowledgePoint.length > 1200 ? 'text-yellow-500' : 'text-gray-500'}`}>
              {knowledgePoint.length}/1500
            </span>
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1 text-gray-700">
            {mounted ? t('outputLanguage', { ns: 'content', defaultValue: 'Output Language' }) : 'Output Language'}
          </label>
          <input
            className="w-full border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
            value={language}
            readOnly
            placeholder={mounted ? t('selectOutputLanguage', { ns: 'content', defaultValue: 'Click to select output language (BCP 47)' }) : 'Click to select output language (BCP 47)'}
            disabled={isAiFormDisabled}
            onClick={() => !isAiFormDisabled && setShowLanguagePicker(true)}
          />
        </div>

        {user && user.role === 'admin' && (
          <div>
            <AIProviderSelector
              selectedProvider={aiProvider}
              onProviderChange={setAiProvider}
              disabled={isAiFormDisabled}
              className="mb-2"
            />
          </div>
        )}
      </div>

      <button
        type="button"
        className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg shadow hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        onClick={handleAsyncAiGenerate}
        disabled={isAiFormDisabled || !knowledgePoint.trim() || checking || (creditsBalance !== null && creditsBalance <= 0) || pendingCount >= 3}
      >
        {aiGenerating ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>🤖 {t('startingGeneration', { ns: 'content', defaultValue: '正在启动生成...' })}</span>
          </>
        ) : (
          '🚀 ' + (mounted ? t('aiGenerateShort', { ns: 'content', defaultValue: 'AI生成' }) : 'AI生成')
        )}
      </button>

      {(creditsBalance !== null && creditsBalance <= 0) && (
        <div className="text-sm text-red-600">{t('errors.insufficientCredits', { ns: 'content', defaultValue: '积分不足，无法生成' })}</div>
      )}
      {(pendingCount >= 3) && (
        <div className="text-sm text-gray-600">{t('errors.queueLimitReached', { ns: 'content', defaultValue: '队列不能超过3个任务' })}</div>
      )}

      {showLanguagePicker && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowLanguagePicker(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">{mounted ? t('selectOutputLanguage', { ns: 'content', defaultValue: 'Select Output Language' }) : 'Select Output Language'}</h3>
              <button className="text-gray-500 hover:text-black" onClick={() => setShowLanguagePicker(false)}>✕</button>
            </div>
            <input
              className="w-full border border-gray-200 p-2 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-black"
              value={languageSearch}
              onChange={e => setLanguageSearch(e.target.value)}
              placeholder={mounted ? t('searchLanguage', { ns: 'content', defaultValue: 'Search language...' }) : 'Search language...'}
            />
            <div className="max-h-80 overflow-auto border border-gray-100 rounded-lg">
              {filteredLanguages.map(l => (
                <div
                  key={l.code}
                  className={`px-3 py-2 cursor-pointer hover:bg-gray-50 flex items-center justify-between ${language === l.code ? 'bg-blue-50' : ''}`}
                  onClick={() => handleSelectLanguage(l.code)}
                >
                  <div>
                    <div className="font-medium text-gray-900">{l.label}</div>
                    <div className="text-xs text-gray-500">{l.code}</div>
                  </div>
                  {language === l.code && <span className="text-blue-600">✓</span>}
                </div>
              ))}
              {filteredLanguages.length === 0 && (
                <div className="px-3 py-6 text-center text-gray-500 text-sm">{mounted ? t('noResults', { ns: 'common', defaultValue: '暂无结果' }) : 'No results'}</div>
              )}
            </div>
            <div className="mt-3 flex gap-2 justify-end">
              <button className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50" onClick={() => setShowLanguagePicker(false)}>
                {mounted ? t('cancel', { ns: 'common', defaultValue: '取消' }) : 'Cancel'}
              </button>
              <button className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800" onClick={() => setShowLanguagePicker(false)}>
                {mounted ? t('confirm', { ns: 'common', defaultValue: '确定' }) : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


