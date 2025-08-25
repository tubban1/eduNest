'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Heart, Plus, Settings, LogOut, User, Menu, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';
import { useState, useEffect } from 'react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  variant?: 'desktop' | 'mobile';
}

export default function Sidebar({ isOpen = true, onClose, variant = 'desktop' }: SidebarProps) {
  const { t } = useTranslation(['navigation', 'common', 'auth']);
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const handleItemClick = () => {
    // 移动端点击菜单项后自动关闭侧边栏
    if (variant === 'mobile' && onClose) {
      onClose();
    }
  };

  const sidebarContent = (
    <div className="w-64 h-screen bg-white shadow-sm border-r border-gray-200 flex flex-col">
      {/* 移动端头部 */}
      {variant === 'mobile' && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">
            {mounted ? t('platformTitle', { ns: 'common', defaultValue: 'EduNest AI' }) : 'EduNest AI'}
          </h1>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      )}
      
      <div className="p-6 flex-1">
        {/* 桌面端标题 */}
        {variant === 'desktop' && (
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {mounted ? t('platformTitle', { ns: 'common', defaultValue: 'EduNest AI' }) : 'EduNest AI'}
          </h1>
        )}
        
        <LanguageSelector variant="button" />
        
        {/* 用户信息 */}
        {user && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center mb-3">
              <User className="w-5 h-5 text-gray-600 mr-2" />
              <span className="text-sm font-medium text-gray-900">
                {mounted ? t('userInfo', { ns: 'auth', defaultValue: 'User Info' }) : 'User Info'}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              <div className="mb-1">
                <span className="font-medium">
                  {mounted ? t('username', { ns: 'auth', defaultValue: 'Name:' }) : 'Name:'}
                </span> {user.name}
              </div>
              <div className="mb-1">
                <span className="font-medium">
                  {mounted ? t('email', { ns: 'auth', defaultValue: 'Email:' }) : 'Email:'}
                </span> {user.email}
              </div>
              <div>
                <span className="font-medium">
                  {mounted ? t('role', { ns: 'auth', defaultValue: 'Role:' }) : 'Role:'}
                </span> {user.email.includes('admin') ? 
                  (mounted ? t('admin', { ns: 'auth', defaultValue: 'Admin' }) : 'Admin') : 
                  (mounted ? t('user', { ns: 'auth', defaultValue: 'User' }) : 'User')
                }
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
                onClick={handleItemClick}
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
            {mounted ? t('logout', { ns: 'auth', defaultValue: 'Logout' }) : 'Logout'}
          </button>
        </div>
      )}
    </div>
  );

  if (variant === 'mobile') {
    return (
      <>
        {/* 移动端遮罩层 */}
        {isOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={onClose}
          />
        )}
        
        {/* 移动端侧边栏 */}
        <div 
          className={`fixed top-0 left-0 h-full z-50 lg:hidden transform transition-transform duration-300 ease-in-out ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebarContent}
        </div>
      </>
    );
  }

  // 桌面端侧边栏
  return sidebarContent;
}

// 移动端菜单按钮组件
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
      aria-label="打开菜单"
    >
      <Menu className="w-6 h-6 text-gray-600" />
    </button>
  );
} 