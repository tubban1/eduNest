'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { MobileMenuButton } from './Sidebar';

interface MobileHeaderProps {
  onMenuClick: () => void;
  className?: string;
}

export default function MobileHeader({ onMenuClick, className = '' }: MobileHeaderProps) {
  const { user } = useAuth();
  const { t } = useTranslation(['navigation', 'auth']);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className={`lg:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 border-b border-border ${className}`}>
      <MobileMenuButton onClick={onMenuClick} />
      {!user ? (
        <Link
          href="/login"
          className="ai-gradient-btn px-4 py-2 rounded-lg text-sm font-medium"
        >
          {mounted ? t('login', { ns: 'auth', defaultValue: '登录' }) : 'Login'}
        </Link>
      ) : (
        <div className="w-16" aria-hidden />
      )}
    </div>
  );
}
