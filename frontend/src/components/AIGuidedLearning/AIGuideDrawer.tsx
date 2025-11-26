import React, { useState, useRef } from 'react';
import { X, Minimize2, Maximize2 } from 'lucide-react';
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
}

export const AIGuideDrawer: React.FC<AIGuideDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  isLoading
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [width] = useState(400);
  const drawerRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  return (
    <div
      ref={drawerRef}
      className={`fixed right-0 top-0 h-full bg-white shadow-2xl z-50 transition-transform duration-300 flex flex-col border-l border-gray-200 ${
        isMinimized ? 'translate-x-[calc(100%-60px)]' : 'translate-x-0'
      }`}
      style={{ width: isMinimized ? 'auto' : `${width}px` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
        <h3 className="font-semibold text-gray-800 flex items-center">
          🤖 AI 学习助手
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-gray-200 rounded text-gray-500"
          >
            {isMinimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded text-gray-500"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <>
          <div className="flex-1 overflow-hidden flex flex-col">
            <AIGuideMessageList messages={messages} isLoading={isLoading} />
          </div>
          <div className="p-4 border-t border-gray-100 bg-white">
            <AIGuideInput onSend={onSendMessage} disabled={isLoading} />
          </div>
        </>
      )}
    </div>
  );
};

