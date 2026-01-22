import React, { useState, useRef } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { AIGuideMessageList } from './AIGuideMessageList';
import { AIGuideInput } from './AIGuideInput';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface AIGuideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isLoggedIn: boolean;
  initFailed?: boolean;
  onRetryInit?: () => void;
  freeTrialUsed?: boolean;
  hasMetadata?: boolean;
}

export const AIGuideDrawer: React.FC<AIGuideDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  isLoading,
  isLoggedIn,
  initFailed = false,
  onRetryInit,
  freeTrialUsed = false,
  hasMetadata = true
}) => {
  const { t } = useTranslation('aiGuide');
  const router = useRouter();
  const [width] = useState(400);
  const drawerRef = useRef<HTMLDivElement>(null);

  const handleLogin = () => {
    router.push('/login');
  };

  const handleRegister = () => {
    router.push('/register');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层：点击左侧内容区域关闭 AI Guide */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-300"
        style={{ right: `${width}px`, cursor: 'pointer' }}
      />
      
      {/* AI Guide Drawer */}
      <div
        ref={drawerRef}
        className="fixed right-0 top-0 h-full bg-card shadow-2xl z-50 transition-transform duration-300 flex flex-col border-l border-border translate-x-0"
        style={{ width: `${width}px` }}
        onClick={(e) => e.stopPropagation()}
      >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
        <h3 className="font-semibold text-foreground flex items-center">
          🤖 {t('title')}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded text-muted-foreground"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <AIGuideMessageList messages={messages} isLoading={isLoading} hasMetadata={hasMetadata} />
        {/* Retry button when init failed */}
        {initFailed && onRetryInit && (
          <div className="p-4 border-t border-border bg-card">
            <button
              onClick={onRetryInit}
              disabled={isLoading}
              className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              {t('retry')}
            </button>
          </div>
        )}
      </div>
      
      {/* Input or Login Buttons */}
      <div className="p-4 border-t border-border bg-card">
        {isLoggedIn ? (
          <AIGuideInput onSend={onSendMessage} disabled={isLoading || initFailed} />
        ) : freeTrialUsed ? (
          // 免费试用已使用，显示登录/注册按钮
          <div className="space-y-3">
            <button
              onClick={handleLogin}
              className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              {t('loginButton')}
            </button>
            <button
              onClick={handleRegister}
              className="w-full py-3 px-4 bg-card text-primary border-2 border-primary rounded-lg font-semibold hover:bg-primary/10 transition-all duration-200"
            >
              {t('registerButton')}
            </button>
          </div>
        ) : (
          // 未登录且免费试用未使用，显示输入框（允许第一次对话）
          <AIGuideInput onSend={onSendMessage} disabled={isLoading || initFailed} />
        )}
      </div>
    </div>
    </>
  );
};

