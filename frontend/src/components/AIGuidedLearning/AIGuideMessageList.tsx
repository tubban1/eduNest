import React, { useEffect, useRef } from 'react';
import { Bot, User } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface AIGuideMessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export const AIGuideMessageList: React.FC<AIGuideMessageListProps> = ({ messages, isLoading }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
            }`}
          >
            {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
          </div>
          <div
            className={`max-w-[80%] rounded-lg p-3 text-sm leading-relaxed shadow-sm ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-tr-none'
                : 'bg-card border border-border text-foreground rounded-tl-none'
            }`}
          >
            <div className="whitespace-pre-wrap">{msg.content}</div>
          </div>
        </div>
      ))}
      
      {isLoading && (
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <Bot size={16} />
          </div>
          <div className="bg-card border border-border rounded-lg p-3 rounded-tl-none shadow-sm">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

