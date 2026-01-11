import React, { useEffect, useRef } from 'react';
import { Bot, User } from 'lucide-react';
import AIGuideMessageRenderer from '../AIGuideMessageRenderer';
import { AIGuideAnalyzingPrompt } from './AIGuideAnalyzingPrompt';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface AIGuideMessageListProps {
  messages: Message[];
  isLoading: boolean;
  hasMetadata?: boolean;
}

export const AIGuideMessageList: React.FC<AIGuideMessageListProps> = ({ messages, isLoading, hasMetadata = true }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  // 检查是否有 assistant 的回复消息（有内容的消息）
  const hasAssistantResponse = messages.some(msg => 
    msg.role === 'assistant' && msg.content && msg.content.trim().length > 0
  );

  // 显示条件：metadata 不存在 && 没有 assistant 回复（不管是否在加载中）
  // 一旦有 assistant 回复，动画就消失
  const shouldShowAnalyzing = !hasMetadata && !hasAssistantResponse;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
      {/* 如果 metadata_json 不存在且还没有 assistant 的回复，显示分析提示 */}
      {shouldShowAnalyzing && (
        <AIGuideAnalyzingPrompt />
      )}
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
            {msg.role === 'assistant' ? (
              <AIGuideMessageRenderer content={msg.content} messageId={idx.toString()} />
            ) : (
              <div className="whitespace-pre-wrap">{msg.content}</div>
            )}
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

