import React, { useState, useEffect } from 'react';
import { AIGuideButton } from './AIGuideButton';
import { AIGuideDrawer } from './AIGuideDrawer';
import { api } from '../../lib/api';

interface AIGuidedLearningProps {
  contentId: string;
  onUIStateChange?: (state: any) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

export const AIGuidedLearning: React.FC<AIGuidedLearningProps> = ({ contentId, onUIStateChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hasInit, setHasInit] = useState(false);

  // Initialize conversation when opening for the first time
  const initSession = async () => {
    if (hasInit) return;
    setIsLoading(true);
    try {
      const res = await api.aiGuide.init(contentId);
      if (res) {
        setConversationId(res.conversation_id);
        if (res.initial_message) {
          setMessages([{ role: 'assistant', content: res.initial_message }]);
        }
        setHasInit(true);
      }
    } catch (error) {
      console.error('Failed to init AI guide:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    if (newState && !hasInit) {
      initSession();
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!conversationId) return;

    // Add user message immediately
    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    
    setIsLoading(true);
    try {
      const res = await api.aiGuide.chat(conversationId, text, null); // Pass UI state if available
      if (res && res.reply) {
        const aiMsg: Message = { role: 'assistant', content: res.reply };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，我现在无法回答，请稍后再试。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <AIGuideButton onClick={handleToggle} />
      )}
      <AIGuideDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />
    </>
  );
};

