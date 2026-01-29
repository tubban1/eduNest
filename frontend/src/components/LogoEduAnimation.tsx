'use client';

import React, { useState, useEffect, useRef } from 'react';

const CYCLE_INTERVAL_MS = 20_000;
const DRAW_MS = 1800;
const HOLD_MS = 800;
const EASE = 'cubic-bezier(0.32, 0, 0.22, 1)';

type Phase =
  | 'logo-draw'
  | 'logo-hold'
  | 'logo-undraw'
  | 'edu-draw'
  | 'edu-hold'
  | 'edu-undraw'
  | 'overlap-to-edu'
  | 'overlap-to-logo';

type StyleKind = 'classic' | 'reverse' | 'overlap';

/** Abstract EDU logo: E + rounded right (U), single stroke (viewBox 0 0 64 64) */
const LOGO_PATH =
  'M12 12 L12 52 L32 52 L32 44 L20 44 L20 28 L28 28 L28 12 L12 12 L36 12 C48 12 54 22 54 34 C54 46 48 52 36 52 L12 52';

/** EDU letters, single continuous stroke (viewBox 0 0 56 24) */
const EDU_PATH =
  'M8 8 L8 18 L14 18 L14 15 L11 15 L11 13 L13 13 L13 8 L8 8 L20 8 L20 18 L26 18 C30 18 32 16 32 13 C32 10 30 8 26 8 L20 8 L36 8 L36 18 L46 18 L46 8';

function scheduleClassic(setPhase: (p: Phase) => void, push: (t: ReturnType<typeof setTimeout>) => void) {
  setPhase('logo-draw');
  push(setTimeout(() => setPhase('logo-hold'), DRAW_MS));
  push(setTimeout(() => setPhase('logo-undraw'), DRAW_MS + HOLD_MS));
  push(setTimeout(() => setPhase('edu-draw'), DRAW_MS + HOLD_MS + DRAW_MS));
  push(setTimeout(() => setPhase('edu-hold'), DRAW_MS + HOLD_MS + DRAW_MS + DRAW_MS));
  push(setTimeout(() => setPhase('edu-undraw'), DRAW_MS + HOLD_MS + DRAW_MS + DRAW_MS + HOLD_MS));
}

function scheduleReverse(setPhase: (p: Phase) => void, push: (t: ReturnType<typeof setTimeout>) => void) {
  setPhase('edu-draw');
  push(setTimeout(() => setPhase('edu-hold'), DRAW_MS));
  push(setTimeout(() => setPhase('edu-undraw'), DRAW_MS + HOLD_MS));
  push(setTimeout(() => setPhase('logo-draw'), DRAW_MS + HOLD_MS + DRAW_MS));
  push(setTimeout(() => setPhase('logo-hold'), DRAW_MS + HOLD_MS + DRAW_MS + DRAW_MS));
  push(setTimeout(() => setPhase('logo-undraw'), DRAW_MS + HOLD_MS + DRAW_MS + DRAW_MS + HOLD_MS));
}

function scheduleOverlap(setPhase: (p: Phase) => void, push: (t: ReturnType<typeof setTimeout>) => void) {
  setPhase('logo-hold');
  push(setTimeout(() => setPhase('overlap-to-edu'), 80));
  push(setTimeout(() => setPhase('edu-hold'), 80 + DRAW_MS));
  push(setTimeout(() => setPhase('overlap-to-logo'), 80 + DRAW_MS + HOLD_MS));
  push(setTimeout(() => setPhase('logo-hold'), 80 + DRAW_MS + HOLD_MS + DRAW_MS));
}

export default function LogoEduAnimation({ className = '' }: { className?: string }) {
  const [styleIndex, setStyleIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('logo-undraw');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const styles: StyleKind[] = ['classic', 'reverse', 'overlap'];
  const kind = styles[styleIndex % 3];

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  const push = (t: ReturnType<typeof setTimeout>) => {
    timersRef.current.push(t);
  };

  const runCycle = () => {
    clearTimers();
    push(setTimeout(() => {
      if (kind === 'classic') scheduleClassic(setPhase, push);
      else if (kind === 'reverse') scheduleReverse(setPhase, push);
      else scheduleOverlap(setPhase, push);
    }, 50));
  };

  useEffect(() => {
    runCycle();
    const id = setInterval(() => {
      setStyleIndex((i) => (i + 1) % 3);
      runCycle();
    }, CYCLE_INTERVAL_MS);
    return () => {
      clearTimers();
      clearInterval(id);
    };
  }, []);

  const logoOffset =
    phase === 'logo-draw' || phase === 'logo-hold' || phase === 'overlap-to-logo' ? 0 : 1;
  const eduOffset =
    phase === 'edu-draw' || phase === 'edu-hold' || phase === 'overlap-to-edu' ? 0 : 1;

  const trans = `${DRAW_MS}ms ${EASE}`;

  return (
    <div
      className={`flex items-center justify-center overflow-hidden ${className}`}
      style={{ minHeight: 48 }}
    >
      <div className="relative w-16 h-12 flex items-center justify-center">
        <svg
          viewBox="0 0 64 64"
          className="absolute w-12 h-12 text-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ overflow: 'visible' }}
        >
          <path
            d={LOGO_PATH}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={logoOffset}
            style={{ transition: `stroke-dashoffset ${trans}` }}
          />
        </svg>
        <svg
          viewBox="0 0 56 24"
          className="absolute w-14 h-6 text-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ overflow: 'visible' }}
        >
          <path
            d={EDU_PATH}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={eduOffset}
            style={{ transition: `stroke-dashoffset ${trans}` }}
          />
        </svg>
      </div>
    </div>
  );
}
