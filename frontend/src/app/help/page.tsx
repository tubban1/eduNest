'use client';

import { useTranslation } from 'react-i18next';
import { useState, useEffect, useMemo } from 'react';
import Sidebar, { MobileMenuButton } from '@/components/Sidebar';
import FullHTMLRenderer from '@/components/FullHTMLRenderer';
import { 
  Sparkles, 
  FileText, 
  Languages, 
  MessageCircle, 
  Clock, 
  Gift,
  ChevronRight,
  Play,
  BookOpen,
  Brain,
  Zap
} from 'lucide-react';

export default function HelpPage() {
  const { t, i18n } = useTranslation(['help', 'common', 'navigation']);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 监听语言变化
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      // Language changed handler
    };
    
    i18n.on('languageChanged', handleLanguageChanged);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n, t]);

  // 使用 useMemo 确保在 mounted 之前使用默认值，避免 hydration 错误
  const sections = useMemo(() => {
    if (!mounted) {
      // 服务器端渲染时使用默认英语标题
      return [
        {
          id: 0,
          icon: Sparkles,
          title: 'What is EduNest?',
          contentKey: 'whatIsEduNest',
        },
        {
          id: 1,
          icon: FileText,
          title: 'Animation Generation',
          contentKey: 'animationGeneration',
        },
        {
          id: 2,
          icon: MessageCircle,
          title: 'How to Interact with Generated Content',
          contentKey: 'interaction',
        },
        {
          id: 3,
          icon: Gift,
          title: 'Free Trial Credits',
          contentKey: 'freeTrial',
        },
      ];
    }
    // 客户端挂载后使用翻译
    const title0 = t('whatIsEduNest.title', { ns: 'help', defaultValue: 'What is EduNest?' });
    const title1 = t('animationGeneration.title', { ns: 'help', defaultValue: 'Animation Generation' });
    const title2 = t('interaction.title', { ns: 'help', defaultValue: 'How to Interact with Generated Content' });
    const title3 = t('freeTrial.title', { ns: 'help', defaultValue: 'Free Trial Credits' });
    return [
      {
        id: 0,
        icon: Sparkles,
        title: title0,
        contentKey: 'whatIsEduNest',
      },
      {
        id: 1,
        icon: FileText,
        title: title1,
        contentKey: 'animationGeneration',
      },
      {
        id: 2,
        icon: MessageCircle,
        title: title2,
        contentKey: 'interaction',
      },
      {
        id: 3,
        icon: Gift,
        title: title3,
        contentKey: 'freeTrial',
      },
    ];
  }, [mounted, t, i18n.language]);

  const toggleSection = (id: number) => {
    setActiveSection(activeSection === id ? null : id);
  };

  // 动画 HTML 字符串（无文字，只有参数标注和图标按钮）
  const incenterAnimationHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
    canvas { border: 2px solid #3b82f6; border-radius: 4px; display: block; margin: 20px auto; }
    .controls { text-align: center; margin: 20px 0; display: flex; justify-content: center; gap: 10px; }
    button { width: 40px; height: 40px; padding: 0; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    button:hover { background: #2563eb; }
    button:disabled { background: #9ca3af; cursor: not-allowed; }
    .param-label { position: absolute; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <canvas id="canvas" width="600" height="400"></canvas>
    <div class="controls">
      <button id="step1Btn" onclick="step1_DrawBisectors()" title="Draw Bisectors">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </button>
      <button id="step2Btn" onclick="step2_DrawIncircle()" disabled title="Draw Incircle">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
      </button>
      <button onclick="reset()" title="Reset">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
      </button>
    </div>
  </div>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let triangle = null;
    let bisectors = [];
    let incenter = null;
    let incircle = null;
    let step = 0;
    let animatingBisector = null;
    let animationProgress = 0;

    function initTriangle() {
      triangle = { A: { x: 150, y: 300 }, B: { x: 450, y: 300 }, C: { x: 300, y: 100 } };
      bisectors = [];
      incenter = null;
      incircle = null;
      step = 0;
      animatingBisector = null;
      animationProgress = 0;
      document.getElementById('step1Btn').disabled = false;
      document.getElementById('step2Btn').disabled = true;
      draw();
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (!triangle) return;

      // 绘制三角形
      ctx.strokeStyle = '#1e40af';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(triangle.A.x, triangle.A.y);
      ctx.lineTo(triangle.B.x, triangle.B.y);
      ctx.lineTo(triangle.C.x, triangle.C.y);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = '#1e40af';
      ctx.font = '12px Arial';
      ctx.fillText('A', triangle.A.x - 10, triangle.A.y + 20);
      ctx.fillText('B', triangle.B.x + 5, triangle.B.y + 20);
      ctx.fillText('C', triangle.C.x - 5, triangle.C.y - 10);

      // 绘制已完成的角平分线
      bisectors.forEach((bisector, idx) => {
        const isAnimating = animatingBisector === idx;
        const progress = isAnimating ? animationProgress : 1;

        // 绘制边上的圆规弧（在两条边上画弧找交点）
        if (bisector.edgeArcs && progress >= 0.1) {
          bisector.edgeArcs.forEach((arc, arcIdx) => {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = Math.min(1, (progress - 0.1) * 5);
            ctx.beginPath();
            if (isAnimating && progress < 0.3) {
              const arcProgress = Math.min(1, (progress - 0.1) / 0.2);
              const angleRange = arc.endAngle - arc.startAngle;
              const currentEndAngle = arc.startAngle + angleRange * arcProgress;
              ctx.arc(arc.center.x, arc.center.y, arc.radius, arc.startAngle, currentEndAngle);
            } else {
              ctx.arc(arc.center.x, arc.center.y, arc.radius, arc.startAngle, arc.endAngle);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
          });
        }

        // 绘制边交点
        if (bisector.edgePoints && progress >= 0.3) {
          bisector.edgePoints.forEach((point, pointIdx) => {
            const pointProgress = Math.min(1, (progress - 0.3) / 0.2);
            ctx.fillStyle = '#f59e0b';
            ctx.globalAlpha = pointProgress;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4 * pointProgress, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          });
        }

        // 绘制从边交点画的弧（找角平分线上的点）
        if (bisector.intersectionArcs && progress >= 0.5) {
          bisector.intersectionArcs.forEach((arc, arcIdx) => {
            const arcProgress = Math.min(1, (progress - 0.5) / 0.2);
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.globalAlpha = arcProgress;
            ctx.beginPath();
            if (isAnimating && progress < 0.7) {
              ctx.arc(arc.center.x, arc.center.y, arc.radius * arcProgress, 0, Math.PI * 2);
            } else {
              ctx.arc(arc.center.x, arc.center.y, arc.radius, 0, Math.PI * 2);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
          });
        }

        // 绘制角平分线上的点
        if (bisector.bisectorPoint && progress >= 0.7) {
          const pointProgress = Math.min(1, (progress - 0.7) / 0.1);
          ctx.fillStyle = '#ef4444';
          ctx.globalAlpha = pointProgress;
          ctx.beginPath();
          ctx.arc(bisector.bisectorPoint.x, bisector.bisectorPoint.y, 4 * pointProgress, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // 绘制角平分线
        if (bisector.start && bisector.end && progress >= 0.8) {
          const lineProgress = Math.min(1, (progress - 0.8) / 0.2);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.globalAlpha = lineProgress;
          ctx.beginPath();
          ctx.moveTo(bisector.start.x, bisector.start.y);
          if (isAnimating && progress < 1) {
            const endX = bisector.start.x + (bisector.end.x - bisector.start.x) * lineProgress;
            const endY = bisector.start.y + (bisector.end.y - bisector.start.y) * lineProgress;
            ctx.lineTo(endX, endY);
          } else {
            ctx.lineTo(bisector.end.x, bisector.end.y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      });

      // 绘制内心
      if (incenter) {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(incenter.x, incenter.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(incenter.x, incenter.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#10b981';
        ctx.font = '12px Arial';
        ctx.fillText('I', incenter.x + 10, incenter.y - 10);
      }

      // 绘制内切圆
      if (incircle) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(incircle.center.x, incircle.center.y, incircle.radius, 0, Math.PI * 2);
        ctx.stroke();

        if (incircle.animating) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(incircle.center.x, incircle.center.y, incircle.currentRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    function step1_DrawBisectors() {
      if (step >= 1 || !triangle) return;
      
      document.getElementById('step1Btn').disabled = true;
      
      // 按顺序绘制每个角的角平分线
      const angles = [
        { vertex: triangle.A, edge1: triangle.B, edge2: triangle.C },
        { vertex: triangle.B, edge1: triangle.C, edge2: triangle.A },
        { vertex: triangle.C, edge1: triangle.A, edge2: triangle.B }
      ];

      const radius = 60;
      
      // 为每个角创建角平分线数据
      angles.forEach((angle, idx) => {
        const dir1 = Math.atan2(angle.edge1.y - angle.vertex.y, angle.edge1.x - angle.vertex.x);
        const dir2 = Math.atan2(angle.edge2.y - angle.vertex.y, angle.edge2.x - angle.vertex.x);
        const dist1 = Math.sqrt((angle.edge1.x - angle.vertex.x) ** 2 + (angle.edge1.y - angle.vertex.y) ** 2);
        const dist2 = Math.sqrt((angle.edge2.x - angle.vertex.x) ** 2 + (angle.edge2.y - angle.vertex.y) ** 2);
        
        // 在两条边上用圆规画弧，找到两个点
        const point1 = {
          x: angle.vertex.x + Math.cos(dir1) * Math.min(radius, dist1 * 0.3),
          y: angle.vertex.y + Math.sin(dir1) * Math.min(radius, dist1 * 0.3)
        };
        const point2 = {
          x: angle.vertex.x + Math.cos(dir2) * Math.min(radius, dist2 * 0.3),
          y: angle.vertex.y + Math.sin(dir2) * Math.min(radius, dist2 * 0.3)
        };

        // 从这两个点用圆规画弧，找到它们的交点（角平分线上的点）
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

        // 计算角平分线的方向
        const bisectorDir = Math.atan2(bisectorPoint.y - angle.vertex.y, bisectorPoint.x - angle.vertex.x);
        const bisectorEnd = {
          x: angle.vertex.x + Math.cos(bisectorDir) * 200,
          y: angle.vertex.y + Math.sin(bisectorDir) * 200
        };

        bisectors.push({
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
              radius: r1,
              startAngle: 0,
              endAngle: Math.PI * 2
            },
            {
              center: point2,
              radius: r2,
              startAngle: 0,
              endAngle: Math.PI * 2
            }
          ]
        });
      });

      // 按顺序为每个角平分线播放动画
      let currentBisectorIndex = 0;
      
      function animateBisector() {
        if (currentBisectorIndex >= bisectors.length) {
          // 所有角平分线绘制完成，计算内心
          if (bisectors.length >= 2) {
            const line1 = bisectors[0];
            const line2 = bisectors[1];
            const x1 = line1.start.x, y1 = line1.start.y;
            const x2 = line1.end.x, y2 = line1.end.y;
            const x3 = line2.start.x, y3 = line2.start.y;
            const x4 = line2.end.x, y4 = line2.end.y;

            const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
            if (Math.abs(denom) > 0.001) {
              const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
              incenter = { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
            }
          }
          step = 1;
          document.getElementById('step2Btn').disabled = false;
          animatingBisector = null;
          animationProgress = 0;
          draw();
          return;
        }

        animatingBisector = currentBisectorIndex;
        animationProgress = 0;

        function animate() {
          animationProgress += 0.02;
          if (animationProgress >= 1) {
            animationProgress = 1;
            draw();
            currentBisectorIndex++;
            setTimeout(() => animateBisector(), 200); // 每个角平分线之间暂停200ms
          } else {
            draw();
            requestAnimationFrame(animate);
          }
        }
        animate();
      }

      animateBisector();
    }

    function step2_DrawIncircle() {
      if (step < 1 || !incenter) return;
      
      const distToAB = distanceToLine(incenter, triangle.A, triangle.B);
      const distToBC = distanceToLine(incenter, triangle.B, triangle.C);
      const distToCA = distanceToLine(incenter, triangle.C, triangle.A);
      const radius = Math.min(distToAB, distToBC, distToCA);

      incircle = { center: incenter, radius: radius, currentRadius: 0, animating: true };

      let currentRadius = 0;
      const animate = () => {
        if (currentRadius < radius) {
          currentRadius += 2;
          incircle.currentRadius = currentRadius;
          draw();
          requestAnimationFrame(animate);
        } else {
          incircle.animating = false;
          incircle.currentRadius = radius;
          draw();
        }
      };
      animate();

      step = 2;
      document.getElementById('step2Btn').disabled = true;
    }

    function distanceToLine(point, lineStart, lineEnd) {
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
    }

    function reset() {
      initTriangle();
    }

    initTriangle();
  </script>
</body>
</html>
  `;

  const aiTeacherAnimationHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
    .preview-area { position: relative; width: 100%; height: 300px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; overflow: hidden; }
    .ai-teacher-button { position: absolute; bottom: 20px; right: 20px; background: #3b82f6; color: white; padding: 12px 20px; border-radius: 50px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: all 0.3s ease; z-index: 10; }
    .ai-teacher-button:hover { background: #2563eb; transform: scale(1.05); box-shadow: 0 6px 16px rgba(0,0,0,0.3); }
    .ai-teacher-button svg { width: 20px; height: 20px; }
    .ai-teacher-avatar { position: absolute; bottom: 80px; right: 20px; width: 60px; height: 60px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 50%; display: none; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); animation: popIn 0.3s ease-out; z-index: 9; }
    .ai-teacher-avatar.show { display: flex; }
    .ai-teacher-avatar::before { content: '🤖'; font-size: 32px; }
    @keyframes popIn {
      from { transform: scale(0) translateY(20px); opacity: 0; }
      to { transform: scale(1) translateY(0); opacity: 1; }
    }
    .dialog-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.3s ease-out; }
    .dialog-overlay.show { display: flex; }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .dialog-box { background: white; border-radius: 12px; width: 90%; max-width: 500px; max-height: 80vh; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
    .dialog-box.pop-open { animation: popOpen 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55); }
    @keyframes popOpen {
      0% { transform: scale(0.3) translateY(50px); opacity: 0; }
      50% { transform: scale(1.05) translateY(-5px); }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    .typing-indicator { display: inline-block; }
    .typing-indicator::after { content: '▊'; animation: blink 1s infinite; }
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
    .dialog-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; display: flex; align-items: center; justify-content: space-between; }
    .dialog-header h3 { margin: 0; font-size: 18px; display: flex; align-items: center; gap: 10px; }
    .dialog-close { background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
    .dialog-close:hover { background: rgba(255,255,255,0.3); }
    .dialog-content { padding: 20px; max-height: calc(80vh - 120px); overflow-y: auto; }
    .dialog-message { background: #f3f4f6; padding: 12px 16px; border-radius: 8px; margin-bottom: 12px; }
    .dialog-input-area { display: flex; gap: 10px; padding: 20px; border-top: 1px solid #e5e7eb; }
    .dialog-input { flex: 1; padding: 10px 16px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
    .dialog-input:focus { outline: none; border-color: #3b82f6; }
    .dialog-send { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 500; transition: background 0.2s; }
    .dialog-send:hover { background: #2563eb; }
    .dialog-send:disabled { background: #9ca3af; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="container">
    <div class="preview-area" id="previewArea">
      <div class="ai-teacher-avatar" id="aiTeacherAvatar"></div>
      <div class="ai-teacher-button" id="aiTeacherButton">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>AI Teacher</span>
      </div>
    </div>
    <div class="dialog-overlay" id="dialogOverlay">
      <div class="dialog-box">
        <div class="dialog-header">
          <h3>
            <span>🤖</span>
            <span>AI Teacher</span>
          </h3>
          <button class="dialog-close" id="dialogClose">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="dialog-content" id="dialogContent">
        </div>
        <div class="dialog-input-area">
          <input type="text" class="dialog-input" id="dialogInput" placeholder="Ask a question...">
          <button class="dialog-send" id="dialogSend">Send</button>
        </div>
      </div>
    </div>
  </div>
  <script>
    const aiTeacherButton = document.getElementById('aiTeacherButton');
    const aiTeacherAvatar = document.getElementById('aiTeacherAvatar');
    const dialogOverlay = document.getElementById('dialogOverlay');
    const dialogClose = document.getElementById('dialogClose');
    const dialogInput = document.getElementById('dialogInput');
    const dialogSend = document.getElementById('dialogSend');
    const dialogContent = document.getElementById('dialogContent');

    // 鼠标悬停显示 AI 老师头像
    aiTeacherButton.addEventListener('mouseenter', () => {
      aiTeacherAvatar.classList.add('show');
    });

    aiTeacherButton.addEventListener('mouseleave', () => {
      aiTeacherAvatar.classList.remove('show');
    });

    // 打字机效果函数
    function typeMessage(element, text, speed, callback) {
      let i = 0;
      element.textContent = '';
      element.classList.add('typing-indicator');
      
      function type() {
        if (i < text.length) {
          element.textContent = text.substring(0, i + 1);
          i++;
          setTimeout(type, speed);
        } else {
          element.classList.remove('typing-indicator');
          if (callback) callback();
        }
      }
      
      type();
    }

    // 点击按钮打开对话框
    aiTeacherButton.addEventListener('click', function() {
      dialogOverlay.classList.add('show');
      const dialogBox = document.querySelector('.dialog-box');
      dialogBox.classList.add('pop-open');
      
      // 清空内容并显示初始消息（带打字效果）
      dialogContent.innerHTML = '';
      const welcomeMessage = document.createElement('div');
      welcomeMessage.className = 'dialog-message';
      dialogContent.appendChild(welcomeMessage);
      
      const welcomeText = 'Hello! I am your AI Teacher. How can I help you learn today?';
      typeMessage(welcomeMessage, welcomeText, 30);
      
      dialogInput.focus();
    });

    // 关闭对话框
    dialogClose.addEventListener('click', function() {
      dialogOverlay.classList.remove('show');
      const dialogBox = document.querySelector('.dialog-box');
      dialogBox.classList.remove('pop-open');
    });

    dialogOverlay.addEventListener('click', function(e) {
      if (e.target === dialogOverlay) {
        dialogOverlay.classList.remove('show');
        const dialogBox = document.querySelector('.dialog-box');
        dialogBox.classList.remove('pop-open');
      }
    });

    // 发送消息
    function sendMessage() {
      const message = dialogInput.value.trim();
      if (!message) return;

      // 添加用户消息
      const userMessage = document.createElement('div');
      userMessage.className = 'dialog-message';
      userMessage.style.background = '#3b82f6';
      userMessage.style.color = 'white';
      userMessage.style.marginLeft = 'auto';
      userMessage.style.maxWidth = '80%';
      userMessage.textContent = message;
      dialogContent.appendChild(userMessage);

      // 清空输入框并禁用发送按钮
      dialogInput.value = '';
      dialogSend.disabled = true;

      // 滚动到底部
      dialogContent.scrollTop = dialogContent.scrollHeight;

      // 简单的 AI 回复（带打字效果）
      setTimeout(function() {
        const aiMessage = document.createElement('div');
        aiMessage.className = 'dialog-message';
        dialogContent.appendChild(aiMessage);
        
        const responseText = 'That is a great question! I am here to help you learn.';
        
        typeMessage(aiMessage, responseText, 30, function() {
          dialogSend.disabled = false;
          dialogInput.focus();
        });
        
        dialogContent.scrollTop = dialogContent.scrollHeight;
      }, 500);
    }

    dialogSend.addEventListener('click', sendMessage);
    dialogInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !dialogSend.disabled) {
        sendMessage();
      }
    });
  </script>
</body>
</html>
  `;

  const functionIntersectionAnimationHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
    canvas { border: 2px solid #8b5cf6; border-radius: 4px; display: block; margin: 20px auto; }
    .controls { text-align: center; margin: 20px 0; display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .slider-container { margin: 8px 0; display: flex; align-items: center; justify-content: center; gap: 10px; }
    label { display: inline-block; width: 30px; text-align: center; font-size: 14px; color: #666; }
    input[type="range"] { width: 200px; }
    .value { display: inline-block; width: 50px; text-align: left; font-size: 14px; color: #666; }
    button { width: 40px; height: 40px; padding: 0; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    button:hover { background: #7c3aed; }
  </style>
</head>
<body>
  <div class="container">
    <canvas id="canvas" width="600" height="400"></canvas>
    <div class="controls">
      <div class="slider-container">
        <label>a:</label>
        <input type="range" id="a" min="-2" max="2" step="0.1" value="0.5">
        <span class="value" id="aValue">0.5</span>
      </div>
      <div class="slider-container">
        <label>k:</label>
        <input type="range" id="k" min="-2" max="2" step="0.1" value="1">
        <span class="value" id="kValue">1</span>
      </div>
      <div class="slider-container">
        <label>b:</label>
        <input type="range" id="b" min="-3" max="3" step="0.1" value="0">
        <span class="value" id="bValue">0</span>
      </div>
      <button onclick="reset()" title="Reset">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
      </button>
    </div>
  </div>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = 50;

    function draw() {
      ctx.clearRect(0, 0, width, height);
      
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, height);
      ctx.stroke();

      const a = parseFloat(document.getElementById('a').value);
      const k = parseFloat(document.getElementById('k').value);
      const b = parseFloat(document.getElementById('b').value);

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let first = true;
      for (let x = -width/2; x <= width/2; x += 0.5) {
        const screenX = centerX + x;
        const y = a * (x / scale) * (x / scale);
        const screenY = centerY - y * scale;
        if (first) {
          ctx.moveTo(screenX, screenY);
          first = false;
        } else {
          ctx.lineTo(screenX, screenY);
        }
      }
      ctx.stroke();
      ctx.fillStyle = '#3b82f6';
      ctx.font = '12px Arial';
      ctx.fillText('y = ax²', 10, 20);

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const y1 = k * (-width/2 / scale) + b;
      const y2 = k * (width/2 / scale) + b;
      ctx.moveTo(0, centerY - y1 * scale);
      ctx.lineTo(width, centerY - y2 * scale);
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.font = '12px Arial';
      ctx.fillText('y = kx + b', 10, 40);

      const discriminant = k * k + 4 * a * b;
      if (discriminant >= 0 && Math.abs(a) > 0.01) {
        const sqrtD = Math.sqrt(discriminant);
        const x1 = (k + sqrtD) / (2 * a);
        const x2 = (k - sqrtD) / (2 * a);
        const y1 = a * x1 * x1;
        const y2 = a * x2 * x2;

        [x1, x2].forEach((x, idx) => {
          if (x >= -width/2/scale && x <= width/2/scale) {
            const y = idx === 0 ? y1 : y2;
            const screenX = centerX + x * scale;
            const screenY = centerY - y * scale;
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.arc(screenX, screenY, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      } else if (Math.abs(a) < 0.01) {
        if (Math.abs(k) > 0.01) {
          const x = -b / k;
          const y = k * x + b;
          if (x >= -width/2/scale && x <= width/2/scale) {
            const screenX = centerX + x * scale;
            const screenY = centerY - y * scale;
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.arc(screenX, screenY, 6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    function reset() {
      document.getElementById('a').value = 0.5;
      document.getElementById('k').value = 1;
      document.getElementById('b').value = 0;
      document.getElementById('aValue').textContent = '0.5';
      document.getElementById('kValue').textContent = '1';
      document.getElementById('bValue').textContent = '0';
      draw();
    }

    document.getElementById('a').addEventListener('input', (e) => {
      document.getElementById('aValue').textContent = e.target.value;
      draw();
    });
    document.getElementById('k').addEventListener('input', (e) => {
      document.getElementById('kValue').textContent = e.target.value;
      draw();
    });
    document.getElementById('b').addEventListener('input', (e) => {
      document.getElementById('bValue').textContent = e.target.value;
      draw();
    });

    draw();
  </script>
</body>
</html>
  `;

  const wordMatchingGameHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
    .game-area { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
    .card { aspect-ratio: 1; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px; font-weight: bold; color: white; transition: all 0.3s; }
    .card:hover { transform: scale(1.05); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
    .card.flipped { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .card.matched { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); opacity: 0.6; cursor: default; }
    .score { text-align: center; font-size: 20px; font-weight: bold; color: #ec4899; margin: 20px 0; }
    .controls { text-align: center; margin: 20px 0; display: flex; justify-content: center; gap: 10px; }
    button { width: 40px; height: 40px; padding: 0; background: #ec4899; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    button:hover { background: #db2777; }
  </style>
</head>
<body>
  <div class="container">
    <div class="score">Score: <span id="score">0</span></div>
    <div class="game-area" id="gameArea"></div>
    <div class="controls">
      <button onclick="resetGame()" title="Reset">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
      </button>
    </div>
  </div>
  <script>
    const words = [
      { word: 'Apple', definition: 'A red fruit' },
      { word: 'Book', definition: 'For reading' },
      { word: 'Cat', definition: 'A pet animal' },
      { word: 'Dog', definition: 'Loyal friend' }
    ];

    let cards = [];
    let flippedCards = [];
    let matchedPairs = 0;
    let score = 0;

    function initGame() {
      cards = [];
      words.forEach((item, index) => {
        cards.push({ id: index * 2, text: item.word, type: 'word', matched: false });
        cards.push({ id: index * 2 + 1, text: item.definition, type: 'definition', matched: false });
      });
      cards.sort(() => Math.random() - 0.5);
      renderGame();
    }

    function renderGame() {
      const gameArea = document.getElementById('gameArea');
      gameArea.innerHTML = '';
      cards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card' + (card.matched ? ' matched' : card.flipped ? ' flipped' : '');
        cardEl.textContent = card.flipped || card.matched ? card.text : '?';
        cardEl.onclick = () => !card.matched && !card.flipped && flipCard(card.id);
        gameArea.appendChild(cardEl);
      });
    }

    function flipCard(id) {
      const card = cards.find(c => c.id === id);
      if (flippedCards.length >= 2 || card.flipped || card.matched) return;

      card.flipped = true;
      flippedCards.push(card);
      renderGame();

      if (flippedCards.length === 2) {
        setTimeout(() => {
          const [card1, card2] = flippedCards;
          const wordIndex1 = words.findIndex(w => w.word === card1.text || w.definition === card1.text);
          const wordIndex2 = words.findIndex(w => w.word === card2.text || w.definition === card2.text);

          if (wordIndex1 === wordIndex2 && wordIndex1 !== -1 && card1.type !== card2.type) {
            card1.matched = true;
            card2.matched = true;
            matchedPairs++;
            score += 10;
            document.getElementById('score').textContent = score;
            if (matchedPairs === words.length) {
              setTimeout(() => alert('Complete!'), 100);
            }
          } else {
            card1.flipped = false;
            card2.flipped = false;
          }
          flippedCards = [];
          renderGame();
        }, 1000);
      }
    }

    function resetGame() {
      matchedPairs = 0;
      score = 0;
      document.getElementById('score').textContent = score;
      flippedCards = [];
      initGame();
    }

    initGame();
  </script>
</body>
</html>
  `;

  if (!mounted) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="hidden lg:block h-screen sticky top-0 left-0 z-30">
          <Sidebar variant="desktop" />
        </div>
        <main className="flex-1 bg-background overflow-y-auto">
          <div className="p-8 lg:p-8">
            <div className="text-center text-muted-foreground">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* 桌面端侧边栏 */}
      <div className="hidden lg:block h-screen sticky top-0 left-0 z-30">
        <Sidebar variant="desktop" />
      </div>
      
      {/* 移动端侧边栏 */}
      <Sidebar 
        variant="mobile" 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <main className="flex-1 bg-background overflow-y-auto">
        {/* 移动端头部（固定） */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-card/80 backdrop-blur-sm border-b border-border">
          <MobileMenuButton onClick={() => setSidebarOpen(true)} />
          <div className="w-10" />
        </div>
        
        {/* 顶部预留占位，避免内容被固定头部遮挡 */}
        <div className="lg:hidden h-14" />

        <div className="p-8 lg:p-12 max-w-4xl mx-auto">
          {/* 页面标题 */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-foreground mb-2 opacity-0 animate-[fadeIn_0.6s_ease-out_0.2s_forwards]">
              {t('pageTitle', { ns: 'help', defaultValue: 'How to Use EduNest' })}
            </h1>
            <p className="text-muted-foreground opacity-0 animate-[fadeIn_0.6s_ease-out_0.4s_forwards]">
              {t('pageSubtitle', { ns: 'help', defaultValue: 'Learn how to create interactive educational content with AI' })}
            </p>
          </div>

          {/* 帮助内容区域 */}
          <div className="space-y-4">
            {sections.map((section, index) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              
              return (
                <div
                  key={section.id}
                  className="bg-card border border-border rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md opacity-0"
                  style={{ 
                    animation: `fadeInUp 0.5s ease-out ${index * 0.1}s forwards`
                  }}
                >
                  {/* 可点击的标题栏 */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">
                          {section.title}
                        </h2>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${
                        isActive ? 'rotate-90' : ''
                      }`}
                    />
                  </button>

                  {/* 展开的内容 */}
                  {isActive && (
                    <div className="px-6 pb-6" style={{ animation: 'expand 0.3s ease-out' }}>
                      <div className="pt-4 border-t border-border">
                        <div className="prose prose-sm max-w-none text-foreground">
                          {/* Section 0: What is EduNest */}
                          {section.id === 0 && (
                            <div className="space-y-4">
                              <p className="text-base leading-relaxed">
                                {t('whatIsEduNest.description', { 
                                  ns: 'help', 
                                  defaultValue: 'EduNest is an AI-powered platform for creating courseware and problem-solving animations. Each animation comes with a dedicated AI teacher to explain the content.' 
                                })}
                              </p>
                              
                              {/* 教学动画例子 */}
                              <div className="mt-6">
                                <h4 className="font-semibold text-lg mb-4">
                                  {t('whatIsEduNest.examples.title', { ns: 'help', defaultValue: 'Examples of Educational Animations' })}
                                </h4>
                                <div className="space-y-3">
                                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                                    <div className="flex items-start gap-3 mb-3">
                                      <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                                        <Play className="w-5 h-5 text-primary" />
                                      </div>
                                      <div className="flex-1">
                                        <h5 className="font-semibold text-foreground mb-1">
                                          {t('whatIsEduNest.examples.example1.title', { ns: 'help', defaultValue: '1. Finding the Incenter of a Triangle' })}
                                        </h5>
                                        <p className="text-sm text-muted-foreground">
                                          {t('whatIsEduNest.examples.example1.description', { ns: 'help', defaultValue: 'An interactive animation that demonstrates how to find the incenter of a triangle by drawing angle bisectors.' })}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-3 rounded-lg overflow-hidden border border-primary/20 bg-white">
                                      <FullHTMLRenderer
                                        fullHTML={incenterAnimationHTML}
                                        fixedHeight={true}
                                        style={{ height: '500px', minHeight: '500px' }}
                                      />
                                    </div>
                                  </div>
                                  
                                  <div className="p-4 bg-secondary/5 rounded-lg border border-secondary/20">
                                    <div className="flex items-start gap-3 mb-3">
                                      <div className="p-2 bg-secondary/10 rounded-lg mt-0.5">
                                        <Zap className="w-5 h-5 text-secondary" />
                                      </div>
                                      <div className="flex-1">
                                        <h5 className="font-semibold text-foreground mb-1">
                                          {t('whatIsEduNest.examples.example2.title', { ns: 'help', defaultValue: '2. Finding Intersection Points of Functions and Lines' })}
                                        </h5>
                                        <p className="text-sm text-muted-foreground">
                                          {t('whatIsEduNest.examples.example2.description', { ns: 'help', defaultValue: 'Adjust parameters to find where a function and a line intersect, with real-time visualization.' })}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-3 rounded-lg overflow-hidden border border-secondary/20 bg-white">
                                      <FullHTMLRenderer
                                        fullHTML={functionIntersectionAnimationHTML}
                                        fixedHeight={true}
                                        style={{ height: '550px', minHeight: '550px' }}
                                      />
                                    </div>
                                  </div>
                                  
                                  <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
                                    <div className="flex items-start gap-3 mb-3">
                                      <div className="p-2 bg-accent/10 rounded-lg mt-0.5">
                                        <BookOpen className="w-5 h-5 text-accent" />
                                      </div>
                                      <div className="flex-1">
                                        <h5 className="font-semibold text-foreground mb-1">
                                          {t('whatIsEduNest.examples.example3.title', { ns: 'help', defaultValue: '3. English Word Matching Game' })}
                                        </h5>
                                        <p className="text-sm text-muted-foreground">
                                          {t('whatIsEduNest.examples.example3.description', { ns: 'help', defaultValue: 'An engaging word matching game to help students learn English vocabulary through interactive gameplay.' })}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-3 rounded-lg overflow-hidden border border-accent/20 bg-white">
                                      <FullHTMLRenderer
                                        fullHTML={wordMatchingGameHTML}
                                        fixedHeight={true}
                                        style={{ height: '500px', minHeight: '500px' }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* AI Teacher 说明 */}
                              <div className="mt-6 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
                                <div className="flex items-start gap-3">
                                  <div className="p-2 bg-primary/20 rounded-lg mt-0.5">
                                    <MessageCircle className="w-6 h-6 text-primary" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-lg mb-2">
                                      {t('whatIsEduNest.aiTeacher.title', { ns: 'help', defaultValue: 'AI Teacher - Your Personal Learning Assistant' })}
                                    </h4>
                                    <p className="text-sm text-muted-foreground mb-3">
                                      {t('whatIsEduNest.aiTeacher.description', { ns: 'help', defaultValue: 'The AI Teacher button is located in the bottom right corner of each animation page. Click it to start a conversation and learn about any concepts you don\'t understand, or explore extended knowledge. The AI teacher gradually learns your strengths and weaknesses to provide personalized tutoring.' })}
                                    </p>
                                    <div className="mt-3 rounded-lg overflow-hidden border border-primary/20 bg-white">
                                      <FullHTMLRenderer
                                        fullHTML={aiTeacherAnimationHTML}
                                        fixedHeight={true}
                                        style={{ height: '400px', minHeight: '400px' }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Section 1: Animation Generation */}
                          {section.id === 1 && (
                            <div className="space-y-4">
                              <div className="space-y-3">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                  <FileText className="w-5 h-5 text-primary" />
                                  {t('animationGeneration.prompt.title', { ns: 'help', defaultValue: 'How to Write a Prompt' })}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  {t('animationGeneration.prompt.intro', { ns: 'help', defaultValue: 'Write a clear and specific description of what you want to create. Here are some tips:' })}
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-base ml-4">
                                  <li>{t('animationGeneration.prompt.tip1', { ns: 'help', defaultValue: 'Be specific about the topic or concept you want to explain' })}</li>
                                  <li>{t('animationGeneration.prompt.tip2', { ns: 'help', defaultValue: 'Include details about the target audience (e.g., grade level)' })}</li>
                                  <li>{t('animationGeneration.prompt.tip3', { ns: 'help', defaultValue: 'Mention any specific examples or scenarios you want to include' })}</li>
                                </ul>
                              </div>
                              
                              {/* Prompt 例子 */}
                              <div className="mt-6">
                                <h4 className="font-semibold text-base mb-3">
                                  {t('animationGeneration.examples.title', { ns: 'help', defaultValue: 'Example Prompts' })}
                                </h4>
                                <div className="space-y-3">
                                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                                    <p className="text-sm font-mono text-foreground mb-2">
                                      {t('animationGeneration.examples.example1', { ns: 'help', defaultValue: 'Create an interactive animation showing how to find the incenter of a triangle by drawing angle bisectors. Include step-by-step visualization.' })}
                                    </p>
                                  </div>
                                  <div className="p-4 bg-secondary/5 rounded-lg border border-secondary/20">
                                    <p className="text-sm font-mono text-foreground mb-2">
                                      {t('animationGeneration.examples.example2', { ns: 'help', defaultValue: 'Build an animation where students can adjust parameters to find where a function and a line intersect, with real-time visualization of the intersection point.' })}
                                    </p>
                                  </div>
                                  <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
                                    <p className="text-sm font-mono text-foreground mb-2">
                                      {t('animationGeneration.examples.example3', { ns: 'help', defaultValue: 'Create an English word matching game where students match words with their definitions. Include scoring and feedback.' })}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
                                <div className="flex items-center gap-2 mb-2">
                                  <Languages className="w-5 h-5 text-primary" />
                                  <span className="font-semibold">
                                    {t('animationGeneration.language.title', { ns: 'help', defaultValue: 'Select Output Language' })}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {t('animationGeneration.language.description', { ns: 'help', defaultValue: 'Choose the language for your generated content. The AI will create animations in your selected language.' })}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Section 2: Interaction */}
                          {section.id === 2 && (
                            <div className="space-y-4">
                              <p className="text-base leading-relaxed">
                                {t('interaction.description', { 
                                  ns: 'help', 
                                  defaultValue: 'After generating content, you can interact with it using the AI Teacher button located in the bottom right corner of each animation page.' 
                                })}
                              </p>
                              <div className="space-y-3 mt-4">
                                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Clock className="w-5 h-5 text-primary" />
                                    <span className="font-semibold">
                                      {t('interaction.initialization.title', { ns: 'help', defaultValue: 'Initialization (1 minute)' })}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {t('interaction.initialization.description', { ns: 'help', defaultValue: 'The AI Guide needs about 1 minute to initialize when you first open it. Please be patient during this process.' })}
                                  </p>
                                </div>
                                <div className="p-4 bg-secondary/5 rounded-lg border border-secondary/20">
                                  <div className="flex items-center gap-2 mb-2">
                                    <MessageCircle className="w-5 h-5 text-secondary" />
                                    <span className="font-semibold">
                                      {t('interaction.questions.title', { ns: 'help', defaultValue: 'Ask Questions' })}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {t('interaction.questions.description', { ns: 'help', defaultValue: 'After initialization, you can ask questions about the current page content. The AI teacher will provide detailed explanations.' })}
                                  </p>
                                </div>
                                <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Brain className="w-5 h-5 text-accent" />
                                    <span className="font-semibold">
                                      {t('interaction.personalized.title', { ns: 'help', defaultValue: 'Personalized Learning' })}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {t('interaction.personalized.description', { ns: 'help', defaultValue: 'The AI teacher gradually learns your strengths and weaknesses through your interactions. It will provide personalized tutoring based on your learning progress and areas that need improvement.' })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Section 3: Free Trial */}
                          {section.id === 3 && (
                            <div className="space-y-4">
                              <p className="text-base leading-relaxed">
                                {t('freeTrial.description', { 
                                  ns: 'help', 
                                  defaultValue: 'EduNest provides limited free usage credits to make AI education accessible to students and teachers worldwide.' 
                                })}
                              </p>
                              <div className="mt-4 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
                                <div className="flex items-center gap-2 mb-2">
                                  <Gift className="w-5 h-5 text-primary" />
                                  <span className="font-semibold">
                                    {t('freeTrial.benefit.title', { ns: 'help', defaultValue: 'Free Credits' })}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {t('freeTrial.benefit.description', { ns: 'help', defaultValue: 'New users receive free credits to try out the platform. This allows everyone to experience the power of AI-powered education.' })}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

    </div>
  );
}

