'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { truncateUserQuery } from '@/utils/generationStatus';

interface PendingCardProps {
  content?: {
    id: string;
    title: string;
    created_at: string;
  };
  userQuery?: string;
  queuedAt?: string;
}

const PendingCard: React.FC<PendingCardProps> = ({ userQuery, queuedAt }) => {
  const { t } = useTranslation(['content', 'common']);
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);

  useEffect(() => {
    if (!queuedAt) {
      setElapsedTime(null);
      return;
    }

    const start = new Date(queuedAt);

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - start.getTime()) / 1000));
      setElapsedTime(diff);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [queuedAt]);

  const formatElapsed = (seconds: number | null) => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="bg-gray-100 rounded-lg p-4 animate-pulse">
      {userQuery && (
        <div className="mb-3">
          <div className="text-sm text-gray-600 font-medium mb-1">
            {t('generation.userQuery', { ns: 'content', defaultValue: '生成内容' })}: <span title={userQuery}>{truncateUserQuery(userQuery, 15)}</span>
          </div>
        </div>
      )}
      <div className="space-y-2 mb-4">
        <div className="h-3 bg-gray-300 rounded w-full"></div>
        <div className="h-3 bg-gray-300 rounded w-4/5"></div>
      </div>
      <div className="flex items-center justify-center">
        <div className="text-sm text-gray-500 flex items-center gap-1">
          <span>⏳</span>
          <span>{t('generation.pending', { ns: 'content', defaultValue: '请勿离开本页，并保持网络通畅' })}</span>
        </div>
      </div>
      <div className="mt-3 text-center text-xs text-gray-500">
        {t('generation.pendingElapsed', { ns: 'content', defaultValue: '排队时长' })}：{formatElapsed(elapsedTime)}
      </div>
    </div>
  );
};

export default PendingCard;
