import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

interface LoginRequiredProps {
  title?: string;
  description?: string;
  showSidebar?: boolean;
}

export default function LoginRequired({ 
  title, 
  description,
  showSidebar = false 
}: LoginRequiredProps) {
  const { t } = useTranslation(['auth', 'common', 'home']);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const content = (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="mb-6">
          <LogIn className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{title || (mounted ? t('loginRequired', { ns: 'auth', defaultValue: 'Please login' }) : 'Please login')}</h1>
          <p className="text-gray-600">{description || (mounted ? t('loginRequiredDesc', { ns: 'auth', defaultValue: 'Login to view this page content' }) : 'Login to view this page content')}</p>
        </div>
        <div className="space-y-3">
          <Link
            href="/login"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium w-full"
          >
            {mounted ? t('login', { ns: 'auth', defaultValue: 'Login' }) : 'Login'}
          </Link>
          <Link
            href="/"
            className="inline-block bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium w-full"
          >
            {mounted ? t('home', { ns: 'navigation', defaultValue: 'Home' }) : 'Home'}
          </Link>
        </div>
      </div>
    </div>
  );

  if (showSidebar) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <div className="w-64 bg-white shadow-sm border-r border-gray-200">
          {/* 空的侧边栏 */}
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      {content}
    </div>
  );
} 