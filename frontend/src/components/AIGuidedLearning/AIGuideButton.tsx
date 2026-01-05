import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AIGuideButtonProps {
  onClick: () => void;
  hasNewMessage?: boolean;
}

const STORAGE_KEY = 'ai_guide_button_clicked';

export const AIGuideButton: React.FC<AIGuideButtonProps> = ({ onClick, hasNewMessage }) => {
  const { t } = useTranslation('aiGuide');
  const [showBubble, setShowBubble] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bubbleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 检查用户是否已经点击过
    const hasClicked = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true';
    
    if (!hasClicked) {
      // 5秒后显示气泡提示
      bubbleTimeoutRef.current = setTimeout(() => {
        setShowBubble(true);
        // 10秒后自动隐藏气泡
        setTimeout(() => {
          setShowBubble(false);
        }, 10000);
      }, 5000);
    }

    return () => {
      if (bubbleTimeoutRef.current) {
        clearTimeout(bubbleTimeoutRef.current);
      }
    };
  }, []);

  const handleClick = () => {
    // 记录用户点击过
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    // 隐藏气泡
    setShowBubble(false);
    // 清除定时器
    if (bubbleTimeoutRef.current) {
      clearTimeout(bubbleTimeoutRef.current);
    }
    onClick();
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleClick}
        className="fixed bottom-6 right-6 bg-primary hover:opacity-90 text-primary-foreground p-4 rounded-full shadow-lg transition-all hover:scale-105 z-50 flex items-center justify-center group animate-breathe"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap group-hover:ml-2">
          {t('buttonLabel')}
        </span>
        {hasNewMessage && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-destructive rounded-full border-2 border-white"></span>
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

