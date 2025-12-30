'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Bisector {
  start: Point;
  end: Point;
  edgePoints: Point[];
  bisectorPoint: Point;
  edgeArcs: Array<{
    center: Point;
    radius: number;
    startAngle: number;
    endAngle: number;
  }>;
  intersectionArcs: Array<{
    center: Point;
    radius: number;
  }>;
}

export default function IncenterAnimation() {
  const [step, setStep] = useState(0);
  const [triangle, setTriangle] = useState<{ A: Point; B: Point; C: Point } | null>(null);
  const [bisectors, setBisectors] = useState<Bisector[]>([]);
  const [incenter, setIncenter] = useState<Point | null>(null);
  const [incircle, setIncircle] = useState<{ center: Point; radius: number } | null>(null);
  const [animatingBisector, setAnimatingBisector] = useState<number | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [incircleRadius, setIncircleRadius] = useState(0);
  const [incircleProgress, setIncircleProgress] = useState(0);
  const animationRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const viewBox = "0 0 600 400";
  const centerX = 300;
  const centerY = 200;

  useEffect(() => {
    initTriangle();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const initTriangle = () => {
    // 立即清除所有动画和定时器
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // 立即重置所有状态
    setTriangle({ A: { x: 150, y: 300 }, B: { x: 450, y: 300 }, C: { x: 300, y: 100 } });
    setBisectors([]);
    setIncenter(null);
    setIncircle(null);
    setStep(0);
    setAnimatingBisector(null);
    setAnimationProgress(0);
    setIncircleRadius(0);
    setIncircleProgress(0);
  };

  const distanceToLine = (point: Point, lineStart: Point, lineEnd: Point): number => {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) { xx = lineStart.x; yy = lineStart.y; }
    else if (param > 1) { xx = lineEnd.x; yy = lineEnd.y; }
    else { xx = lineStart.x + param * C; yy = lineStart.y + param * D; }
    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const step1_DrawBisectors = () => {
    if (step >= 1 || !triangle) return;
    
    const angles = [
      { vertex: triangle.A, edge1: triangle.B, edge2: triangle.C },
      { vertex: triangle.B, edge1: triangle.C, edge2: triangle.A },
      { vertex: triangle.C, edge1: triangle.A, edge2: triangle.B }
    ];

    const radius = 60;
    const newBisectors: Bisector[] = [];

    angles.forEach((angle) => {
      const dir1 = Math.atan2(angle.edge1.y - angle.vertex.y, angle.edge1.x - angle.vertex.x);
      const dir2 = Math.atan2(angle.edge2.y - angle.vertex.y, angle.edge2.x - angle.vertex.x);
      const dist1 = Math.sqrt((angle.edge1.x - angle.vertex.x) ** 2 + (angle.edge1.y - angle.vertex.y) ** 2);
      const dist2 = Math.sqrt((angle.edge2.x - angle.vertex.x) ** 2 + (angle.edge2.y - angle.vertex.y) ** 2);
      
      const point1 = {
        x: angle.vertex.x + Math.cos(dir1) * Math.min(radius, dist1 * 0.3),
        y: angle.vertex.y + Math.sin(dir1) * Math.min(radius, dist1 * 0.3)
      };
      const point2 = {
        x: angle.vertex.x + Math.cos(dir2) * Math.min(radius, dist2 * 0.3),
        y: angle.vertex.y + Math.sin(dir2) * Math.min(radius, dist2 * 0.3)
      };

      const d = Math.sqrt((point2.x - point1.x) ** 2 + (point2.y - point1.y) ** 2);
      const r1 = radius * 0.8;
      const r2 = radius * 0.8;
      const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
      const h = Math.sqrt(r1 * r1 - a * a);
      const midX = point1.x + a * (point2.x - point1.x) / d;
      const midY = point1.y + a * (point2.y - point1.y) / d;
      const bisectorPoint = {
        x: midX + h * (point2.y - point1.y) / d,
        y: midY - h * (point2.x - point1.x) / d
      };

      const bisectorDir = Math.atan2(bisectorPoint.y - angle.vertex.y, bisectorPoint.x - angle.vertex.x);
      const bisectorEnd = {
        x: angle.vertex.x + Math.cos(bisectorDir) * 200,
        y: angle.vertex.y + Math.sin(bisectorDir) * 200
      };

      newBisectors.push({
        start: angle.vertex,
        end: bisectorEnd,
        edgePoints: [point1, point2],
        bisectorPoint: bisectorPoint,
        edgeArcs: [
          {
            center: angle.vertex,
            radius: radius,
            startAngle: dir1,
            endAngle: dir2
          },
          {
            center: angle.vertex,
            radius: radius,
            startAngle: dir2,
            endAngle: dir1
          }
        ],
        intersectionArcs: [
          {
            center: point1,
            radius: r1
          },
          {
            center: point2,
            radius: r2
          }
        ]
      });
    });

    setBisectors(newBisectors);

    let currentBisectorIndex = 0;
    
    const animateBisector = () => {
      if (currentBisectorIndex >= newBisectors.length) {
        if (newBisectors.length >= 2) {
          const line1 = newBisectors[0];
          const line2 = newBisectors[1];
          const x1 = line1.start.x, y1 = line1.start.y;
          const x2 = line1.end.x, y2 = line1.end.y;
          const x3 = line2.start.x, y3 = line2.start.y;
          const x4 = line2.end.x, y4 = line2.end.y;

          const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
          if (Math.abs(denom) > 0.001) {
            const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
            setIncenter({ x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) });
          }
        }
        setStep(1);
        setAnimatingBisector(null);
        setAnimationProgress(0);
        // 角平分线动画完成后，延迟1秒后自动进入画内切圆步骤
        timeoutRef.current = setTimeout(() => {
          step2_DrawIncircle();
        }, 1000);
        return;
      }

      setAnimatingBisector(currentBisectorIndex);
      setAnimationProgress(0);

      const animate = () => {
        setAnimationProgress(prev => {
          // 进一步减慢动画速度，让圆规效果更明显
          const newProgress = prev + 0.00005;
          if (newProgress >= 1) {
            currentBisectorIndex++;
            // 增加每个角平分线之间的暂停时间
            timeoutRef.current = setTimeout(() => animateBisector(), 1200);
            return 1;
          } else {
            animationRef.current = requestAnimationFrame(animate);
            return newProgress;
          }
        });
      };
      animate();
    };

    animateBisector();
  };

  const step2_DrawIncircle = () => {
    if (step < 1 || !incenter || !triangle) return;
    
    const distToAB = distanceToLine(incenter, triangle.A, triangle.B);
    const distToBC = distanceToLine(incenter, triangle.B, triangle.C);
    const distToCA = distanceToLine(incenter, triangle.C, triangle.A);
    const radius = Math.min(distToAB, distToBC, distToCA);

    setIncircle({ center: incenter, radius: radius });
    setIncircleRadius(0);
    setIncircleProgress(0);

    const animate = () => {
      setIncircleProgress(prev => {
        if (prev < 1) {
          // 减慢内切圆动画速度，让圆规效果更丝滑
          const newProgress = prev + 0.002;
          animationRef.current = requestAnimationFrame(animate);
          return Math.min(1, newProgress);
        } else {
          // 动画完成后，延迟2秒后自动reset
          timeoutRef.current = setTimeout(() => {
            reset();
          }, 2000);
          return 1;
        }
      });
    };
    animate();

    setStep(2);
  };

  const reset = () => {
    // 立即清除所有动画和定时器
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // 立即重置所有状态
    initTriangle();
  };

  // SVG 路径辅助函数 - 支持完整圆和部分弧
  const arcPath = (center: Point, radius: number, startAngle: number, endAngle: number, progress: number = 1): string => {
    // 检查是否是完整圆（2π角度范围）
    const isFullCircle = Math.abs(endAngle - startAngle - 2 * Math.PI) < 0.001 || 
                        (startAngle === 0 && Math.abs(endAngle - 2 * Math.PI) < 0.001);
    
    if (isFullCircle) {
      // 完整圆：使用两个半圆弧来绘制
      const actualEndAngle = startAngle + 2 * Math.PI * progress;
      if (progress >= 1) {
        // 完整圆：使用两个半圆弧
        const midAngle = startAngle + Math.PI;
        const startX = center.x + radius * Math.cos(startAngle);
        const startY = center.y + radius * Math.sin(startAngle);
        const midX = center.x + radius * Math.cos(midAngle);
        const midY = center.y + radius * Math.sin(midAngle);
        const endX = center.x + radius * Math.cos(startAngle + 2 * Math.PI);
        const endY = center.y + radius * Math.sin(startAngle + 2 * Math.PI);
        return `M ${startX} ${startY} A ${radius} ${radius} 0 1 1 ${midX} ${midY} A ${radius} ${radius} 0 1 1 ${endX} ${endY}`;
      } else {
        // 部分圆：根据progress绘制
        if (progress <= 0.5) {
          // 前半部分
          const endX = center.x + radius * Math.cos(actualEndAngle);
          const endY = center.y + radius * Math.sin(actualEndAngle);
          const startX = center.x + radius * Math.cos(startAngle);
          const startY = center.y + radius * Math.sin(startAngle);
          return `M ${startX} ${startY} A ${radius} ${radius} 0 ${progress > 0.25 ? 1 : 0} 1 ${endX} ${endY}`;
        } else {
          // 超过一半，需要两个弧
          const midAngle = startAngle + Math.PI;
          const startX = center.x + radius * Math.cos(startAngle);
          const startY = center.y + radius * Math.sin(startAngle);
          const midX = center.x + radius * Math.cos(midAngle);
          const midY = center.y + radius * Math.sin(midAngle);
          const endX = center.x + radius * Math.cos(actualEndAngle);
          const endY = center.y + radius * Math.sin(actualEndAngle);
          return `M ${startX} ${startY} A ${radius} ${radius} 0 1 1 ${midX} ${midY} A ${radius} ${radius} 0 ${progress > 0.75 ? 1 : 0} 1 ${endX} ${endY}`;
        }
      }
    } else {
      // 部分弧：处理角度范围（可能跨越 0 度）
      let angleRange = endAngle - startAngle;
      // 标准化角度范围到 [-π, π]
      if (angleRange > Math.PI) angleRange -= 2 * Math.PI;
      if (angleRange < -Math.PI) angleRange += 2 * Math.PI;
      
      const start = startAngle;
      const end = startAngle + angleRange * progress;
      const startX = center.x + radius * Math.cos(start);
      const startY = center.y + radius * Math.sin(start);
      const endX = center.x + radius * Math.cos(end);
      const endY = center.y + radius * Math.sin(end);
      const largeArc = Math.abs(angleRange * progress) > Math.PI ? 1 : 0;
      const sweepFlag = angleRange > 0 ? 1 : 0;
      return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${endX} ${endY}`;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white p-4 rounded-lg border-2 border-blue-500">
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto border border-blue-500 rounded"
        style={{ touchAction: 'manipulation' }}
      >
        {/* 三角形 */}
        {triangle && (
          <g>
            <path
              d={`M ${triangle.A.x} ${triangle.A.y} L ${triangle.B.x} ${triangle.B.y} L ${triangle.C.x} ${triangle.C.y} Z`}
              fill="none"
              stroke="#1e40af"
              strokeWidth="2"
            />
            <text x={triangle.A.x - 10} y={triangle.A.y + 20} fontSize="12" fill="#1e40af">A</text>
            <text x={triangle.B.x + 5} y={triangle.B.y + 20} fontSize="12" fill="#1e40af">B</text>
            <text x={triangle.C.x - 5} y={triangle.C.y - 10} fontSize="12" fill="#1e40af">C</text>
          </g>
        )}

        {/* 角平分线动画 */}
        {bisectors.map((bisector, idx) => {
          const isAnimating = animatingBisector === idx;
          const progress = isAnimating ? animationProgress : 1;

          return (
            <g key={idx} opacity={progress > 0.1 ? 1 : 0}>
              {/* 边上的圆规弧 - 丝滑的圆规效果 */}
              {progress >= 0.1 && bisector.edgeArcs.map((arc, arcIdx) => {
                const arcProgress = Math.min(1, (progress - 0.1) / 0.3);
                return (
                  <path
                    key={arcIdx}
                    d={arcPath(arc.center, arc.radius, arc.startAngle, arc.endAngle, arcProgress)}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={Math.min(1, arcProgress * 1.2)}
                  />
                );
              })}

              {/* 边交点 */}
              {progress >= 0.35 && bisector.edgePoints.map((point, pointIdx) => {
                const pointProgress = Math.min(1, (progress - 0.35) / 0.15);
                return (
                  <circle
                    key={pointIdx}
                    cx={point.x}
                    cy={point.y}
                    r={4 * pointProgress}
                    fill="#f59e0b"
                    opacity={pointProgress}
                  />
                );
              })}

              {/* 从边交点画的弧 - 丝滑的圆规效果 */}
              {progress >= 0.5 && bisector.intersectionArcs.map((arc, arcIdx) => {
                const arcProgress = Math.min(1, (progress - 0.5) / 0.3);
                // 绘制完整的圆，体现圆规效果
                return (
                  <path
                    key={arcIdx}
                    d={arcPath(arc.center, arc.radius, 0, 2 * Math.PI, arcProgress)}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="3 3"
                    opacity={arcProgress}
                  />
                );
              })}

              {/* 角平分线上的点 */}
              {progress >= 0.7 && (
                <circle
                  cx={bisector.bisectorPoint.x}
                  cy={bisector.bisectorPoint.y}
                  r={4 * Math.min(1, (progress - 0.7) / 0.1)}
                  fill="#ef4444"
                  opacity={Math.min(1, (progress - 0.7) / 0.1)}
                />
              )}

              {/* 角平分线 */}
              {progress >= 0.8 && bisector.start && bisector.end && (
                <line
                  x1={bisector.start.x}
                  y1={bisector.start.y}
                  x2={
                    isAnimating && progress < 1
                      ? bisector.start.x + (bisector.end.x - bisector.start.x) * Math.min(1, (progress - 0.8) / 0.2)
                      : bisector.end.x
                  }
                  y2={
                    isAnimating && progress < 1
                      ? bisector.start.y + (bisector.end.y - bisector.start.y) * Math.min(1, (progress - 0.8) / 0.2)
                      : bisector.end.y
                  }
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                  opacity={Math.min(1, (progress - 0.8) / 0.2)}
                />
              )}
            </g>
          );
        })}

        {/* 内心 */}
        {incenter && (
          <g>
            <circle cx={incenter.x} cy={incenter.y} r="6" fill="#10b981" />
            <circle cx={incenter.x} cy={incenter.y} r="3" fill="#fff" />
            <text x={incenter.x + 10} y={incenter.y - 10} fontSize="12" fill="#10b981">I</text>
          </g>
        )}

        {/* 内切圆 - 丝滑的圆规效果 */}
        {incircle && (
          <g>
            {/* 绘制中的圆规效果 - 优先显示 */}
            {incircleProgress < 1 && (
              <path
                d={arcPath(incircle.center, incircle.radius, 0, 2 * Math.PI, incircleProgress)}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={incircleProgress}
              />
            )}
            {/* 最终的内切圆 - 完成后显示 */}
            {incircleProgress >= 1 && (
              <path
                d={arcPath(incircle.center, incircle.radius, 0, 2 * Math.PI, 1)}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </g>
        )}
      </svg>

      {/* 控制按钮 */}
      <div className="flex justify-center gap-3 mt-4">
        <button
          onClick={step1_DrawBisectors}
          disabled={step >= 1}
          className="w-12 h-12 p-0 bg-blue-500 text-white rounded border-none cursor-pointer flex items-center justify-center disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-600 active:bg-blue-700 transition-colors touch-manipulation"
          style={{ minWidth: '44px', minHeight: '44px' }}
          title="Draw Bisectors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
        <button
          onClick={step2_DrawIncircle}
          disabled={step < 1}
          className="w-12 h-12 p-0 bg-blue-500 text-white rounded border-none cursor-pointer flex items-center justify-center disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-600 active:bg-blue-700 transition-colors touch-manipulation"
          style={{ minWidth: '44px', minHeight: '44px' }}
          title="Draw Incircle"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
          </svg>
        </button>
        <button
          onClick={reset}
          className="w-12 h-12 p-0 bg-blue-500 text-white rounded border-none cursor-pointer flex items-center justify-center hover:bg-blue-600 active:bg-blue-700 transition-colors touch-manipulation"
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

