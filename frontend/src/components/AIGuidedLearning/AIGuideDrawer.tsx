import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';
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
}

export const AIGuideDrawer: React.FC<AIGuideDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  isLoading,
  isLoggedIn
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
    <div
      ref={drawerRef}
      className="fixed right-0 top-0 h-full bg-white shadow-2xl z-50 transition-transform duration-300 flex flex-col border-l border-gray-200 translate-x-0"
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
        <h3 className="font-semibold text-gray-800 flex items-center">
          🤖 {t('title')}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded text-gray-500"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <AIGuideMessageList messages={messages} isLoading={isLoading} />
      </div>
      
      {/* Input or Login Buttons */}
      <div className="p-4 border-t border-gray-100 bg-white">
        {isLoggedIn ? (
          <AIGuideInput onSend={onSendMessage} disabled={isLoading} />
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleLogin}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              {t('loginButton')}
            </button>
            <button
              onClick={handleRegister}
              className="w-full py-3 px-4 bg-white text-blue-600 border-2 border-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-all duration-200"
            >
              {t('registerButton')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

