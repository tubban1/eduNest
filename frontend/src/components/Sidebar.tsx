'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Heart, Plus, Settings, LogOut, User, Menu, X, List, HelpCircle, Crown, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';
import Logo from './Logo';
import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import CreditsHistoryDialog from './CreditsHistoryDialog';
import LogoEduAnimation from './LogoEduAnimation';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  variant?: 'desktop' | 'mobile';
}

export default function Sidebar({ isOpen = true, onClose, variant = 'desktop' }: SidebarProps) {
  const { t } = useTranslation(['navigation', 'common', 'auth', 'content', 'credits']);
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [userInfoExpanded, setUserInfoExpanded] = useState(false);

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

  // 获取订阅状态
  const fetchSubscription = async () => {
    if (!user) {
      setSubscription(null);
      return;
    }
    try {
      setLoadingSubscription(true);
      const data = await api.getSubscriptionStatus();
      setSubscription(data);
    } catch (error) {
      console.error('获取订阅状态失败:', error);
      setSubscription(null);
    } finally {
      setLoadingSubscription(false);
    }
  };

  // 首次加载
  useEffect(() => {
    fetchCredits();
    fetchSubscription();
  }, [user]);

  // 判断是否是Pro用户
  const isProUser = useMemo(() => {
    if (!subscription) return false;
    const plan = subscription.plan;
    const status = subscription.status;
    const isActive = subscription.is_active;
    // Pro用户：plan是monthly或yearly，且状态是active
    return (plan === 'monthly' || plan === 'yearly') && (status === 'active' || isActive);
  }, [subscription]);

  // 使用 useMemo 确保在 mounted 之前使用默认值，避免 hydration 错误
  const menuItems = useMemo(() => {
    if (!mounted) {
      // 服务器端渲染时使用默认英语文本
      return [
        { href: '/', label: 'Home', icon: Home },
        { href: '/c', label: 'My Creations', icon: BookOpen },
        { href: '/collections', label: 'My Collections', icon: Heart },
        { href: '/help', label: 'Help', icon: HelpCircle },
      ];
    }
    // 客户端挂载后使用翻译
    return [
      { href: '/', label: t('home', { ns: 'navigation', defaultValue: 'Home' }), icon: Home },
      { href: '/c', label: t('myContent', { ns: 'navigation', defaultValue: 'My Creations' }), icon: BookOpen },
      { href: '/collections', label: t('myCollections', { ns: 'navigation', defaultValue: 'My Collections' }), icon: Heart },
      { href: '/help', label: t('help', { ns: 'navigation', defaultValue: 'Help' }), icon: HelpCircle },
    ];
  }, [mounted, t]);

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
    <div className={`sidebar-dark w-64 h-screen bg-slate-900/65 backdrop-blur-xl border-r border-white/10 flex flex-col shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.06)] ${variant === 'mobile' ? 'h-[100dvh]' : ''}`}>
      {variant === 'mobile' && (
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Logo size="sm" className="[&_span]:text-gray-100" />
            <LanguageSelector variant="button" />
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      )}
      
      <div className="p-6 flex-1">
        {variant === 'desktop' && (
          <div className="mb-6 flex items-center gap-3">
            <Logo size="md" className="[&_span]:text-gray-100" />
            <LanguageSelector variant="button" />
          </div>
        )}
        
        {!user && (
          <div className="sidebar-dark-login mb-6 p-4 rounded-xl bg-white/5 border border-white/15">
            <div className="flex flex-col gap-2">
              <Link
                href="/login"
                onClick={handleItemClick}
                className="tile button w-full"
              >
                <div className="tile w-full justify-center text-sm font-medium">
                  {mounted ? t('login', { ns: 'navigation', defaultValue: '登录' }) : 'Login'}
                </div>
              </Link>
              <Link
                href="/signup"
                onClick={handleItemClick}
                className="tile button w-full"
              >
                <div className="tile w-full justify-center text-sm font-medium">
                  {mounted ? t('signup', { ns: 'navigation', defaultValue: '注册' }) : 'Sign Up'}
                </div>
              </Link>
            </div>
          </div>
        )}

        {user && (
          <div className={`sidebar-dark-usercard mb-6 rounded-xl transition-all overflow-hidden border border-white/15 ${
            isProUser 
              ? 'bg-amber-950/40 relative' 
              : 'bg-white/5'
          }`}>
            {isProUser && (
              <>
                <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/15 rounded-full blur-2xl -mr-10 -mt-10" />
                <div className="absolute bottom-0 left-0 w-16 h-16 bg-amber-400/10 rounded-full blur-xl -ml-8 -mb-8" />
                <div className="absolute top-2 right-2 z-10">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
              </>
            )}
            
            <button
              onClick={() => setUserInfoExpanded(!userInfoExpanded)}
              className={`w-full p-4 flex items-center justify-between relative z-10 transition-colors ${
                isProUser ? 'hover:bg-amber-500/10' : 'hover:bg-white/10'
              }`}
            >
              {isProUser ? (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold rounded-full shadow-lg flex items-center gap-1.5">
                    <Crown className="w-4 h-4" />
                    PRO
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-400">
                      {mounted ? t('credits', { ns: 'credits', defaultValue: '积分' }) : 'Credits'}:
                    </span>
                    <span className="text-sm font-semibold text-gray-100">
                      {loadingCredits ? (mounted ? t('loading', { ns: 'credits', defaultValue: '...' }) : '...') : (credits ?? '-')}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHistory(true);
                    }}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors"
                    title={mounted ? t('creditsHistory', { ns: 'credits', defaultValue: '查看积分明细' }) : 'View Credits History'}
                  >
                    <List className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              )}
              
              {userInfoExpanded ? (
                <ChevronUp className={`w-5 h-5 ${isProUser ? 'text-amber-400' : 'text-gray-400'}`} />
              ) : (
                <ChevronDown className={`w-5 h-5 ${isProUser ? 'text-amber-400' : 'text-gray-400'}`} />
              )}
            </button>

            {userInfoExpanded && (
              <div className={`px-4 pb-4 pt-0 relative z-10 border-t ${isProUser ? 'border-amber-500/20' : 'border-white/10'}`}>
                <div className={`text-sm mt-3 space-y-2 ${isProUser ? 'text-amber-200' : 'text-gray-400'}`}>
                  <div>
                    <span className="font-medium">{mounted ? t('username', { ns: 'auth', defaultValue: 'Name:' }) : 'Name:'}</span>{' '}
                    <span>{user.name}</span>
                  </div>
                  <div>
                    <span className="font-medium">{mounted ? t('email', { ns: 'auth', defaultValue: 'Email:' }) : 'Email:'}</span>{' '}
                    <span>{user.email}</span>
                  </div>
                  <div>
                    <span className="font-medium">{mounted ? t('role', { ns: 'auth', defaultValue: 'Role:' }) : 'Role:'}</span>{' '}
                    {isProUser ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-semibold">
                        <Crown className="w-3 h-3" />
                        {subscription?.plan === 'monthly' 
                          ? (mounted ? t('subscription.monthly', { ns: 'content', defaultValue: '月付' }) : 'Monthly')
                          : subscription?.plan === 'yearly'
                          ? (mounted ? t('subscription.yearly', { ns: 'content', defaultValue: '年付' }) : 'Yearly')
                          : 'Pro'
                        }
                      </span>
                    ) : (
                      user.role === 'admin' 
                        ? (mounted ? t('admin', { ns: 'auth', defaultValue: 'Admin' }) : 'Admin') 
                        : (mounted ? t('user', { ns: 'auth', defaultValue: 'User' }) : 'User')
                    )}
                  </div>
                  
                  {/* Pro用户显示Subscription管理按钮 */}
                  {isProUser && (
                    <div className="pt-2">
                      <Link
                        href="/subscription"
                        onClick={handleItemClick}
                        className="tile button w-full"
                      >
                        <div className="tile w-full justify-center text-sm font-medium">
                          {mounted ? t('subscription.manageSubscription', { ns: 'content', defaultValue: '管理订阅' }) : 'Manage Subscription'}
                        </div>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        {user && !isProUser && (
          <Link
            href="/subscription"
            onClick={handleItemClick}
            className="w-full mb-4 flex items-center justify-center gap-1.5 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold rounded-xl shadow-lg hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] transition-all duration-200"
          >
            <Crown className="w-4 h-4" />
            {mounted ? t('upgrade_to_pro', { ns: 'navigation', defaultValue: '升级到 Pro' }) : '升级到 Pro'}
          </Link>
        )}

        <nav className="space-y-2 sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            // 对于首页 (/)，只有完全匹配时才激活；其他路径支持子路径匹配
            const isActive = item.href === '/' 
              ? pathname === '/' 
              : pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} onClick={handleItemClick}
                className="tile button w-full"
                aria-pressed={isActive ? 'true' : 'false'}
              >
                <div className="tile w-full justify-start px-4 py-3 text-sm font-medium sidebar-nav-link">
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
      
      {user && (
        <>
          <div className="px-6 pt-4 pb-2">
            <LogoEduAnimation />
          </div>
          <div className={`p-6 border-t border-white/10 ${variant === 'mobile' ? 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]' : ''}`}>
            <button onClick={handleSignOut} className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/15 transition-colors">
              <LogOut className="w-5 h-5 mr-3" />
              {mounted ? t('logout', { ns: 'auth', defaultValue: 'Logout' }) : 'Logout'}
            </button>
          </div>
        </>
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