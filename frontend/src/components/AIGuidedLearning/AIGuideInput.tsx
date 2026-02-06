import React, { useState, KeyboardEvent, CompositionEvent } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AIGuideInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  /** 渲染在发送按钮左侧的额外按钮（如语音） */
  trailingButtons?: React.ReactNode;
}

export const AIGuideInput: React.FC<AIGuideInputProps> = ({ onSend, disabled, trailingButtons }) => {
  const { t } = useTranslation('aiGuide');
  const [text, setText] = useState('');
  const [isComposing, setIsComposing] = useState(false); // IME 输入状态

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 如果正在使用 IME 输入（拼音输入），不处理回车键
    if (isComposing) {
      return;
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // IME 输入开始（开始输入拼音）
  const handleCompositionStart = (e: CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(true);
  };

  // IME 输入结束（确认拼音输入）
  const handleCompositionEnd = (e: CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
  };

  return (
    <div className="relative">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        disabled={disabled}
        placeholder={t('inputPlaceholder')}
        className="w-full border border-input rounded-xl p-3 pr-24 focus:ring-2 focus:ring-primary focus:border-transparent resize-none bg-background focus:bg-card transition-all text-sm"
        rows={2}
      />
      <div className="absolute right-2 bottom-2.5 flex items-center gap-1">
        {trailingButtons}
        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:hover:opacity-50 transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

