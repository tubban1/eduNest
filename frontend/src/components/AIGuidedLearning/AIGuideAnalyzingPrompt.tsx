import React from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Bot } from 'lucide-react';

interface AIGuideAnalyzingPromptProps {
  className?: string;
}

export const AIGuideAnalyzingPrompt: React.FC<AIGuideAnalyzingPromptProps> = ({ className = '' }) => {
  const { t } = useTranslation('aiGuide');

  return (
    <div className={`flex gap-3 ${className}`}>
      <div className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
        <Bot size={16} />
      </div>
      <div className="bg-card border border-border rounded-lg p-4 rounded-tl-none shadow-sm max-w-[80%]">
        <div className="flex items-center gap-3 mb-2">
          <div className="relative">
            <Brain 
              size={20} 
              className="text-primary animate-pulse" 
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 bg-primary/30 rounded-full animate-ping" />
            </div>
          </div>
          <span className="text-sm font-medium text-foreground">
            {t('analyzing.title', { defaultValue: '🧠 AI Teacher is analyzing this lesson…' })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('analyzing.description', { 
            defaultValue: 'Understanding diagrams, formulas, and interactions...' 
          })}
        </p>
        <div className="mt-3 flex gap-1">
          <div className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
};

