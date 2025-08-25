'use client';

import { useState, useEffect } from 'react';
import { detectSessionConflict, enforceSingleAccount } from '@/utils/sessionManager';

export default function SessionConflictAlert() {
  const [showAlert, setShowAlert] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    // 检测session冲突
    const checkConflict = () => {
      const hasConflict = detectSessionConflict();
      setShowAlert(hasConflict);
    };

    checkConflict();
    
    // 定期检查
    const interval = setInterval(checkConflict, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleResolve = async () => {
    setIsResolving(true);
    try {
      await enforceSingleAccount();
      setShowAlert(false);
      // 刷新页面以确保状态一致
      window.location.reload();
    } catch (error) {
      console.error('Failed to resolve session conflict:', error);
    } finally {
      setIsResolving(false);
    }
  };

  if (!showAlert) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-4 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-xl">⚠️</div>
          <div>
            <div className="font-bold">检测到多账号登录冲突</div>
            <div className="text-sm text-red-100">
              系统检测到您在同一个浏览器中登录了多个账号，这可能导致数据混乱和安全问题。
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleResolve}
            disabled={isResolving}
            className="px-4 py-2 bg-white text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {isResolving ? '处理中...' : '立即解决'}
          </button>
          
          <button
            onClick={() => setShowAlert(false)}
            className="px-3 py-2 text-red-100 hover:text-white transition-colors"
          >
            稍后处理
          </button>
        </div>
      </div>
    </div>
  );
} 