'use client';

import React, { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function getRealtimeWsBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const api = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
  const u = new URL(api);
  const protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${u.host}/api/ai-guide/realtime`;
}

const TARGET_SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4096;

function float32ToInt16Pcm(float32: Float32Array): ArrayBuffer {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16.buffer;
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export interface AIGuideRealtimeProps {
  onAddMessage: (role: 'user' | 'assistant', content: string) => void;
  /** 收到用户语音转写后，用实际文字替换占位「[语音]」 */
  onUpdateLastUserMessage?: (transcript: string) => void;
  /** WebSocket 连接成功时的回调 */
  onConnected?: () => void;
  disabled?: boolean;
  children: (props: {
    voiceButtons: React.ReactNode;
    systemLogs: React.ReactNode;
  }) => React.ReactNode;
}

export interface AIGuideRealtimeHandle {
  sendContextUpdate: (payload: { meta: any; currentStage: any; uiState: any }) => void;
}

export const AIGuideRealtime = forwardRef<AIGuideRealtimeHandle, AIGuideRealtimeProps>(({
  onAddMessage,
  onUpdateLastUserMessage,
  onConnected,
  disabled,
  children
}, ref) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const outputRef = useRef<string>('');
  const transcriptRef = useRef<string>('');
  const userTranscriptRef = useRef<string>('');
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const appendCountRef = useRef(0);
  const isPlayingRef = useRef(false);
  const onUpdateRef = useRef(onUpdateLastUserMessage);
  const onAddRef = useRef(onAddMessage);
  onUpdateRef.current = onUpdateLastUserMessage;
  onAddRef.current = onAddMessage;

  // 暴露 sendContextUpdate 方法给父组件
  useImperativeHandle(ref, () => ({
    sendContextUpdate: (payload: { meta: any; currentStage: any; uiState: any }) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'edu.context.update',
          payload
        }));
      }
    }
  }), []);

  const addLog = useCallback((msg: string) => {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    setSystemLogs((prev) => [...prev.slice(-99), line]);
  }, []);

  const playNextAudioChunk = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    const b64 = audioQueueRef.current.shift();
    if (!b64) return;
    try {
      const pcm = base64ToArrayBuffer(b64);
      const int16 = new Int16Array(pcm);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
      const ctx = playbackCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (!playbackCtxRef.current) playbackCtxRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume();
      const buf = ctx.createBuffer(1, float32.length, 24000);
      buf.getChannelData(0).set(float32);
      const src = ctx.createBufferSource();
      currentSourceRef.current = src;
      src.buffer = buf;
      src.connect(ctx.destination);
      isPlayingRef.current = true;
      setSpeaking(true);
      src.onended = () => {
        currentSourceRef.current = null;
        isPlayingRef.current = false;
        if (audioQueueRef.current.length > 0) {
          playNextAudioChunk();
        } else {
          setSpeaking(false);
        }
      };
      src.start();
    } catch (e) {
      isPlayingRef.current = false;
      setSpeaking(false);
      if (audioQueueRef.current.length > 0) playNextAudioChunk();
    }
  }, []);

  const stopPlayback = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch {}
      currentSourceRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setSpeaking(false);
    addLog('已停止播放');
  }, [addLog]);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === 1) return;
    setStatus('connecting');
    addLog('正在连接...');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      addLog('需要登录');
      setStatus('error');
      return;
    }
    const url = `${getRealtimeWsBaseUrl()}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      addLog('已连接');
      onConnected?.();
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'response.text.delta' && data.delta) {
          outputRef.current += data.delta;
        } else if (data.type === 'response.audio_transcript.delta' && data.delta) {
          transcriptRef.current += data.delta;
        } else if (data.type === 'response.audio.delta' && data.delta) {
          audioQueueRef.current.push(data.delta);
          playNextAudioChunk();
        } else if (
          data.type === 'response.text.done' ||
          data.type === 'response.audio.done' ||
          data.type === 'response.audio_transcript.done' ||
          data.type === 'response.done'
        ) {
          const done = outputRef.current || transcriptRef.current;
          if (done) {
            onAddRef.current?.('assistant', done);
            addLog(`[完成] ${done.slice(0, 50)}${done.length > 50 ? '...' : ''}`);
          }
          outputRef.current = '';
          transcriptRef.current = '';
        } else if (data.type === 'conversation.item.input_audio_transcription.completed') {
          const t = (data.transcript ?? data.transcript_text ?? userTranscriptRef.current) || '';
          userTranscriptRef.current = '';
          if (t) {
            // 每次完整转写完成都追加一条新的用户消息
            onAddRef.current?.('user', t);
            addLog(`[你说] ${t}`);
          }
        } else if (data.type === 'conversation.item.input_audio_transcription.delta' && data.delta) {
          // 累积 delta，以便在 completed 时作为兜底
          userTranscriptRef.current += data.delta;
        } else if (data.type === 'conversation.item.input_audio_transcription.text' && data.text) {
          // 有的实现用 .text 直接发送完整转写，这里直接追加一条用户消息
          onAddRef.current?.('user', data.text);
          addLog(`[你说] ${data.text}`);
        } else if (data.type === 'conversation.item.created' && data.item?.type === 'message') {
          const content = data.item?.content;
          if (Array.isArray(content)) {
            const textPart = content.find((c: any) => c.type === 'input_audio_transcription' && c.transcript);
            if (textPart?.transcript) {
              onAddRef.current?.('user', textPart.transcript);
              addLog(`[你说] ${textPart.transcript}`);
            }
          }
        } else if (data.type === 'response.input_audio_transcription.completed') {
          const t = data.transcript ?? data.transcript_text ?? '';
          if (t) {
            onAddRef.current?.('user', t);
            addLog(`[你说] ${t}`);
          }
        } else if (data.type === 'error') {
          addLog(`错误: ${data.error?.message || JSON.stringify(data.error)}`);
        } else if (['input_audio_buffer.append', 'input_audio_buffer.commit', 'input_audio_buffer.clear'].includes(data.type)) {
          addLog(data.type);
        } else if (
          (data.type?.includes('transcript') || data.type?.includes('input_audio')) &&
          !data.type?.startsWith('response.')
        ) {
          const t = data.transcript ?? data.transcript_text ?? data.text ?? data.delta;
          if (t && typeof t === 'string') {
            addLog(`${data.type}: ${t.slice(0, 40)}${t.length > 40 ? '...' : ''}`);
            onAddRef.current?.('user', t);
          }
        }
      } catch {}
    };

    ws.onerror = () => {
      setStatus('error');
      addLog('连接错误');
    };

    ws.onclose = (ev) => {
      setStatus(ev.code === 4003 ? 'error' : 'idle');
      addLog(ev.code === 4003 ? (ev.reason || '仅限管理员使用') : '已断开');
      wsRef.current = null;
    };
  }, [addLog, playNextAudioChunk]);

  const disconnect = useCallback(() => {
    stopPlayback();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [stopPlayback]);

  const startRecording = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) {
      addLog('请先连接');
      return;
    }
    try {
      appendCountRef.current = 0;
      userTranscriptRef.current = '';
      ws.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: TARGET_SAMPLE_RATE });
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        let data = new Float32Array(input);
        if (ctx.sampleRate !== TARGET_SAMPLE_RATE) {
          const ratio = ctx.sampleRate / TARGET_SAMPLE_RATE;
          const newLen = Math.floor(input.length / ratio);
          data = new Float32Array(newLen);
          for (let i = 0; i < newLen; i++) data[i] = input[Math.floor(i * ratio)];
        }
        const pcm = float32ToInt16Pcm(data);
        const bytes = new Uint8Array(pcm);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
        }
        const b64 = btoa(binary);
        ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: b64 }));
        appendCountRef.current += 1;
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setRecording(true);
      addLog('🎤 录音中...');
    } catch (err: any) {
      addLog(`麦克风错误: ${err?.message || '无权限'}`);
    }
  }, [addLog]);

  const stopRecording = useCallback(() => {
    const ws = wsRef.current;
    const count = appendCountRef.current;

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) sourceRef.current.disconnect();
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) audioContextRef.current.close();
    setRecording(false);

    if (count >= 3 && ws?.readyState === 1) {
      // 只提交音频缓冲区，用户消息在收到转写事件时追加
      setTimeout(() => {
        if (ws?.readyState === 1) {
          ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          ws.send(JSON.stringify({ type: 'response.create' }));
          addLog('已发送语音');
        }
      }, 150);
    } else if (count < 3) {
      addLog(`录音太短，请说话超过 0.5 秒`);
    }
  }, [addLog]);

  const isConnected = status === 'connected';
  const voiceButtons = (
    <button
      type="button"
      onClick={() => {
        if (!isConnected) {
          // 未连接：点击一次建立连接（建立后可再次点击开始录音）
          connect();
        } else if (recording) {
          // 已连接且正在录音：停止录音并断开
          stopRecording();
          disconnect();
        } else if (speaking) {
          // 仅在播放 AI 语音：停止播放并断开
          stopPlayback();
          disconnect();
        } else {
          // 已连接但未录音：开始新一轮录音
          startRecording();
        }
      }}
      disabled={status === 'connecting' || disabled}
      className={`p-2 rounded-lg transition-colors ${
        !isConnected
          ? 'bg-muted hover:bg-muted/80 text-muted-foreground disabled:opacity-50'
          : recording
            ? 'bg-red-500/20 text-red-600'
            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
      }`}
      title={
        !isConnected
          ? '开始语音对话'
          : recording
            ? '停止语音并断开'
            : speaking
              ? '停止播放并断开'
              : '开始语音对话'
      }
    >
      {recording ? <Square size={16} /> : <Mic size={16} />}
    </button>
  );

  const systemLogsEl = (
    <div className="max-h-20 overflow-y-auto text-xs font-mono bg-muted/50 rounded p-2 space-y-0.5">
      {systemLogs.length === 0 ? (
        <span className="text-muted-foreground">语音状态</span>
      ) : (
        systemLogs.map((l, i) => <div key={i}>{l}</div>)
      )}
    </div>
  );

  return <>{children({ voiceButtons, systemLogs: systemLogsEl })}</>;
});
