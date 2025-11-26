import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AIGuideButtonProps {
  onClick: () => void;
  hasNewMessage?: boolean;
}

export const AIGuideButton: React.FC<AIGuideButtonProps> = ({ onClick, hasNewMessage }) => {
  const { t } = useTranslation('aiGuide');
  
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all hover:scale-105 z-50 flex items-center justify-center group"
    >
      <MessageCircle className="w-6 h-6" />
      <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap group-hover:ml-2">
        {t('buttonLabel')}
      </span>
      {hasNewMessage && (
        <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
      )}
    </button>
  );
};

