'use client';

import React from 'react';

interface ProcessingCardProps {
  content: {
    id: string;
    title: string;
    created_at: string;
  };
  progress: number;
  retryCount: number;
}

const ProcessingCard: React.FC<ProcessingCardProps> = ({ content, progress, retryCount }) => (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
      <div className="flex-1">
        <div className="h-4 bg-blue-100 rounded mb-2 w-3/4 animate-pulse"></div>
        <div className="h-3 bg-blue-100 rounded w-1/2 animate-pulse"></div>
      </div>
    </div>
    
    {/* 进度条 */}
    <div className="mb-4">
      <div className="flex justify-between text-sm text-blue-600 mb-1">
        <span>生成进度</span>
        <span>{progress}%</span>
      </div>
      <div className="w-full bg-blue-100 rounded-full h-2">
        <div 
          className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>

    <div className="space-y-2">
      <div className="h-3 bg-blue-100 rounded w-full animate-pulse"></div>
      <div className="h-3 bg-blue-100 rounded w-5/6 animate-pulse"></div>
      <div className="h-3 bg-blue-100 rounded w-4/6 animate-pulse"></div>
    </div>
    
    <div className="mt-4 flex items-center justify-between">
      <div className="flex gap-2">
        <div className="w-16 h-6 bg-blue-100 rounded animate-pulse"></div>
        <div className="w-20 h-6 bg-blue-100 rounded animate-pulse"></div>
      </div>
      <div className="text-sm text-blue-600 flex items-center gap-1">
        <span>🔄</span>
        <span>AI 正在生成中...</span>
        {retryCount > 0 && (
          <span className="text-xs text-blue-500">(重试 {retryCount}/2)</span>
        )}
      </div>
    </div>
  </div>
);

export default ProcessingCard;
