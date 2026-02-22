'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import Sidebar, { SidebarWidthContext, SIDEBAR_COLLAPSED_KEY } from '@/components/Sidebar';
import MobileHeader from '@/components/MobileHeader';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import AIGuideMessageRenderer from '@/components/AIGuideMessageRenderer';
import LearnPageImageEditor, { type AttachedImage } from '@/components/LearnPageImageEditor';
import { ImagePlus, MessageSquarePlus, History, Heart, PanelTop, PanelLeft } from 'lucide-react';
import i18n from '@/i18n/config';
import MathText from '@/components/MathText';

const MAX_ATTACH_IMAGES = 3;

function compressImage(file: File, targetSizeMB: number = 4): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const targetSizeBytes = targetSizeMB * 1024 * 1024;
        const originalWidth = img.width;
        const originalHeight = img.height;
        let maxDimension = 2048;
        let quality = 0.8;
        let outputMimeType = file.type;
        if (file.type === 'image/png' || file.type === 'image/gif') outputMimeType = 'image/jpeg';
        let dataUrl = '';
        let currentQuality = quality;
        while (currentQuality >= 0.1) {
          let newWidth = originalWidth;
          let newHeight = originalHeight;
          if (newWidth > maxDimension || newHeight > maxDimension) {
            const ratio = Math.min(maxDimension / newWidth, maxDimension / newHeight);
            newWidth = Math.floor(newWidth * ratio);
            newHeight = Math.floor(newHeight * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = newWidth;
          canvas.height = newHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法创建 canvas 上下文'));
            return;
          }
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          dataUrl = canvas.toDataURL(outputMimeType, currentQuality);
          const base64Match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
          if (base64Match) {
            const actualSize = (base64Match[1].length * 3) / 4;
            if (actualSize <= targetSizeBytes) {
              resolve(dataUrl);
              return;
            }
          }
          currentQuality = Math.max(0.1, currentQuality - 0.1);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

const IFRAME_DEFAULT_H = 420;
const DRAG_BAR_H = 24; // h-6
const CHAT_MIN_H = 260;
const CHAT_DESIRED_H = 400;
/** 无历史对话时 iframe 按语言显示的默认内容 short_id（中文/英文/德文/法文） */
const SHORT_ID_BY_LOCALE: Record<string, string> = {
  'zh-CN': 'm245mkdm',
  'en-US': 'pipttt1g',
  'de-DE': 'qdr90188',
  'fr-FR': 'kf808khv',
};

type ChatRole = 'user' | 'assistant';
interface ChatMessage {
  role: ChatRole;
  content: string;
  metadata?: {
    image_urls?: Array<{ url: string; displayUrl?: string }>;
    image_placeholders?: Array<{ dataUrl: string }>;
    images_pending?: boolean;
  };
}

function getShortIdForLocale(): string {
  const code = i18n.language || 'zh-CN';
  return SHORT_ID_BY_LOCALE[code] || SHORT_ID_BY_LOCALE['zh-CN'];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type LearnRole = 'student' | 'parent' | 'teacher';

function buildNewConversationIframeHtml(t: (key: string) => string, role: LearnRole): string {
  const title = escapeHtml(t('newConversation'));
  const hint = escapeHtml(t(`newTaskPrompt.${role}`));
  const examples = escapeHtml(t(`newTaskPromptPlaceholder.${role}`));
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:rgba(255,255,255,0.9);font-family:system-ui,sans-serif;padding:24px;box-sizing:border-box"><div style="max-width:420px;text-align:center"><h2 style="margin:0 0 16px;font-size:1.25rem;font-weight:600;color:rgba(255,255,255,0.95)">${title}</h2><p style="margin:0 0 20px;font-size:0.9375rem;line-height:1.6;color:rgba(255,255,255,0.8)">${hint}</p><p style="margin:0;font-size:0.8125rem;line-height:1.5;color:rgba(255,255,255,0.5)">${examples}</p></div></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

export default function LearnPage() {
  const { t } = useTranslation(['aiGuide', 'onboard', 'content', 'common', 'auth']);
  const { user, loading: authLoading } = useAuth();
  const learnRole: LearnRole = ['student', 'parent', 'teacher'].includes(user?.role || '') ? (user!.role as LearnRole) : 'student';
  const [shortId, setShortId] = useState<string | null>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(IFRAME_DEFAULT_H);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasInit, setHasInit] = useState(false);
  const [freeTrialUsed, setFreeTrialUsed] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<
    Array<{ id: string; short_id?: string; title?: string; svg_thumbnail?: string; thumbnail_url?: string }>
  >([]);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const historyScrollRef = useRef<HTMLDivElement>(null);
  const HISTORY_PAGE_SIZE = 50;
  const [historyViewMode, setHistoryViewMode] = useState<'svg' | 'title'>('svg');
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [collectionLists, setCollectionLists] = useState<Array<{ id: string; name: string }>>([]);
  const [collectionItems, setCollectionItems] = useState<Array<{ id: string; content: { short_id?: string; title?: string } }>>([]);
  const [activeCollectionTab, setActiveCollectionTab] = useState<string>('all');
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [isAwaitingNewContent, setIsAwaitingNewContent] = useState(false);
  const [isGeneratingNewContent, setIsGeneratingNewContent] = useState(false);
  const [generatingKnowledgePoint, setGeneratingKnowledgePoint] = useState('');
  const [mounted, setMounted] = useState(false);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
  /** 对话框内点击图片时，页面内弹窗预览的图片 URL（null 表示关闭） */
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeBoxRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** 从 last-session 恢复时跳过一次 shortId 的 init，避免用 init 结果覆盖已恢复的 conversation + messages */
  const skipNextShortIdLoad = useRef(false);
  /** 已通过 getLastConversation 加载过，需忽略后续 loadConversationForContent 的延迟回调（避免竞态覆盖） */
  const lastConversationLoadedRef = useRef(false);
  /** 当从历史对话导入/恢复后，自动把 iframe+对话框填满视口 */
  const autoFitOnNextInitRef = useRef(false);
  
  // 为每个 shortId 生成稳定的版本号，避免同一会话中重复加载
  // 当 shortId 变化时，版本号会更新，强制重新加载内容
  const iframeVersion = useMemo(() => {
    if (!shortId) return Date.now();
    // 基于 shortId 生成稳定的版本号（使用 shortId 的 hash）
    let hash = 0;
    for (let i = 0; i < shortId.length; i++) {
      const char = shortId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }, [shortId]);
  /** 拖动 iframe / 对话框分隔条的状态 */
  const dragStateRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const iframeHeightRef = useRef(iframeHeight);
  const pendingIframeHeightRef = useRef<number | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  /** 向 iframe 请求 UI 状态时的 Promise 解析与超时（与 AIGuidedLearning 一致） */
  const pendingUIStateResolveRef = useRef<
    ((value: { currentStage: { stageId: string; stageIndex: number } | null; uiState: Record<string, unknown> | null }) => void) | null
  >(null);
  const pendingUIStateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  /** 最近一次从 iframe 拿到的 uiState / stage（超时或无 iframe 时作为 fallback） */
  const [currentUIState, setCurrentUIState] = useState<Record<string, unknown> | null>(null);
  const [currentStage, setCurrentStage] = useState<{ stageId: string; stageIndex: number } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  useEffect(() => {
    try {
      setSidebarCollapsed(typeof window !== 'undefined' && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== 'false');
    } catch (_) {}
  }, []);

  const LAYOUT_KEY = 'edu_learn_layout';
  const LAYOUT_HORIZONTAL_MIN_WIDTH = 768; // 窄屏禁止左右排列；≥768 时允许左右排列，对话框 z-20 保证顶部按钮可点
  const [layoutVertical, setLayoutVertical] = useState(true);
  const [isNarrowScreen, setIsNarrowScreen] = useState(true);
  useEffect(() => {
    const check = () => setIsNarrowScreen(typeof window !== 'undefined' && window.innerWidth < LAYOUT_HORIZONTAL_MIN_WIDTH);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  useEffect(() => {
    try {
      setLayoutVertical(typeof window !== 'undefined' && localStorage.getItem(LAYOUT_KEY) !== 'horizontal');
    } catch (_) {}
  }, []);
  const effectiveLayoutVertical = layoutVertical || isNarrowScreen;
  const toggleLayout = useCallback(() => {
    setLayoutVertical((v) => {
      const next = !v;
      try {
        localStorage.setItem(LAYOUT_KEY, next ? 'vertical' : 'horizontal');
      } catch (_) {}
      return next;
    });
  }, []);

  const SPLIT_RATIO_KEY = 'edu_learn_split_ratio';
  const SPLIT_MIN = 25;
  const SPLIT_MAX = 75;
  const [splitLeftPercent, setSplitLeftPercent] = useState(50);
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const raw = localStorage.getItem(SPLIT_RATIO_KEY);
      if (raw != null) {
        const n = Number(raw);
        if (!Number.isNaN(n) && n >= SPLIT_MIN && n <= SPLIT_MAX) setSplitLeftPercent(n);
      }
    } catch (_) {}
  }, []);
  const horizontalDragStateRef = useRef<{ pointerId: number; startX: number; startPercent: number } | null>(null);
  const [isHorizontalDragging, setIsHorizontalDragging] = useState(false);
  const pendingSplitRef = useRef<number | null>(null);
  const splitRafRef = useRef<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // 监听 iframe 内 eduNestRuntime 上报的 UI 状态与阶段变化，供发送对话时带上 ui_state
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'EDUNEST_UI_STATE_RESPONSE') {
        const uiState = (data.data ?? {}) as Record<string, unknown>;
        setCurrentUIState(uiState);
        const stage =
          currentStage ??
          (typeof uiState.stageIndex === 'number' && uiState.stageIndex > 0
            ? {
                stageId: String(uiState.currentStage ?? uiState['data-current-stage'] ?? `STAGE_${uiState.stageIndex}`),
                stageIndex: uiState.stageIndex as number,
              }
            : null);
        if (stage) setCurrentStage(stage);
        if (pendingUIStateResolveRef.current) {
          const resolveFn = pendingUIStateResolveRef.current;
          pendingUIStateResolveRef.current = null;
          if (pendingUIStateTimeoutRef.current) {
            clearTimeout(pendingUIStateTimeoutRef.current);
            pendingUIStateTimeoutRef.current = null;
          }
          resolveFn({ currentStage: stage, uiState });
        }
      }
      if (data.type === 'EDUNEST_EVENT' && data.data?.eventType === 'stage_change') {
        const payload = data.data?.data ?? {};
        const stageId = payload?.stage ?? payload?.stageId ?? '';
        const stageIndex = Number(payload?.stageIndex ?? 0) || 0;
        if (stageId && stageIndex > 0) {
          setCurrentStage({ stageId, stageIndex });
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentStage]);

  /** 向当前 iframe 请求 UI 状态（standalone 内容会通过 EDUNEST_GET_UI_STATE 响应），超时 800ms 用当前缓存 */
  const refreshUIState = useCallback((): Promise<{
    currentStage: { stageId: string; stageIndex: number } | null;
    uiState: Record<string, unknown> | null;
  }> => {
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      return Promise.resolve({ currentStage, uiState: currentUIState });
    }
    win.postMessage({ type: 'EDUNEST_GET_UI_STATE' }, '*');
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        pendingUIStateTimeoutRef.current = null;
        if (pendingUIStateResolveRef.current) {
          pendingUIStateResolveRef.current({ currentStage, uiState: currentUIState });
          pendingUIStateResolveRef.current = null;
        }
        resolve({ currentStage, uiState: currentUIState });
      }, 800);
      pendingUIStateTimeoutRef.current = timeout;
      pendingUIStateResolveRef.current = (value) => {
        if (pendingUIStateTimeoutRef.current) {
          clearTimeout(pendingUIStateTimeoutRef.current);
          pendingUIStateTimeoutRef.current = null;
        }
        pendingUIStateResolveRef.current = null;
        resolve(value);
      };
    });
  }, [currentStage, currentUIState]);

  // 对话有新内容或初次加载完消息时，滚动到底部
  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const run = () => {
      el.scrollTo({ top: el.scrollHeight - el.clientHeight, behavior: 'smooth' });
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [messages, isLoading]);

  const applyIframeHeightVar = useCallback((h: number) => {
    iframeBoxRef.current?.style.setProperty('--iframe-h', `${h}px`);
  }, []);

  const fitToViewport = useCallback(() => {
    const el = workspaceRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const bottomPadding = 16;
    const available = Math.max(0, window.innerHeight - rect.top - bottomPadding);
    const next = Math.max(0, available - DRAG_BAR_H - CHAT_DESIRED_H);

    iframeHeightRef.current = next;
    pendingIframeHeightRef.current = next;
    applyIframeHeightVar(next);
    setIframeHeight(next);
  }, [applyIframeHeightVar]);

  useEffect(() => {
    iframeHeightRef.current = iframeHeight;
    applyIframeHeightVar(iframeHeight);
  }, [iframeHeight, applyIframeHeightVar]);

  const flushDragHeight = useCallback(() => {
    dragRafRef.current = null;
    const pending = pendingIframeHeightRef.current;
    if (pending == null) return;
    applyIframeHeightVar(pending);
  }, [applyIframeHeightVar]);

  const endDrag = useCallback((finalize: boolean) => {
    dragStateRef.current = null;

    if (dragRafRef.current != null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }

    if (finalize) {
      const finalH = pendingIframeHeightRef.current ?? iframeHeightRef.current;
      iframeHeightRef.current = finalH;
      setIframeHeight(finalH);
      applyIframeHeightVar(finalH);
    }

    pendingIframeHeightRef.current = null;
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [applyIframeHeightVar]);

  const handleDragPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const el = e.currentTarget;
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }

    dragStateRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startHeight: iframeHeightRef.current,
    };
    pendingIframeHeightRef.current = iframeHeightRef.current;
    setIsDragging(true);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleDragPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    e.preventDefault();

    const delta = e.clientY - st.startY;
    const nextH = Math.max(0, st.startHeight + delta);
    pendingIframeHeightRef.current = nextH;
    iframeHeightRef.current = nextH;

    if (dragRafRef.current == null) {
      dragRafRef.current = requestAnimationFrame(flushDragHeight);
    }
  }, [flushDragHeight]);

  const handleDragPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    e.preventDefault();
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    endDrag(true);
  }, [endDrag]);

  const handleDragPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    e.preventDefault();
    endDrag(true);
  }, [endDrag]);

  const flushSplitRatio = useCallback(() => {
    splitRafRef.current = null;
    const p = pendingSplitRef.current;
    if (p == null) return;
    setSplitLeftPercent(p);
  }, []);
  const endHorizontalDrag = useCallback((finalize: boolean) => {
    horizontalDragStateRef.current = null;
    if (splitRafRef.current != null) {
      cancelAnimationFrame(splitRafRef.current);
      splitRafRef.current = null;
    }
    if (finalize) {
      const p = pendingSplitRef.current ?? splitLeftPercent;
      setSplitLeftPercent(p);
      try {
        localStorage.setItem(SPLIT_RATIO_KEY, String(Math.round(p)));
      } catch (_) {}
    }
    pendingSplitRef.current = null;
    setIsHorizontalDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [splitLeftPercent]);
  const handleHorizontalDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    horizontalDragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startPercent: pendingSplitRef.current ?? splitLeftPercent,
    };
    pendingSplitRef.current = splitLeftPercent;
    setIsHorizontalDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [splitLeftPercent]);
  const handleHorizontalDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const st = horizontalDragStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    e.preventDefault();
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const rect = workspace.getBoundingClientRect();
    const totalW = rect.width;
    if (totalW <= 0) return;
    const deltaX = e.clientX - st.startX;
    const deltaPercent = (deltaX / totalW) * 100;
    let next = st.startPercent + deltaPercent;
    next = Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, next));
    pendingSplitRef.current = next;
    if (splitRafRef.current == null) {
      splitRafRef.current = requestAnimationFrame(flushSplitRatio);
    }
  }, [flushSplitRatio]);
  const handleHorizontalDragUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const st = horizontalDragStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    e.preventDefault();
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    endHorizontalDrag(true);
  }, [endHorizontalDrag]);
  const handleHorizontalDragCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const st = horizontalDragStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    e.preventDefault();
    endHorizontalDrag(true);
  }, [endHorizontalDrag]);

  // 读取内容后：自动调节 iframe 高度，使 iframe + 拖动条 + 对话框整体刚好适配当前浏览器高度
  useEffect(() => {
    if (!mounted) return;
    if (!autoFitOnNextInitRef.current) return;
    if (!hasInit || !conversationId) return;
    if (isAwaitingNewContent || isGeneratingNewContent) return;

    autoFitOnNextInitRef.current = false;
    // 等布局稳定（消息导入、iframe key 切换）后再测量并适配
    requestAnimationFrame(() => requestAnimationFrame(() => fitToViewport()));
  }, [mounted, hasInit, conversationId, isAwaitingNewContent, isGeneratingNewContent, fitToViewport]);

  // 约定：iframe 显示「当前用户最新 ai_conversation 对应内容」，对话框显示该会话的 ai_messages；无历史则按语言显示默认内容（SHORT_ID_BY_LOCALE）
  // 依赖 user?.id：登录态就绪后再拉一次最近对话，避免首屏时 auth 未就绪导致拿到 null/访客会话、iframe 显示错误内容
  // 必须等 auth 加载完成后再决定 shortId，否则会出现 loadConversationForContent 与 getLastConversation 竞态、iframe 与对话框内容错位
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    lastConversationLoadedRef.current = false;
    // 非登录用户：不请求 last-conversation，直接按当前语言用默认 iframe，后续由 loadConversationForContent 调 init-free
    if (!user?.id) {
      setShortId(getShortIdForLocale());
      skipNextShortIdLoad.current = false;
      return;
    }
    (async () => {
      try {
        const last = await api.aiGuide.getLastConversation();
        if (cancelled) return;
        lastConversationLoadedRef.current = true;
        if (last?.conversation_id) {
          // 有历史：用最新会话的 content_short_id 作为 iframe 内容，对话框显示该会话的 messages
          autoFitOnNextInitRef.current = true;
          setConversationId(last.conversation_id);
          setHasInit(true);
          skipNextShortIdLoad.current = true;
          setShortId(last.content_short_id || getShortIdForLocale());
          const mapped = (last.messages || []).map((m: any) => ({ role: m.role as ChatRole, content: m.content || '', metadata: m.metadata }));
          setMessages(mapped.length > 0 ? mapped : [{ role: 'assistant', content: t('learnInitialMessage') }]);
        } else {
          // 无历史：iframe 显示当前语言默认内容（中文 m245mkdm / 英文 pipttt1g / 德文 qdr90188 / 法文 kf808khv）
          setShortId(getShortIdForLocale());
          skipNextShortIdLoad.current = false;
        }
      } catch {
        if (!cancelled) {
          setShortId(getShortIdForLocale());
          skipNextShortIdLoad.current = false;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [t, user?.id, authLoading]);

  const loadConversationForContent = useCallback(async (contentShortId: string) => {
    try {
      const result = user
        ? await api.aiGuide.init(contentShortId, false)
        : await api.aiGuide.initFree(contentShortId, false);
      // 若 getLastConversation 已先完成并设置状态，忽略本次延迟回调，避免 iframe 与对话框内容错位
      if (lastConversationLoadedRef.current) return;
      if (!result?.conversation_id) {
        setConversationId(null);
        setHasInit(false);
        setMessages([{ role: 'assistant', content: t('learnInitialMessage') }]);
        return;
      }
      setConversationId(result.conversation_id);
      setHasInit(true);
      if (result.messages?.length > 0) {
        setMessages((result.messages || []).map((m: any) => ({ role: m.role as ChatRole, content: m.content || '', metadata: m.metadata })));
      } else {
        setMessages([{ role: 'assistant', content: result.initial_message || t('learnInitialMessage') }]);
      }
    } catch {
      if (lastConversationLoadedRef.current) return;
      setConversationId(null);
      setHasInit(false);
      setMessages([{ role: 'assistant', content: t('learnInitialMessage') }]);
    }
  }, [user, t]);

  useEffect(() => {
    if (!shortId || isAwaitingNewContent || isGeneratingNewContent) return;
    if (skipNextShortIdLoad.current) {
      skipNextShortIdLoad.current = false;
      return;
    }
    lastConversationLoadedRef.current = false;
    autoFitOnNextInitRef.current = true;
    setMessages([]);
    setConversationId(null);
    setHasInit(false);
    loadConversationForContent(shortId);
  }, [shortId, loadConversationForContent, isAwaitingNewContent, isGeneratingNewContent]);

  const ensureSession = async (): Promise<string> => {
    if (conversationId) return conversationId;
    if (!shortId) throw new Error(t('initSessionFailed'));
    const result = user
      ? await api.aiGuide.init(shortId, false)
      : await api.aiGuide.initFree(shortId, false);
    if (!result?.conversation_id) throw new Error(t('initSessionFailed'));
    setConversationId(result.conversation_id);
    setHasInit(true);
    if (result.messages?.length > 0) {
      setMessages((result.messages || []).map((m: any) => ({ role: m.role as ChatRole, content: m.content || '', metadata: m.metadata })));
    } else {
      setMessages([{ role: 'assistant', content: result.initial_message || t('learnInitialMessage') }]);
    }
    return result.conversation_id;
  };

  const fetchHistoryList = useCallback(async () => {
    if (!user?.id) { setHistoryList([]); setHistoryHasMore(false); return; }
    try {
      const res = await api.get(`/content/history?limit=${HISTORY_PAGE_SIZE}&offset=0`);
      const list = res?.success && Array.isArray(res.data) ? res.data : [];
      setHistoryList(
        list.map((c: any) => ({
          id: c.id,
          short_id: c.short_id,
          title: c.title,
          svg_thumbnail: c.svg_thumbnail,
          thumbnail_url: c.thumbnail_url,
        })),
      );
      setHistoryHasMore(!!(res as any)?.hasMore);
    } catch {
      setHistoryList([]);
      setHistoryHasMore(false);
    }
  }, [user?.id]);

  const fetchMoreHistory = useCallback(async () => {
    if (!user?.id || historyLoadingMore || !historyHasMore) return;
    setHistoryLoadingMore(true);
    try {
      const offset = historyList.length;
      const res = await api.get(`/content/history?limit=${HISTORY_PAGE_SIZE}&offset=${offset}`);
      const list = res?.success && Array.isArray(res.data) ? res.data : [];
      const next = list.map((c: any) => ({
        id: c.id,
        short_id: c.short_id,
        title: c.title,
        svg_thumbnail: c.svg_thumbnail,
        thumbnail_url: c.thumbnail_url,
      }));
      setHistoryList((prev) => [...prev, ...next]);
      setHistoryHasMore(!!(res as any)?.hasMore);
    } catch {
      setHistoryHasMore(false);
    } finally {
      setHistoryLoadingMore(false);
    }
  }, [user?.id, historyLoadingMore, historyHasMore, historyList.length]);

  const onHistoryScroll = useCallback(() => {
    const el = historyScrollRef.current;
    if (!el || historyLoadingMore || !historyHasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 120) {
      fetchMoreHistory();
    }
  }, [historyLoadingMore, historyHasMore, fetchMoreHistory]);

  const fetchCollectionLists = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await api.get('/collection_lists');
      if (res?.success && Array.isArray(res.data)) {
        setCollectionLists(res.data.map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })));
      }
    } catch {
      setCollectionLists([]);
    }
  }, [user?.id]);

  const fetchCollectionItems = useCallback(async (listId: string) => {
    if (!user?.id) { setCollectionItems([]); return; }
    setLoadingCollections(true);
    try {
      if (listId === 'liked') {
        const res = await api.getLikedContent();
        setCollectionItems(Array.isArray(res) ? res : []);
      } else {
        const res = await api.get(`/user_collections/group/${listId}`);
        setCollectionItems(res?.success && Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      setCollectionItems([]);
    } finally {
      setLoadingCollections(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (collectionsOpen && user?.id) {
      fetchCollectionLists();
      setActiveCollectionTab((prev) => prev || 'all');
    }
  }, [collectionsOpen, user?.id, fetchCollectionLists]);

  useEffect(() => {
    if (collectionsOpen && activeCollectionTab && user?.id) fetchCollectionItems(activeCollectionTab);
  }, [collectionsOpen, activeCollectionTab, user?.id, fetchCollectionItems]);

  const handleStartNewConversation = () => {
    setHasInit(false);
    setShortId(null);
    setConversationId(null);
    setMessages([{ role: 'assistant', content: t(`newTaskPrompt.${learnRole}`) }]);
    setIsAwaitingNewContent(true);
    setIsGeneratingNewContent(false);
    setGeneratingKnowledgePoint('');
    setHistoryOpen(false);
    setCollectionsOpen(false);
    setInputValue('');
    setAttachedImages([]);
  };

  const addOneImageFromFile = useCallback(async (file: File): Promise<boolean> => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) return false;
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) return false;
    const dataUrl = await compressImage(file, 4);
    const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) return false;
    const mimeType = base64Match[1];
    const base64 = base64Match[2];
    setAttachedImages((prev) => {
      if (prev.length >= MAX_ATTACH_IMAGES) return prev;
      return [...prev, { file, dataUrl, base64, mimeType }];
    });
    return true;
  }, []);

  const processImageFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setImageUploading(true);
      try {
        const toAdd = Math.min(files.length, MAX_ATTACH_IMAGES - attachedImages.length);
        for (let i = 0; i < toAdd; i++) {
          await addOneImageFromFile(files[i]);
        }
      } finally {
        setImageUploading(false);
        if (imageInputRef.current) imageInputRef.current.value = '';
      }
    },
    [addOneImageFromFile, attachedImages.length]
  );

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList?.length) return;
      const files = Array.from(fileList).slice(0, MAX_ATTACH_IMAGES - attachedImages.length);
      processImageFiles(files);
      e.target.value = '';
    },
    [processImageFiles, attachedImages.length]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items?.length) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') === -1) continue;
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
      if (imageFiles.length === 0) return;
      e.preventDefault();
      const remaining = MAX_ATTACH_IMAGES - attachedImages.length;
      if (remaining <= 0) return;
      processImageFiles(imageFiles.slice(0, remaining));
    },
    [processImageFiles, attachedImages.length]
  );

  const removeAttachedImage = useCallback((index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
    setEditingImageIndex(null);
  }, []);

  const handleGenerateFromInput = useCallback(async () => {
    const knowledgePoint = inputValue.trim();
    if (!knowledgePoint || isGeneratingNewContent) return;
    if (freeTrialUsed && !user) {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('pleaseLoginToContinue') }]);
      return;
    }
    const lang = (i18n.language || 'zh-CN').split('-')[0] === 'zh' ? 'zh-CN' : (i18n.language || 'en-US');
    const imagePayload = attachedImages[0]
      ? { mime_type: attachedImages[0].mimeType, data: attachedImages[0].base64 }
      : undefined;
    setGeneratingKnowledgePoint(knowledgePoint);
    setInputValue('');
    setAttachedImages([]);
    setMessages((prev) => [...prev, { role: 'user', content: knowledgePoint }, { role: 'assistant', content: '' }]);
    setIsGeneratingNewContent(true);
    setIsAwaitingNewContent(false);
    let contentId: string;
    let newShortId: string;
    try {
      if (!user) {
        const res = await api.generateContentFree({
          knowledgePoint,
          output_type: 'interactive',
          language_code: lang,
          image: imagePayload,
        });
        const data = (res as any)?.data;
        if (!(res as any)?.success || !data?.id) {
          const err = (res as any)?.error || (res as any)?.message || '生成失败';
          const replaceLastWith = (content: string) => setMessages((prev) => {
            const p = [...prev];
            if (p.length && p[p.length - 1].role === 'assistant' && !p[p.length - 1].content) p.pop();
            return [...p, { role: 'assistant', content }];
          });
          if (err === 'FREE_TRIAL_USED' || (err && String(err).includes('FREE_TRIAL'))) {
            setFreeTrialUsed(true);
            replaceLastWith(t('pleaseLoginToContinue'));
          } else {
            replaceLastWith(err);
          }
          return;
        }
        if ((res as any)?.freeTrialUsed) setFreeTrialUsed(true);
        contentId = data.id;
        newShortId = data.short_id;
        if (!newShortId) {
          setMessages((prev) => {
            const p = [...prev];
            if (p.length && p[p.length - 1].role === 'assistant' && !p[p.length - 1].content) p.pop();
            return [...p, { role: 'assistant', content: t('initSessionFailed') }];
          });
          return;
        }
        setShortId(newShortId);
      } else {
        const safeTitle = knowledgePoint.length > 200 ? knowledgePoint.slice(0, 200) : knowledgePoint;
        const content = await api.content.create({
          title: safeTitle,
          description: '',
          language_code: lang,
          content_type: 'vue',
          full_html: '<div class="p-4 text-slate-400">内容生成中…</div>',
          tags: [],
        });
        if (!content?.id) {
          setMessages((prev) => {
            const p = [...prev];
            if (p.length && p[p.length - 1].role === 'assistant' && !p[p.length - 1].content) p.pop();
            return [...p, { role: 'assistant', content: '创建内容失败' }];
          });
          return;
        }
        contentId = content.id;
        newShortId = content.short_id;
        if (!newShortId) {
          setMessages((prev) => {
            const p = [...prev];
            if (p.length && p[p.length - 1].role === 'assistant' && !p[p.length - 1].content) p.pop();
            return [...p, { role: 'assistant', content: t('initSessionFailed') }];
          });
          return;
        }
        await api.generateContentAsync(contentId, {
          knowledge_point: knowledgePoint,
          output_type: 'interactive',
          language_code: lang,
          image: imagePayload,
        });
        setShortId(newShortId);
      }
      const maxAttempts = 120;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await api.getContentGenerationStatus(contentId);
        const status = (statusRes as any)?.data?.status ?? (statusRes as any)?.status;
        if (status === 'done') {
          setIsGeneratingNewContent(false);
          // 不在此处再调 loadConversationForContent：setShortId(newShortId) 已触发 useEffect 调过一次 init，避免 start session 被保存两次
          return;
        }
        if (status === 'failed') {
          const errMsg = (statusRes as any)?.data?.error_message ?? (statusRes as any)?.error_message ?? '生成失败';
          setMessages((prev) => {
            const p = [...prev];
            if (p.length && p[p.length - 1].role === 'assistant' && !p[p.length - 1].content) p.pop();
            return [...p, { role: 'assistant', content: errMsg }];
          });
          break;
        }
      }
      setIsGeneratingNewContent(false);
      setMessages((prev) => {
        const p = [...prev];
        if (p.length && p[p.length - 1].role === 'assistant' && !p[p.length - 1].content) p.pop();
        return [...p, { role: 'assistant', content: t(`newTaskPromptPlaceholder.${learnRole}`) }];
      });
    } catch (e: any) {
      const msg = e?.message || String(e);
      setMessages((prev) => {
        const p = [...prev];
        if (p.length && p[p.length - 1].role === 'assistant' && !p[p.length - 1].content) p.pop();
        return [...p, { role: 'assistant', content: msg }];
      });
      if (msg.includes('FREE_TRIAL')) setFreeTrialUsed(true);
    } finally {
      setIsGeneratingNewContent(false);
    }
  }, [
    inputValue,
    attachedImages,
    isGeneratingNewContent,
    freeTrialUsed,
    user,
    learnRole,
    t,
    loadConversationForContent,
  ]);

  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    const imagesPayload =
      attachedImages.length > 0
        ? attachedImages.map((img) => ({ mime_type: img.mimeType, data: img.base64 }))
        : undefined;
    const imagePlaceholders = attachedImages.length > 0
      ? attachedImages.map((img) => ({ dataUrl: img.dataUrl }))
      : undefined;
    setInputValue('');
    setAttachedImages([]);
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: text,
        metadata: imagePlaceholders?.length
          ? { images_pending: true, image_placeholders: imagePlaceholders }
          : undefined
      },
      { role: 'assistant', content: '' }
    ]);
    setIsLoading(true);
    let convId: string | null = null;
    try {
      convId = await ensureSession();
      const { currentStage: stage, uiState: uiStateFromIframe } = await refreshUIState();
      const ui_state = stage || uiStateFromIframe ? { currentStage: stage, uiState: uiStateFromIframe } : undefined;
      let fullReply = '';
      if (user) {
        await api.aiGuide.chatStream(convId, text, ui_state, (chunk) => {
          fullReply += chunk;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') last.content = fullReply;
            return next;
          });
        }, imagesPayload);
      } else {
        const result = await api.aiGuide.chatStreamFree(convId, text, ui_state, (chunk) => {
          fullReply += chunk;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') last.content = fullReply;
            return next;
          });
        }, imagesPayload);
        if ((result as any)?.freeTrialUsed) setFreeTrialUsed(true);
      }
      if (imagesPayload?.length && convId) {
        setTimeout(() => {
          api.aiGuide.getMessages(convId!).then((list: any[]) => {
            if (Array.isArray(list) && list.length > 0) {
              setMessages(list.map((msg: any) => ({
                role: msg.role as ChatRole,
                content: msg.content || '',
                metadata: msg.metadata ?? undefined
              })));
            }
          }).catch(() => {});
        }, 2500);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') last.content = msg.includes('FREE_TRIAL') ? t('pleaseLoginToContinue') : msg;
        return next;
      });
      if (msg.includes('FREE_TRIAL')) setFreeTrialUsed(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitInput = useCallback(() => {
    if (isAwaitingNewContent) {
      handleGenerateFromInput();
    } else {
      handleSendMessage();
    }
  }, [isAwaitingNewContent, handleGenerateFromInput, handleSendMessage]);

  const placeholder = isAwaitingNewContent
    ? t(`learnPlaceholder.${learnRole}`)
    : (isGeneratingNewContent || !shortId ? t(`newTaskPromptPlaceholder.${learnRole}`) : t('inputPlaceholder'));

  if (!mounted) {
    return (
      <div className="flex min-h-screen bg-background" suppressHydrationWarning>
        <main className="flex-1 flex flex-col min-h-screen bg-slate-950" />
      </div>
    );
  }

  return (
    <SidebarWidthContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
    <div className="flex bg-background" suppressHydrationWarning>
      <div className="hidden lg:block fixed top-0 left-0 h-screen z-30">
        <Sidebar variant="desktop" />
      </div>
      <Sidebar variant="mobile" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className={`flex-1 flex flex-col min-h-screen bg-slate-950 transition-[margin] duration-200 ease-out ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <MobileHeader onMenuClick={() => setSidebarOpen(true)} className="shrink-0" />
        <div className="flex-1 flex flex-col min-h-0 relative">
            <div
              ref={workspaceRef}
              className={`flex-1 flex min-h-0 px-2 sm:px-4 lg:px-6 py-2 lg:py-4 ${effectiveLayoutVertical ? 'flex-col' : 'flex-row gap-2 lg:gap-3'}`}
            >
            <div
              ref={iframeBoxRef}
              className={`flex flex-col min-h-0 rounded-xl border border-white/15 bg-black/10 overflow-hidden relative ${!effectiveLayoutVertical ? 'flex-none min-w-0 shrink-0 z-10' : ''}`}
              style={
                effectiveLayoutVertical
                  ? ({ ['--iframe-h' as any]: `${iframeHeight}px` } as React.CSSProperties)
                  : { width: `${splitLeftPercent}%` }
              }
            >
              <div className="absolute top-2 right-2 z-20 flex gap-1 pointer-events-none">
                {shortId && !isGeneratingNewContent && !isAwaitingNewContent && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/c/${shortId}`, '_blank', 'noopener,noreferrer');
                    }}
                    className="pointer-events-auto px-1.5 py-0.5 rounded-full bg-slate-900/70 border border-white/15 text-[10px] text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                    title={t('openInNewTab', { ns: 'aiGuide', defaultValue: '在新标签页打开完整内容' })}
                  >
                    ↗
                  </button>
                )}
              </div>
              <iframe
                ref={iframeRef}
                key={isGeneratingNewContent ? 'loading' : isAwaitingNewContent ? 'blank' : shortId ?? 'loading'}
                src={
                  isGeneratingNewContent
                    ? `/learn/loading?kp=${encodeURIComponent(generatingKnowledgePoint || t(`newTaskPromptPlaceholder.${learnRole}`))}`
                    : isAwaitingNewContent
                      ? buildNewConversationIframeHtml(t, learnRole)
                      : shortId
                        ? `/standalone/${shortId}?v=${iframeVersion}`
                        : `/learn/loading?kp=${encodeURIComponent(t('loadingMessages'))}`
                }
                title={t('iframeTitle')}
                className={`w-full border-0 rounded-t-xl ${effectiveLayoutVertical ? 'shrink-0' : 'flex-1 min-h-0'}`}
                style={effectiveLayoutVertical ? { height: 'var(--iframe-h)' } : { height: '100%', minHeight: 0 }}
              />
            </div>
            {/* iframe 下边缘拖动条（仅上下排列时显示） */}
            {effectiveLayoutVertical && (
            <div
              className="relative h-6 cursor-row-resize z-30 flex items-center justify-center px-2 sm:px-4 lg:px-6 select-none touch-none"
              onPointerDown={handleDragPointerDown}
              onPointerMove={handleDragPointerMove}
              onPointerUp={handleDragPointerUp}
              onPointerCancel={handleDragPointerCancel}
              onLostPointerCapture={() => endDrag(true)}
            >
              <div className={`w-28 h-1.5 rounded-full transition-colors ${
                isDragging ? 'bg-blue-500' : 'bg-slate-500/50 hover:bg-slate-500/70'
              }`} />
            </div>
            )}
            {/* 左右排列时：中间垂直拖动条，调节 iframe 与对话框宽度 */}
            {!effectiveLayoutVertical && (
            <div
              className="relative w-2 flex-shrink-0 flex items-center justify-center cursor-col-resize z-30 select-none touch-none group"
              onPointerDown={handleHorizontalDragStart}
              onPointerMove={handleHorizontalDragMove}
              onPointerUp={handleHorizontalDragUp}
              onPointerCancel={handleHorizontalDragCancel}
              onLostPointerCapture={() => endHorizontalDrag(true)}
              aria-label={t('resizeHandleLabel', { ns: 'aiGuide', defaultValue: '调整左右宽度' })}
            >
              <div className={`w-1.5 h-16 rounded-full transition-colors ${
                isHorizontalDragging ? 'bg-blue-500' : 'bg-slate-500/50 group-hover:bg-slate-500/70'
              }`} />
            </div>
            )}
            <div className={`rounded-xl border border-white/15 bg-slate-950/95 backdrop-blur-sm flex flex-col overflow-hidden ${effectiveLayoutVertical ? 'h-[400px] flex-none' : 'flex-1 min-w-0 min-h-0 relative z-20'}`}>
              <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-white/10 shrink-0 relative z-10 bg-slate-950/95 min-h-[40px]">
                {!user ? (
                  <Link
                    href="/login"
                    className="ai-gradient-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0"
                  >
                    {t('login', { ns: 'auth', defaultValue: '登录' })}
                  </Link>
                ) : null}
                <div className={`flex items-center gap-3 ${user ? 'ml-auto' : ''}`}>
                {!isNarrowScreen && (
                <button
                  type="button"
                  onClick={toggleLayout}
                  className="flex items-center gap-1.5 text-slate-300 hover:text-white text-xs"
                  title={layoutVertical ? t('layoutToggleToHorizontal') : t('layoutToggleToVertical')}
                  aria-label={layoutVertical ? t('layoutToggleToHorizontal') : t('layoutToggleToVertical')}
                >
                  {layoutVertical ? <PanelLeft className="w-4 h-4" /> : <PanelTop className="w-4 h-4" />}
                  <span className="hidden sm:inline">{layoutVertical ? t('layoutHorizontal') : t('layoutVertical')}</span>
                </button>
                )}
                <button type="button" onClick={handleStartNewConversation} className="flex items-center gap-1.5 text-slate-300 hover:text-white text-xs">
                  <MessageSquarePlus className="w-4 h-4" />{t('newConversation')}
                </button>
                {user && (
                  <>
                    <button type="button" onClick={() => setCollectionsOpen((o) => !o)} className="flex items-center gap-1.5 text-slate-300 hover:text-white text-xs">
                      <Heart className="w-4 h-4" />{t('collectionsButton')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setHistoryOpen((o) => !o); if (!historyOpen) fetchHistoryList(); }}
                      className="flex items-center gap-1.5 text-slate-300 hover:text-white text-xs"
                    >
                      <History className="w-4 h-4" />{t('conversationHistory')}
                    </button>
                  </>
                )}
                </div>
              </div>
              <div ref={messagesScrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
                {messages.map((m, idx) => (
                  <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800/80 text-slate-50'}`}>
                      {idx === messages.length - 1 && m.role === 'assistant' && !m.content && (isLoading || isGeneratingNewContent) ? (
                        <div className="py-1">
                          <div className="flex items-center gap-1" aria-label={isGeneratingNewContent ? t('generating') : t('sending')}>
                            <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                            <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                            <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                          </div>
                          {isGeneratingNewContent && (
                            <p className="text-slate-400 text-xs mt-2">{t('generatingPanelTitle')}</p>
                          )}
                        </div>
                      ) : (
                        <AIGuideMessageRenderer content={m.content} messageId={String(idx)} />
                      )}
                      {m.role === 'user' && (m.metadata?.image_urls?.length || m.metadata?.image_placeholders?.length) ? (
                        <div className="flex flex-wrap gap-1.5 mt-2 justify-end">
                          {(m.metadata.image_urls?.length ? m.metadata.image_urls : m.metadata.image_placeholders!).map((item, i) => {
                            const thumbSrc = 'displayUrl' in item ? (item.displayUrl || (item as { url: string }).url) : (item as { dataUrl: string }).dataUrl;
                            const fullUrl = 'url' in item ? (item as { url: string }).url : (item as { dataUrl: string }).dataUrl;
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setImagePreviewUrl(fullUrl)}
                                className="block rounded-lg overflow-hidden border border-white/20 w-14 h-14 flex-shrink-0 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-400"
                              >
                                <img src={thumbSrc} alt="" className="w-full h-full object-cover pointer-events-none" />
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 px-3 py-2 shrink-0">
                {attachedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {attachedImages.map((img, idx) => (
                      <div key={idx} className="relative rounded-lg overflow-hidden border border-white/15 bg-black/30 w-14 h-14 flex-shrink-0">
                        <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center gap-0.5 opacity-0 hover:opacity-100 bg-black/50 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setEditingImageIndex(idx)}
                            className="p-1 rounded bg-white/20 hover:bg-white/30 text-white"
                            title={t('editImage', { ns: 'content', defaultValue: '编辑图片' })}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAttachedImage(idx)}
                            className="p-1 rounded bg-white/20 hover:bg-white/30 text-white"
                            title={t('removeImage', { ns: 'content', defaultValue: '移除图片' })}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={textareaRef}
                    className="flex-1 text-sm rounded-lg border border-white/15 bg-black/30 text-white px-3 py-2 resize-none h-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        // 避免中文/拼音输入法组合中按回车直接发送
                        const anyEvent = e.nativeEvent as any;
                        if (anyEvent.isComposing) return;
                        e.preventDefault();
                        handleSubmitInput();
                      }
                    }}
                    onPaste={handlePaste}
                    disabled={isGeneratingNewContent || (!isAwaitingNewContent && !shortId) || isLoading || (freeTrialUsed && !user)}
                  />
                  <div className="flex flex-col gap-1 items-center">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      multiple
                      onChange={handleImageSelect}
                      disabled={isGeneratingNewContent || (!isAwaitingNewContent && !shortId) || isLoading || imageUploading || attachedImages.length >= MAX_ATTACH_IMAGES || (freeTrialUsed && !user)}
                      className="hidden"
                      id="learn-page-image-input"
                    />
                    <label
                      htmlFor="learn-page-image-input"
                      className={`flex items-center justify-center w-9 h-9 rounded-lg border border-white/15 bg-black/30 text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed ${attachedImages.length >= MAX_ATTACH_IMAGES ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={t('uploadImage', { ns: 'content', defaultValue: '添加图片' }) + ` (${attachedImages.length}/${MAX_ATTACH_IMAGES})`}
                    >
                      {imageUploading ? (
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent" />
                      ) : (
                        <ImagePlus className="w-5 h-5" />
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={handleSubmitInput}
                      disabled={
                        isGeneratingNewContent ||
                        (isAwaitingNewContent ? !inputValue.trim() : (!shortId || !inputValue.trim())) ||
                        isLoading ||
                        (freeTrialUsed && !user)
                      }
                      className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60"
                    >
                      {isGeneratingNewContent ? t('generating') : isLoading ? t('sending') : t('send')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {editingImageIndex !== null && attachedImages[editingImageIndex] && (
            <LearnPageImageEditor
              image={attachedImages[editingImageIndex]}
              onApply={(updated) => {
                setAttachedImages((prev) => prev.map((img, i) => (i === editingImageIndex ? updated : img)));
                setEditingImageIndex(null);
              }}
              onClose={() => setEditingImageIndex(null)}
            />
          )}

          {imagePreviewUrl && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              onClick={() => setImagePreviewUrl(null)}
              role="dialog"
              aria-modal="true"
              aria-label={t('imagePreview', { ns: 'content', defaultValue: '图片预览' })}
            >
              <button
                type="button"
                onClick={() => setImagePreviewUrl(null)}
                className="absolute top-3 right-3 z-10 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label={t('close', { ns: 'common', defaultValue: '关闭' })}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <img
                src={imagePreviewUrl}
                alt=""
                className="max-w-full max-h-[90vh] w-auto h-auto object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {historyOpen && <div className="fixed inset-0 bg-black/50 z-10" onClick={() => setHistoryOpen(false)} aria-hidden />}
          <aside className={`${historyOpen ? 'flex' : 'hidden'} flex-col fixed right-0 top-0 bottom-0 z-20 w-[85%] max-w-sm border-l border-white/10 bg-slate-900/95 overflow-hidden shadow-xl`}>
            <div className="flex items-center justify-between px-3 py-3 border-b border-white/10">
              <span className="flex items-center gap-2 text-slate-200 text-sm font-medium">
                <History className="w-4 h-4" />
                {t('conversationHistory')}
              </span>
              <button type="button" onClick={() => setHistoryOpen(false)} className="text-slate-400 hover:text-white p-1">
                ×
              </button>
            </div>
            <div className="px-3 py-2 border-b border-white/10 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setHistoryViewMode('svg')}
                className={`flex-1 text-center px-2 py-0.5 rounded text-[11px] border ${
                  historyViewMode === 'svg'
                    ? 'bg-blue-600/90 text-white border-blue-500'
                    : 'bg-slate-800/80 text-slate-300 border-slate-600'
                }`}
              >
                {t('listViewSvg')}
              </button>
              <button
                type="button"
                onClick={() => setHistoryViewMode('title')}
                className={`flex-1 text-center px-2 py-0.5 rounded text-[11px] border ${
                  historyViewMode === 'title'
                    ? 'bg-blue-600/90 text-white border-blue-500'
                    : 'bg-slate-800/80 text-slate-300 border-slate-600'
                }`}
              >
                {t('listViewTitle')}
              </button>
            </div>
            <div
              ref={historyScrollRef}
              onScroll={onHistoryScroll}
              className="flex-1 overflow-y-auto px-3 py-3"
            >
              {!user ? (
                <p className="text-slate-500 text-xs">{t('loginToViewHistory', { ns: 'aiGuide', defaultValue: '登录后查看历史对话' })}</p>
              ) : historyList.length === 0 && !historyLoadingMore ? (
                <p className="text-slate-500 text-xs">{t('noMyContent', { ns: 'aiGuide' })}</p>
              ) : historyViewMode === 'svg' ? (
                <div className="grid grid-cols-2 gap-2">
                  {historyList.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        if (c.short_id) {
                          autoFitOnNextInitRef.current = true;
                          const isSame = c.short_id === shortId;
                          // 立刻让对话框与 iframe 对应：先重置对话框，再切换 iframe
                          setMessages([{ role: 'assistant', content: t('learnInitialMessage') }]);
                          // 用户手动切换内容，不再跳过下一次 shortId init
                          skipNextShortIdLoad.current = false;
                          setShortId(c.short_id);
                          setConversationId(null);
                          setHasInit(false);
                          setHistoryOpen(false);
                          setIsAwaitingNewContent(false);
                          setIsGeneratingNewContent(false);
                          if (isSame) {
                            setMessages([]);
                            loadConversationForContent(c.short_id);
                          }
                        }
                      }}
                      className="w-full h-full text-left block rounded-lg border border-white/10 hover:border-blue-500/50 bg-slate-800/50 p-2"
                    >
                      <div className="flex flex-col gap-1 h-full">
                        <div className="w-full aspect-video rounded-md bg-slate-900/80 overflow-hidden border border-white/10">
                          {c.svg_thumbnail ? (
                            <div
                              className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:object-cover"
                              dangerouslySetInnerHTML={{ __html: c.svg_thumbnail }}
                            />
                          ) : c.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.thumbnail_url}
                              alt={c.title || c.short_id || ''}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl text-slate-300">
                              📚
                            </div>
                          )}
                        </div>
                        <MathText
                          text={c.title || c.short_id || ''}
                          className="text-xs text-slate-200 line-clamp-2"
                          as="span"
                        />
                      </div>
                    </button>
                  ))}
                  {historyLoadingMore && (
                    <div className="col-span-2 py-2 text-center text-slate-400 text-xs">{t('loadingMessages', { ns: 'aiGuide', defaultValue: '加载中...' })}</div>
                  )}
                  {historyHasMore && !historyLoadingMore && historyList.length > 0 && (
                    <div className="col-span-2 py-1 text-center text-slate-500 text-[11px]">{t('scrollForMore', { ns: 'aiGuide', defaultValue: '下滑加载更多' })}</div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {historyList.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        if (c.short_id) {
                          autoFitOnNextInitRef.current = true;
                          const isSame = c.short_id === shortId;
                          // 立刻让对话框与 iframe 对应：先重置对话框，再切换 iframe
                          setMessages([{ role: 'assistant', content: t('learnInitialMessage') }]);
                          // 用户手动切换内容，不再跳过下一次 shortId init
                          skipNextShortIdLoad.current = false;
                          setShortId(c.short_id);
                          setConversationId(null);
                          setHasInit(false);
                          setHistoryOpen(false);
                          setIsAwaitingNewContent(false);
                          setIsGeneratingNewContent(false);
                          if (isSame) {
                            setMessages([]);
                            loadConversationForContent(c.short_id);
                          }
                        }
                      }}
                      className="w-full text-left block rounded-lg border border-white/10 hover:border-blue-500/50 bg-slate-800/50 p-2"
                    >
                      <MathText
                        text={c.title || c.short_id || ''}
                        className="text-xs text-slate-300 line-clamp-2"
                        as="span"
                      />
                    </button>
                  ))}
                  {historyLoadingMore && (
                    <div className="py-2 text-center text-slate-400 text-xs">{t('loadingMessages', { ns: 'aiGuide', defaultValue: '加载中...' })}</div>
                  )}
                  {historyHasMore && !historyLoadingMore && historyList.length > 0 && (
                    <div className="py-1 text-center text-slate-500 text-[11px]">{t('scrollForMore', { ns: 'aiGuide', defaultValue: '下滑加载更多' })}</div>
                  )}
                </div>
              )}
            </div>
          </aside>

          {collectionsOpen && <div className="fixed inset-0 bg-black/50 z-10" onClick={() => setCollectionsOpen(false)} aria-hidden />}
          <aside className={`${collectionsOpen ? 'flex' : 'hidden'} flex-col fixed right-0 top-0 bottom-0 z-20 w-[85%] max-w-sm border-l border-white/10 bg-slate-900/95 overflow-hidden shadow-xl`}>
            <div className="flex items-center justify-between px-3 py-3 border-b border-white/10">
              <span className="flex items-center gap-2 text-slate-200 text-sm font-medium"><Heart className="w-4 h-4" />{t('collectionsPanelTitle')}</span>
              <button type="button" onClick={() => setCollectionsOpen(false)} className="text-slate-400 hover:text-white p-1">×</button>
            </div>
            {!user ? <div className="p-4"><p className="text-slate-500 text-xs">{t('loginToViewCollections')}</p></div> : (
              <>
                <div className="flex gap-1.5 px-3 py-2 border-b border-white/10 overflow-x-auto">
                  <button type="button" onClick={() => setActiveCollectionTab('all')} className={`flex-shrink-0 text-xs px-2 py-1.5 rounded ${activeCollectionTab === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>{t('allCollections', { ns: 'navigation', defaultValue: '全部收藏' })}</button>
                  {collectionLists.map((list) => (
                    <button key={list.id} type="button" onClick={() => setActiveCollectionTab(list.id)} className={`flex-shrink-0 text-xs px-2 py-1.5 rounded ${activeCollectionTab === list.id ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>{list.name}</button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-3">
                  {loadingCollections ? <p className="text-slate-500 text-xs">{t('loadingMessages')}</p> : collectionItems.length === 0 ? <p className="text-slate-500 text-xs">{t('noCollectionsInLearn')}</p> : (
                    <div className="space-y-2">
                      {collectionItems.map((item: any) => {
                        const c = item.content ?? item;
                        const sid = c?.short_id;
                        if (!sid) return null;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              // 立刻让对话框与 iframe 对应：先重置对话框，再切换 iframe
                              setMessages([{ role: 'assistant', content: t('learnInitialMessage') }]);
                              // 用户手动切换内容，不再跳过下一次 shortId init
                              skipNextShortIdLoad.current = false;
                              setShortId(sid);
                              setConversationId(null);
                              setHasInit(false);
                              setIsAwaitingNewContent(false);
                              setIsGeneratingNewContent(false);
                              setCollectionsOpen(false);
                            }}
                            className="w-full text-left block rounded-lg border border-white/10 hover:border-blue-500/50 bg-slate-800/50 px-2 py-2"
                          >
                            <MathText
                              text={c?.title || sid}
                              className="text-xs text-slate-300 line-clamp-2"
                              as="span"
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
    </SidebarWidthContext.Provider>
  );
}
