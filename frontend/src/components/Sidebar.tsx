'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Heart, Plus, Settings, LogOut, User, Menu, X, List, Share2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import CreditsHistoryDialog from './CreditsHistoryDialog';

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
  const [credits, setCredits] = useState<number | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [referralCode, setReferralCode] = useState<string>('');
  const [loadingReferral, setLoadingReferral] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchCredits = async () => {
    if (!user) {
      setCredits(null);
      return;
    }
    try {
      setLoadingCredits(true);
      const res = await api.get('/credits/balance');
      if ((res as any)?.success) {
        setCredits((res as any).data?.balance ?? 0);
      } else if ((res as any)?.data?.balance !== undefined) {
        setCredits((res as any).data.balance);
      }
    } catch (e) {
      setCredits(null);
    } finally {
      setLoadingCredits(false);
    }
  };

  // 首次加载
  useEffect(() => {
    fetchCredits();
    // 仅查询已有推荐码，不生成
    const fetchReferral = async () => {
      if (!user) { setReferralCode(''); return; }
      try {
        setLoadingReferral(true);
        const res = await api.get('/referrals/code');
        if ((res as any)?.success) {
          setReferralCode((res as any).data?.code || '');
        }
      } catch (e) {
        setReferralCode('');
      } finally {
        setLoadingReferral(false);
      }
    };
    fetchReferral();
  }, [user]);

  const handleShareReferral = async () => {
    try {
      // 确保有邀请码
      if (!referralCode) {
        const res = await api.post('/referrals/code'); // 显式生成
        if ((res as any)?.success) {
          const code = (res as any).data?.code || '';
          setReferralCode(code);
        }
      }
      const url = `${window.location.origin}/signup?ref=${encodeURIComponent(referralCode)}`;
      if (navigator.share) {
        await navigator.share({ title: '邀请注册', text: '一起使用 EduNest AI', url });
      } else {
        await navigator.clipboard.writeText(url);
        // 无额外提示，静默复制
      }
    } catch {}
  };

  // 分享/邀请与手动刷新已移除，积分自动加载

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
    if (variant === 'mobile' && onClose) onClose();
  };

  const sidebarContent = (
    <div className="w-64 h-screen bg-white shadow-sm border-r border-gray-200 flex flex-col">
      {variant === 'mobile' && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">
            {mounted ? t('platformTitle', { ns: 'common', defaultValue: 'EduNest AI' }) : 'EduNest AI'}
          </h1>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      )}
      
      <div className="p-6 flex-1">
        {variant === 'desktop' && (
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {mounted ? t('platformTitle', { ns: 'common', defaultValue: 'EduNest AI' }) : 'EduNest AI'}
          </h1>
        )}
        
        <LanguageSelector variant="button" />
        
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
                <span className="font-medium">{mounted ? t('username', { ns: 'auth', defaultValue: 'Name:' }) : 'Name:'}</span> {user.name}
              </div>
              <div className="mb-1">
                <span className="font-medium">{mounted ? t('email', { ns: 'auth', defaultValue: 'Email:' }) : 'Email:'}</span> {user.email}
              </div>
              <div className="mb-1">
                <span className="font-medium">{mounted ? t('role', { ns: 'auth', defaultValue: 'Role:' }) : 'Role:'}</span> {user.role === 'admin' ? (mounted ? t('admin', { ns: 'auth', defaultValue: 'Admin' }) : 'Admin') : (mounted ? t('user', { ns: 'auth', defaultValue: 'User' }) : 'User')}
              </div>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <span className="font-medium">邀请码:</span>{' '}
                  {loadingReferral ? (mounted ? t('loading', { ns: 'common', defaultValue: '加载中...' }) : 'Loading...') : (referralCode || '-')}
                </div>
                <button onClick={handleShareReferral} className="p-1.5 rounded hover:bg-gray-200" title="分享邀请链接">
                  <Share2 className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{mounted ? t('credits', { ns: 'common', defaultValue: '积分:' }) : '积分:'}</span>{' '}
                  {loadingCredits ? (mounted ? t('loading', { ns: 'common', defaultValue: '加载中...' }) : 'Loading...') : (credits ?? '-')}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowHistory(true)} className="p-1.5 rounded hover:bg-gray-200" title="明细">
                    <List className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {user && (
          <Link
            href="/subscription"
            onClick={handleItemClick}
            className="block w-full mb-4 px-4 py-3 rounded-lg bg-blue-600 text-white text-sm font-medium text-center hover:bg-blue-700"
          >
            升级到 Pro
          </Link>
        )}

        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} onClick={handleItemClick}
                className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}>
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      
      {user && (
        <div className="p-6 border-t border-gray-200">
          <button onClick={handleSignOut} className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors">
            <LogOut className="w-5 h-5 mr-3" />
            {mounted ? t('logout', { ns: 'auth', defaultValue: 'Logout' }) : 'Logout'}
          </button>
        </div>
      )}

      {/* 积分明细弹窗 */}
      <CreditsHistoryDialog open={showHistory} onClose={() => setShowHistory(false)} />
    </div>
  );

  if (variant === 'mobile') {
    return (
      <>
        {isOpen && (<div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={onClose} />)}
        <div className={`fixed top-0 left-0 h-full z-50 lg:hidden transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {sidebarContent}
        </div>
      </>
    );
  }

  return sidebarContent;
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="打开菜单">
      <Menu className="w-6 h-6 text-gray-600" />
    </button>
  );
} 