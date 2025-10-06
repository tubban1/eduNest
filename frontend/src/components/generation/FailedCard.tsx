'use client';

import React from 'react';
import { truncateUserQuery } from '@/utils/generationStatus';

interface FailedCardProps {
  content: {
    id: string;
    title: string;
    created_at: string;
  };
  errorMessage?: string;
  retryCount: number;
  userQuery?: string;
  onRetry: () => void;
  isRetrying: boolean;
}

const FailedCard: React.FC<FailedCardProps> = ({ 
  content, 
  errorMessage, 
  retryCount, 
  userQuery,
  onRetry, 
  isRetrying 
}) => {
  // 基于测试页面的成功逻辑，确保重试按钮正确激活
  const canRetry = !isRetrying;
  
  return (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    {/* 显示用户查询 */}
    {userQuery && (
      <div className="mb-3">
        <div className="text-sm text-red-700 font-medium mb-1">
          生成内容: <span title={userQuery}>{truncateUserQuery(userQuery, 15)}</span>
        </div>
      </div>
    )}

    {/* 错误信息 */}
    {errorMessage && (
      <div className="mb-4 p-3 bg-red-100 rounded-lg border border-red-200">
        <div className="flex items-start gap-2">
          <span className="text-red-500 text-sm">⚠️</span>
          <div className="flex-1">
            <p className="text-sm text-red-700 font-medium">生成失败</p>
            <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
          </div>
        </div>
      </div>
    )}
    
    {/* 底部操作区域 */}
    <div className="flex items-center justify-between">
      <div className="text-sm text-red-600 flex items-center gap-1">
        <span>❌</span>
        <span>生成失败</span>
        {retryCount > 0 && (
          <span className="text-xs text-red-500">(自动重试 {retryCount}/2)</span>
        )}
      </div>
      
      <button
        onClick={onRetry}
        disabled={!canRetry}
        className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isRetrying ? (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
            <span>重试中...</span>
          </div>
        ) : (
          '重试'
        )}
      </button>
    </div>
  </div>
  );
};

export default FailedCard;
