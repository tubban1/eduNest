'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/components/Sidebar';
import MobileHeader from '@/components/MobileHeader';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import AIGuideMessageRenderer from '@/components/AIGuideMessageRenderer';
import LearnPageImageEditor, { type AttachedImage } from '@/components/LearnPageImageEditor';
import { ImagePlus, MessageSquarePlus, History, Heart } from 'lucide-react';
import i18n from '@/i18n/config';

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
  metadata?: { image_urls?: Array<{ url: string }>; image_placeholders?: Array<{ dataUrl: string }>; images_pending?: boolean };
}

function getShortIdForLocale(): string {
  const code = i18n.language || 'zh-CN';
  return SHORT_ID_BY_LOCALE[code] || SHORT_ID_BY_LOCALE['zh-CN'];
}

export default function LearnPage() {
  const { t } = useTranslation(['aiGuide', 'onboard', 'content', 'common']);
  const { user } = useAuth();
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeBoxRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** 从 last-session 恢复时跳过一次 shortId 的 init，避免用 init 结果覆盖已恢复的 conversation + messages */
  const skipNextShortIdLoad = useRef(false);
  /** 当从历史对话导入/恢复后，自动把 iframe+对话框填满视口 */
  const autoFitOnNextInitRef = useRef(false);
  /** 拖动 iframe / 对话框分隔条的状态 */
  const dragStateRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const iframeHeightRef = useRef(iframeHeight);
  const pendingIframeHeightRef = useRef<number | null>(null);
  const dragRafRef = useRef<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

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

  // 从数据库 ai_conversations 表查询最近一次 conversation，导入到工作台（iframe + 消息）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const last = await api.aiGuide.getLastConversation();
        if (cancelled) return;
        if (last?.conversation_id) {
          // 有上次对话：导入到工作台
          autoFitOnNextInitRef.current = true;
          // 1. 设置 conversationId（当前会话）
          setConversationId(last.conversation_id);
          setHasInit(true);
          skipNextShortIdLoad.current = true;
          // 2. 设置 iframe 内容（如果有 content_short_id）
          if (last.content_short_id) {
            setShortId(last.content_short_id);
          } else {
            setShortId(getShortIdForLocale());
          }
          // 3. 导入消息列表（从数据库 ai_messages 表）
          const mapped = (last.messages || []).map((m: any) => ({ role: m.role as ChatRole, content: m.content || '', metadata: m.metadata }));
          setMessages(mapped.length > 0 ? mapped : [{ role: 'assistant', content: t('learnInitialMessage') }]);
        } else {
          // 无上次对话：使用默认 shortId
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
  }, [t]);

  const loadConversationForContent = useCallback(async (contentShortId: string) => {
    try {
      const result = user
        ? await api.aiGuide.init(contentShortId, false)
        : await api.aiGuide.initFree(contentShortId, false);
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
    if (!user?.id) { setHistoryList([]); return; }
    try {
      const list = await api.content.getFiltered({ created_by: user.id, limit: 50, offset: 0 } as any);
      setHistoryList(
        (list || []).map((c: any) => ({
          id: c.id,
          short_id: c.short_id,
          title: c.title,
          svg_thumbnail: c.svg_thumbnail,
          thumbnail_url: c.thumbnail_url,
        })),
      );
    } catch {
      setHistoryList([]);
    }
  }, [user?.id]);

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
    setConversationId(null);
    setMessages([{ role: 'assistant', content: t('newTaskPrompt') }]);
    setIsAwaitingNewContent(true);
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

  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    const imagesPayload =
      attachedImages.length > 0
        ? attachedImages.map((img) => ({ mime_type: img.mimeType, data: img.base64 }))
        : undefined;
    setInputValue('');
    setAttachedImages([]);
    setMessages((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setIsLoading(true);
    try {
      const convId = await ensureSession();
      let fullReply = '';
      if (user) {
        await api.aiGuide.chatStream(convId, text, undefined, (chunk) => {
          fullReply += chunk;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') last.content = fullReply;
            return next;
          });
        }, imagesPayload);
      } else {
        const result = await api.aiGuide.chatStreamFree(convId, text, undefined, (chunk) => {
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

  const placeholder = isAwaitingNewContent
    ? t('learnPlaceholder.student')
    : (isGeneratingNewContent || !shortId ? t('newTaskPromptPlaceholder') : t('inputPlaceholder'));

  if (!mounted) {
    return (
      <div className="flex min-h-screen bg-background" suppressHydrationWarning>
        <main className="flex-1 flex flex-col min-h-screen bg-slate-950" />
      </div>
    );
  }

  return (
    <div className="flex bg-background" suppressHydrationWarning>
      <div className="hidden lg:block fixed top-0 left-0 h-screen z-30">
        <Sidebar variant="desktop" />
      </div>
      <Sidebar variant="mobile" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 flex flex-col min-h-screen bg-slate-950 lg:ml-64">
        <MobileHeader onMenuClick={() => setSidebarOpen(true)} className="shrink-0" />
        <div className="flex-1 flex flex-col min-h-0 relative">
            <div
              ref={workspaceRef}
              className="flex-1 flex flex-col min-h-0 px-2 sm:px-4 lg:px-6 py-2 lg:py-4"
            >
            <div
              ref={iframeBoxRef}
              className="flex flex-col min-h-0 rounded-xl border border-white/15 bg-black/10 overflow-hidden relative"
              style={{ ['--iframe-h' as any]: `${iframeHeight}px` } as React.CSSProperties}
            >
              <iframe
                ref={iframeRef}
                key={isGeneratingNewContent ? 'loading' : isAwaitingNewContent ? 'blank' : shortId ?? 'loading'}
                src={
                  isGeneratingNewContent
                    ? `/learn/loading?kp=${encodeURIComponent(generatingKnowledgePoint || t('newTaskPromptPlaceholder'))}`
                    : isAwaitingNewContent
                      ? `data:text/html,<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:rgba(255,255,255,0.7);font-family:system-ui;padding:16px"><p>${t('newTaskPromptHintBelow')}</p></body>`
                      : shortId
                        ? `/standalone/${shortId}`
                        : `/learn/loading?kp=${encodeURIComponent(t('loadingMessages'))}`
                }
                title={t('iframeTitle')}
                className="w-full border-0 rounded-t-xl shrink-0"
                style={{ height: 'var(--iframe-h)' }}
              />
            </div>
            {/* iframe 下边缘拖动条 */}
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
            <div className="rounded-xl border border-white/15 bg-slate-950/95 backdrop-blur-sm flex flex-col h-[400px] overflow-hidden flex-none">
              <div className="flex items-center justify-end gap-3 px-3 py-2 border-b border-white/10 shrink-0">
                <button type="button" onClick={handleStartNewConversation} className="flex items-center gap-1.5 text-slate-300 hover:text-white text-xs">
                  <MessageSquarePlus className="w-4 h-4" />{t('newConversation')}
                </button>
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
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
                {messages.map((m, idx) => (
                  <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800/80 text-slate-50'}`}>
                      <AIGuideMessageRenderer content={m.content} messageId={String(idx)} />
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
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    onPaste={handlePaste}
                    disabled={!shortId || isLoading || (freeTrialUsed && !user)}
                  />
                  <div className="flex flex-col gap-1 items-center">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      multiple
                      onChange={handleImageSelect}
                      disabled={!shortId || isLoading || imageUploading || attachedImages.length >= MAX_ATTACH_IMAGES || (freeTrialUsed && !user)}
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
                      onClick={handleSendMessage}
                      disabled={!shortId || !inputValue.trim() || isLoading || (freeTrialUsed && !user)}
                      className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60"
                    >
                      {isLoading ? t('sending') : t('send')}
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
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {!user ? (
                <p className="text-slate-500 text-xs">{t('visitorChooseRolePlaceholder', { ns: 'aiGuide' })}</p>
              ) : historyList.length === 0 ? (
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
                        <span className="text-xs text-slate-200 line-clamp-2">{c.title || c.short_id}</span>
                      </div>
                    </button>
                  ))}
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
                      <span className="text-xs text-slate-300 line-clamp-2">{c.title || c.short_id}</span>
                    </button>
                  ))}
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
                          <button key={item.id} type="button" onClick={() => { setShortId(sid); setConversationId(null); setHasInit(false); setCollectionsOpen(false); }} className="w-full text-left block rounded-lg border border-white/10 hover:border-blue-500/50 bg-slate-800/50 px-2 py-2">
                            <span className="text-xs text-slate-300 line-clamp-2">{c?.title || sid}</span>
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
  );
}
