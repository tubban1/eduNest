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
        className="w-full border border-input rounded-xl p-3 pr-12 focus:ring-2 focus:ring-primary focus:border-transparent resize-none bg-background focus:bg-card transition-all text-sm"
        rows={2}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        className="absolute right-2 bottom-2.5 p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:hover:opacity-50 transition-colors"
      >
        <Send size={16} />
      </button>
    </div>
  );
};

