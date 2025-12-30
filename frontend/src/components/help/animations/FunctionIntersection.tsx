'use client';

import React, { useState, useEffect } from 'react';

export default function FunctionIntersection() {
  const [a, setA] = useState(0.5);
  const [k, setK] = useState(1);
  const [b, setB] = useState(0);

  const viewBox = "0 0 600 400";
  const centerX = 300;
  const centerY = 200;
  const scale = 50;

  const reset = () => {
    setA(0.5);
    setK(1);
    setB(0);
  };

  // 计算抛物线路径
  const getParabolaPath = (): string => {
    const points: string[] = [];
    for (let x = -300; x <= 300; x += 2) {
      const screenX = centerX + x;
      const y = a * (x / scale) * (x / scale);
      const screenY = centerY - y * scale;
      points.push(`${screenX},${screenY}`);
    }
    return `M ${points.join(' L ')}`;
  };

  // 计算直线路径
  const getLinePath = (): string => {
    const y1 = k * (-300 / scale) + b;
    const y2 = k * (300 / scale) + b;
    const x1 = 0;
    const x2 = 600;
    return `M ${x1} ${centerY - y1 * scale} L ${x2} ${centerY - y2 * scale}`;
  };

  // 计算交点
  const getIntersections = (): Array<{ x: number; y: number }> => {
    const discriminant = k * k + 4 * a * b;
    const intersections: Array<{ x: number; y: number }> = [];

    if (discriminant >= 0 && Math.abs(a) > 0.01) {
      const sqrtD = Math.sqrt(discriminant);
      const x1 = (k + sqrtD) / (2 * a);
      const x2 = (k - sqrtD) / (2 * a);
      const y1 = a * x1 * x1;
      const y2 = a * x2 * x2;

      [x1, x2].forEach((x, idx) => {
        if (x >= -300 / scale && x <= 300 / scale) {
          const y = idx === 0 ? y1 : y2;
          const screenX = centerX + x * scale;
          const screenY = centerY - y * scale;
          intersections.push({ x: screenX, y: screenY });
        }
      });
    } else if (Math.abs(a) < 0.01) {
      if (Math.abs(k) > 0.01) {
        const x = -b / k;
        const y = k * x + b;
        if (x >= -300 / scale && x <= 300 / scale) {
          const screenX = centerX + x * scale;
          const screenY = centerY - y * scale;
          intersections.push({ x: screenX, y: screenY });
        }
      }
    }

    return intersections;
  };

  const intersections = getIntersections();

  return (
    <div className="w-full max-w-2xl mx-auto bg-white p-4 rounded-lg border-2 border-purple-500">
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto border border-purple-500 rounded"
        style={{ touchAction: 'manipulation' }}
      >
        {/* 坐标轴 */}
        <line x1="0" y1={centerY} x2="600" y2={centerY} stroke="#ccc" strokeWidth="1" />
        <line x1={centerX} y1="0" x2={centerX} y2="400" stroke="#ccc" strokeWidth="1" />

        {/* 抛物线 y = ax² */}
        <path
          d={getParabolaPath()}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
        />
        <text x="10" y="20" fontSize="12" fill="#3b82f6">y = ax²</text>

        {/* 直线 y = kx + b */}
        <path
          d={getLinePath()}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
        />
        <text x="10" y="40" fontSize="12" fill="#ef4444">y = kx + b</text>

        {/* 交点 */}
        {intersections.map((point, idx) => (
          <g key={idx}>
            <circle cx={point.x} cy={point.y} r="6" fill="#10b981" />
            <circle cx={point.x} cy={point.y} r="3" fill="#fff" />
          </g>
        ))}
      </svg>

      {/* 控制滑块 */}
      <div className="flex flex-col items-center gap-3 mt-4">
        <div className="flex items-center justify-center gap-3 w-full max-w-md">
          <label className="w-8 text-center text-sm text-gray-600">a:</label>
          <input
            type="range"
            min="-2"
            max="2"
            step="0.1"
            value={a}
            onChange={(e) => setA(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer touch-manipulation"
            style={{ minHeight: '44px' }}
          />
          <span className="w-12 text-left text-sm text-gray-600">{a.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-center gap-3 w-full max-w-md">
          <label className="w-8 text-center text-sm text-gray-600">k:</label>
          <input
            type="range"
            min="-2"
            max="2"
            step="0.1"
            value={k}
            onChange={(e) => setK(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer touch-manipulation"
            style={{ minHeight: '44px' }}
          />
          <span className="w-12 text-left text-sm text-gray-600">{k.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-center gap-3 w-full max-w-md">
          <label className="w-8 text-center text-sm text-gray-600">b:</label>
          <input
            type="range"
            min="-3"
            max="3"
            step="0.1"
            value={b}
            onChange={(e) => setB(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer touch-manipulation"
            style={{ minHeight: '44px' }}
          />
          <span className="w-12 text-left text-sm text-gray-600">{b.toFixed(1)}</span>
        </div>
        <button
          onClick={reset}
          className="w-12 h-12 p-0 bg-purple-500 text-white rounded border-none cursor-pointer flex items-center justify-center hover:bg-purple-600 active:bg-purple-700 transition-colors touch-manipulation"
          style={{ minWidth: '44px', minHeight: '44px' }}
          title="Reset"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
      </div>
    </div>
  );
}

