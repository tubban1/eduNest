'use client';

import React from 'react';

interface FailedCardProps {
  content: {
    id: string;
    title: string;
    created_at: string;
  };
  errorMessage?: string;
  retryCount: number;
  onRetry: () => void;
  isRetrying: boolean;
}

const FailedCard: React.FC<FailedCardProps> = ({ 
  content, 
  errorMessage, 
  retryCount, 
  onRetry, 
  isRetrying 
}) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
        <span className="text-red-500 text-xl">❌</span>
      </div>
      <div className="flex-1">
        <div className="h-4 bg-red-100 rounded mb-2 w-3/4"></div>
        <div className="h-3 bg-red-100 rounded w-1/2"></div>
      </div>
    </div>

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

    <div className="space-y-2">
      <div className="h-3 bg-red-100 rounded w-full"></div>
      <div className="h-3 bg-red-100 rounded w-5/6"></div>
      <div className="h-3 bg-red-100 rounded w-4/6"></div>
    </div>
    
    <div className="mt-4 flex items-center justify-between">
      <div className="flex gap-2">
        <div className="w-16 h-6 bg-red-100 rounded"></div>
        <div className="w-20 h-6 bg-red-100 rounded"></div>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="text-sm text-red-600 flex items-center gap-1">
          <span>❌</span>
          <span>生成失败</span>
          {retryCount > 0 && (
            <span className="text-xs text-red-500">(已重试 {retryCount}/2)</span>
          )}
        </div>
        
        <button
          onClick={onRetry}
          disabled={isRetrying || retryCount >= 2}
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
  </div>
);

export default FailedCard;
