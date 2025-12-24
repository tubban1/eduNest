'use client';

import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';

export default function LoadingSpinner() {
  const { t } = useTranslation(['common']);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <span className="ml-3 text-lg text-muted-foreground">
        {mounted ? t('loading', { ns: 'common', defaultValue: '加载中...' }) : '加载中...'}
      </span>
    </div>
  );
} 