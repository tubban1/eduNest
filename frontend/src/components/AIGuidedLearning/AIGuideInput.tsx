import React, { useState, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AIGuideInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const AIGuideInput: React.FC<AIGuideInputProps> = ({ onSend, disabled }) => {
  const { t } = useTranslation('aiGuide');
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={t('inputPlaceholder')}
        className="w-full border border-gray-300 rounded-xl p-3 pr-12 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-gray-50 focus:bg-white transition-all text-sm"
        rows={2}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        className="absolute right-2 bottom-2.5 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
      >
        <Send size={16} />
      </button>
    </div>
  );
};

