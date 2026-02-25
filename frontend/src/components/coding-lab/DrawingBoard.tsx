'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Tool = 'pen' | 'eraser';

export type DrawingBoardExport = {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
};

export default function DrawingBoard({
  width = 640,
  height = 480,
  onExport,
  disabled,
}: {
  width?: number;
  height?: number;
  disabled?: boolean;
  onExport?: (payload: DrawingBoardExport) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#22c55e');
  const [size, setSize] = useState(10);
  const [bg, setBg] = useState<'white' | 'transparent'>('white');
  const [history, setHistory] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);

  const palette = useMemo(
    () => ['#0ea5e9', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#111827', '#ffffff'],
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctxRef.current = ctx;
    // init background
    if (bg === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
    // first history snapshot
    setHistory([ctx.getImageData(0, 0, width, height)]);
    setRedoStack([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  useEffect(() => {
    // when bg changes, redraw by applying background then drawing pixels from last snapshot
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const snap = history[history.length - 1];
    if (!snap) return;
    if (bg === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(snap, 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(snap, 0, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bg]);

  const getPoint = (e: PointerEvent | React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const applyStroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const pushHistory = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((h) => [...h.slice(-30), snap]); // cap
    setRedoStack([]);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = getPoint(e);
    lastPointRef.current = p;
    applyStroke(p, { x: p.x + 0.01, y: p.y + 0.01 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current || disabled) return;
    const last = lastPointRef.current;
    if (!last) return;
    const p = getPoint(e);
    applyStroke(last, p);
    lastPointRef.current = p;
  };
  const endStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    pushHistory();
  };

  const undo = () => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    setHistory((h) => {
      if (h.length <= 1) return h;
      const next = h.slice(0, -1);
      const last = next[next.length - 1];
      setRedoStack((r) => [h[h.length - 1], ...r].slice(0, 30));
      ctx.putImageData(last, 0, 0);
      return next;
    });
  };

  const redo = () => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const [head, ...rest] = r;
      setHistory((h) => [...h, head].slice(-30));
      ctx.putImageData(head, 0, 0);
      return rest;
    });
  };

  const clear = () => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    if (bg === 'white') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    pushHistory();
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mimeType = 'image/png';
    const dataUrl = canvas.toDataURL(mimeType);
    onExport?.({ dataUrl, mimeType, width: canvas.width, height: canvas.height });
  };

  return (
    <div className="w-full h-full flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            tool === 'pen' ? 'bg-emerald-500/15 border-emerald-500/40' : 'bg-slate-900 border-slate-700'
          }`}
          onClick={() => setTool('pen')}
          disabled={disabled}
        >
          画笔
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            tool === 'eraser' ? 'bg-amber-500/15 border-amber-500/40' : 'bg-slate-900 border-slate-700'
          }`}
          onClick={() => setTool('eraser')}
          disabled={disabled}
        >
          橡皮擦
        </button>

        <div className="flex items-center gap-2 ml-1">
          <span className="text-xs text-slate-400">粗细</span>
          <input
            type="range"
            min={2}
            max={40}
            value={size}
            onChange={(e) => setSize(parseInt(e.target.value, 10))}
            disabled={disabled}
          />
          <span className="text-xs text-slate-400 w-8">{size}</span>
        </div>

        <div className="flex items-center gap-1 ml-1">
          <span className="text-xs text-slate-400 mr-1">颜色</span>
          {palette.map((c) => (
            <button
              key={c}
              type="button"
              className={`w-6 h-6 rounded-full border ${color === c ? 'border-white/80' : 'border-white/10'}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              disabled={disabled}
              title={c}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button type="button" className="px-3 py-1.5 rounded-lg text-sm border border-slate-700" onClick={undo} disabled={disabled || history.length <= 1}>
            撤销
          </button>
          <button type="button" className="px-3 py-1.5 rounded-lg text-sm border border-slate-700" onClick={redo} disabled={disabled || redoStack.length === 0}>
            重做
          </button>
          <button type="button" className="px-3 py-1.5 rounded-lg text-sm border border-slate-700" onClick={clear} disabled={disabled}>
            清空
          </button>
          <select
            className="px-2 py-1.5 rounded-lg text-sm border border-slate-700 bg-slate-950"
            value={bg}
            onChange={(e) => setBg(e.target.value as any)}
            disabled={disabled}
          >
            <option value="white">白底</option>
            <option value="transparent">透明</option>
          </select>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-sm border border-indigo-500/40 bg-indigo-500/15"
            onClick={exportPng}
            disabled={disabled}
          >
            导出 PNG
          </button>
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={endStroke}
        />
      </div>
    </div>
  );
}

