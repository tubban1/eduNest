'use client';

import React from 'react';
import { truncateUserQuery } from '@/utils/generationStatus';

interface PendingCardProps {
  content: {
    id: string;
    title: string;
    created_at: string;
  };
  userQuery?: string;
}

const PendingCard: React.FC<PendingCardProps> = ({ content, userQuery }) => (
  <div className="bg-gray-100 rounded-lg p-4 animate-pulse">
    {/* 显示用户查询 */}
    {userQuery && (
      <div className="mb-3">
        <div className="text-sm text-gray-600 font-medium mb-1">
          生成内容: <span title={userQuery}>{truncateUserQuery(userQuery, 15)}</span>
        </div>
      </div>
    )}
    
    {/* 简化的占位符内容 */}
    <div className="space-y-2 mb-4">
      <div className="h-3 bg-gray-300 rounded w-full"></div>
      <div className="h-3 bg-gray-300 rounded w-4/5"></div>
    </div>
    
    {/* 底部状态 */}
    <div className="flex items-center justify-center">
      <div className="text-sm text-gray-500 flex items-center gap-1">
        <span>⏳</span>
        <span>等待生成中...</span>
      </div>
    </div>
  </div>
);

export default PendingCard;
