'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Heart, Plus, Settings, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';

export default function Sidebar() {
  const { t } = useTranslation(['navigation', 'common', 'auth']);
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const menuItems = [
    { href: '/content', label: t('myContent', { ns: 'navigation', defaultValue: 'My Creations' }), icon: BookOpen },
    { href: '/collections', label: t('myCollections', { ns: 'navigation', defaultValue: 'My Collections' }), icon: Heart },
    { href: '/content/create', label: t('createContent', { ns: 'navigation', defaultValue: 'Create Content' }), icon: Plus },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/';
    } catch (error) {}
  };

  return (
    <div className="w-64 h-screen bg-white shadow-sm border-r border-gray-200 flex flex-col">
      <div className="p-6 flex-1">
        <h1 className="text-xl font-bold text-gray-900 mb-2">{t('platformTitle', { ns: 'common', defaultValue: 'EduNest AI' })}</h1>
        <LanguageSelector variant="button" />
        {/* 用户信息 */}
        {user && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center mb-3">
              <User className="w-5 h-5 text-gray-600 mr-2" />
              <span className="text-sm font-medium text-gray-900">{t('userInfo', { ns: 'auth', defaultValue: 'User Info' })}</span>
            </div>
            <div className="text-sm text-gray-600">
              <div className="mb-1">
                <span className="font-medium">{t('username', { ns: 'auth', defaultValue: 'Name:' })}</span> {user.name}
              </div>
              <div className="mb-1">
                <span className="font-medium">{t('email', { ns: 'auth', defaultValue: 'Email:' })}</span> {user.email}
              </div>
              <div>
                <span className="font-medium">{t('role', { ns: 'auth', defaultValue: 'Role:' })}</span> {user.email.includes('admin') ? t('admin', { ns: 'auth', defaultValue: 'Admin' }) : t('user', { ns: 'auth', defaultValue: 'User' })}
              </div>
            </div>
          </div>
        )}
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {/* 登出按钮 */}
      {user && (
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            {t('logout', { ns: 'auth', defaultValue: 'Logout' })}
          </button>
        </div>
      )}
    </div>
  );
} 