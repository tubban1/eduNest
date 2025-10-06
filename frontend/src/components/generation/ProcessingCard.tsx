'use client';

import React from 'react';
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
}

const ProcessingCard: React.FC<ProcessingCardProps> = ({ content, progress, retryCount, userQuery }) => {
  const { t } = useTranslation(['content', 'common']);
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      {userQuery && (
        <div className="mb-3">
          <div className="text-sm text-blue-700 font-medium mb-1">
            {t('generation.userQuery', { ns: 'content', defaultValue: '生成内容' })}: <span title={userQuery}>{truncateUserQuery(userQuery, 15)}</span>
          </div>
        </div>
      )}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-blue-600 mb-1">
          <span>{t('generation.progress', { ns: 'content', defaultValue: '生成进度' })}</span>
          <span>{progress}%</span>
        </div>
        <div 
          className="w-full bg-blue-100 rounded-full h-2 cursor-pointer"
          onClick={() => {
            const event = new CustomEvent('showAiLoadingAnimation', { 
              detail: { knowledgePoint: userQuery || t('generation.loading', { ns: 'content', defaultValue: 'AI生成中' }) } 
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
          {t('generation.viewDetails', { ns: 'content', defaultValue: '点击进度条查看详细生成过程' })}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="h-3 bg-blue-100 rounded w-full animate-pulse"></div>
        <div className="h-3 bg-blue-100 rounded w-4/5 animate-pulse"></div>
      </div>
      
      <div className="flex items-center justify-center">
        <div className="text-sm text-blue-600 flex items-center gap-1">
          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span>{t('generation.processing', { ns: 'content', defaultValue: 'AI 正在生成中...' })}</span>
          {retryCount > 0 && (
            <span className="text-xs text-blue-500">{t('generation.autoRetry', { ns: 'content', defaultValue: '(自动重试 {{count}}/2)', count: retryCount })}</span>
          )}
        </div>
      </div>
      
      <div className="mt-2 text-xs text-blue-500 text-center">
        {progress < 50 && t('generation.phaseAnalyzing', { ns: 'content', defaultValue: '正在分析您的需求...' })}
        {progress >= 50 && progress < 80 && t('generation.phaseGenerating', { ns: 'content', defaultValue: '正在生成教学内容...' })}
        {progress >= 80 && t('generation.phaseFinishing', { ns: 'content', defaultValue: '即将完成，请稍候...' })}
      </div>
    </div>
  );
};

export default ProcessingCard;
