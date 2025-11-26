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
    
    // Add placeholder for AI message
    const aiMsgId = Date.now().toString();
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
    
    setIsLoading(true);
    try {
      let fullReply = '';
      await api.aiGuide.chatStream(conversationId, text, null, (chunk) => {
        fullReply += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = fullReply;
          }
          return newMessages;
        });
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg.role === 'assistant' && !lastMsg.content) {
            lastMsg.content = '抱歉，我现在无法回答，请稍后再试。';
        }
        return newMessages;
      });
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

