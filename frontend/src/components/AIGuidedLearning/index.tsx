import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { AIGuideButton } from './AIGuideButton';
import { AIGuideDrawer } from './AIGuideDrawer';
import { api } from '../../lib/api';
import { useAuth } from '@/hooks/useAuth';
import { getVisitorId } from '@/utils/visitorId';

interface AIGuidedLearningProps {
  contentId: string;
  content?: { metadata_json?: any } | null;
  onUIStateChange?: (state: any) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

export const AIGuidedLearning: React.FC<AIGuidedLearningProps> = ({ contentId, content, onUIStateChange }) => {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation('aiGuide');
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hasInit, setHasInit] = useState(false);
  const [initFailed, setInitFailed] = useState(false);
  const [trialStatus, setTrialStatus] = useState<{ content_generated: boolean; ai_guide_used: boolean } | null>(null);
  const [freeTrialUsed, setFreeTrialUsed] = useState(false);
  // 记录初始化时 metadata 是否存在（用于显示分析动画）
  const [hadMetadataOnInit, setHadMetadataOnInit] = useState<boolean | null>(null);

  // 检查免费试用状态（未登录用户）
  const fetchTrialStatus = async () => {
    if (user) return; // 已登录用户不需要检查
    try {
      const status = await api.visitor.checkTrial();
      if (status.success && status.data) {
        setTrialStatus(status.data);
        if (status.data.ai_guide_used) {
          setFreeTrialUsed(true);
        }
      }
    } catch (e) {
      // 静默失败
    }
  };

  useEffect(() => {
    if (!user) {
      fetchTrialStatus();
    }
  }, [user]);

  // Initialize conversation when opening for the first time
  const initSession = async () => {
    if (hasInit && !initFailed) return;
    
    // 记录初始化时的 metadata 状态（如果还没记录）
    if (hadMetadataOnInit === null) {
      setHadMetadataOnInit(!!content?.metadata_json);
    }
    
    setIsLoading(true);
    setInitFailed(false);
    try {
      let res;
      
      if (!user) {
        // 未登录用户：检查免费试用状态
        await fetchTrialStatus();
        if (trialStatus?.ai_guide_used) {
          setMessages([{ 
            role: 'assistant', 
            content: t('pleaseLoginToContinue', { defaultValue: '请登录后继续免费使用' })
          }]);
          setHasInit(true);
          setInitFailed(false);
          setIsLoading(false);
          return;
        }
        
        // 使用免费初始化接口
        res = await api.aiGuide.initFree(contentId);
      } else {
        // 已登录用户：使用原有接口
        res = await api.aiGuide.init(contentId);
      }
      
      if (res) {
        setConversationId(res.conversation_id);
        
        // 适配新的 API 响应格式
        if (res.is_resumed) {
          // 恢复历史对话：使用 messages 数组（如果有历史消息）
          if (res.messages && res.messages.length > 0) {
            setMessages(res.messages.map((msg: any) => ({
              role: msg.role,
              content: msg.content,
              created_at: msg.created_at
            })));
          } else {
            // 如果恢复的对话没有消息，显示空列表（不应该显示初始消息）
            setMessages([]);
          }
        } else if (res.initial_message) {
          // 新对话：显示初始消息
          setMessages([{ role: 'assistant', content: res.initial_message }]);
        } else {
          // 如果没有初始消息也没有历史消息，显示空消息列表
          setMessages([]);
        }
        
        setHasInit(true);
        setInitFailed(false);
      }
    } catch (error) {
      console.error('Failed to init AI guide:', error);
      const errorMsg = error instanceof Error ? error.message : '';
      const errorObj = error as any;
      
      // 检查是否是免费试用已用完的错误
      if (errorMsg.includes('FREE_TRIAL_USED') || errorObj?.error === 'FREE_TRIAL_USED' || errorMsg.includes('免费试用已用完')) {
        setFreeTrialUsed(true);
        setTrialStatus(prev => ({ ...prev, ai_guide_used: true } as any));
        setMessages([{ 
          role: 'assistant', 
          content: t('pleaseLoginToContinue', { defaultValue: '请登录后继续免费使用' })
        }]);
        setInitFailed(false);
      } else if (errorMsg.includes('认证') || errorMsg.includes('登录') || errorMsg.includes('authentication')) {
        setMessages([{ 
          role: 'assistant', 
          content: t('loginPrompt')
        }]);
        setInitFailed(false);
      } else {
        setMessages([{ 
          role: 'assistant', 
          content: t('errorInitializing') + ': ' + errorMsg
        }]);
        setInitFailed(true);
      }
      setHasInit(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Retry initialization
  const retryInit = async () => {
    setHasInit(false);
    setInitFailed(false);
    setConversationId(null);
    setMessages([]);
    await initSession();
  };

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    if (newState && !hasInit) {
      // 记录打开时的 metadata 状态
      setHadMetadataOnInit(!!content?.metadata_json);
      initSession();
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!conversationId) {
      setMessages(prev => [...prev, 
        { role: 'user', content: text },
        { role: 'assistant', content: t('errorInitializing') }
      ]);
      return;
    }

    // 未登录用户：检查免费试用状态
    if (!user) {
      if (freeTrialUsed || trialStatus?.ai_guide_used) {
        setMessages(prev => [...prev, 
          { role: 'user', content: text },
          { role: 'assistant', content: t('pleaseLoginToContinue', { defaultValue: '请登录后继续免费使用' }) }
        ]);
        return;
      }
    }

    // Add user message immediately
    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    
    // Add placeholder for AI message
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
    
    setIsLoading(true);
    try {
      let fullReply = '';
      let trialUsedInThisChat = false;
      
      if (!user) {
        // 未登录用户：使用免费对话接口
        const result = await api.aiGuide.chatStreamFree(conversationId, text, null, (chunk) => {
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
        
        if (result?.freeTrialUsed) {
          trialUsedInThisChat = true;
          setFreeTrialUsed(true);
          setTrialStatus(prev => ({ ...prev, ai_guide_used: true } as any));
        }
      } else {
        // 已登录用户：使用原有接口
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
      }
      
      // 如果免费试用已使用，在消息中添加提示（不显示弹窗）
      if (trialUsedInThisChat) {
        // 在 AI 回复后添加一条提示消息
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: t('pleaseLoginToContinue', { defaultValue: '请登录后继续免费使用' })
        }]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMsg = error instanceof Error ? error.message : '';
      const errorObj = error as any;
      
      // 检查是否是免费试用已用完的错误
      if (errorMsg.includes('FREE_TRIAL_USED') || errorObj?.error === 'FREE_TRIAL_USED' || errorMsg.includes('免费试用已用完')) {
        setFreeTrialUsed(true);
        setTrialStatus(prev => ({ ...prev, ai_guide_used: true } as any));
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === 'assistant' && !lastMsg.content) {
            lastMsg.content = t('pleaseLoginToContinue', { defaultValue: '请登录后继续免费使用' });
          }
          return newMessages;
        });
      } else {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === 'assistant' && !lastMsg.content) {
            if (errorMsg.includes('认证') || errorMsg.includes('登录') || errorMsg.includes('authentication')) {
              lastMsg.content = t('loginPrompt');
            } else {
              lastMsg.content = t('errorSending') + ': ' + errorMsg;
            }
          }
          return newMessages;
        });
      }
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
        isLoggedIn={!!user}
        initFailed={initFailed}
        onRetryInit={retryInit}
        freeTrialUsed={freeTrialUsed || trialStatus?.ai_guide_used || false}
        hasMetadata={hadMetadataOnInit !== null ? hadMetadataOnInit : !!(content?.metadata_json !== undefined && content?.metadata_json !== null)}
      />
    </>
  );
};

