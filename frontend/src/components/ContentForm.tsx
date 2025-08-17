'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import LoginRequired from './LoginRequired';
import Logo from './Logo';
import AiLoadingAnimation from './AiLoadingAnimation';
import { useTranslation } from 'react-i18next';

const DEFAULT_HTML = '<div id="app">{{ message }}</div>';
const DEFAULT_CSS = 'body { font-family: sans-serif; } #app { padding: 20px; }';
const DEFAULT_JS = 'const { createApp } = Vue;\n\ncreateApp({\n  data() {\n    return {\n      message: "Hello World!"\n    }\n  }\n}).mount("#app");\n\n// VueKinesis示例\n// const { createApp } = Vue;\n// createApp({\n//   data() {\n//     return {\n//       message: "Hello VueKinesis!"\n//     }\n//   }\n// }).mount("#app");';

function renderExternalLinks(links: string | string[]) {
  let arr: string[] = [];
  if (Array.isArray(links)) {
    arr = links;
  } else if (typeof links === 'string') {
    arr = links
      .split(/\n|,|;/)
      .map(link => link.trim())
      .filter(Boolean);
  }
  
  // 分离CSS和JS文件，确保CSS先加载
  const cssFiles = arr.filter(link => link.endsWith('.css'));
  const jsFiles = arr.filter(link => !link.endsWith('.css'));
  
  // 确保Vue.js在插件之前加载
  const vueFiles = jsFiles.filter(link => link.includes('vue'));
  const otherFiles = jsFiles.filter(link => !link.includes('vue'));
  const sortedJsFiles = [...vueFiles, ...otherFiles];
  
  const cssLinks = cssFiles.map(link => `<link rel="stylesheet" href="${link}">`).join('\n');
  const jsScripts = sortedJsFiles.map(link => `<script src="${link}"></script>`).join('\n');
  
  return `${cssLinks}\n${jsScripts}`;
}

function FixForm({ error, onSubmit, loading, t }: { error: string; onSubmit: (note: string) => void; loading: boolean; t: any }) {
  const [note, setNote] = useState(error || "");
  useEffect(() => { setNote(error || ""); }, [error]);
  
  const hasError = !!error;
  
  return (
    <form className="flex flex-col gap-2" onSubmit={e => { e.preventDefault(); onSubmit(note); }}>
      <div className="flex justify-between items-center mb-2">
        <label className="font-semibold text-gray-700">
          {hasError ? t('fixForm.errorMessage', { ns: 'content', defaultValue: 'Error message/Modification request' }) : t('fixForm.optimizationRequest', { ns: 'content', defaultValue: 'Optimization request' })}
        </label>
        {hasError && (
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 text-sm"
            onClick={() => {
              window.postMessage({ type: 'CLOSE_FIX_FORM' }, '*');
            }}
            disabled={loading}
          >
            ✕ {t('fixForm.close', { ns: 'content', defaultValue: 'Close' })}
          </button>
        )}
      </div>
      <textarea 
        className="border p-2 rounded" 
        value={note} 
        onChange={e => setNote(e.target.value)} 
        rows={3} 
        placeholder={
          hasError 
            ? t('fixForm.errorMessagePlaceholder', { ns: 'content', defaultValue: 'Error message has been automatically filled, you can supplement modification requirements...' })
            : t('fixForm.exampleOptimizationRequest', { ns: 'content', defaultValue: 'For example: Add background animation, optimize interaction effects, fix style issues, enhance user experience...' })
        }
        disabled={loading}
      />
      <button type="submit" className="bg-purple-600 text-white rounded p-2 mt-2 flex items-center justify-center gap-2" disabled={loading}>
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            {t('fixForm.fixing', { ns: 'content', defaultValue: 'Fixing...' })}
          </>
        ) : (
          hasError ? t('fixForm.submitFix', { ns: 'content', defaultValue: 'Submit fix' }) : t('fixForm.submitOptimization', { ns: 'content', defaultValue: 'Submit optimization' })
        )}
      </button>
    </form>
  );
}

export default function ContentForm({ mode, contentId }: { mode: 'create' | 'edit'; contentId?: string }) {
  const { t } = useTranslation(['content', 'common', 'auth']);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [title, setTitle] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tagList, setTagList] = useState<string[]>([]);
  const [external_links, setExternalLinks] = useState('https://unpkg.com/vue@3/dist/vue.global.prod.js');
  const [code_html, setHtml] = useState(DEFAULT_HTML);
  const [code_css, setCss] = useState(DEFAULT_CSS);
  const [code_js, setJs] = useState(DEFAULT_JS);
  const [activeTab, setActiveTab] = useState('html');
  const [previewKey, setPreviewKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [externalLinksError, setExternalLinksError] = useState('');
  const [savedContentId, setSavedContentId] = useState<string | null>(null);
  const [contentShortId, setContentShortId] = useState<string | null>(null);
  
  // 新增字段
  const [description, setDescription] = useState('');
  const [content_type, setContentType] = useState('');
  const [language, setLanguage] = useState('');
  
  // AI生成相关状态
  const [knowledgePoint, setKnowledgePoint] = useState('');
  const [learningStage, setLearningStage] = useState('understanding');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false); // 新增：标记是否已经生成过内容
  
  // AI修复相关状态
  const [fixError, setFixError] = useState("");
  const [showFix, setShowFix] = useState(false);
  const [fixLoading, setFixLoading] = useState(false);
  const [fixed, setFixed] = useState(""); // 新增：存储修复摘要
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  // 检查用户是否为普通用户（role === 'user'）
  const isRegularUser = user?.role === 'user';

  // 统一的表单禁用状态
  const isFormDisabled = loading || aiGenerating || fixLoading;
  
  // AI 表单禁用状态（只有 AI 生成和修复时锁定）
  const isAiFormDisabled = aiGenerating || fixLoading;

  // 语言选择器状态与工具
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [languageSearch, setLanguageSearch] = useState('');
 
  // AI生成的语言代码，与输出语言选择器分开
  const [aiGeneratedLanguage, setAiGeneratedLanguage] = useState('');

  // 多语言LANGUAGE_OPTIONS
  const LANGUAGE_OPTIONS: { code: string; name: string }[] = [
    { code: 'zh-CN', name: mounted ? t('languageOptions.zhCN', { ns: 'content', defaultValue: 'Chinese (China)' }) : 'Chinese (China)' },
    { code: 'zh-TW', name: mounted ? t('languageOptions.zhTW', { ns: 'content', defaultValue: 'Chinese (Taiwan)' }) : 'Chinese (Taiwan)' },
    { code: 'en-US', name: mounted ? t('languageOptions.enUS', { ns: 'content', defaultValue: 'English (United States)' }) : 'English (United States)' },
    { code: 'en-GB', name: mounted ? t('languageOptions.enGB', { ns: 'content', defaultValue: 'English (United Kingdom)' }) : 'English (United Kingdom)' },
    { code: 'de-DE', name: mounted ? t('languageOptions.deDE', { ns: 'content', defaultValue: 'German (Germany)' }) : 'German (Germany)' },
    { code: 'de-CH', name: mounted ? t('languageOptions.deCH', { ns: 'content', defaultValue: 'German (Switzerland)' }) : 'German (Switzerland)' },
    { code: 'fr-FR', name: mounted ? t('languageOptions.frFR', { ns: 'content', defaultValue: 'French (France)' }) : 'French (France)' },
    { code: 'fr-CH', name: mounted ? t('languageOptions.frCH', { ns: 'content', defaultValue: 'French (Switzerland)' }) : 'French (Switzerland)' },
    { code: 'es-ES', name: mounted ? t('languageOptions.esES', { ns: 'content', defaultValue: 'Spanish (Spain)' }) : 'Spanish (Spain)' },
    { code: 'it-IT', name: mounted ? t('languageOptions.itIT', { ns: 'content', defaultValue: 'Italian (Italy)' }) : 'Italian (Italy)' },
    { code: 'pt-BR', name: mounted ? t('languageOptions.ptBR', { ns: 'content', defaultValue: 'Portuguese (Brazil)' }) : 'Portuguese (Brazil)' },
    { code: 'pt-PT', name: mounted ? t('languageOptions.ptPT', { ns: 'content', defaultValue: 'Portuguese (Portugal)' }) : 'Portuguese (Portugal)' },
    { code: 'ja-JP', name: mounted ? t('languageOptions.jaJP', { ns: 'content', defaultValue: 'Japanese (Japan)' }) : 'Japanese (Japan)' },
    { code: 'ko-KR', name: mounted ? t('languageOptions.koKR', { ns: 'content', defaultValue: 'Korean (South Korea)' }) : 'Korean (South Korea)' },
    { code: 'ru-RU', name: mounted ? t('languageOptions.ruRU', { ns: 'content', defaultValue: 'Russian (Russia)' }) : 'Russian (Russia)' },
    { code: 'ar-SA', name: mounted ? t('languageOptions.arSA', { ns: 'content', defaultValue: 'Arabic (Saudi Arabia)' }) : 'Arabic (Saudi Arabia)' },
    { code: 'hi-IN', name: mounted ? t('languageOptions.hiIN', { ns: 'content', defaultValue: 'Hindi (India)' }) : 'Hindi (India)' },
    { code: 'nl-NL', name: mounted ? t('languageOptions.nlNL', { ns: 'content', defaultValue: 'Dutch (Netherlands)' }) : 'Dutch (Netherlands)' },
    { code: 'sv-SE', name: mounted ? t('languageOptions.svSE', { ns: 'content', defaultValue: 'Swedish (Sweden)' }) : 'Swedish (Sweden)' },
  ];

  const normalizeBCP47 = (tag: string): string => {
    if (!tag) return '';
    const parts = tag.split('-');
    return parts
      .map((p, idx) => {
        if (idx === 0) return p.toLowerCase();
        if (p.length === 2 || p.length === 3) return p.toUpperCase();
        if (p.length === 4) return p[0].toUpperCase() + p.slice(1).toLowerCase();
        return p;
      })
      .join('-');
  };

  const filteredLanguages = LANGUAGE_OPTIONS.filter(l => {
    const q = languageSearch.trim().toLowerCase();
    if (!q) return true;
    return l.code.toLowerCase().includes(q) || l.name.toLowerCase().includes(q);
  });

  useEffect(() => {
    if (mode === 'edit' && contentId) {
      setLoading(true);
      api.content.getById(contentId).then((data: any) => {
        if (data) {
          setTitle(data.title || '');
          setTagList(Array.isArray(data.tags) ? data.tags : (typeof data.tags === 'string' ? data.tags.split(/,|\n/) : []));
          setTagInput('');
          setHtml(data.code_html || DEFAULT_HTML);
          setCss(data.code_css || DEFAULT_CSS);
          setJs(data.code_js || DEFAULT_JS);
          setDescription(data.description || '');
          setContentType(data.content_type || '');
          setLanguage(data.language || '');
          setAiGeneratedLanguage(data.language_code || data.language || '');
          // 外部依赖显示为一行一个链接
          if (Array.isArray(data.external_links)) {
            setExternalLinks(data.external_links.join('\n'));
          } else {
            setExternalLinks(data.external_links || '');
          }
          // 保存short_id用于打开按钮
          setContentShortId(data.short_id || null);
        } else {
          setError(t('contentNotFound', { ns: 'content', defaultValue: 'Content not found' }));
        }
        setLoading(false);
      }).catch((e: any) => {
        setError(e.message || t('loadContentFailed', { ns: 'content', defaultValue: 'Failed to load content' }));
        setLoading(false);
      });
    } else if (mode === 'create') {
      setTitle('');
      setTagList([]);
      setTagInput('');
      setHtml(DEFAULT_HTML);
      setCss(DEFAULT_CSS);
      setJs(DEFAULT_JS);
      setDescription('');
      setContentType('');
      setLanguage('');
      setExternalLinks('https://unpkg.com/vue@3/dist/vue.global.prod.js');
      setContentShortId(null);
    }
  }, [mode, contentId]);

  // ContentForm组件内部
  // 1. 定义getRecommendedLanguage函数
  function getRecommendedLanguage({ contentLanguage, lastUsed, uiLanguage, browserLanguage, defaultLanguage }: { contentLanguage?: string, lastUsed?: string, uiLanguage?: string, browserLanguage?: string, defaultLanguage: string }) {
    return (
      contentLanguage ||
      lastUsed ||
      uiLanguage ||
      browserLanguage ||
      defaultLanguage
    );
  }

  // 2. 在ContentForm内部useEffect初始化language
  useEffect(() => {
    let browserLang = '';
    if (typeof navigator !== 'undefined') {
      browserLang = normalizeBCP47(navigator.language || (Array.isArray(navigator.languages) ? navigator.languages[0] : ''));
    }
    const lastUsed = typeof window !== 'undefined' ? localStorage.getItem('output_language_last_used') || '' : '';
    if (mode === 'edit' && contentId) {
      // 编辑模式下，优先用内容本身language
      if (language) return;
      setLanguage(getRecommendedLanguage({
        contentLanguage: aiGeneratedLanguage || language,
        lastUsed,
        uiLanguage: t('languageOptions.enUS', { ns: 'content', defaultValue: 'English (United States)' }), // Assuming a default for UI language
        browserLanguage: browserLang,
        defaultLanguage: 'en-US' // Default to English
      }));
    } else if (mode === 'create') {
      setLanguage(getRecommendedLanguage({
        lastUsed,
        uiLanguage: t('languageOptions.enUS', { ns: 'content', defaultValue: 'English (United States)' }), // Assuming a default for UI language
        browserLanguage: browserLang,
        defaultLanguage: 'en-US' // Default to English
      }));
    }
  }, [mode, contentId, aiGeneratedLanguage, language, t]);

  // 3. 用户每次选择output language时，保存到localStorage
  const handleLanguageSelect = (code: string) => {
    setLanguage(code);
    if (typeof window !== 'undefined') {
      localStorage.setItem('output_language_last_used', code);
    }
    setShowLanguagePicker(false);
    setLanguageSearch('');
  };

  // 4. 选择器弹窗内按钮onClick={() => handleLanguageSelect(item.code)}
  // 5. 支持自定义输入，校验BCP 47格式
  const isValidBCP47 = (code: string) => {
    const parts = code.split('-');
    if (parts.length < 2) return false;
    const languagePart = parts[0];
    const regionPart = parts[1];

    // 检查语言部分是否为2或3个字母
    if (!/^[a-z]{2,3}$/.test(languagePart)) return false;

    // 检查区域部分是否为2或3个字母，或者数字
    if (!/^[a-z]{2,3}$/.test(regionPart) && !/^[0-9]{1,3}$/.test(regionPart)) return false;

    return true;
  };

  // 监听iframe错误
  useEffect(() => {
    function handleMsg(e: MessageEvent) {
      if (e.data?.type === "RENDER_ERROR") {
        setFixError(e.data.message + (e.data.stack ? "\n" + e.data.stack : ""));
        setShowFix(true);
      } else if (e.data?.type === "CLOSE_FIX_FORM") {
        setShowFix(false);
        setFixError("");
      }
    }
    window.addEventListener("message", handleMsg);
    return () => window.removeEventListener("message", handleMsg);
  }, []);

  // 在编辑模式下始终显示修复表单
  useEffect(() => {
    if (mode === 'edit') {
      setShowFix(true);
    }
  }, [mode]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">{mounted ? t('verifying', { ns: 'common', defaultValue: 'Verifying...' }) : 'Verifying...'}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginRequired 
        title={mounted ? t('loginRequired', { ns: 'auth', defaultValue: 'Please login' }) : 'Please login'}
        description={mounted ? t('loginRequiredDesc', { ns: 'auth', defaultValue: 'Login to create and edit content' }) : 'Login to create and edit content'}
      />
    );
  }

  // 调试信息
  // console.log('当前activeTab:', activeTab);

  // 生成srcDoc，注入window.onerror
  const srcDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width,initial-scale=1,user-scalable=no'>
  <style>
    body { 
      margin: 0; 
      padding: 0; 
      min-height: 100vh; 
      overflow-x: hidden; 
      font-family: Arial, sans-serif;
    }
    #app { 
      min-height: 100vh; 
      width: 100%; 
      overflow-x: auto;
    }
    .ocean-background {
      min-height: 100vh;
      width: 100%;
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
      box-sizing: border-box;
    }
    .game-container {
      max-width: 100%;
      overflow-x: auto;
    }
    .game-content {
      flex-wrap: wrap;
      justify-content: center;
      gap: 15px;
    }
    .game-board {
      max-width: 100%;
      height: auto;
      min-height: 400px;
    }
    .side-panel {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 10px;
    }
    .panel {
      min-width: 120px;
    }
    .game-title {
      font-size: 2rem !important;
    }
    .game-subtitle {
      font-size: 0.9rem !important;
    }
    @media (max-width: 768px) {
      .game-container {
        transform: scale(0.7);
      }
      .game-content {
        flex-direction: column;
      }
      .game-board {
        width: 100%;
        max-width: 300px;
        transform: scale(0.6);
      }
      .side-panel {
        flex-direction: row;
        justify-content: center;
        transform: scale(0.6);
      }
    }
  </style>
  ${renderExternalLinks(external_links)}
  <style>${code_css||""}</style>
</head>
<body>
  ${code_html||""}
  <script>
    window.onerror=function(m,s,l,c,e){
      parent.postMessage({type:'RENDER_ERROR',message:m,stack:e?.stack},'*');
    };
  </script>
  <script>${code_js||""}</script>
</body>
</html>`;

  const handlePreview = () => {
    setPreviewKey(prev => prev + 1);
  };

  const handleAddTag = () => {
    const value = tagInput.trim();
    if (value && !tagList.includes(value)) {
      // 检查标签长度，超过20个字符的标签会被忽略
      if (value.length > 20) {
        setError(t('tagLengthExceeded', { ns: 'content', defaultValue: 'Tag length cannot exceed 20 characters' }));
        return;
      }
      setTagList([...tagList, value]);
      setError(''); // 清除错误信息
    }
    setTagInput('');
  };
  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };
  const handleRemoveTag = (removeTag: string) => {
    setTagList(tagList.filter(t => t !== removeTag));
  };

  // 验证外部链接
  const validateExternalLinks = (links: string) => {
    const linkArray = links
      .split(/\n|,|;/)
      .map(link => link.trim())
      .filter(Boolean);
    
    const errors: string[] = [];
    
    linkArray.forEach(link => {
      if (!link.startsWith('http://') && !link.startsWith('https://')) {
        errors.push(t('invalidUrl', { ns: 'content', defaultValue: `Link "${link}" is not a valid URL` }));
      }
      if (!link.endsWith('.js') && !link.endsWith('.css')) {
        errors.push(t('invalidFileType', { ns: 'content', defaultValue: `Link "${link}" is not a valid JS or CSS file` }));
      }
    });
    
    if (errors.length > 0) {
      setExternalLinksError(errors.join('\n'));
    } else {
      setExternalLinksError('');
    }
    return errors.join('\n');
  };

  const handleExternalLinksChange = (value: string) => {
    // 自动将Vue开发版本替换为生产版本
    let processedValue = value;
    if (value.includes('vue.global.js')) {
      processedValue = value.replace('vue.global.js', 'vue.global.prod.js');
    }
    
    setExternalLinks(processedValue);
    const error = validateExternalLinks(processedValue);
    setExternalLinksError(error);
  };

  // AI生成处理函数
  const handleAiGenerate = async () => {
    if (!knowledgePoint.trim()) {
      setError(t('pleaseEnterKnowledgePoint', { ns: 'content', defaultValue: 'Please enter a knowledge point' }));
      return;
    }

    setAiGenerating(true);
    setError('');

    try {
      const prompt = `${t('aiGenerateContentPrompt', { ns: 'content', defaultValue: `Generate a ${learningStage} learning content about "${knowledgePoint.trim()}".${description ? `Specific requirements: ${description}` : ''}` })}`;
      
      const response = await api.generateContent(prompt, {
        knowledgePoint,
        learningStage,
        description,
        language_code: language
      });

      if (response.success && response.data) {
        const { html, css, js, title: generatedTitle, external_links: generatedLinks, tags: generatedTags, description: generatedDescription, content_type: generatedContentType, language_code: generatedLanguageCode, language: legacyLanguage } = response.data;
        
        // 更新表单内容
        setHtml(html || DEFAULT_HTML);
        setCss(css || DEFAULT_CSS);
        setJs(js || DEFAULT_JS);
        setTitle(generatedTitle || title);
        setDescription(generatedDescription || description);
        // 只有当用户没有手动输入时才使用 AI 生成的值
        setContentType(content_type || generatedContentType || '');
        // 将AI生成的语言代码存储到专门的字段中
        setAiGeneratedLanguage(generatedLanguageCode || legacyLanguage || '');
        
        if (generatedLinks && Array.isArray(generatedLinks)) {
          setExternalLinks(generatedLinks.join('\n'));
        }
        
        // 统一处理标签去重
        const allNewTags = [];
        
        // 添加生成的标签
        if (generatedTags && Array.isArray(generatedTags)) {
          // 先对AI生成的标签本身去重，并过滤空值和过长标签
          const uniqueGeneratedTags = [...new Set(generatedTags.filter(tag => 
            tag && tag.trim() && tag.trim().length <= 20
          ))];
          allNewTags.push(...uniqueGeneratedTags);
        }
        
        // 添加知识点作为标签（也检查长度）
        if (knowledgePoint.trim() && knowledgePoint.trim().length <= 20) {
          allNewTags.push(knowledgePoint.trim());
        }
        
        // 对所有新标签进行最终去重
        const finalUniqueTags = [...new Set(allNewTags)];
        
        // 过滤掉已存在的标签
        const uniqueNewTags = finalUniqueTags.filter(tag => !tagList.includes(tag));
        
        if (uniqueNewTags.length > 0) {
          setTagList(prev => [...prev, ...uniqueNewTags]);
        }
        
        // 切换到JS标签页显示生成的代码
        setActiveTab('js');
        
        setError('');
        setHasGenerated(true); // 设置已生成标记
      } else {
        throw new Error('AI generation failed');
      }
    } catch (error: any) {
      setError(error.message || t('aiGenerateFailed', { ns: 'content', defaultValue: 'AI generation failed, please try again later' }));
    } finally {
      setAiGenerating(false);
    }
  };

  // AI修复提交
  const handleFix = async (note: string) => {
    setFixLoading(true);
    try {
      const requestBody: any = {
        note,
        html: code_html,
        css: code_css,
        js: code_js,
        external_links: external_links.split(/\n|,|;/).map(s => s.trim()).filter(Boolean)
      };
      
      // 如果是编辑模式，添加 content_id
      if (mode === 'edit' && contentId) {
        requestBody.content_id = contentId;
      } else {
        // 如果是创建模式，添加其他必要参数
        requestBody.content_type = content_type || 'vue';
        requestBody.language_code = aiGeneratedLanguage || 'zh-CN';
        requestBody.title = title || 'Unnamed content';
        requestBody.description = description || '';
      }
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === 'production' ? 'https://eduNest.app/api' : 'http://localhost:3001/api')}/content/fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      const result = await res.json();
      if (result.html) setHtml(result.html);
      if (result.css) setCss(result.css);
      if (result.js) setJs(result.js);
      if (result.external_links) setExternalLinks(result.external_links.join('\n'));
      if (result.fixed) setFixed(result.fixed); // 更新 fixed 状态
      // 保持修复表单显示，不清空错误信息，让用户可以继续优化
      setFixError(""); // 清空错误信息，表示修复成功
      setPreviewKey(prev => prev + 1);
    } catch (e: any) {
      setFixError(e.message || t('fixFailed', { ns: 'content', defaultValue: 'Fix failed' }));
    } finally {
      setFixLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      const externalLinksArr = external_links
        .split(/\n|,|;/)
        .map(s => s.trim())
        .filter(Boolean);
      const content = {
        title,
        code_html,
        code_css,
        code_js,
        tags: tagList,
        external_links: externalLinksArr,
        description,
        content_type,
        language_code: aiGeneratedLanguage,
      };
      
      if (mode === 'edit' && contentId) {
        const result = await api.content.update(contentId, content);
        if (result && result.short_id) {
          setSavedContentId(result.short_id);
        }
      } else {
        const result = await api.content.create(content);
        if (result && result.short_id) {
          setSavedContentId(result.short_id);
        }
      }
      router.push('/content');
    } catch (e: any) {
      setError(e.message || t('saveFailed', { ns: 'content', defaultValue: 'Save failed' }));
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { key: 'html', label: mounted ? t('tabs.html', { ns: 'content', defaultValue: 'HTML' }) : 'HTML' },
    { key: 'css', label: mounted ? t('tabs.css', { ns: 'content', defaultValue: 'CSS' }) : 'CSS' },
    { key: 'js', label: mounted ? t('tabs.js', { ns: 'content', defaultValue: 'JS' }) : 'JS' },
  ];
  const LEARNING_STAGES = [
    { value: 'understanding', label: mounted ? t('learningStage.understanding', { ns: 'content', defaultValue: 'Understanding core principles and logic' }) : 'Understanding core principles and logic' },
    { value: 'application', label: mounted ? t('learningStage.application', { ns: 'content', defaultValue: 'Knowledge application' }) : 'Knowledge application' },
    { value: 'assessment', label: mounted ? t('learningStage.assessment', { ns: 'content', defaultValue: 'Practice and assessment' }) : 'Practice and assessment' },
    { value: 'expansion', label: mounted ? t('learningStage.expansion', { ns: 'content', defaultValue: 'Interdisciplinary application' }) : 'Interdisciplinary application' },
    { value: 'gamify', label: mounted ? t('learningStage.gamify', { ns: 'content', defaultValue: 'Gamified learning' }) : 'Gamified learning' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center py-8">
      <div className="w-full max-w-6xl rounded-2xl shadow-xl border border-gray-200 bg-white/90 p-0 md:p-8 flex flex-col gap-4">
        <div className="flex justify-center mb-6">
          <Logo size="md" />
        </div>
        <div className="flex justify-between items-center px-6 pt-6 pb-2 border-b border-gray-100">
          <button onClick={() => router.push('/content')} className="text-gray-400 hover:text-black text-sm font-medium transition">{mounted ? t('backToList', { ns: 'common', defaultValue: '← Back to List' }) : '← Back to List'}</button>
          <div className="flex gap-2">
            <button 
              className="px-6 py-2 rounded-full bg-blue-600 text-white font-medium shadow hover:bg-blue-700 transition" 
              onClick={() => {
                  let targetId = null;
                  
                  if (mode === 'edit') {
                    // edit模式下使用从数据库加载的short_id
                    targetId = contentShortId;
                  } else {
                    // create模式下使用保存后返回的short_id
                    targetId = savedContentId;
                  }
                  
                  if (targetId) {
                    window.open(`/content/${targetId}`, '_blank');
                  } else {
                    alert(mounted ? t('saveFirst', { ns: 'content', defaultValue: 'Please save content first' }) : 'Please save content first');
                  }
                }}
              type="button"
            >
              {mode === 'create' ? (mounted ? t('openAfterSave', { ns: 'content', defaultValue: 'Open after save' }) : 'Open after save') : (mounted ? t('open', { ns: 'common', defaultValue: 'Open' }) : 'Open')}
            </button>
            <button className="px-6 py-2 rounded-full bg-black text-white font-medium shadow hover:bg-gray-800 transition" onClick={handlePreview} type="button">{mounted ? t('preview', { ns: 'content', defaultValue: 'Preview' }) : 'Preview'}</button>
            <button className="px-6 py-2 rounded-full bg-gradient-to-r from-gray-900 to-gray-700 text-white font-medium shadow hover:from-gray-800 hover:to-gray-600 transition" onClick={handleSave} type="button" disabled={loading}>{loading ? (mounted ? t('saving', { ns: 'common', defaultValue: 'Saving...' }) : 'Saving...') : (mounted ? t('save', { ns: 'common', defaultValue: 'Save' }) : 'Save')}</button>
          </div>
        </div>
        <div className="px-6 pt-4 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 左侧：知识点、标签、外部依赖、代码编辑区 */}
            <div className="flex flex-col gap-6">
              {/* AI生成区域或修复表单区域 */}
              {mode === 'create' ? (
                <>
                  {hasGenerated ? (
                    <div className="flex flex-col gap-2 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl shadow border border-purple-100 p-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">{mounted ? t('aiFixOptimize', { ns: 'content', defaultValue: '🔧 AI Smart Fix/Optimization' }) : '🔧 AI Smart Fix/Optimization'}</h3>
                      {/* 错误信息显示 */}
                      {fixError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                          <div className="flex items-start gap-2">
                            <div className="text-red-600 text-sm">⚠️</div>
                            <div className="flex-1">
                              <div className="text-sm text-red-800 font-medium mb-1">{mounted ? t('detectedError', { ns: 'content', defaultValue: 'Detected Error' }) : 'Detected Error'}</div>
                              <div className="text-xs text-red-700 bg-red-100 p-2 rounded border font-mono whitespace-pre-wrap">
                                {fixError}
                              </div>
                              <div className="text-xs text-red-600 mt-2">{mounted ? t('copyErrorToForm', { ns: 'content', defaultValue: 'Please copy the error message above to the form below for repair' }) : 'Please copy the error message above to the form below for repair'}</div>
                            </div>
                          </div>
                        </div>
                      )}
                      <FixForm error={fixError} onSubmit={handleFix} loading={fixLoading} t={t} />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow border border-blue-100 p-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">{mounted ? t('aiGenerate', { ns: 'content', defaultValue: '🤖 AI Smart Generation' }) : '🤖 AI Smart Generation'}</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block font-semibold mb-1 text-gray-700">{mounted ? t('knowledgePoint', { ns: 'content', defaultValue: 'Knowledge Point' }) : 'Knowledge Point'} <span className="text-red-500">*</span></label>
                          <textarea
                            className="w-full border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none h-20"
                            value={knowledgePoint}
                            onChange={e => setKnowledgePoint(e.target.value)}
                            placeholder={mounted ? t('knowledgePointPlaceholder', { ns: 'content', defaultValue: 'For example: Fraction operations, cell structure, Newton\'s laws...' }) : 'For example: Fraction operations, cell structure, Newton\'s laws...'}
                            required
                            disabled={isAiFormDisabled}
                          />
                        </div>
                        <div>
                          <label className="block font-semibold mb-1 text-gray-700">{mounted ? t('learningStage', { ns: 'content', defaultValue: 'Learning Stage' }) : 'Learning Stage'}</label>
                          <select
                            className="w-full border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            value={learningStage}
                            onChange={e => setLearningStage(e.target.value)}
                            disabled={isAiFormDisabled}
                          >
                            {LEARNING_STAGES.map(stage => (
                              <option key={stage.value} value={stage.value}>
                                {stage.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-1 text-gray-700">{mounted ? t('outputLanguage', { ns: 'content', defaultValue: 'Output Language' }) : 'Output Language'}</label>
                          <div className="flex gap-2">
                            <input
                              className="flex-1 border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              value={language}
                              readOnly
                              placeholder={mounted ? t('selectOutputLanguage', { ns: 'content', defaultValue: 'Please select output language (BCP 47) through the selector' }) : 'Please select output language (BCP 47) through the selector'}
                              disabled={isAiFormDisabled}
                            />
                            <button
                              type="button"
                              className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                              onClick={() => setShowLanguagePicker(true)}
                              disabled={isAiFormDisabled}
                              aria-label={mounted ? t('selectOutputLanguage', { ns: 'content', defaultValue: 'Select output language' }) : 'Select output language'}
                              title={mounted ? t('selectOutputLanguage', { ns: 'content', defaultValue: 'Select output language' }) : 'Select output language'}
                            >
                              🌐
                            </button>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg shadow hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        onClick={handleAiGenerate}
                        disabled={isAiFormDisabled || !knowledgePoint.trim()}
                      >
                        {aiGenerating ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            🤖 AI generating...
                          </>
                        ) : (
                          '🚀 AI generate content'
                        )}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                showFix && (
                  <FixForm error={fixError} onSubmit={handleFix} loading={fixLoading} t={t} />
                )
              )}
              
              <div className="flex flex-col gap-2 bg-white/80 rounded-xl shadow border border-gray-100 p-4">
                <div className="mt-2">
                  <label className="block font-semibold mb-1 text-gray-700">{mounted ? t('title', { ns: 'content', defaultValue: 'Title' }) : 'Title'} <span className="text-red-500">*</span></label>
                  <input
                    className="w-full border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-gray-50"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={mounted ? t('inputTitlePlaceholder', { ns: 'content', defaultValue: 'Please enter content title' }) : 'Please enter content title'}
                    required
                    disabled={isAiFormDisabled}
                  />
                </div>
                <div className="mt-2">
                  <label className="block font-semibold mb-1 text-gray-700">{mounted ? t('description', { ns: 'content', defaultValue: 'Description' }) : 'Description'}</label>
                  <textarea
                    className="w-full border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-gray-50 resize-none h-16"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={mounted ? t('inputDescriptionPlaceholder', { ns: 'content', defaultValue: 'Please enter content description' }) : 'Please enter content description'}
                    disabled={isAiFormDisabled}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {!isRegularUser && (
                    <div>
                      <label className="block font-semibold mb-1 text-gray-700">{mounted ? t('contentType', { ns: 'content', defaultValue: 'Content Type' }) : 'Content Type'}</label>
                      <input
                        className="w-full border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-gray-50"
                        value={content_type}
                        onChange={e => setContentType(e.target.value)}
                        placeholder={mounted ? t('exampleContentType', { ns: 'content', defaultValue: 'For example: react, vanilla, python' }) : 'For example: react, vanilla, python'}
                        disabled={isAiFormDisabled}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block font-semibold mb-1 text-gray-700">{mounted ? t('languageCode', { ns: 'content', defaultValue: 'Language Code' }) : 'Language Code'}</label>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-gray-50"
                        value={aiGeneratedLanguage}
                        readOnly
                        placeholder={mounted ? t('aiGeneratedLanguagePlaceholder', { ns: 'content', defaultValue: 'AI generated language code (BCP 47) will be filled automatically after generation' }) : 'AI generated language code (BCP 47) will be filled automatically after generation'}
                        disabled={isAiFormDisabled}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block font-semibold mb-1 text-gray-700">{mounted ? t('tags', { ns: 'content', defaultValue: 'Tags (single line input, press Enter or click to add)' }) : 'Tags (single line input, press Enter or click to add)'}</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-gray-50"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      placeholder={mounted ? t('inputTagPlaceholder', { ns: 'content', defaultValue: 'Enter tag and press Enter or click to add (max 20 characters)' }) : 'Enter tag and press Enter or click to add (max 20 characters)'}
                      maxLength={20}
                      disabled={isAiFormDisabled}
                    />
                    <button
                      type="button"
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                      onClick={handleAddTag}
                      disabled={isAiFormDisabled}
                    >{mounted ? t('addTag', { ns: 'content', defaultValue: 'Add' }) : 'Add'}</button>
                  </div>
                  {/* 块状标签实时预览，可删除 */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tagList.map((t, i) => (
                      <span key={i} className="flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                        {t}
                        <button type="button" className="ml-1 text-blue-400 hover:text-red-500" onClick={() => handleRemoveTag(t)} disabled={isAiFormDisabled}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
                {!isRegularUser && (
                  <div className="mt-2">
                    <label className="block font-semibold mb-1 text-gray-700">{mounted ? t('externalDependencies', { ns: 'content', defaultValue: 'External Dependencies (one CDN link per line, supports JS/CSS)' }) : 'External Dependencies (one CDN link per line, supports JS/CSS)'}</label>
                    <textarea className="w-full border border-gray-200 p-2 rounded-lg h-16 focus:outline-none focus:ring-2 focus:ring-black bg-gray-50 font-mono text-xs" value={external_links} onChange={e => handleExternalLinksChange(e.target.value)} placeholder={mounted ? 'For example: https://unpkg.com/vue@3/dist/vue.global.js\nhttps://cdn.jsdelivr.net/npm/axios/dist/axios.min.js' : 'For example: https://unpkg.com/vue@3/dist/vue.global.js\nhttps://cdn.jsdelivr.net/npm/axios/dist/axios.min.js'} disabled={isAiFormDisabled} />
                    {externalLinksError && <div className="text-red-600 text-xs mt-1">{externalLinksError}</div>}
                  </div>
                )}
              </div>
              {/* 代码编辑Tabs */}
              {!isRegularUser && (
                <div className="bg-white/80 rounded-xl shadow border border-gray-100 p-0 flex flex-col">
                  <div className="flex gap-2 border-b border-gray-100 px-4 pt-2">
                    {TABS.map(tab => (
                      <button
                        key={tab.key}
                        className={`px-5 py-1 text-sm font-medium rounded-t transition-all duration-150 cursor-pointer ${activeTab === tab.key ? 'bg-black text-white shadow' : 'text-gray-500 hover:text-black bg-gray-100'}`}
                        onClick={() => {
                          setActiveTab(tab.key);
                        }}
                        type="button"
                        disabled={isAiFormDisabled}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="px-4 pb-4 pt-2">
                    {activeTab === 'html' && (
                      <textarea className="w-full border border-gray-200 p-2 rounded-lg h-32 focus:outline-none focus:ring-2 focus:ring-black font-mono text-sm bg-gray-50 resize-y transition" value={code_html} onChange={e => setHtml(e.target.value)} placeholder={mounted ? 'Please enter HTML code' : 'Please enter HTML code'} disabled={isAiFormDisabled} />
                    )}
                    {activeTab === 'css' && (
                      <textarea className="w-full border border-gray-200 p-2 rounded-lg h-32 focus:outline-none focus:ring-2 focus:ring-black font-mono text-sm bg-gray-50 resize-y transition" value={code_css} onChange={e => setCss(e.target.value)} placeholder={mounted ? 'Please enter CSS code' : 'Please enter CSS code'} disabled={isAiFormDisabled} />
                    )}
                    {activeTab === 'js' && (
                      <textarea className="w-full border border-gray-200 p-2 rounded-lg h-32 focus:outline-none focus:ring-2 focus:ring-black font-mono text-sm bg-gray-50 resize-y transition" value={code_js} onChange={e => setJs(e.target.value)} placeholder={mounted ? 'Please enter JS code' : 'Please enter JS code'} disabled={isAiFormDisabled} />
                    )}
                  </div>
                </div>
              )}
              {error && <div className="text-red-600 text-center mt-2">{error}</div>}
            </div>
            {/* 右侧：实时预览区 */}
            <div className="bg-gradient-to-br from-gray-100 to-white border border-gray-200 rounded-xl shadow flex flex-col h-[40rem]">
              <div className="text-xs text-gray-400 px-4 py-2 border-b border-gray-100 bg-white/80 rounded-t-xl">{mounted ? t('realTimePreview', { ns: 'content', defaultValue: 'Real-time Preview' }) : 'Real-time Preview'}</div>
              <iframe
                ref={iframeRef}
                key={previewKey}
                srcDoc={srcDoc}
                title="预览"
                sandbox="allow-scripts allow-forms"
                className="w-full h-full border-0 bg-white rounded-b-xl"
                style={{
                  minHeight: '700px',
                  height: '100%',
                  width: '100%',
                  overflow: 'auto',
                  resize: 'both'
                }}
              />
              {/* AI修复摘要显示 */}
              {fixed && (
                <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-blue-50 border-t border-gray-200 rounded-b-xl">
                  <div className="flex items-start gap-2">
                    <div className="text-green-600 text-sm">🔧</div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 font-medium mb-1">{mounted ? t('aiFixSummary', { ns: 'content', defaultValue: 'AI Fix Summary' }) : 'AI Fix Summary'}</div>
                      <div className="text-sm text-gray-700">{fixed}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* AI Loading动画 */}
      <AiLoadingAnimation 
        isActive={aiGenerating}
        knowledgePoint={knowledgePoint}
        onComplete={() => {
          // AI生成完成
        }}
      />
      {/* 语言选择器弹窗 */}
      {showLanguagePicker && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowLanguagePicker(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">{mounted ? t('selectOutputLanguage', { ns: 'content', defaultValue: 'Select Output Language' }) : 'Select Output Language'}</h3>
              <button className="text-gray-500 hover:text-black" onClick={() => setShowLanguagePicker(false)}>{mounted ? '✕' : '✕'}</button>
            </div>
            <input
              className="w-full border border-gray-200 p-2 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-black"
              placeholder={mounted ? 'Search language or enter BCP 47 code (e.g., zh-CN, en-US)' : 'Search language or enter BCP 47 code (e.g., zh-CN, en-US)'}
              value={languageSearch}
              onChange={e => setLanguageSearch(e.target.value)}
            />
            <div className="max-h-72 overflow-auto border border-gray-100 rounded-lg">
              {filteredLanguages.map(item => (
                <button
                  key={item.code}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between ${language === item.code ? 'bg-gray-50' : ''}`}
                  onClick={() => handleLanguageSelect(item.code)}
                >
                  <span>{item.name}</span>
                  <span className="text-gray-500 text-sm">{item.code}</span>
                </button>
              ))}
              {filteredLanguages.length === 0 && (
                <div className="p-3 text-sm text-gray-500">{mounted ? 'No matching language found' : 'No matching language found'}</div>
              )}
            </div>
            <div className="mt-3 flex gap-2 justify-end">
              <button
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                onClick={() => setShowLanguagePicker(false)}
              >{mounted ? 'Cancel' : 'Cancel'}</button>
              <button
                className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800"
                onClick={() => handleLanguageSelect(languageSearch)}
                disabled={!isValidBCP47(languageSearch)}
              >{mounted ? 'OK' : 'OK'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 