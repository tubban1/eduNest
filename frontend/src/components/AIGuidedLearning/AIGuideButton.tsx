import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';

interface AIGuideButtonProps {
  onClick: () => void;
  hasNewMessage?: boolean;
}

const BUBBLE_HIDE_MS = 10000;

export const AIGuideButton: React.FC<AIGuideButtonProps> = ({ onClick, hasNewMessage }) => {
  const { t } = useTranslation('aiGuide');
  const [showBubble, setShowBubble] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bubbleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // ai_conversations 中 user_id 出现 3 次以上则不显示提示
        const count = await api.aiGuide.getConversationCount();
        if (cancelled || count >= 3) return;

        setShowBubble(true);
        bubbleTimeoutRef.current = setTimeout(() => {
          if (!cancelled) setShowBubble(false);
        }, BUBBLE_HIDE_MS);
      } catch {
        // API 失败时默认显示
        if (!cancelled) {
          setShowBubble(true);
          bubbleTimeoutRef.current = setTimeout(() => {
            if (!cancelled) setShowBubble(false);
          }, BUBBLE_HIDE_MS);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (bubbleTimeoutRef.current) {
        clearTimeout(bubbleTimeoutRef.current);
      }
    };
  }, []);

  const handleClick = () => {
    setShowBubble(false);
    if (bubbleTimeoutRef.current) {
      clearTimeout(bubbleTimeoutRef.current);
    }
    onClick();
  };

  return (
    <>
      {/* AI Guide 专用滤镜（局部 SVG，不影响其它组件） */}
      <svg className="ai-guide-filters" aria-hidden="true">
        <defs>
          <filter id="aiGuideFilmGrain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="1.2"
              numOctaves="3"
              stitchTiles="noStitch"
              result="noise"
            />
            <feColorMatrix in="noise" type="saturate" values="0" result="mono" />
            <feComponentTransfer in="mono">
              <feFuncA type="linear" slope="0.5" />
            </feComponentTransfer>
          </filter>

          <filter id="aiGuideGlow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="35" result="blurred" />
            <feColorMatrix
              in="blurred"
              type="matrix"
              values="
                0 0 0 0 0.65
                0 0 0 0 0.78
                0 0 0 0 1
                0 0 0 0.6 0
              "
              result="coloredGlow"
            />
            <feMerge>
              <feMergeNode in="coloredGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <button
        ref={buttonRef}
        onClick={handleClick}
        className="ai-guide-btn fixed bottom-6 right-6 z-50 group"
      >
        <div className="ai-guide-btn-inner">
          <div className="ai-guide-blob">
            <div className="ai-guide-blob-shape">
              <div className="ai-guide-grain" />
            </div>
          </div>
          <MessageCircle className="w-4 h-4 text-white/90 absolute inset-0 m-auto drop-shadow-[0_2px_6px_rgba(15,23,42,0.4)] pointer-events-none" />
        </div>
        {hasNewMessage && (
          <span className="ai-guide-dot" />
        )}
      </button>
      {showBubble && (
        <div
          className="fixed bottom-24 right-6 bg-card border border-border rounded-lg px-4 py-2 shadow-xl z-50 animate-bubble-pop"
          style={{
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          <div className="text-sm text-foreground font-medium">
            {t('bubbleMessage')}
          </div>
          {/* 气泡小箭头，指向按钮 */}
          <div
            className="absolute -bottom-2 right-8 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-border"
          />
        </div>
      )}
    </>
  );
};

