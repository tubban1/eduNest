'use client';

import React from 'react';
import { truncateUserQuery } from '@/utils/generationStatus';

interface ProcessingCardProps {
  content: {
    id: string;
    title: string;
    created_at: string;
  };
  progress: number;
  retryCount: number;
  userQuery?: string;
}

const ProcessingCard: React.FC<ProcessingCardProps> = ({ content, progress, retryCount, userQuery }) => (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
    {/* 显示用户查询 */}
    {userQuery && (
      <div className="mb-3">
        <div className="text-sm text-blue-700 font-medium mb-1">
          生成内容: <span title={userQuery}>{truncateUserQuery(userQuery, 15)}</span>
        </div>
      </div>
    )}
    
    {/* 进度条 */}
    <div className="mb-4">
      <div className="flex justify-between text-sm text-blue-600 mb-1">
        <span>生成进度</span>
        <span>{progress}%</span>
      </div>
      <div 
        className="w-full bg-blue-100 rounded-full h-2 cursor-pointer"
        onClick={() => {
          // 点击进度条显示详细动画
          const event = new CustomEvent('showAiLoadingAnimation', { 
            detail: { knowledgePoint: userQuery || 'AI生成中' } 
          });
          window.dispatchEvent(event);
        }}
      >
        <div 
          className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="text-xs text-blue-500 mt-1 text-center">
        点击进度条查看详细生成过程
      </div>
    </div>

    {/* 简化的占位符内容 */}
    <div className="space-y-2 mb-4">
      <div className="h-3 bg-blue-100 rounded w-full animate-pulse"></div>
      <div className="h-3 bg-blue-100 rounded w-4/5 animate-pulse"></div>
    </div>
    
    {/* 底部状态 */}
    <div className="flex items-center justify-center">
      <div className="text-sm text-blue-600 flex items-center gap-1">
        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <span>AI 正在生成中...</span>
        {retryCount > 0 && (
          <span className="text-xs text-blue-500">(自动重试 {retryCount}/2)</span>
        )}
      </div>
    </div>
    
    {/* 生成提示 */}
    <div className="mt-2 text-xs text-blue-500 text-center">
      {progress < 50 && "正在分析您的需求..."}
      {progress >= 50 && progress < 80 && "正在生成教学内容..."}
      {progress >= 80 && "即将完成，请稍候..."}
    </div>
  </div>
);

export default ProcessingCard;
