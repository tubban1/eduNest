'use client';

import { useTranslation } from 'react-i18next';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import MobileHeader from '@/components/MobileHeader';
import { api } from '@/lib/api';
import {
  IncenterAnimation,
  FunctionIntersection,
  WordMatchingGame,
  AITeacherDemo
} from '@/components/help/animations';
import { 
  Sparkles, 
  FileText, 
  Languages, 
  MessageCircle, 
  Clock, 
  Gift,
  ChevronRight,
  Play,
  BookOpen,
  Brain,
  Zap,
  Search,
  Library,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';

const KB_CATEGORIES = ['全部', '产品', '价格', '销售', '售后', '分销', 'FAQ'] as const;
type KbCategory = (typeof KB_CATEGORIES)[number];

type KbEntry = {
  id: string;
  category?: string;
  subcategory?: string | null;
  title?: string | null;
  content?: string | null;
  content_type?: string | null;
  question?: string | null;
  answer?: string | null;
  tags?: string[] | null;
  source?: string | null;
};

type RecommendItem = {
  id: string;
  short_id?: string | null;
  title?: string | null;
  thumbnail_url?: string | null;
  language_code?: string | null;
};

export default function HelpPage() {
  const { t, i18n } = useTranslation(['help', 'common', 'navigation']);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<number | null>(null);
  // 产品咨询
  const [kbCategory, setKbCategory] = useState<KbCategory>('全部');
  const [kbSearch, setKbSearch] = useState('');
  const [kbSearchInput, setKbSearchInput] = useState('');
  const [kbEntries, setKbEntries] = useState<KbEntry[]>([]);
  const [kbRecommend, setKbRecommend] = useState<RecommendItem[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbRecommendLoading, setKbRecommendLoading] = useState(false);
  // 问一问（多轮对话）
  const [askInput, setAskInput] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  type AskMessage = {
    role: 'user' | 'assistant';
    content: string;
    sources?: { id: string; title?: string; category?: string; source?: string }[];
    recommend?: RecommendItem[];
    source_type?: 'static' | 'exact' | 'vector';
  };
  const [askMessages, setAskMessages] = useState<AskMessage[]>([]);
  const [lastAskQuery, setLastAskQuery] = useState('');
  const [lastAssistantMeta, setLastAssistantMeta] = useState<{ source_type?: 'static' | 'exact' | 'vector'; sources?: { id: string }[] } | null>(null);
  const [askFeedbackSent, setAskFeedbackSent] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 监听语言变化
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      // Language changed handler
    };
    
    i18n.on('languageChanged', handleLanguageChanged);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n, t]);

  // 使用 useMemo 确保在 mounted 之前使用默认值，避免 hydration 错误
  const sections = useMemo(() => {
    if (!mounted) {
      // 服务器端渲染时使用默认英语标题
      return [
        {
          id: 0,
          icon: Sparkles,
          title: 'What is EduNest?',
          contentKey: 'whatIsEduNest',
        },
        {
          id: 1,
          icon: FileText,
          title: 'Animation Generation',
          contentKey: 'animationGeneration',
        },
        {
          id: 2,
          icon: MessageCircle,
          title: 'How to Interact with Generated Content',
          contentKey: 'interaction',
        },
        {
          id: 3,
          icon: Gift,
          title: 'Free Trial Credits',
          contentKey: 'freeTrial',
        },
        {
          id: 4,
          icon: Library,
          title: '产品咨询',
          contentKey: 'productConsultation',
        },
      ];
    }
    // 客户端挂载后使用翻译
    const title0 = t('whatIsEduNest.title', { ns: 'help', defaultValue: 'What is EduNest?' });
    const title1 = t('animationGeneration.title', { ns: 'help', defaultValue: 'Animation Generation' });
    const title2 = t('interaction.title', { ns: 'help', defaultValue: 'How to Interact with Generated Content' });
    const title3 = t('freeTrial.title', { ns: 'help', defaultValue: 'Free Trial Credits' });
    const title4 = t('productConsultation.title', { ns: 'help', defaultValue: '产品咨询' });
    return [
      {
        id: 0,
        icon: Sparkles,
        title: title0,
        contentKey: 'whatIsEduNest',
      },
      {
        id: 1,
        icon: FileText,
        title: title1,
        contentKey: 'animationGeneration',
      },
      {
        id: 2,
        icon: MessageCircle,
        title: title2,
        contentKey: 'interaction',
      },
      {
        id: 3,
        icon: Gift,
        title: title3,
        contentKey: 'freeTrial',
      },
      {
        id: 4,
        icon: Library,
        title: title4,
        contentKey: 'productConsultation',
      },
    ];
  }, [mounted, t, i18n.language]);

  const languageCode = i18n.language === 'zh' || i18n.language?.startsWith('zh') ? 'zh-CN' : (i18n.language || 'en-US');

  const fetchKbEntries = useCallback(async () => {
    setKbLoading(true);
    try {
      const params = new URLSearchParams({ limit: '30', language_code: languageCode });
      if (kbCategory && kbCategory !== '全部') params.set('category', kbCategory);
      if (kbSearch.trim()) params.set('q', kbSearch.trim());
      const res = await api.get(`/kb/entries?${params.toString()}`) as { success?: boolean; data?: KbEntry[] };
      setKbEntries(res?.data ?? []);
    } catch (e) {
      console.error('kb/entries', e);
      setKbEntries([]);
    } finally {
      setKbLoading(false);
    }
  }, [kbCategory, kbSearch, languageCode]);

  const fetchKbRecommend = useCallback(async () => {
    setKbRecommendLoading(true);
    try {
      const res = await api.get(`/kb/recommend?limit=4&language_code=${encodeURIComponent(languageCode)}`) as { success?: boolean; data?: RecommendItem[] };
      setKbRecommend(res?.data ?? []);
    } catch (e) {
      console.error('kb/recommend', e);
      setKbRecommend([]);
    } finally {
      setKbRecommendLoading(false);
    }
  }, [languageCode]);

  useEffect(() => {
    if (activeSection !== 4) return;
    fetchKbEntries();
    fetchKbRecommend();
  }, [activeSection, fetchKbEntries, fetchKbRecommend]);

  const handleAsk = useCallback(async () => {
    const q = askInput.trim();
    if (!q || askLoading) return;
    setAskLoading(true);
    setAskFeedbackSent(false);
    const userMessage: AskMessage = { role: 'user', content: q };
    setAskMessages((prev) => [...prev, userMessage]);
    setAskInput('');
    const historyForApi = askMessages
      .map((m) => ({ role: m.role, content: m.content }))
      .slice(-10);
    try {
      const res = await api.post('/kb/ask', {
        query: q,
        language_code: languageCode,
        history: historyForApi,
      }) as { success?: boolean; answer?: string; sources?: unknown[]; recommend?: RecommendItem[]; source_type?: 'static' | 'exact' | 'vector'; error?: string };
      if (res.success && res.answer !== undefined) {
        setLastAskQuery(q);
        const sources = res.sources as { id: string; title?: string; category?: string; source?: string }[] | undefined;
        setLastAssistantMeta({ source_type: res.source_type, sources });
        setAskMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.answer!,
            sources,
            recommend: res.recommend ?? [],
            source_type: res.source_type,
          },
        ]);
      } else {
        setLastAssistantMeta(null);
        setAskMessages((prev) => [
          ...prev,
          { role: 'assistant', content: res.error || t('productConsultation.askError', { ns: 'help', defaultValue: '请求失败，请稍后再试' }) },
        ]);
      }
    } catch (e) {
      console.error('kb/ask', e);
      setLastAssistantMeta(null);
      setAskMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t('productConsultation.askError', { ns: 'help', defaultValue: '请求失败，请稍后再试' }) },
      ]);
    } finally {
      setAskLoading(false);
    }
  }, [askInput, askLoading, languageCode, askMessages, t]);

  const handleAskFeedback = useCallback(async (helpful: boolean) => {
    if (!lastAskQuery || askFeedbackSent) return;
    try {
      await api.post('/kb/feedback', {
        query: lastAskQuery,
        helpful,
        source_type: lastAssistantMeta?.source_type ?? undefined,
        entry_id: lastAssistantMeta?.sources?.[0]?.id ?? undefined,
      });
      setAskFeedbackSent(true);
    } catch (e) {
      console.error('kb/feedback', e);
    }
  }, [lastAskQuery, askFeedbackSent, lastAssistantMeta]);

  const toggleSection = (id: number) => {
    setActiveSection(activeSection === id ? null : id);
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="hidden lg:block h-screen sticky top-0 left-0 z-30">
          <Sidebar variant="desktop" />
        </div>
        <main className="flex-1 bg-background overflow-y-auto">
          <div className="px-4 py-8 sm:px-6 lg:p-8">
            <div className="text-center text-muted-foreground">Loading...</div>
          </div>
        </main>
      </div>
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
      
      <main className="flex-1 bg-background overflow-y-auto">
        {/* 移动端头部（固定） */}
        <MobileHeader onMenuClick={() => setSidebarOpen(true)} className="bg-card/80 backdrop-blur-sm" />
        
        {/* 顶部预留占位，避免内容被固定头部遮挡 */}
        <div className="lg:hidden h-14" />

        <div className="px-4 py-8 sm:px-6 lg:p-12 max-w-4xl mx-auto">
          {/* 页面标题 */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-foreground mb-2 opacity-0 animate-[fadeIn_0.6s_ease-out_0.2s_forwards]">
              {t('pageTitle', { ns: 'help', defaultValue: 'How to Use EduNest' })}
            </h1>
            <p className="text-muted-foreground opacity-0 animate-[fadeIn_0.6s_ease-out_0.4s_forwards]">
              {t('pageSubtitle', { ns: 'help', defaultValue: 'Learn how to create interactive educational content with AI' })}
            </p>
          </div>

          {/* 帮助内容区域 */}
          <div className="space-y-4">
            {sections.map((section, index) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              
              return (
                <div
                  key={section.id}
                  className="bg-card border border-border rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md opacity-0"
                  style={{ 
                    animation: `fadeInUp 0.5s ease-out ${index * 0.1}s forwards`
                  }}
                >
                  {/* 可点击的标题栏 */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">
                          {section.title}
                        </h2>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${
                        isActive ? 'rotate-90' : ''
                      }`}
                    />
                  </button>

                  {/* 展开的内容 */}
                  {isActive && (
                    <div className="px-6 pb-6" style={{ animation: 'expand 0.3s ease-out' }}>
                      <div className="pt-4 border-t border-border">
                        <div className="prose prose-sm max-w-none text-foreground">
                          {/* Section 0: What is EduNest */}
                          {section.id === 0 && (
                            <div className="space-y-4">
                              <p className="text-base leading-relaxed">
                                {t('whatIsEduNest.description', { 
                                  ns: 'help', 
                                  defaultValue: 'EduNest is an AI-powered platform for creating courseware and problem-solving animations. Each animation comes with a dedicated AI teacher to explain the content.' 
                                })}
                              </p>
                              
                              {/* 教学动画例子 */}
                              <div className="mt-6">
                                <h4 className="font-semibold text-lg mb-4">
                                  {t('whatIsEduNest.examples.title', { ns: 'help', defaultValue: 'Examples of Educational Animations' })}
                                </h4>
                                <div className="space-y-3">
                                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                                    <div className="flex items-start gap-3 mb-3">
                                      <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                                        <Play className="w-5 h-5 text-primary" />
                                      </div>
                                      <div className="flex-1">
                                        <h5 className="font-semibold text-foreground mb-1">
                                          {t('whatIsEduNest.examples.example1.title', { ns: 'help', defaultValue: '1. Finding the Incenter of a Triangle' })}
                                        </h5>
                                        <p className="text-sm text-muted-foreground">
                                          {t('whatIsEduNest.examples.example1.description', { ns: 'help', defaultValue: 'An interactive animation that demonstrates how to find the incenter of a triangle by drawing angle bisectors.' })}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-3">
                                      <IncenterAnimation />
                                    </div>
                                  </div>
                                  
                                  <div className="p-4 bg-secondary/5 rounded-lg border border-secondary/20">
                                    <div className="flex items-start gap-3 mb-3">
                                      <div className="p-2 bg-secondary/10 rounded-lg mt-0.5">
                                        <Zap className="w-5 h-5 text-secondary" />
                                      </div>
                                      <div className="flex-1">
                                        <h5 className="font-semibold text-foreground mb-1">
                                          {t('whatIsEduNest.examples.example2.title', { ns: 'help', defaultValue: '2. Finding Intersection Points of Functions and Lines' })}
                                        </h5>
                                        <p className="text-sm text-muted-foreground">
                                          {t('whatIsEduNest.examples.example2.description', { ns: 'help', defaultValue: 'Adjust parameters to find where a function and a line intersect, with real-time visualization.' })}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-3">
                                      <FunctionIntersection />
                                    </div>
                                  </div>
                                  
                                  <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
                                    <div className="flex items-start gap-3 mb-3">
                                      <div className="p-2 bg-accent/10 rounded-lg mt-0.5">
                                        <BookOpen className="w-5 h-5 text-accent" />
                                      </div>
                                      <div className="flex-1">
                                        <h5 className="font-semibold text-foreground mb-1">
                                          {t('whatIsEduNest.examples.example3.title', { ns: 'help', defaultValue: '3. English Word Matching Game' })}
                                        </h5>
                                        <p className="text-sm text-muted-foreground">
                                          {t('whatIsEduNest.examples.example3.description', { ns: 'help', defaultValue: 'An engaging word matching game to help students learn English vocabulary through interactive gameplay.' })}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-3">
                                      <WordMatchingGame />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* AI Teacher 说明 */}
                              <div className="mt-6 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
                                <div className="flex items-start gap-3">
                                  <div className="p-2 bg-primary/20 rounded-lg mt-0.5">
                                    <MessageCircle className="w-6 h-6 text-primary" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-lg mb-2">
                                      {t('whatIsEduNest.aiTeacher.title', { ns: 'help', defaultValue: 'AI Teacher - Your Personal Learning Assistant' })}
                                    </h4>
                                    <p className="text-sm text-muted-foreground mb-3">
                                      {t('whatIsEduNest.aiTeacher.description', { ns: 'help', defaultValue: 'The AI Teacher button is located in the bottom right corner of each animation page. Click it to start a conversation and learn about any concepts you don\'t understand, or explore extended knowledge. The AI teacher gradually learns your strengths and weaknesses to provide personalized tutoring.' })}
                                    </p>
                                  </div>
                                </div>
                                {/* AI Teacher Demo - 与左侧 icon 对齐 */}
                                <div className="flex items-start gap-13 mt-3">
                                  <div className="w-0 flex-shrink-10" /> {/* 占位，与 icon 对齐，更靠左 */}
                                  <div className="flex-1">
                                    <AITeacherDemo />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Section 1: Animation Generation */}
                          {section.id === 1 && (
                            <div className="space-y-4">
                              <div className="space-y-3">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                  <FileText className="w-5 h-5 text-primary" />
                                  {t('animationGeneration.prompt.title', { ns: 'help', defaultValue: 'How to Write a Prompt' })}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  {t('animationGeneration.prompt.intro', { ns: 'help', defaultValue: 'Write a clear and specific description of what you want to create. Here are some tips:' })}
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-base ml-4">
                                  <li>{t('animationGeneration.prompt.tip1', { ns: 'help', defaultValue: 'Be specific about the topic or concept you want to explain' })}</li>
                                  <li>{t('animationGeneration.prompt.tip2', { ns: 'help', defaultValue: 'Include details about the target audience (e.g., grade level)' })}</li>
                                  <li>{t('animationGeneration.prompt.tip3', { ns: 'help', defaultValue: 'Mention any specific examples or scenarios you want to include' })}</li>
                                </ul>
                              </div>
                              
                              {/* Prompt 例子 */}
                              <div className="mt-6">
                                <h4 className="font-semibold text-base mb-3">
                                  {t('animationGeneration.examples.title', { ns: 'help', defaultValue: 'Example Prompts' })}
                                </h4>
                                <div className="space-y-3">
                                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                                    <p className="text-sm font-mono text-foreground mb-2">
                                      {t('animationGeneration.examples.example1', { ns: 'help', defaultValue: 'Create an interactive animation showing how to find the incenter of a triangle by drawing angle bisectors. Include step-by-step visualization.' })}
                                    </p>
                                  </div>
                                  <div className="p-4 bg-secondary/5 rounded-lg border border-secondary/20">
                                    <p className="text-sm font-mono text-foreground mb-2">
                                      {t('animationGeneration.examples.example2', { ns: 'help', defaultValue: 'Build an animation where students can adjust parameters to find where a function and a line intersect, with real-time visualization of the intersection point.' })}
                                    </p>
                                  </div>
                                  <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
                                    <p className="text-sm font-mono text-foreground mb-2">
                                      {t('animationGeneration.examples.example3', { ns: 'help', defaultValue: 'Create an English word matching game where students match words with their definitions. Include scoring and feedback.' })}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
                                <div className="flex items-center gap-2 mb-2">
                                  <Languages className="w-5 h-5 text-primary" />
                                  <span className="font-semibold">
                                    {t('animationGeneration.language.title', { ns: 'help', defaultValue: 'Select Output Language' })}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {t('animationGeneration.language.description', { ns: 'help', defaultValue: 'Choose the language for your generated content. The AI will create animations in your selected language.' })}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Section 2: Interaction */}
                          {section.id === 2 && (
                            <div className="space-y-4">
                              <p className="text-base leading-relaxed">
                                {t('interaction.description', { 
                                  ns: 'help', 
                                  defaultValue: 'After generating content, you can interact with it using the AI Teacher button located in the bottom right corner of each animation page.' 
                                })}
                              </p>
                              <div className="space-y-3 mt-4">
                                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Clock className="w-5 h-5 text-primary" />
                                    <span className="font-semibold">
                                      {t('interaction.initialization.title', { ns: 'help', defaultValue: 'Initialization (1 minute)' })}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {t('interaction.initialization.description', { ns: 'help', defaultValue: 'The AI Guide needs about 1 minute to initialize when you first open it. Please be patient during this process.' })}
                                  </p>
                                </div>
                                <div className="p-4 bg-secondary/5 rounded-lg border border-secondary/20">
                                  <div className="flex items-center gap-2 mb-2">
                                    <MessageCircle className="w-5 h-5 text-secondary" />
                                    <span className="font-semibold">
                                      {t('interaction.questions.title', { ns: 'help', defaultValue: 'Ask Questions' })}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {t('interaction.questions.description', { ns: 'help', defaultValue: 'After initialization, you can ask questions about the current page content. The AI teacher will provide detailed explanations.' })}
                                  </p>
                                </div>
                                <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Brain className="w-5 h-5 text-accent" />
                                    <span className="font-semibold">
                                      {t('interaction.personalized.title', { ns: 'help', defaultValue: 'Personalized Learning' })}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {t('interaction.personalized.description', { ns: 'help', defaultValue: 'The AI teacher gradually learns your strengths and weaknesses through your interactions. It will provide personalized tutoring based on your learning progress and areas that need improvement.' })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Section 3: Free Trial */}
                          {section.id === 3 && (
                            <div className="space-y-4">
                              <p className="text-base leading-relaxed">
                                {t('freeTrial.description', { 
                                  ns: 'help', 
                                  defaultValue: 'EduNest provides limited free usage credits to make AI education accessible to students and teachers worldwide.' 
                                })}
                              </p>
                              <div className="mt-4 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
                                <div className="flex items-center gap-2 mb-2">
                                  <Gift className="w-5 h-5 text-primary" />
                                  <span className="font-semibold">
                                    {t('freeTrial.benefit.title', { ns: 'help', defaultValue: 'Free Credits' })}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {t('freeTrial.benefit.description', { ns: 'help', defaultValue: 'New users receive free credits to try out the platform. This allows everyone to experience the power of AI-powered education.' })}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Section 4: 产品咨询 */}
                          {section.id === 4 && (
                            <div className="space-y-5">
                              <p className="text-sm text-muted-foreground">
                                {t('productConsultation.description', { ns: 'help', defaultValue: '按分类浏览或搜索产品与常见问题。' })}
                              </p>
                              {/* 问一问 */}
                              <div className="rounded-xl border border-border bg-muted/30 p-4">
                                <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                                  <MessageCircle className="w-4 h-4 text-primary" />
                                  {t('productConsultation.askTitle', { ns: 'help', defaultValue: '问一问' })}
                                </h4>
                                {askMessages.length > 0 && (
                                  <div className="mb-3 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => { setAskMessages([]); setLastAskQuery(''); setLastAssistantMeta(null); setAskFeedbackSent(false); }}
                                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-muted/50"
                                    >
                                      {t('productConsultation.clearChat', { ns: 'help', defaultValue: '清空对话' })}
                                    </button>
                                  </div>
                                )}
                                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                                  {askMessages.map((msg, idx) => (
                                    <div
                                      key={idx}
                                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                      <div
                                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                                          msg.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted/60 text-foreground border border-border'
                                        }`}
                                      >
                                        {msg.content}
                                        {msg.role === 'assistant' && idx === askMessages.length - 1 && (
                                          <div className="mt-3 space-y-2 border-t border-border pt-2">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                              {askFeedbackSent ? (
                                                <span>{t('productConsultation.feedbackThanks', { ns: 'help', defaultValue: '感谢反馈' })}</span>
                                              ) : (
                                                <>
                                                  <span>{t('productConsultation.feedbackPrompt', { ns: 'help', defaultValue: '这条回答有帮助吗？' })}</span>
                                                  <button type="button" onClick={() => handleAskFeedback(true)} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted/60 transition-colors">
                                                    <ThumbsUp className="w-3.5 h-3.5" />
                                                    {t('productConsultation.feedbackUseful', { ns: 'help', defaultValue: '有用' })}
                                                  </button>
                                                  <button type="button" onClick={() => handleAskFeedback(false)} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted/60 transition-colors">
                                                    <ThumbsDown className="w-3.5 h-3.5" />
                                                    {t('productConsultation.feedbackUseless', { ns: 'help', defaultValue: '无用' })}
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                            {msg.sources && msg.sources.length > 0 && (
                                              <p className="text-xs text-muted-foreground">
                                                {t('productConsultation.sources', { ns: 'help', defaultValue: '参考' })}：{msg.sources.map((s) => s.title || s.source).filter(Boolean).join('、')}
                                              </p>
                                            )}
                                            {msg.recommend && msg.recommend.length > 0 && (
                                              <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1">{t('productConsultation.recommendTitle', { ns: 'help', defaultValue: '为你推荐' })}</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                  {msg.recommend.map((item) => (
                                                    <Link key={item.id} href={item.short_id ? `/c/${item.short_id}` : '#'} className="flex items-center gap-2 p-1.5 rounded border border-border bg-card hover:bg-muted/50 text-xs">
                                                      {item.thumbnail_url && <img src={item.thumbnail_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />}
                                                      <span className="line-clamp-2 text-foreground">{item.title || '(无标题)'}</span>
                                                    </Link>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  {askLoading && (
                                    <div className="flex justify-start">
                                      <div className="rounded-lg px-3 py-2 text-sm text-muted-foreground bg-muted/60 border border-border">
                                        {t('common:loading', { defaultValue: '...' })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2 mt-2">
                                  <input
                                    type="text"
                                    value={askInput}
                                    onChange={(e) => setAskInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                                    placeholder={t('productConsultation.askPlaceholder', { ns: 'help', defaultValue: '输入产品、价格、售后等问题...' })}
                                    className="flex-1 px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    disabled={askLoading}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAsk()}
                                    disabled={askLoading || !askInput.trim()}
                                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                                  >
                                    {t('productConsultation.askSubmit', { ns: 'help', defaultValue: '提问' })}
                                  </button>
                                </div>
                              </div>
                              {/* 分类 Tab */}
                              <div className="flex flex-wrap gap-2">
                                {KB_CATEGORIES.map((cat) => (
                                  <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setKbCategory(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                      kbCategory === cat
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                                    }`}
                                  >
                                    {cat === '全部' ? t('productConsultation.all', { ns: 'help', defaultValue: '全部' }) : cat}
                                  </button>
                                ))}
                              </div>
                              {/* 搜索 */}
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                  <input
                                    type="text"
                                    value={kbSearchInput}
                                    onChange={(e) => setKbSearchInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && setKbSearch(kbSearchInput)}
                                    placeholder={t('productConsultation.searchPlaceholder', { ns: 'help', defaultValue: '输入关键词搜索...' })}
                                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setKbSearch(kbSearchInput)}
                                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
                                >
                                  {t('productConsultation.search', { ns: 'help', defaultValue: '搜索' })}
                                </button>
                              </div>
                              {/* 列表 */}
                              <div>
                                <h4 className="font-semibold text-foreground mb-3">
                                  {t('productConsultation.entriesTitle', { ns: 'help', defaultValue: '知识库条目' })}
                                </h4>
                                {kbLoading ? (
                                  <p className="text-sm text-muted-foreground">{t('common:loading', { defaultValue: '加载中...' })}</p>
                                ) : kbEntries.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">{t('productConsultation.noEntries', { ns: 'help', defaultValue: '暂无条目' })}</p>
                                ) : (
                                  <ul className="space-y-3 max-h-64 overflow-y-auto">
                                    {kbEntries.map((entry) => (
                                      <li key={entry.id} className="p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50">
                                        <div className="font-medium text-foreground text-sm">
                                          {entry.title || entry.question || entry.content?.slice(0, 60) || '(无标题)'}
                                        </div>
                                        {(entry.answer || entry.content) && (
                                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                            {(entry.answer || entry.content || '').slice(0, 120)}
                                            {(entry.answer || entry.content || '').length > 120 ? '...' : ''}
                                          </p>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              {/* 为你推荐 */}
                              <div>
                                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                                  <Sparkles className="w-4 h-4 text-primary" />
                                  {t('productConsultation.recommendTitle', { ns: 'help', defaultValue: '为你推荐' })}
                                </h4>
                                {kbRecommendLoading ? (
                                  <p className="text-sm text-muted-foreground">{t('common:loading', { defaultValue: '加载中...' })}</p>
                                ) : kbRecommend.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">{t('productConsultation.noRecommend', { ns: 'help', defaultValue: '暂无推荐' })}</p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {kbRecommend.map((item) => (
                                      <Link
                                        key={item.id}
                                        href={item.short_id ? `/c/${item.short_id}` : '#'}
                                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                                      >
                                        {item.thumbnail_url && (
                                          <img src={item.thumbnail_url} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                                        )}
                                        <span className="text-sm font-medium text-foreground line-clamp-2">{item.title || '(无标题)'}</span>
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

    </div>
  );
}

