'use client';

import Link from 'next/link';
import { Edit3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

interface EditButtonProps {
  contentId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function EditButton({ 
  contentId, 
  size = 'md',
  className = ''
}: EditButtonProps) {
  const { t } = useTranslation(['common']);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => { setMounted(true); }, []);

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <Link
      href={`/c/edit/${contentId}`}
      className={`flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors ${sizeClasses[size]} ${className}`}
      title={mounted ? t('edit', { ns: 'common', defaultValue: 'Edit' }) : 'Edit'}
    >
      <Edit3 className={iconSizes[size]} />
    </Link>
  );
}
