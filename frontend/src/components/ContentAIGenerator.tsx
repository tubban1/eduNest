'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import AIProviderSelector from '@/components/AIProviderSelector';
import { SUPPORTED_LANGUAGES } from '@/i18n/config';
import { getVisitorId } from '@/utils/visitorId';
import { RegistrationPrompt } from '@/components/RegistrationPrompt';
import i18n from '@/i18n/config';

const DEFAULT_FULL_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>新内容</title>
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <style>
    body {
      font-family: sans-serif;
      margin: 0;
      padding: 20px;
    }
    #app {
      padding: 20px;
    }
  </style>
</head>
<body>
  <div id="app">{{ message }}</div>
  <script>
    const { createApp } = Vue;
    createApp({
      data() {
        return {
          message: "Hello World!"
        }
      }
    }).mount("#app");
  </script>
</body>
</html>`;

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
  const router = useRouter();
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
  const [showRegistrationPrompt, setShowRegistrationPrompt] = useState(false);
  const [trialStatus, setTrialStatus] = useState<{ content_generated: boolean; ai_guide_used: boolean } | null>(null);

  // 语言弹窗
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [languageSearch, setLanguageSearch] = useState('');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // 游客状态：使用系统语言，如果不在支持列表中则使用英语
    if (!user) {
      // 获取系统语言（从 i18n 或 navigator）
      const systemLang = i18n.language || navigator.language || 'en-US';
      // 标准化语言代码（zh -> zh-CN, en -> en-US 等）
      const normalizedSystemLang = systemLang === 'zh' || systemLang.startsWith('zh-') ? 'zh-CN' :
                                   systemLang === 'en' || systemLang.startsWith('en-') ? 'en-US' :
                                   systemLang === 'de' || systemLang.startsWith('de-') ? 'de-DE' :
                                   systemLang === 'fr' || systemLang.startsWith('fr-') ? 'fr-FR' :
                                   systemLang;
      
      // 检查系统语言是否在支持列表中
      const isSupported = SUPPORTED_LANGUAGES.some(l => l.code === normalizedSystemLang);
      const initial = isSupported ? normalizedSystemLang : 'en-US';
      setLanguage(initial);
      return;
    }
    
    // 已登录用户：使用原有逻辑（defaultLanguageCode > localStorage > zh-CN）
    const fromStorage = localStorage.getItem('output_language_last_used') || '';
    const initial = defaultLanguageCode || fromStorage || 'zh-CN';
    setLanguage(initial);
  }, [defaultLanguageCode, user]);

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

  // 检查免费试用状态（未登录用户）
  const fetchTrialStatus = async () => {
    if (user) return; // 已登录用户不需要检查
    try {
      const status = await api.visitor.checkTrial();
      if (status.success && status.data) {
        setTrialStatus(status.data);
        // 如果试用已用完，显示注册提示
        if (status.data.content_generated) {
          setShowRegistrationPrompt(true);
        }
      }
    } catch (e) {
      // 静默失败
    }
  };

  useEffect(() => {
    if (user) {
      fetchPrecheckInfo();
    } else {
      fetchTrialStatus();
    }
  }, [user]);

  useEffect(() => {
    const onVisible = () => { 
      if (document.visibilityState === 'visible') {
        if (user) {
          fetchPrecheckInfo();
        } else {
          fetchTrialStatus();
        }
      }
    };
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

    // 未登录用户：检查免费试用状态
    if (!user) {
      try {
        await fetchTrialStatus();
        if (trialStatus?.content_generated) {
          setShowRegistrationPrompt(true);
          setError(t('errors.freeTrialUsed', { ns: 'content', defaultValue: '请登录后继续使用' }));
          return;
        }
      } catch (e) {
        // 静默失败，继续尝试生成
      }
    }

    // 已登录用户：前置校验：credits 与 pending 队列
    if (user) {
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
    }

    setAiGenerating(true);
    setError('');
    try {
      const rawTitle = knowledgePoint.trim();
      const safeTitle = rawTitle.length > 200 ? (rawTitle.slice(0, 200)) : rawTitle;
      
      let contentResponse;
      let generateResponse;

      if (!user) {
        // 未登录用户：使用免费生成接口
        generateResponse = await api.generateContentFree({
          knowledgePoint: knowledgePoint.trim(),
          learningStage: 'understanding',
          description,
          language_code: language,
        });

        if (!(generateResponse && (generateResponse as any).success)) {
          const errorCode = (generateResponse as any)?.error;
          if (errorCode === 'FREE_TRIAL_USED') {
            setShowRegistrationPrompt(true);
            setError(t('errors.freeTrialUsed', { ns: 'content', defaultValue: '请登录后继续使用' }));
            return;
          }
          throw new Error((generateResponse as any)?.error || (generateResponse as any)?.message || '生成失败');
        }

        // 免费生成接口返回的内容数据
        contentResponse = (generateResponse as any).data;
        if (!contentResponse || !contentResponse.id) {
          throw new Error('生成内容失败');
        }

        // 标记免费试用已使用
        if ((generateResponse as any).freeTrialUsed) {
          setTrialStatus({ content_generated: true, ai_guide_used: trialStatus?.ai_guide_used || false });
          setShowRegistrationPrompt(true);
        }

        // 游客生成后，跳转到结果页面
        if (contentResponse.short_id) {
          router.push(`/c/${contentResponse.short_id}`);
          return; // 跳转后直接返回，不执行后续逻辑
        }
      } else {
        // 已登录用户：使用原有流程
        const contentData = {
          title: safeTitle,
          description: description || '',
          language_code: language,
          content_type: 'vue',
          full_html: DEFAULT_FULL_HTML || '',
          tags: [],
          created_by: user.id,
        } as any;

        contentResponse = await api.content.create(contentData);
        if (!contentResponse || !contentResponse.id) {
          throw new Error('创建内容记录失败');
        }

        generateResponse = await api.generateContentAsync(contentResponse.id, {
          knowledge_point: knowledgePoint.trim(),
          learning_stage: 'understanding',
          description,
          language_code: language,
          provider: user.role === 'admin' ? aiProvider : undefined,
        });

        if (!(generateResponse && (generateResponse as any).success)) {
          throw new Error((generateResponse as any)?.error || '启动异步生成失败');
        }
      }

      // 1) 写入 sessionStorage，供跨页面或刷新后拾取
      try {
        const payload = { id: contentResponse.id, q: rawTitle, lang: language };
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('new_content', JSON.stringify(payload));
        }
        // 2) 通过事件通知当前页面即时插入乐观卡片
        window.dispatchEvent(new CustomEvent('NEW_CONTENT_CREATED', { detail: payload }));
        // 本地 pending 计数 +1（仅已登录用户）
        if (user) {
          setPendingCount(prev => prev + 1);
        }
      } catch {}

      // 3) 让外部回调进行列表刷新等后续动作（可选）
      if (onGenerated) onGenerated();
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes('401') || msg.includes('无效的访问令牌') || msg.includes('访问令牌缺失')) {
        window.location.href = '/login';
        return;
      }
      // 检查是否是免费试用已用完的错误
      if (msg.includes('FREE_TRIAL_USED') || msg.includes('免费试用已用完')) {
        setShowRegistrationPrompt(true);
        setError(t('errors.freeTrialUsed', { ns: 'content', defaultValue: '请登录后继续使用' }));
        return;
      }
      // 后端参数验证失败时返回 details
      const detailed = (e?.details && Array.isArray(e.details)) ? e.details.map((d: any) => d.msg || d.message || d.param).join('\n') : '';
      setError(detailed ? `${msg}\n${detailed}` : msg);
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <div className={`flex flex-col gap-3 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl shadow border border-primary/20 p-4 ${className || ''}`}>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        {mounted ? t('aiGenerate', { ns: 'content', defaultValue: '🤖 AI Smart Generation' }) : '🤖 AI Smart Generation'}
      </h3>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-2">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block font-semibold mb-1 text-foreground">
            {mounted ? t('knowledgePoint', { ns: 'content', defaultValue: 'Knowledge Point' }) : 'Knowledge Point'} <span className="text-destructive">*</span>
          </label>
          <textarea
            className="w-full border border-border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-card resize-none h-24"
            value={knowledgePoint}
            onChange={e => setKnowledgePoint(e.target.value)}
            placeholder={mounted ? t('knowledgePointPlaceholder', { ns: 'content', defaultValue: 'For example: Fraction operations, cell structure, Newton\'s laws...' }) : 'For example: Fraction operations, cell structure, Newton\'s laws...'}
            required
            disabled={isAiFormDisabled}
            maxLength={1500}
          />
          <div className="flex justify-end items-center mt-1">
            <span className={`text-xs ${knowledgePoint.length > 1350 ? 'text-destructive' : knowledgePoint.length > 1200 ? 'text-warning' : 'text-muted-foreground'}`}>
              {knowledgePoint.length}/1500
            </span>
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1 text-foreground">
            {mounted ? t('outputLanguage', { ns: 'content', defaultValue: 'Output Language' }) : 'Output Language'}
          </label>
          <input
            className="w-full border border-border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-card cursor-pointer"
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
        className="w-full px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg shadow hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        onClick={handleAsyncAiGenerate}
        disabled={isAiFormDisabled || !knowledgePoint.trim() || checking || (user && creditsBalance !== null && creditsBalance <= 0) || (user && pendingCount >= 3) || (!user && trialStatus?.content_generated)}
      >
        {aiGenerating ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground"></div>
            <span>🤖 {t('startingGeneration', { ns: 'content', defaultValue: '正在启动生成...' })}</span>
          </>
        ) : (
          '🚀 ' + (mounted ? t('aiGenerateShort', { ns: 'content', defaultValue: 'AI生成' }) : 'AI生成')
        )}
      </button>

      {user && (creditsBalance !== null && creditsBalance <= 0) && (
        <div className="text-sm text-destructive">{t('errors.insufficientCredits', { ns: 'content', defaultValue: '积分不足，无法生成' })}</div>
      )}
      {user && (pendingCount >= 3) && (
        <div className="text-sm text-muted-foreground">{t('errors.queueLimitReached', { ns: 'content', defaultValue: '队列不能超过3个任务' })}</div>
      )}
      {!user && trialStatus?.content_generated && (
        <div className="text-sm text-destructive mb-2">
          {t('errors.freeTrialUsed', { ns: 'content', defaultValue: '请登录后继续使用' })}
        </div>
      )}

      {showLanguagePicker && (
        <div className="fixed inset-0 bg-foreground/30 flex items-center justify-center z-50" onClick={() => setShowLanguagePicker(false)}>
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-foreground">{mounted ? t('selectOutputLanguage', { ns: 'content', defaultValue: 'Select Output Language' }) : 'Select Output Language'}</h3>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setShowLanguagePicker(false)}>✕</button>
            </div>
            <input
              className="w-full border border-border p-2 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-primary bg-card"
              value={languageSearch}
              onChange={e => setLanguageSearch(e.target.value)}
              placeholder={mounted ? t('searchLanguage', { ns: 'content', defaultValue: 'Search language...' }) : 'Search language...'}
            />
            <div className="max-h-80 overflow-auto border border-border rounded-lg">
              {filteredLanguages.map(l => (
                <div
                  key={l.code}
                  className={`px-3 py-2 cursor-pointer hover:bg-muted/50 flex items-center justify-between ${language === l.code ? 'bg-primary/10' : ''}`}
                  onClick={() => handleSelectLanguage(l.code)}
                >
                  <div>
                    <div className="font-medium text-foreground">{l.label}</div>
                    <div className="text-xs text-muted-foreground">{l.code}</div>
                  </div>
                  {language === l.code && <span className="text-primary">✓</span>}
                </div>
              ))}
              {filteredLanguages.length === 0 && (
                <div className="px-3 py-6 text-center text-muted-foreground text-sm">{mounted ? t('noResults', { ns: 'common', defaultValue: '暂无结果' }) : 'No results'}</div>
              )}
            </div>
            <div className="mt-3 flex gap-2 justify-end">
              <button className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground" onClick={() => setShowLanguagePicker(false)}>
                {mounted ? t('cancel', { ns: 'common', defaultValue: '取消' }) : 'Cancel'}
              </button>
              <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90" onClick={() => setShowLanguagePicker(false)}>
                {mounted ? t('confirm', { ns: 'common', defaultValue: '确定' }) : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <RegistrationPrompt
        type={trialStatus?.content_generated ? 'trialUsed' : 'generation'}
        onRegister={() => setShowRegistrationPrompt(false)}
        onDismiss={() => setShowRegistrationPrompt(false)}
        visible={showRegistrationPrompt}
      />
    </div>
  );
}


