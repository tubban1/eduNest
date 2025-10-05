'use client';

import React from 'react';

interface PendingCardProps {
  content: {
    id: string;
    title: string;
    created_at: string;
  };
}

const PendingCard: React.FC<PendingCardProps> = ({ content }) => (
  <div className="bg-gray-100 rounded-lg p-4 animate-pulse">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-12 h-12 bg-gray-300 rounded-lg"></div>
      <div className="flex-1">
        <div className="h-4 bg-gray-300 rounded mb-2 w-3/4"></div>
        <div className="h-3 bg-gray-300 rounded w-1/2"></div>
      </div>
    </div>
    <div className="space-y-2">
      <div className="h-3 bg-gray-300 rounded w-full"></div>
      <div className="h-3 bg-gray-300 rounded w-5/6"></div>
      <div className="h-3 bg-gray-300 rounded w-4/6"></div>
    </div>
    <div className="mt-4 flex items-center justify-between">
      <div className="flex gap-2">
        <div className="w-16 h-6 bg-gray-300 rounded"></div>
        <div className="w-20 h-6 bg-gray-300 rounded"></div>
      </div>
      <div className="text-sm text-gray-500 flex items-center gap-1">
        <span>⏳</span>
        <span>等待生成中...</span>
      </div>
    </div>
  </div>
);

export default PendingCard;
