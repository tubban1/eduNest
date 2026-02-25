'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

type Mode = 'webspeech' | 'upload';

function dataUrlToBase64(dataUrl: string) {
  // 兼容如 audio/webm;codecs=opus 等带参数的 mimeType
  const m = dataUrl.match(/^data:([^,]+);base64,(.+)$/);
  if (!m) return null;
  return { mimeType: m[1], base64: m[2] };
}

export default function VoiceInput({
  disabled,
  onFinalText,
}: {
  disabled?: boolean;
  onFinalText: (text: string) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>('upload');
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const recRef = useRef<any | null>(null);
  const speechClassRef = useRef<any | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition || null;
    speechClassRef.current = SR;
    if (SR) {
      setMode('webspeech');
    } else {
      setMode('upload');
    }
  }, []);

  useEffect(() => {
    return () => {
      try {
        if (recRef.current) {
          recRef.current.onresult = null;
          recRef.current.onerror = null;
          recRef.current.onend = null;
          recRef.current.stop?.();
        }
      } catch (_) {}
      try {
        mediaRecorderRef.current?.stop();
      } catch (_) {}
      try {
        streamRef.current?.getTracks()?.forEach((t) => t.stop());
      } catch (_) {}
    };
  }, []);

  const startWebSpeech = async () => {
    setError(null);
    setPartial('');
    if (!speechClassRef.current) {
      setMode('upload');
      throw new Error('当前浏览器不支持语音识别，将改用录音上传模式');
    }
    const rec = new speechClassRef.current();
    recRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'zh-CN';

    rec.onresult = async (event: any) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const txt = res?.[0]?.transcript || '';
        if (res.isFinal) finalText += txt;
        else interim += txt;
      }
      if (interim) setPartial(interim);
      if (finalText && finalText.trim()) {
        setPartial('');
        await onFinalText(finalText.trim());
      }
    };
    rec.onerror = (e: any) => {
      const msg = e?.error ? String(e.error) : '语音识别失败';
      setError(`语音识别错误：${msg}`);
    };
    rec.onend = () => {
      setListening(false);
    };

    rec.start();
    setListening(true);
  };

  const stopWebSpeech = () => {
    try {
      recRef.current?.stop?.();
    } catch (_) {}
    setListening(false);
  };

  const startRecord = async () => {
    setError(null);
    setPartial('');
    setUploading(false);
    chunksRef.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mimeCandidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onerror = (e: any) => {
      setError(`录音失败：${e?.message || '未知错误'}`);
    };
    mr.onstop = async () => {
      try {
        setUploading(true);
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        // 确保 dataUrl 中的 mimeType 不受 codecs 参数影响（便于解析）
        const mimeForUrl = (blob.type || 'audio/webm').split(';')[0] || 'audio/webm';
        const dataUrl = `data:${mimeForUrl};base64,${base64}`;
        const parsed = dataUrlToBase64(dataUrl);
        if (!parsed) throw new Error('音频编码失败');
        const res = await api.post('/coding-game/voice/asr', {
          audio: { data: parsed.base64, mimeType: parsed.mimeType },
          language: 'zh-CN',
        });
        const text = (res as any)?.data?.text || (res as any)?.data?.transcript;
        if (text && String(text).trim()) {
          await onFinalText(String(text).trim());
        } else {
          setError('没有识别到内容，可以再说一遍');
        }
      } catch (e: any) {
        setError(e?.message || '转写失败');
      } finally {
        setUploading(false);
        try {
          streamRef.current?.getTracks()?.forEach((t) => t.stop());
          streamRef.current = null;
        } catch (_) {}
      }
    };
    mr.start();
    setListening(true);
  };

  const stopRecord = async () => {
    setListening(false);
    try {
      mediaRecorderRef.current?.stop();
    } catch (_) {}
  };

  const toggle = async () => {
    if (disabled || uploading) return;
    if (listening) {
      if (mode === 'webspeech') stopWebSpeech();
      else await stopRecord();
      return;
    }
    if (mode === 'webspeech') {
      await startWebSpeech();
    } else {
      await startRecord();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-slate-400">
          语音输入：{mode === 'webspeech' ? '浏览器识别' : '录音上传'}（尽量不打字）
        </div>
        <button
          type="button"
          className="text-[11px] px-2 py-1 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-900"
          onClick={() => {
            if (listening) return;
            setMode((m) =>
              m === 'webspeech'
                ? 'upload'
                : speechClassRef.current
                ? 'webspeech'
                : 'upload'
            );
          }}
          disabled={disabled || listening}
          title="切换识别方式"
        >
          切换
        </button>
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={disabled || uploading}
        className={`w-full py-3 rounded-xl border text-sm font-medium transition-colors ${
          listening
            ? 'border-rose-500/50 bg-rose-500/15'
            : 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15'
        } disabled:opacity-50`}
      >
        {uploading ? '转写中…' : listening ? '松开结束 / 再点停止' : '按住说话 / 点击开始'}
      </button>

      {partial && (
        <div className="text-xs text-slate-300 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">实时字幕</div>
          <div className="whitespace-pre-wrap">{partial}</div>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-300 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-2">
          {error}
        </div>
      )}
    </div>
  );
}

