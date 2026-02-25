'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar, { SidebarWidthContext, SIDEBAR_COLLAPSED_KEY } from '@/components/Sidebar';
import MobileHeader from '@/components/MobileHeader';
import { api } from '@/lib/api';
import DrawingBoard, { type DrawingBoardExport } from '@/components/coding-lab/DrawingBoard';
import VoiceInput from '@/components/coding-lab/VoiceInput';
import RuleTree from '@/components/coding-lab/RuleTree';
import GamePreview from '@/components/coding-lab/GamePreview';
import { createDefaultRunnerRules, type RulesJson } from '@/types/codingGame';

interface GameProjectSummary {
  id: string;
  title: string;
  description?: string | null;
  age_level?: string | null;
  engine_preset: string;
  thumbnail_url?: string | null;
  created_at: string;
  updated_at: string;
}

export default function CodingLabPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [projectsPanelOpen, setProjectsPanelOpen] = useState(false);
  const [projects, setProjects] = useState<GameProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [drawingKind, setDrawingKind] = useState<'character' | 'monster' | 'item' | 'background'>('character');
  const [drawingLabel, setDrawingLabel] = useState('');
  const [lastUploadedUrl, setLastUploadedUrl] = useState<string | null>(null);
  const [chat, setChat] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    { role: 'assistant', text: '你好！我们先画一个角色吧。你可以在画板里画出来，然后点击“导出 PNG”。' },
  ]);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastObjectUrlRef = useRef<string | null>(null);
  const [rules, setRules] = useState<RulesJson | null>(null);
  const [highlightRuleText, setHighlightRuleText] = useState<string | null>(null);
  const [varTimeline, setVarTimeline] = useState<
    Array<{ id: number; tMs: number; text: string }>
  >([]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  useEffect(() => {
    try {
      setSidebarCollapsed(
        typeof window !== 'undefined' &&
          localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== 'false'
      );
    } catch (_) {}
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.codingGame.listProjects();
        const data = (res as any)?.data ?? res;
        const arr = Array.isArray(data) ? data : [];
        setProjects(arr);
        if (!selectedProjectId && arr.length > 0) {
          setSelectedProjectId(arr[0].id);
        }
      } catch (e: any) {
        setError(e?.message || '加载项目失败');
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [selectedProjectId]);

  const refreshProjects = async () => {
    const res = await api.codingGame.listProjects();
    const data = (res as any)?.data ?? res;
    setProjects(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const loadRules = async () => {
      if (!selectedProjectId) {
        setRules(null);
        return;
      }
      try {
        const res = await api.codingGame.getProject(selectedProjectId);
        const data = (res as any)?.data ?? res;
        const r = (data?.rules_json || data?.rules) as RulesJson | undefined;
        if (r && typeof r === 'object') {
          setRules(r);
        } else {
          setRules(createDefaultRunnerRules());
        }
      } catch {
        setRules(createDefaultRunnerRules());
      }
    };
    loadRules();
  }, [selectedProjectId]);

  const createProject = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await api.codingGame.saveProject({
        title: newTitle.trim(),
        engine_preset: 'runner',
        rules_json: createDefaultRunnerRules() as RulesJson,
      });
      const data = (res as any)?.data ?? (res as any)?.data?.data ?? null;
      await refreshProjects();
      if (data?.id) setSelectedProjectId(data.id);
      setNewTitle('');
    } catch (e: any) {
      setError(e?.message || '创建项目失败');
    } finally {
      setCreating(false);
    }
  };

  const uploadDrawing = async (payload: DrawingBoardExport) => {
    if (!selectedProjectId) {
      setError('请先选择或创建一个项目');
      return;
    }
    setUploading(true);
    setError(null);
    setLastUploadedUrl(null);
    try {
      const filename = `${drawingKind}-${Date.now()}.png`;
      const uploadRes = await api.post('/coding-game/upload/freeimage', {
        dataUrl: payload.dataUrl,
        filename,
      });
      const uploaded = (uploadRes as any)?.data;
      const imageUrl = uploaded?.displayUrl || uploaded?.url;
      if (!imageUrl) {
        throw new Error('上传成功但未返回图片 URL');
      }
      setLastUploadedUrl(imageUrl);
      await api.codingGame.addDrawing(selectedProjectId, {
        kind: drawingKind,
        image_url: imageUrl,
        label: drawingLabel || undefined,
        meta: {
          width: payload.width,
          height: payload.height,
          mimeType: payload.mimeType,
        },
      });
      setDrawingLabel('');
    } catch (e: any) {
      setError(e?.message || '上传/保存绘画失败');
    } finally {
      setUploading(false);
    }
  };

  const playTTS = async (text: string) => {
    setSpeaking(true);
    try {
      const res = await api.post('/coding-game/voice/tts', { text, voice: 'alloy', format: 'wav' });
      const data = (res as any)?.data;
      const audioPayload = data?.audio;

      // 开发环境下如果后端关闭了真实 TTS（audio 为 null），直接视为成功但不播放音频
      if (!audioPayload || !audioPayload.data) {
        return;
      }

      const base64 = audioPayload.data as string;
      const mimeType = audioPayload.mimeType || 'audio/wav';

      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
      lastObjectUrlRef.current = url;

      const audio = audioRef.current || new Audio();
      audioRef.current = audio;
      audio.src = url;
      await audio.play();
    } catch (e: any) {
      const msg: string = e?.message || 'TTS 播放失败';
      // 针对配额/限流错误给出更友好的提示
      if (msg.includes('insufficient_quota') || msg.includes('429')) {
        setError('语音服务当前额度不足或繁忙，请稍后再试（可先不使用朗读继续体验）。');
      } else {
        setError(msg);
      }
      // 出错时不再向上抛出，避免中断对话流程
      console.error('playTTS error:', e);
    } finally {
      setSpeaking(false);
    }
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');
    setChat((c) => [...c, { role: 'user', text }]);

    if (!selectedProjectId) {
      const assistantText =
        '我们先创建一个项目，再开始画角色哦。左侧点“新建”就可以。';
      setChat((c) => [...c, { role: 'assistant', text: assistantText }]);
      await playTTS(assistantText);
      return;
    }

    try {
      const res = await api.codingGame.aiGuide({
        projectId: selectedProjectId,
        rules_json: rules ?? createDefaultRunnerRules(),
        user_text: text,
        last_drawing: lastUploadedUrl
          ? {
              kind: drawingKind,
              label: drawingLabel || null,
              image_url: lastUploadedUrl,
            }
          : null,
      });
      const outer = (res as any)?.data ?? res;
      const payload = outer?.data ?? outer;
      const guideMessage =
        payload?.guide_message ||
        '收到！我已经根据你的想法更新了左边的规则树，我们可以继续完善规则。';
      const nextRules = payload?.rules as RulesJson | undefined;
      if (nextRules && typeof nextRules === 'object') {
        setRules(nextRules);
      }
      setChat((c) => [...c, { role: 'assistant', text: guideMessage }]);
      await playTTS(guideMessage);
    } catch (e: any) {
      const fallback =
        e?.message ||
        '这次我没听清你的想法，可以再说一遍吗？也可以先用文字在下面输入框里告诉我。';
      setChat((c) => [...c, { role: 'assistant', text: fallback }]);
      await playTTS(fallback);
    }
  };

  const sidebar = (
    <SidebarWidthContext.Provider
      value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}
    >
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        variant="desktop"
      />
    </SidebarWidthContext.Provider>
  );

  const projectsPanel = (
    <>
      {projectsPanelOpen && (
        <button
          type="button"
          aria-label="关闭我的游戏项目"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]"
          onClick={() => setProjectsPanelOpen(false)}
        />
      )}
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-[360px] max-w-[92vw] transform transition-transform duration-200 ${
          projectsPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full border-l border-slate-800 bg-slate-950 text-slate-50 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">我的游戏项目</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                新建 / 选择项目后，规则树与引擎都会切换到对应项目
              </div>
            </div>
            <button
              type="button"
              onClick={() => setProjectsPanelOpen(false)}
              className="px-2 py-1 rounded-lg text-xs border border-slate-700 bg-slate-900/60 hover:bg-slate-900 transition"
            >
              关闭
            </button>
          </div>

          <div className="p-4">
            <div className="flex gap-2 mb-3">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="新项目名称（例如：小龙龙跑酷）"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm outline-none focus:border-indigo-500/60"
              />
              <button
                type="button"
                onClick={createProject}
                disabled={creating || !newTitle.trim()}
                className="px-3 py-2 rounded-lg text-sm border border-indigo-500/40 bg-indigo-500/15 disabled:opacity-50"
              >
                {creating ? '创建中…' : '新建'}
              </button>
            </div>

            {loading && <p className="text-sm text-slate-400">加载中…</p>}
            {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
            {!loading && !error && projects.length === 0 && (
              <p className="text-sm text-slate-400">
                还没有任何游戏项目。后续这里会展示你用语音和画板创建的所有小游戏。
              </p>
            )}
          </div>

          <div className="px-4 pb-4 flex-1 overflow-y-auto space-y-2">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedProjectId(p.id);
                  setProjectsPanelOpen(false);
                }}
                className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                  selectedProjectId === p.id
                    ? 'border-indigo-500/60 bg-indigo-500/10'
                    : 'border-slate-800 bg-slate-900/80 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{p.title || '未命名项目'}</div>
                    {p.description && (
                      <div className="text-xs text-slate-400 line-clamp-2">{p.description}</div>
                    )}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 uppercase tracking-wide">
                    {p.engine_preset || 'runner'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </>
  );

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-50">
      <div className="hidden lg:block">{sidebar}</div>
      <div className="flex-1 flex flex-col">
        <MobileHeader onMenuClick={() => setSidebarOpen(true)} />
        {projectsPanel}
        <div className="flex-1 flex flex-col px-4 py-4 lg:px-8 lg:py-6 gap-4 pt-16 lg:pt-6">
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Coding Lab · 游戏规则工坊
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                通过语音和绘画，设计属于自己的可玩小游戏。当前版本先打通：项目 → 画板绘画 → 上传到 freeimage.host → 绑定到项目素材。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setProjectsPanelOpen(true)}
                className="px-3 py-2 rounded-lg text-sm border border-slate-700 bg-slate-900/60 hover:bg-slate-900 transition"
              >
                我的游戏项目
              </button>
              {selectedProjectId && (
                <div className="hidden md:block text-xs text-slate-400">
                  当前：<span className="text-slate-200">{selectedProject?.title || selectedProjectId}</span>
                </div>
              )}
            </div>
          </header>

          <div className="flex-1 min-h-0">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col h-full">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-base font-medium">工作台</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    左：规则树占位｜中：画板/画布｜右：AI 语音对话（先接 TTS，ASR 下一步）
                  </p>
                </div>
                {selectedProjectId ? (
                  <div className="text-xs text-slate-400">
                    当前项目：<span className="text-slate-200">{selectedProject?.title || selectedProjectId}</span>
                    {uploading && <span className="ml-2 text-indigo-300">上传中…</span>}
                  </div>
                ) : (
                  <div className="text-xs text-amber-300">
                    先新建/选择项目
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)_minmax(0,1fr)] gap-3 flex-1 min-h-0">
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 flex flex-col min-h-0">
                  <RuleTree
                    rules={rules}
                    disabled={!selectedProjectId || uploading}
                    highlightRuleText={highlightRuleText}
                    onChange={async (next) => {
                      setRules(next);
                      if (!selectedProjectId) return;
                      try {
                        await api.codingGame.saveProject({
                          id: selectedProjectId,
                          rules_json: next,
                        });
                      } catch (e) {
                        console.error('保存规则失败', e);
                      }
                    }}
                  />
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 flex flex-col min-h-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-sm font-medium">画板 & 运行预览</div>
                    <div className="flex items-center gap-2">
                      <select
                        value={drawingKind}
                        onChange={(e) => setDrawingKind(e.target.value as any)}
                        className="px-2 py-1.5 rounded-lg text-sm border border-slate-700 bg-slate-950"
                      >
                        <option value="character">角色</option>
                        <option value="monster">怪物</option>
                        <option value="item">道具</option>
                        <option value="background">背景</option>
                      </select>
                      <input
                        value={drawingLabel}
                        onChange={(e) => setDrawingLabel(e.target.value)}
                        placeholder="名字（可选）"
                        className="w-40 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-sm outline-none focus:border-indigo-500/60"
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex-1 min-h-[260px]">
                      <DrawingBoard
                        width={960}
                        height={360}
                        onExport={uploadDrawing}
                        disabled={uploading}
                      />
                    </div>
                    {lastUploadedUrl && (
                      <div className="mt-2 text-xs text-slate-300">
                        最新上传：
                        <a className="ml-2 text-indigo-300 underline" href={lastUploadedUrl} target="_blank" rel="noreferrer">
                          {lastUploadedUrl}
                        </a>
                      </div>
                    )}
                    <GamePreview
                      rules={rules}
                      characterImageUrl={lastUploadedUrl}
                      onEngineEvent={(evt) => {
                        if (evt.triggeredRuleText) {
                          setHighlightRuleText(evt.triggeredRuleText);
                          window.clearTimeout((window as any).__codingLabHlTimer);
                          (window as any).__codingLabHlTimer = window.setTimeout(() => {
                            setHighlightRuleText(null);
                          }, 900);
                        }
                        if (evt.varChanges && evt.varChanges.length > 0) {
                          setVarTimeline((prev) => {
                            const next = [
                              ...evt.varChanges!.map((c) => ({
                                id: Date.now() + Math.random(),
                                tMs: evt.tMs,
                                text: `${c.name} ${String(c.from)} → ${String(c.to)}`,
                              })),
                              ...prev,
                            ];
                            return next.slice(0, 20);
                          });
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 flex flex-col min-h-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-sm font-medium">AI 对话（先 TTS）</div>
                    <button
                      type="button"
                      className="px-2 py-1 rounded-lg text-xs border border-indigo-500/40 bg-indigo-500/15 disabled:opacity-50"
                      disabled={speaking}
                      onClick={() => playTTS('你好！我们先画一个角色，然后告诉我它会做什么。')}
                    >
                      {speaking ? '朗读中…' : '测试朗读'}
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {chat.map((m, idx) => (
                      <div
                        key={idx}
                        className={`rounded-lg border px-2.5 py-2 text-xs leading-relaxed ${
                          m.role === 'user'
                            ? 'border-slate-700 bg-slate-950/70 text-slate-100'
                            : 'border-indigo-500/20 bg-indigo-500/10 text-slate-100'
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">
                          {m.role === 'user' ? '你' : 'AI'}
                        </div>
                        <div className="whitespace-pre-wrap">{m.text}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <VoiceInput
                      disabled={speaking}
                      onFinalText={async (text) => {
                        setChat((c) => [...c, { role: 'user', text }]);

                        if (!selectedProjectId) {
                          const assistantText =
                            '我们先创建一个项目，再开始画角色哦。左侧点“新建”就可以。';
                          setChat((c) => [...c, { role: 'assistant', text: assistantText }]);
                          await playTTS(assistantText);
                          return;
                        }

                        try {
                          const res = await api.codingGame.aiGuide({
                            projectId: selectedProjectId,
                            rules_json: rules ?? createDefaultRunnerRules(),
                            user_text: text,
                            last_drawing: lastUploadedUrl
                              ? {
                                  kind: drawingKind,
                                  label: drawingLabel || null,
                                  image_url: lastUploadedUrl,
                                }
                              : null,
                          });
                          const outer = (res as any)?.data ?? res;
                          const payload = outer?.data ?? outer;
                          const guideMessage =
                            payload?.guide_message ||
                            '好主意！我已经帮你更新了左边的规则树，我们可以继续设计下一条规则。';
                          const nextRules = payload?.rules as RulesJson | undefined;
                          if (nextRules && typeof nextRules === 'object') {
                            setRules(nextRules);
                          }
                          setChat((c) => [...c, { role: 'assistant', text: guideMessage }]);
                          await playTTS(guideMessage);
                        } catch (e: any) {
                          const fallback =
                            e?.message ||
                            '这次我没听清你的想法，可以再说一遍吗？也可以先用文字在下面输入框里告诉我。';
                          setChat((c) => [...c, { role: 'assistant', text: fallback }]);
                          await playTTS(fallback);
                        }
                      }}
                    />
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    已接入最小 AI guide：语音 / 文本内容会生成规则 diff，更新左侧规则树。后续再迭代更聪明的提示和调试能力。
                  </div>
                  {varTimeline.length > 0 && (
                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 overflow-hidden">
                      <div className="px-3 py-2 border-b border-slate-800 text-[11px] text-slate-400">
                        变量时间线（最近变化）
                      </div>
                      <div className="max-h-36 overflow-y-auto px-3 py-2 space-y-1 text-[11px] text-slate-300">
                        {varTimeline.map((e) => (
                          <div key={e.id} className="truncate">
                            <span className="text-slate-500 mr-2">
                              t={(e.tMs / 1000).toFixed(1)}s
                            </span>
                            {e.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

