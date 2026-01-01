import { useState, useEffect } from 'react';

/**
 * 网络状态检测 Hook
 * 监听浏览器的在线/离线状态变化
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    // 初始化时检查网络状态
    if (typeof window !== 'undefined' && 'navigator' in window) {
      return navigator.onLine;
    }
    return true; // 服务端渲染时默认为在线
  });

  const [wasOffline, setWasOffline] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('navigator' in window)) {
      return;
    }

    const handleOnline = () => {
      setIsOnline(true);
      // 如果之前是离线状态，标记为已恢复
      if (wasOffline) {
        setWasOffline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    // 监听在线/离线事件
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 清理事件监听器
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline, // 用于检测是否刚刚从离线恢复
  };
}

