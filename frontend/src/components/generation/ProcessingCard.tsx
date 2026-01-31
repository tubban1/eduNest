'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  startedAt?: string; // 新增：开始时间
}

const ProcessingCard: React.FC<ProcessingCardProps> = ({ content, progress, retryCount, userQuery, startedAt }) => {
  const { t } = useTranslation(['content', 'common']);
  const [elapsedTime, setElapsedTime] = useState(0);

  // 实时计算已用时间
  useEffect(() => {
    if (!startedAt) return;
    
    const updateTimer = () => {
      const now = new Date();
      const start = new Date(startedAt);
      const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);
      const newElapsedTime = Math.max(0, elapsed);
      setElapsedTime(newElapsedTime);
    };
    
    // 立即更新一次
    updateTimer();
    
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="bg-[#a78bfa]/10 border border-[#a78bfa]/20 rounded-lg p-4">
      {userQuery && (
        <div className="mb-3">
            <div className="text-sm text-[#a78bfa] font-medium mb-1">
            {t('generation.userQuery', { ns: 'content', defaultValue: '生成内容' })}: <span title={userQuery}>{truncateUserQuery(userQuery, 15)}</span>
          </div>
        </div>
      )}
      
      {/* 计时器显示 */}
      <div className="mb-4 bg-[#a78bfa]/20 rounded-lg p-3 text-center">
        <div className="text-3xl font-bold text-[#a78bfa] mb-1">
          {formatElapsed(elapsedTime)}
        </div>
        <div className="text-xs text-[#a78bfa]/80">
          {t('generation.processingElapsed', { ns: 'content', defaultValue: '生成耗时' })}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="h-3 bg-[#a78bfa]/20 rounded w-full animate-pulse"></div>
        <div className="h-3 bg-[#a78bfa]/20 rounded w-4/5 animate-pulse"></div>
      </div>
      
      <div className="flex items-center justify-center">
        <div className="text-sm text-[#a78bfa] flex items-center gap-1">
          <div className="animate-spin w-4 h-4 border-2 border-[#a78bfa] border-t-transparent rounded-full"></div>
          <span>{t('generation.processing', { ns: 'content', defaultValue: '请勿离开本页，并保持网络通畅' })}</span>
          {retryCount > 0 && (
            <span className="text-xs text-[#a78bfa]/80">{t('generation.autoRetry', { ns: 'content', defaultValue: '(自动重试 {{count}}/2)', count: retryCount })}</span>
          )}
        </div>
      </div>
      
      <div className="mt-2 text-xs text-[#a78bfa]/80 text-center">
        {progress < 50 && t('generation.phaseAnalyzing', { ns: 'content', defaultValue: '正在分析您的需求...' })}
        {progress >= 50 && progress < 80 && t('generation.phaseGenerating', { ns: 'content', defaultValue: '请勿离开本页，并保持网络通畅' })}
        {progress >= 80 && t('generation.phaseFinishing', { ns: 'content', defaultValue: '即将完成，请稍候...' })}
      </div>
    </div>
  );
};

export default ProcessingCard;
