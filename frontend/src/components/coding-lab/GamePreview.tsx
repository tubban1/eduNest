'use client';

import { useEffect, useRef, useState } from 'react';
import type { RulesJson } from '@/types/codingGame';

interface GamePreviewProps {
  rules: RulesJson | null;
  characterImageUrl?: string | null;
  onEngineEvent?: (evt: {
    tMs: number;
    triggeredRuleText?: string | null;
    vars: Record<string, number | boolean>;
    varChanges?: Array<{ name: string; from: number | boolean; to: number | boolean }>;
    status?: 'trigger' | 'hit' | 'win' | 'gameOver';
  }) => void;
}

type PlayerState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  onGround: boolean;
};

type Obstacle = {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'monster' | 'hole' | 'gem';
};

type EngineState = {
  vars: Record<string, number | boolean>;
  lastTriggered: string[];
  gameOver: boolean;
};

type DebugEntry = {
  id: number;
  text: string;
};

export default function GamePreview({ rules, characterImageUrl, onEngineEvent }: GamePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = useState(false);
  const [statusText, setStatusText] = useState<string>('按下「开始运行」来预览小游戏。');
  const playerRef = useRef<PlayerState | null>(null);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const lastTimeRef = useRef<number | null>(null);
  const animRef = useRef<number | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const imgRef = useRef<HTMLImageElement | null>(null);
  const engineStateRef = useRef<EngineState | null>(null);
  const [debugLog, setDebugLog] = useState<DebugEntry[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const prevVarsRef = useRef<Record<string, number | boolean> | null>(null);

  // 简单地根据 rules 中是否有 jump 命令，决定是否允许跳跃
  const jumpCommand = rules?.commands?.find((c) => c.name === 'jump');
  const moveCommand = rules?.commands?.find((c) => c.name === 'move');
  const canJump = !!jumpCommand;

  useEffect(() => {
    if (!characterImageUrl) return;
    const img = new Image();
    img.src = characterImageUrl;
    img.onload = () => {
      imgRef.current = img;
    };
  }, [characterImageUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const resetWorld = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const groundY = canvas.height - 40;
    playerRef.current = {
      x: 80,
      y: groundY - 64,
      vx: 0,
      vy: 0,
      width: 48,
      height: 64,
      onGround: true,
    };
    obstaclesRef.current = [
      { x: 380, y: groundY - 40, width: 40, height: 40, kind: 'monster' },
      { x: 620, y: groundY - 30, width: 30, height: 30, kind: 'gem' },
    ];
    const initialVars: EngineState['vars'] = {};
    (rules?.variables || []).forEach((v) => {
      initialVars[v.name] = v.initial;
    });
    if (initialVars.score === undefined) initialVars.score = 0;
    if (initialVars.health === undefined) initialVars.health = 3;
    engineStateRef.current = {
      vars: initialVars,
      lastTriggered: [],
      gameOver: false,
    };
    startTimeRef.current = null;
    prevVarsRef.current = null;
    lastTimeRef.current = null;
    setStatusText('角色会自动向右跑，按空格跳跃（如果规则中存在 jump 命令）。碰到怪物会扣血，吃到宝石会加分。');
    setDebugLog([]);
  };

  const start = () => {
    if (running) return;
    resetWorld();
    setRunning(true);
  };

  const stop = (text?: string) => {
    setRunning(false);
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (text) setStatusText(text);
  };

  const step = (timestamp: number) => {
    const canvas = canvasRef.current;
    const player = playerRef.current;
    const engineState = engineStateRef.current;
    if (!canvas || !player || !engineState) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dt = lastTimeRef.current == null ? 0 : (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;
    if (startTimeRef.current == null) startTimeRef.current = timestamp;

    const groundY = canvas.height - 40;
    const gravity = 1200;

    const baseMove = typeof moveCommand?.params?.speed === 'number'
      ? moveCommand!.params!.speed
      : 1;
    const baseJump = typeof jumpCommand?.params?.height === 'number'
      ? jumpCommand!.params!.height
      : 1;
    const moveSpeed = 140 + baseMove * 80;
    const jumpSpeed = -(400 + baseJump * 120);

    // 输入
    const keys = keysRef.current;
    if (keys.has('ArrowRight')) {
      player.vx = moveSpeed;
    } else if (keys.has('ArrowLeft')) {
      player.vx = -moveSpeed / 2;
    } else {
      player.vx = moveSpeed * 0.7; // 自动向右跑
    }

    if (keys.has('Space') && player.onGround && canJump) {
      player.vy = jumpSpeed;
      player.onGround = false;
    }

    // 物理更新
    player.vy += gravity * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // 地面碰撞
    if (player.y + player.height >= groundY) {
      player.y = groundY - player.height;
      player.vy = 0;
      player.onGround = true;
    }

    // 障碍物碰撞 + 根据 rules_json 条件解释逻辑
    let hit = false;
    const triggered: string[] = [];
    const vars = engineState.vars;

    const applyThen = (thenArr: string[] | undefined | null) => {
      (thenArr || []).forEach((expr) => {
        const s = String(expr).trim();
        if (!s) return;
        if (s === 'gameOver()') {
          engineState.gameOver = true;
          return;
        }
        // 仅支持类似 "name += 1" / "name -= 1"
        const incMatch = s.match(/^([a-zA-Z_][\w]*)\s*\+=\s*(-?\d+(\.\d+)?)$/);
        const decMatch = s.match(/^([a-zA-Z_][\w]*)\s*-\=\s*(-?\d+(\.\d+)?)$/);
        const subMatch = s.match(/^([a-zA-Z_][\w]*)\s*-\=\s*(-?\d+(\.\d+)?)$/);
        if (incMatch) {
          const name = incMatch[1];
          const delta = Number(incMatch[2]);
          const cur = typeof vars[name] === 'number' ? (vars[name] as number) : 0;
          vars[name] = cur + delta;
        } else if (subMatch || decMatch) {
          const m = subMatch || decMatch;
          const name = m![1];
          const delta = Number(m![2]);
          const cur = typeof vars[name] === 'number' ? (vars[name] as number) : 0;
          vars[name] = cur - delta;
        }
      });
    };

    for (const o of obstaclesRef.current) {
      const overlapX =
        player.x < o.x + o.width && player.x + player.width > o.x;
      const overlapY =
        player.y < o.y + o.height && player.y + player.height > o.y;
      if (overlapX && overlapY) {
        if (o.kind === 'monster') {
          hit = true;
        }
        // 解释条件规则 if/then
        (rules?.conditions || []).forEach((cond) => {
          const ifExpr = cond.if.trim();
          if (ifExpr === 'touch(monster)' && o.kind === 'monster') {
            triggered.push(cond.description || cond.id);
            applyThen(cond.then);
          }
          if (ifExpr === 'touch(gem)' && o.kind === 'gem') {
            triggered.push(cond.description || cond.id);
            applyThen(cond.then);
          }
          if (ifExpr === 'fallInto(hole)' && o.kind === 'hole') {
            triggered.push(cond.description || cond.id);
            applyThen(cond.then);
          }
        });

        // 简单宝石拾取：碰到一次就移除这个障碍
        if (o.kind === 'gem') {
          obstaclesRef.current = obstaclesRef.current.filter((x) => x !== o);
        }
      }
    }

    engineState.lastTriggered = triggered;

    // 胜利条件：跑到画面右侧
    const win = player.x > canvas.width - 80;
    const tMs = Math.max(0, timestamp - (startTimeRef.current ?? timestamp));

    // 渲染
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 背景
    const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grd.addColorStop(0, '#020617');
    grd.addColorStop(1, '#0f172a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 地面
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(0, groundY, canvas.width, 40);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, groundY, canvas.width, 6);

    // 障碍物
    ctx.fillStyle = '#f97316';
    obstaclesRef.current.forEach((o) => {
      ctx.fillRect(o.x, o.y, o.width, o.height);
    });

    // 角色
    if (imgRef.current) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        imgRef.current,
        player.x,
        player.y,
        player.width,
        player.height
      );
      ctx.restore();
    } else {
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(player.x, player.y, player.width, player.height);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(player.x + 10, player.y + 18, 10, 10);
    }

    // UI 文本
    ctx.fillStyle = 'rgba(15,23,42,0.8)';
    ctx.fillRect(10, 10, 320, 60);
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('← → 控制速度，Space 跳跃（若规则中存在 jump）', 18, 26);
    ctx.fillText(
      `score=${vars.score ?? 0}  health=${vars.health ?? 0}  gem=${vars.gemCount ?? 0}`,
      18,
      40
    );
    if (engineState.lastTriggered.length > 0) {
      ctx.fillText(
        `触发规则：${engineState.lastTriggered[0]}`,
        18,
        54
      );
    } else {
      ctx.fillText(
        hit ? '状态：撞到障碍物啦！' : win ? '状态：冲过终点，胜利！' : '状态：奔跑中…',
        18,
        54
      );
    }

    // 变量变化检测（用于时间线/高亮）
    const prevVars = prevVarsRef.current;
    const varChanges: Array<{ name: string; from: number | boolean; to: number | boolean }> = [];
    if (prevVars) {
      for (const [k, v] of Object.entries(vars)) {
        if (prevVars[k] !== v) {
          varChanges.push({ name: k, from: prevVars[k], to: v });
        }
      }
    }
    prevVarsRef.current = { ...vars };

    const status: 'trigger' | 'hit' | 'win' | 'gameOver' | null =
      engineState.gameOver ? 'gameOver' : hit ? 'hit' : win ? 'win' : triggered.length > 0 ? 'trigger' : null;

    // 调试日志：只在有事件发生时记录一条
    if (status) {
      const summary = `score=${vars.score ?? 0}, health=${vars.health ?? 0}, gem=${vars.gemCount ?? 0}`;
      const rulePart =
        triggered.length > 0
          ? `规则：「${engineState.lastTriggered[0]}」`
          : hit
          ? '事件：撞到怪物'
          : win
          ? '事件：到达终点'
          : engineState.gameOver
          ? '事件：gameOver()'
          : '';
      const text = `${rulePart} ｜ ${summary}`;
      setDebugLog((prev) => {
        const next = [{ id: Date.now(), text }, ...prev];
        return next.slice(0, 10);
      });

      onEngineEvent?.({
        tMs,
        triggeredRuleText: triggered.length > 0 ? engineState.lastTriggered[0] : null,
        vars: { ...vars },
        varChanges: varChanges.length > 0 ? varChanges : undefined,
        status,
      });
    }

    if (engineState.gameOver || hit) {
      stop('你撞到了怪物或掉进陷阱，可以调整规则或重新开始。');
      return;
    }
    if (win) {
      stop('太棒了！你跑到了终点，可以尝试让关卡更难一点。');
      return;
    }

    if (running) {
      animRef.current = requestAnimationFrame(step);
    }
  };

  useEffect(() => {
    if (!running) return;
    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return (
    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-slate-100">运行预览（Runner 引擎 MVP）</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={start}
            className="px-2.5 py-1.5 rounded-lg text-xs border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/20 transition disabled:opacity-50"
          >
            {running ? '重新开始' : '开始运行'}
          </button>
          <button
            type="button"
            onClick={() => stop('已暂停运行，可以调整规则后再试一次。')}
            className="px-2.5 py-1.5 rounded-lg text-xs border border-slate-700 bg-slate-900/80 hover:bg-slate-900 transition disabled:opacity-50"
            disabled={!running}
          >
            暂停
          </button>
        </div>
      </div>
      <div className="text-[11px] text-slate-400">{statusText}</div>
      <div className="rounded-lg border border-slate-800 bg-black/80 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={640}
          height={240}
          className="w-full block"
        />
      </div>
      {debugLog.length > 0 && (
        <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/80 max-h-28 overflow-y-auto">
          <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] text-slate-400">
            调试日志（最近触发的规则与变量）
          </div>
          <ul className="px-3 py-1.5 space-y-0.5 text-[11px] text-slate-300">
            {debugLog.map((entry) => (
              <li key={entry.id} className="truncate">
                • {entry.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

