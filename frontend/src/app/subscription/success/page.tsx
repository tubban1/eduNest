'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import { api } from '../../../lib/api';
import Sidebar, { MobileMenuButton } from '@/components/Sidebar';

const SubscriptionSuccessContent: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();
  const { t } = useTranslation(['common', 'content']);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [planType, setPlanType] = useState<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const plan = searchParams.get('plan');
    if (plan) {
      setPlanType(plan);
    }
    
    // 获取用户最新订阅状态
    const fetchSubscription = async () => {
      try {
        const sub = await api.getSubscriptionStatus();
        if (sub) {
          setSubscription(sub);
        }
      } catch (error) {
        console.error('获取订阅状态失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // 延迟一下，确保webhook已经处理完成
    setTimeout(() => {
      fetchSubscription();
    }, 2000);
  }, [searchParams]);

  const getPlanName = (plan: string | null) => {
    if (!plan) return mounted ? t('subscription.free', { ns: 'content', defaultValue: '免费' }) : 'Free';
    if (plan === 'monthly') return mounted ? t('subscription.monthly', { ns: 'content', defaultValue: '月付' }) : 'Monthly';
    if (plan === 'yearly') return mounted ? t('subscription.yearly', { ns: 'content', defaultValue: '年付' }) : 'Yearly';
    if (plan === 'lite') return mounted ? t('subscription.lite', { ns: 'content', defaultValue: 'Lite 充值' }) : 'Lite Top-up';
    return plan;
  };

  const getStatusText = (status: string) => {
    if (status === 'active') return mounted ? t('subscription.active', { ns: 'content', defaultValue: '活跃' }) : 'Active';
    if (status === 'free') return mounted ? t('subscription.free', { ns: 'content', defaultValue: '免费' }) : 'Free';
    return status;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gray-50 text-gray-900">
        <div className="hidden lg:block h-screen sticky top-0 left-0 z-30">
          <Sidebar variant="desktop" />
        </div>
        <main className="flex-1 bg-white overflow-y-auto">
          <div className="lg:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-white border-b border-gray-200">
            <MobileMenuButton onClick={() => setSidebarOpen(true)} />
            <div className="w-10" />
          </div>
          <div className="lg:hidden h-14" />
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">
                {mounted ? t('subscription.processing', { ns: 'content', defaultValue: '处理中...' }) : 'Processing...'}
              </p>
            </div>
          </div>
        </main>
        <Sidebar 
          variant="mobile" 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
        />
      </div>
    );
  }

  const isLiteTopUp = subscription?.plan === 'lite' || planType === 'lite';

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      {/* 桌面端侧边栏 */}
      <div className="hidden lg:block h-screen sticky top-0 left-0 z-30">
        <Sidebar variant="desktop" />
      </div>
      
      {/* 移动端侧边栏 */}
      <Sidebar 
        variant="mobile" 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <main className="flex-1 bg-white overflow-y-auto">
        {/* 移动端头部（固定） */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <MobileMenuButton onClick={() => setSidebarOpen(true)} />
          <div className="w-10" />
        </div>
        
        {/* 顶部预留占位，避免内容被固定头部遮挡 */}
        <div className="lg:hidden h-14" />

        <div className="flex flex-col justify-center py-12 sm:px-6 lg:px-8 min-h-[calc(100vh-3.5rem)]">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                {isLiteTopUp 
                  ? (mounted ? t('subscription.topUpCredits', { ns: 'content', defaultValue: '充值成功！' }) : 'Top-up Successful!')
                  : (mounted ? t('subscription.subscriptionSuccess', { ns: 'content', defaultValue: '订阅成功！' }) : 'Subscription Successful!')
                }
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {isLiteTopUp
                  ? (mounted ? t('subscription.thankYouTopUp', { ns: 'content', defaultValue: '感谢您的充值' }) : 'Thank you for your top-up')
                  : (mounted ? t('subscription.thankYouPro', { ns: 'content', defaultValue: '感谢您选择我们的Pro计划' }) : 'Thank you for choosing our Pro plan')
                }
              </p>
            </div>
          </div>

          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {isLiteTopUp
                      ? (mounted ? t('subscription.creditsAdded', { ns: 'content', defaultValue: '积分已添加' }) : 'Credits Added')
                      : (mounted ? t('subscription.proPlanActivated', { ns: 'content', defaultValue: 'Pro计划已激活' }) : 'Pro Plan Activated')
                    }
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {isLiteTopUp
                      ? (mounted ? t('subscription.creditsAddedDesc', { ns: 'content', defaultValue: '您的账户已成功充值500积分，可以立即使用' }) : 'Your account has been successfully topped up with 500 credits and can be used immediately')
                      : (mounted ? t('subscription.proPlanActivatedDesc', { ns: 'content', defaultValue: '您现在可以享受无限AI使用和所有高级功能' }) : 'You can now enjoy unlimited AI usage and all advanced features')
                    }
                  </p>
                  
                  {subscription && (
                    <div className="bg-gray-50 p-4 rounded-lg text-left">
                      <div className="text-sm text-gray-600 space-y-2">
                        <div className="flex justify-between">
                          <span>{mounted ? t('subscription.status', { ns: 'content', defaultValue: '状态' }) : 'Status'}:</span>
                          <span className={`font-medium ${
                            subscription.is_active || subscription.status === 'active' ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            {getStatusText(subscription.status || 'free')}
                          </span>
                        </div>
                        {subscription.plan && (
                          <div className="flex justify-between">
                            <span>{mounted ? t('subscription.planType', { ns: 'content', defaultValue: '计划类型' }) : 'Plan Type'}:</span>
                            <span className="font-medium">{getPlanName(subscription.plan)}</span>
                          </div>
                        )}
                        {subscription.current_period_end && !isLiteTopUp && (
                          <div className="flex justify-between">
                            <span>{mounted ? t('subscription.expiryDate', { ns: 'content', defaultValue: '到期时间' }) : 'Expiry Date'}:</span>
                            <span className="font-medium">
                              {new Date(subscription.current_period_end).toLocaleDateString(
                                currentLanguage === 'zh-CN' ? 'zh-CN' :
                                currentLanguage === 'de-DE' ? 'de-DE' :
                                currentLanguage === 'fr-FR' ? 'fr-FR' : 'en-US'
                              )}
                            </span>
                          </div>
                        )}
                        {isLiteTopUp && (
                          <div className="flex justify-between">
                            <span>{mounted ? t('credits.creditsAmount', { ns: 'credits', defaultValue: '获得积分' }) : 'Credits Added'}:</span>
                            <span className="font-medium text-green-600">500</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => router.push('/')}
                    className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {mounted ? t('subscription.startUsing', { ns: 'content', defaultValue: '开始使用' }) : 'Start Using'}
                  </button>
                  <button
                    onClick={() => router.push('/subscription')}
                    className="flex-1 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {mounted ? t('subscription.manageSubscription', { ns: 'content', defaultValue: '管理订阅' }) : 'Manage Subscription'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">
        Loading...
      </p>
    </div>
  </div>
);

const SubscriptionSuccess: React.FC = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SubscriptionSuccessContent />
    </Suspense>
  );
};

export default SubscriptionSuccess;
