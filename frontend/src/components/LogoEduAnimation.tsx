'use client';

import React, { useState, useEffect, useRef } from 'react';

const DRAW_MS = 2200;
const HOLD_MS = 3000;
const UNDRAW_MS = 2200;
const PAUSE_MS = 10_000;
const PAUSE_AFTER_FOURIER_MS = 10_000;
const PAUSE_AFTER_SIGMOID_MS = 10_000;
const FOURIER_MS = 15_000;
const SIGMOID_MS = 15_000;
const EASE = 'cubic-bezier(0.32, 0, 0.22, 1)';
const CHAR_HEIGHT = 22;

const FOURIER_WIDTH = 180;
const FOURIER_HEIGHT = 56;
const FOURIER_N = 5;
const FOURIER_SPEED = 0.03;
const FOURIER_PATH_MAX = 200;

const SIGMOID_WIDTH = 180;
const SIGMOID_HEIGHT = 56;
const SIGMOID_X_MIN = -6;
const SIGMOID_X_MAX = 6;
const SIGMOID_POINTS = 120;

/** 每个字符的单笔画 path（从左到右依次生长），viewBox 内局部坐标，无回溯 */
const LETTER_PATHS: { d: string; w: number }[] = [
  /* E */ { w: 12, d: 'M 0,0 L 10,0 L 10,1 L 1,1 L 1,11 L 8,11 L 8,12 L 1,12 L 1,22 L 10,22' },
  /* d */ { w: 12, d: 'M 2,0 L 2,20 L 2,16 C 2,8 6,2 10,2 C 14,2 16,8 16,14 C 16,20 14,22 10,22 L 2,22' },
  /* u */ { w: 12, d: 'M 0,0 L 0,14 C 0,20 5,22 9,22 C 13,22 16,19 16,14 L 16,0' },
  /* N */ { w: 12, d: 'M 0,22 L 0,0 L 14,22 L 14,0' },
  /* e */ { w: 12, d: 'M 12,11 C 12,4 7,0 2,0 C 0,0 0,5 0,9 L 10,9 L 10,13 L 0,13 C 0,19 5,22 10,22 C 12,22 12,18 12,11' },
  /* s */ { w: 10, d: 'M 8,3 C 5,3 2,6 2,11 C 2,16 5,19 8,19 L 8,16 C 5,16 4,14 4,11 C 4,8 6,6 8,6 L 8,3' },
  /* t */ { w: 10, d: 'M 5,0 L 5,10 L 2,10 L 8,10 L 5,10 L 5,22' },
  /*   */ { w: 5, d: 'M 0,11 L 5,11' },
  /* A */ { w: 12, d: 'M 0,22 L 6,0 L 12,22 L 9,22 L 9,14 L 3,14 L 3,22 L 0,22' },
  /* I */ { w: 8, d: 'M 2,0 L 6,0 L 6,1 L 4,1 L 4,21 L 6,21 L 6,22 L 2,22' },
];

const TOTAL_WIDTH = LETTER_PATHS.reduce((s, p) => s + p.w, 0);
const VIEW_WIDTH = TOTAL_WIDTH + 8;
const VIEW_HEIGHT = CHAR_HEIGHT + 6;

type Phase = 'drawing' | 'hold' | 'undrawing' | 'ready' | 'pause' | 'fourier' | 'sigmoid';

export default function LogoEduAnimation({ className = '' }: { className?: string }) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [offset, setOffset] = useState(1);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fourierRef = useRef<{
    svg: SVGSVGElement | null;
    circlesG: SVGGElement | null;
    connector: SVGLineElement | null;
    wavePath: SVGPathElement | null;
    currentPoint: SVGCircleElement | null;
    axisX: SVGLineElement | null;
  }>({ svg: null, circlesG: null, connector: null, wavePath: null, currentPoint: null, axisX: null });
  const fourierRafRef = useRef<number>(0);
  const fourierStartRef = useRef<number>(0);
  const fourierTimeRef = useRef(0);
  const fourierPathRef = useRef<number[]>([]);

  const sigmoidRef = useRef<{ pointEl: SVGCircleElement | null }>({ pointEl: null });
  const sigmoidRafRef = useRef<number>(0);
  const sigmoidStartRef = useRef<number>(0);

  const n = LETTER_PATHS.length;
  const letterMs = Math.round(DRAW_MS / n);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  const push = (t: ReturnType<typeof setTimeout>) => {
    timersRef.current.push(t);
  };

  const runFourierFrame = () => {
    const r = fourierRef.current;
    if (!r.svg || !r.circlesG || !r.connector || !r.wavePath || !r.currentPoint || !r.axisX) return;

    const w = FOURIER_WIDTH;
    const h = FOURIER_HEIGHT;
    let x = w * 0.25;
    let y = h / 2;

    r.circlesG.innerHTML = '';

    for (let i = 0; i < FOURIER_N; i++) {
      const prevX = x;
      const prevY = y;
      const n = i * 2 + 1;
      const radius = 18 * (4 / (n * Math.PI));

      x += radius * Math.cos(n * fourierTimeRef.current);
      y += radius * Math.sin(n * fourierTimeRef.current);

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(prevX));
      circle.setAttribute('cy', String(prevY));
      circle.setAttribute('r', String(Math.abs(radius)));
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', 'rgba(56, 189, 248, 0.25)');
      r.circlesG.appendChild(circle);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(prevX));
      line.setAttribute('y1', String(prevY));
      line.setAttribute('x2', String(x));
      line.setAttribute('y2', String(y));
      line.setAttribute('stroke', '#38bdf8');
      line.setAttribute('stroke-width', '1.2');
      r.circlesG.appendChild(line);
    }

    fourierPathRef.current.unshift(y);
    if (fourierPathRef.current.length > FOURIER_PATH_MAX) fourierPathRef.current.pop();

    const startX = w * 0.55;
    let waveData = `M ${startX} ${y}`;
    for (let i = 0; i < fourierPathRef.current.length; i++) {
      waveData += ` L ${startX + i} ${fourierPathRef.current[i]}`;
    }
    r.wavePath.setAttribute('d', waveData);

    r.connector.setAttribute('x1', String(x));
    r.connector.setAttribute('y1', String(y));
    r.connector.setAttribute('x2', String(startX));
    r.connector.setAttribute('y2', String(y));

    r.currentPoint.setAttribute('cx', String(x));
    r.currentPoint.setAttribute('cy', String(y));

    r.axisX.setAttribute('x1', '0');
    r.axisX.setAttribute('y1', String(h / 2));
    r.axisX.setAttribute('x2', String(w));
    r.axisX.setAttribute('y2', String(h / 2));

    fourierTimeRef.current -= FOURIER_SPEED;
  };

  const runFourierLoop = () => {
    fourierStartRef.current = Date.now();
    fourierTimeRef.current = 0;
    fourierPathRef.current = [];

    const tick = () => {
      const elapsed = Date.now() - fourierStartRef.current;
      if (elapsed >= FOURIER_MS) {
        setPhase('pause');
        push(setTimeout(() => setPhase('sigmoid'), PAUSE_AFTER_FOURIER_MS));
        return;
      }
      runFourierFrame();
      fourierRafRef.current = requestAnimationFrame(tick);
    };
    fourierRafRef.current = requestAnimationFrame(tick);
  };

  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

  const runSigmoidFrame = () => {
    const r = sigmoidRef.current;
    if (!r.pointEl) return;

    const elapsed = Date.now() - sigmoidStartRef.current;
    const t = (elapsed / SIGMOID_MS) % 1;
    const x = SIGMOID_X_MIN + t * (SIGMOID_X_MAX - SIGMOID_X_MIN);
    const y = sigmoid(x);

    r.pointEl.setAttribute('cx', String(toSx(x)));
    r.pointEl.setAttribute('cy', String(toSy(y)));
  };

  const pad = 10;
  const toSx = (x: number) =>
    pad + ((x - SIGMOID_X_MIN) / (SIGMOID_X_MAX - SIGMOID_X_MIN)) * (SIGMOID_WIDTH - 2 * pad);
  const toSy = (y: number) =>
    SIGMOID_HEIGHT - pad - y * (SIGMOID_HEIGHT - 2 * pad);

  const getSigmoidPathD = () => {
    const step = (SIGMOID_X_MAX - SIGMOID_X_MIN) / (SIGMOID_POINTS - 1);
    let d = '';
    for (let i = 0; i < SIGMOID_POINTS; i++) {
      const x = SIGMOID_X_MIN + i * step;
      const y = sigmoid(x);
      d += i === 0 ? `M ${toSx(x)} ${toSy(y)}` : ` L ${toSx(x)} ${toSy(y)}`;
    }
    return d;
  };

  const runSigmoidLoop = () => {
    sigmoidStartRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - sigmoidStartRef.current;
      if (elapsed >= SIGMOID_MS) {
        setPhase('pause');
        push(setTimeout(() => runCycle(), PAUSE_AFTER_SIGMOID_MS));
        return;
      }
      runSigmoidFrame();
      sigmoidRafRef.current = requestAnimationFrame(tick);
    };
    sigmoidRafRef.current = requestAnimationFrame(tick);
  };

  const runCycle = () => {
    clearTimers();
    setPhase('ready');
    setOffset(1);

    const t0 = setTimeout(() => {
      setPhase('drawing');
      setOffset(0);
      push(setTimeout(() => setPhase('hold'), DRAW_MS));
      const t1 = setTimeout(() => {
        setPhase('undrawing');
        setOffset(1);
        const t2 = setTimeout(() => {
          setPhase('pause');
          push(setTimeout(() => setPhase('fourier'), PAUSE_MS));
        }, UNDRAW_MS);
        push(t2);
      }, DRAW_MS + HOLD_MS);
      push(t1);
    }, 80);
    push(t0);
  };

  useEffect(() => {
    runCycle();
    return () => {
      clearTimers();
      if (fourierRafRef.current) cancelAnimationFrame(fourierRafRef.current);
      if (sigmoidRafRef.current) cancelAnimationFrame(sigmoidRafRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'fourier') return;
    runFourierLoop();
    return () => {
      if (fourierRafRef.current) {
        cancelAnimationFrame(fourierRafRef.current);
        fourierRafRef.current = 0;
      }
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'sigmoid') return;
    runSigmoidLoop();
    return () => {
      if (sigmoidRafRef.current) {
        cancelAnimationFrame(sigmoidRafRef.current);
        sigmoidRafRef.current = 0;
      }
    };
  }, [phase]);

  const durationMs = phase === 'drawing' ? letterMs : phase === 'undrawing' ? letterMs : 300;
  const transition = `stroke-dashoffset ${durationMs}ms ${EASE}`;

  const isFourier = phase === 'fourier';
  const isSigmoid = phase === 'sigmoid';
  const isPause = phase === 'pause';
  const showText = !isFourier && !isSigmoid && !isPause;

  const blockClass = 'h-6 w-[180px] max-w-full mx-auto';

  return (
    <div
      className={`flex items-center justify-center overflow-hidden ${className}`}
      style={{ minHeight: 40 }}
    >
      {showText && (
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className={`${blockClass} text-foreground`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ overflow: 'visible' }}
        >
          <g transform={`translate(4, ${VIEW_HEIGHT - CHAR_HEIGHT - 2})`}>
            {LETTER_PATHS.map(({ d, w }, i) => {
              const drawDelay = phase === 'drawing' ? i * letterMs : 0;
              const undrawDelay = phase === 'undrawing' ? (n - 1 - i) * letterMs : 0;
              const delay = phase === 'drawing' ? drawDelay : phase === 'undrawing' ? undrawDelay : 0;
              const x = LETTER_PATHS.slice(0, i).reduce((s, p) => s + p.w, 0);
              return (
                <g key={i} transform={`translate(${x}, 0)`}>
                  <path
                    d={d}
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={offset}
                    style={{ transition, transitionDelay: `${delay}ms` }}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {isPause && <div className={blockClass} aria-hidden="true" />}

      {isFourier && (
        <svg
          className={blockClass}
          ref={(el) => {
            fourierRef.current.svg = el;
            if (el) {
              fourierRef.current.axisX = el.querySelector('#fourier-axis-x') as SVGLineElement;
              fourierRef.current.circlesG = el.querySelector('#fourier-circles') as SVGGElement;
              fourierRef.current.connector = el.querySelector('#fourier-connector') as SVGLineElement;
              fourierRef.current.wavePath = el.querySelector('#fourier-wave') as SVGPathElement;
              fourierRef.current.currentPoint = el.querySelector('#fourier-point') as SVGCircleElement;
            }
          }}
          viewBox={`0 0 ${FOURIER_WIDTH} ${FOURIER_HEIGHT}`}
          style={{ overflow: 'visible' }}
        >
          <line
            id="fourier-axis-x"
            x1={0}
            y1={FOURIER_HEIGHT / 2}
            x2={FOURIER_WIDTH}
            y2={FOURIER_HEIGHT / 2}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
          <g id="fourier-circles" />
          <line
            id="fourier-connector"
            x1={0}
            y1={0}
            x2={0}
            y2={0}
            stroke="rgba(255,255,255,0.3)"
            strokeDasharray="4"
            strokeWidth="1"
          />
          <path
            id="fourier-wave"
            fill="none"
            stroke="#fb7185"
            strokeWidth="2"
          />
          <circle id="fourier-point" r="3" fill="#fb7185" />
        </svg>
      )}

      {isSigmoid && (
        <svg
          className={blockClass}
          viewBox={`0 0 ${SIGMOID_WIDTH} ${SIGMOID_HEIGHT}`}
          style={{ overflow: 'visible' }}
        >
          <line
            x1={0}
            y1={SIGMOID_HEIGHT / 2}
            x2={SIGMOID_WIDTH}
            y2={SIGMOID_HEIGHT / 2}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
          <line
            x1={toSx(0)}
            y1={0}
            x2={toSx(0)}
            y2={SIGMOID_HEIGHT}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
          <path
            d={getSigmoidPathD()}
            fill="none"
            stroke="#a78bfa"
            strokeWidth="2"
          />
          <circle
            ref={(el) => { sigmoidRef.current.pointEl = el; }}
            r="4"
            fill="#a78bfa"
            cx={toSx(SIGMOID_X_MIN)}
            cy={toSy(sigmoid(SIGMOID_X_MIN))}
          />
        </svg>
      )}
    </div>
  );
}
