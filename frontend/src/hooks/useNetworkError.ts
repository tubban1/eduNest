import { useEffect, useCallback } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { toast } from '../utils/toast';

/**
 * 网络错误处理 Hook
 * 统一处理网络错误，显示用户友好的提示
 */
export function useNetworkError() {
  const { isOnline, isOffline, wasOffline } = useNetworkStatus();

  // 监听离线状态
  useEffect(() => {
    if (isOffline) {
      toast.warning('网络连接已断开，请检查网络设置', 5000);
    }
  }, [isOffline]);

  // 监听网络恢复
  useEffect(() => {
    if (wasOffline && isOnline) {
      toast.success('网络连接已恢复', 3000);
    }
  }, [wasOffline, isOnline]);

  // 处理网络错误的统一方法
  const handleNetworkError = useCallback((error: any, context?: string): string => {
    const errorMessage = error?.message || String(error);
    
    // 判断是否为网络错误
    const isNetworkError = 
      error instanceof TypeError ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('NetworkError') ||
      errorMessage.includes('网络连接') ||
      errorMessage.includes('请求超时') ||
      errorMessage.includes('timeout');

    if (isNetworkError) {
      const message = isOffline 
        ? '网络连接已断开，请检查网络设置'
        : '网络连接失败，请稍后重试';
      
      toast.error(message, 5000);
      return message;
    }

    // 其他错误，显示原始错误信息
    const displayMessage = context 
      ? `${context}: ${errorMessage}`
      : errorMessage;
    
    toast.error(displayMessage, 5000);
    return displayMessage;
  }, [isOffline]);

  return {
    isOnline,
    isOffline,
    handleNetworkError,
  };
}

