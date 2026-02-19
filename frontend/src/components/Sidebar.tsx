'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Heart, Plus, Settings, LogOut, User, Menu, X, List, HelpCircle, Crown, Sparkles, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';
import Logo from './Logo';
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import CreditsHistoryDialog from './CreditsHistoryDialog';
import LogoEduAnimation from './LogoEduAnimation';

export const SIDEBAR_COLLAPSED_KEY = 'edu_sidebar_collapsed';

export type SidebarWidthContextValue = {
  collapsed: boolean;
  setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
};

export const SidebarWidthContext = createContext<SidebarWidthContextValue | null>(null);

export function useSidebarWidth() {
  return useContext(SidebarWidthContext);
}

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

  const ctx = useSidebarWidth();
  const [localCollapsed, setLocalCollapsed] = useState(true);
  const collapsed = ctx ? ctx.collapsed : localCollapsed;
  const setCollapsed = ctx ? ctx.setCollapsed : setLocalCollapsed;

  useEffect(() => {
    if (variant === 'desktop' && typeof window !== 'undefined' && !ctx) {
      try {
        const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        setLocalCollapsed(stored !== 'false');
      } catch (_) {}
    }
  }, [variant, ctx]);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch (_) {}
      return next;
    });
  };

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

  // 只保留一个 AI 入口：学习工作台。普通用户侧栏仅：学习工作台、帮助；admin 额外显示首页（最新内容）
  const menuItems = useMemo(() => {
    const learn = { href: '/learn', label: mounted ? t('learnWorkspace', { ns: 'navigation', defaultValue: '学习工作台' }) : 'Learn', icon: Sparkles };
    const help = { href: '/help', label: mounted ? t('help', { ns: 'navigation', defaultValue: 'Help' }) : 'Help', icon: HelpCircle };
    const home = { href: '/', label: mounted ? t('home', { ns: 'navigation', defaultValue: '首页' }) : 'Home', icon: Home };
    if (!mounted) {
      return user?.role === 'admin' ? [home, learn, help] : [learn, help];
    }
    return user?.role === 'admin' ? [home, learn, help] : [learn, help];
  }, [mounted, t, user?.role]);

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/learn';
    } catch (error) {}
  };

  const handleItemClick = () => {
    if (variant === 'mobile' && onClose) onClose();
  };

  const isDesktopCollapsed = variant === 'desktop' && collapsed;
  const sidebarContent = (
    <div
      className={`sidebar-dark h-screen bg-slate-900/65 backdrop-blur-xl border-r border-white/10 flex flex-col shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.06)] transition-[width] duration-200 ease-out ${
        variant === 'mobile' ? 'w-64 h-[100dvh]' : isDesktopCollapsed ? 'w-16' : 'w-64'
      }`}
    >
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

      <div className={`flex-1 flex flex-col overflow-hidden ${isDesktopCollapsed ? 'p-2' : 'p-6'}`}>
        {variant === 'desktop' && (
          <div className={`flex items-center gap-3 w-full ${isDesktopCollapsed ? 'mb-4 justify-center' : 'mb-6'}`}>
            {isDesktopCollapsed ? (
              <button type="button" onClick={toggleCollapsed} className="p-2 rounded-lg hover:bg-white/10 transition-colors" title={mounted ? t('menuSection', { ns: 'navigation', defaultValue: '展开菜单' }) : 'Expand'}>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            ) : (
              <>
                <Logo size="md" className="[&_span]:text-gray-100 flex-shrink-0" />
                <LanguageSelector variant="button" />
                <button type="button" onClick={toggleCollapsed} className="ml-auto p-2 rounded-lg hover:bg-white/10 transition-colors" title={mounted ? t('logout', { ns: 'auth', defaultValue: '收起' }) : 'Collapse'}>
                  <ChevronLeft className="w-5 h-5 text-gray-400" />
                </button>
              </>
            )}
          </div>
        )}
        
        {!user && !isDesktopCollapsed && (
          <div className="sidebar-dark-login mb-6 p-4 rounded-xl bg-white/5 border border-white/15">
            <div className="flex flex-col gap-2">
              <Link href="/login" onClick={handleItemClick} className="tile button w-full">
                <div className="tile w-full justify-center text-sm font-medium">
                  {mounted ? t('login', { ns: 'navigation', defaultValue: '登录' }) : 'Login'}
                </div>
              </Link>
              <Link href="/signup" onClick={handleItemClick} className="tile button w-full">
                <div className="tile w-full justify-center text-sm font-medium">
                  {mounted ? t('signup', { ns: 'navigation', defaultValue: '注册' }) : 'Sign Up'}
                </div>
              </Link>
            </div>
          </div>
        )}
        {!user && isDesktopCollapsed && (
          <Link href="/login" onClick={handleItemClick} className="mb-4 flex justify-center p-2 rounded-lg hover:bg-white/10 transition-colors" title={mounted ? t('login', { ns: 'navigation', defaultValue: '登录' }) : 'Login'}>
            <User className="w-5 h-5 text-gray-400" />
          </Link>
        )}

        {user && !isDesktopCollapsed && (
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
                <div className={`text-sm mt-3 space-y-2 ${isProUser ? 'text-amber-200' : 'text-slate-300'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`flex-shrink-0 font-medium ${isProUser ? 'text-amber-400/70' : 'text-slate-400'}`}>
                      {mounted ? t('username', { ns: 'auth', defaultValue: 'Name:' }) : 'Name:'}
                    </span>
                    <span className="w-px h-3 bg-white/20 flex-shrink-0" />
                    <span className={`min-w-0 truncate ${isProUser ? 'text-amber-200' : 'text-slate-100'}`} title={user.name || undefined}>{user.name}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`flex-shrink-0 font-medium ${isProUser ? 'text-amber-400/70' : 'text-slate-400'}`}>
                      {mounted ? t('email', { ns: 'auth', defaultValue: 'Email:' }) : 'Email:'}
                    </span>
                    <span className="w-px h-3 bg-white/20 flex-shrink-0" />
                    <span className={`min-w-0 truncate ${isProUser ? 'text-amber-200' : 'text-slate-100'}`} title={user.email || undefined}>{user.email}</span>
                  </div>
                  <Link
                    href="/onboard/role"
                    onClick={handleItemClick}
                    className={`flex items-center gap-2 hover:opacity-90 transition-opacity min-w-0 ${isProUser ? 'text-amber-200 visited:text-amber-200' : 'text-slate-100 visited:text-slate-100'}`}
                  >
                    <span className={`flex-shrink-0 font-medium ${isProUser ? 'text-amber-400/70 visited:text-amber-400/70' : 'text-slate-400 visited:text-slate-400'}`}>
                      {mounted ? t('role', { ns: 'auth', defaultValue: 'Role:' }) : 'Role:'}
                    </span>
                    <span className="w-px h-3 bg-white/20 flex-shrink-0" />
                    <span className={`min-w-0 truncate ${isProUser ? 'text-amber-200' : 'text-slate-100'}`}>
                      {user.role === 'admin'
                        ? (mounted ? t('admin', { ns: 'auth', defaultValue: 'Admin' }) : 'Admin')
                        : user.role === 'student'
                        ? (mounted ? t('student', { ns: 'auth', defaultValue: '学生' }) : 'Student')
                        : user.role === 'parent'
                        ? (mounted ? t('parent', { ns: 'auth', defaultValue: '家长' }) : 'Parent')
                        : user.role === 'teacher'
                        ? (mounted ? t('teacher', { ns: 'auth', defaultValue: '老师' }) : 'Teacher')
                        : (mounted ? t('user', { ns: 'auth', defaultValue: '用户' }) : 'User')}
                    </span>
                  </Link>
                  {subscription?.plan && (
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${isProUser ? 'text-amber-400/70' : 'text-gray-500'}`}>
                        {mounted ? t('subscription.plan', { ns: 'content', defaultValue: 'Plan:' }) : 'Plan:'}
                      </span>
                      <span className="w-px h-3 bg-white/20" />
                      <span className={isProUser ? 'inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-semibold' : 'text-slate-100'}>
                        {subscription.plan === 'monthly'
                          ? (mounted ? t('subscription.monthly', { ns: 'content', defaultValue: '月付' }) : 'Monthly')
                          : subscription.plan === 'yearly'
                          ? (mounted ? t('subscription.yearly', { ns: 'content', defaultValue: '年付' }) : 'Yearly')
                          : subscription.plan}
                      </span>
                    </div>
                  )}
                  
                  {/* Pro用户显示Subscription管理按钮 */}
                  {isProUser && (
                    <div className="pt-2">
                      <Link
                        href="/subscription"
                        onClick={handleItemClick}
                        className="ai-gradient-btn w-full flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-bold rounded-xl shadow-lg"
                      >
                        {mounted ? t('subscription.manageSubscription', { ns: 'content', defaultValue: '管理订阅' }) : 'Manage Subscription'}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {user && isDesktopCollapsed && (
          <button type="button" onClick={toggleCollapsed} className="mb-4 flex justify-center p-2 rounded-lg hover:bg-white/10 transition-colors" title={mounted ? t('credits', { ns: 'credits', defaultValue: '积分' }) : 'Credits'}>
            {isProUser ? <Crown className="w-5 h-5 text-amber-400" /> : <span className="text-xs font-semibold text-gray-100">{credits ?? '-'}</span>}
          </button>
        )}

        {user && !isDesktopCollapsed && !isProUser && (
          <Link href="/subscription" onClick={handleItemClick} className="ai-gradient-btn w-full mb-4 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-bold rounded-xl shadow-lg">
            <Crown className="w-4 h-4" />
            {mounted ? t('upgrade_to_pro', { ns: 'navigation', defaultValue: '升级到 Pro' }) : '升级到 Pro'}
          </Link>
        )}

        {user && !isDesktopCollapsed && <div className="my-4 h-px bg-white/10" />}

        <nav className={`space-y-2 sidebar-nav ${isDesktopCollapsed ? 'flex flex-col items-center gap-1' : ''}`}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(item.href + '/');
            return isDesktopCollapsed ? (
              <Link key={item.href} href={item.href} onClick={handleItemClick} className={`flex justify-center p-2.5 rounded-lg transition-colors ${isActive ? 'bg-white/15 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'}`} title={item.label} aria-label={item.label}>
                <Icon className="w-5 h-5" />
              </Link>
            ) : (
              <Link key={item.href} href={item.href} onClick={handleItemClick} className="tile button w-full" aria-pressed={isActive ? 'true' : 'false'}>
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
          {!isDesktopCollapsed && <div className="px-6 pt-4 pb-2"><LogoEduAnimation /></div>}
          <div className={`border-t border-white/10 ${isDesktopCollapsed ? 'p-2' : 'p-6'} ${variant === 'mobile' ? 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]' : ''}`}>
            <button onClick={handleSignOut} className={`w-full flex items-center justify-center rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/15 transition-colors ${isDesktopCollapsed ? 'p-2' : 'px-4 py-3'}`} title={mounted ? t('logout', { ns: 'auth', defaultValue: 'Logout' }) : 'Logout'}>
              <LogOut className="w-5 h-5 mr-3" />
              {!isDesktopCollapsed && (mounted ? t('logout', { ns: 'auth', defaultValue: 'Logout' }) : 'Logout')}
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