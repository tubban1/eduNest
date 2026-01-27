'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import Sidebar, { MobileMenuButton } from '@/components/Sidebar';

const SubscriptionCancel: React.FC = () => {
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  const { t } = useTranslation(['common', 'content']);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100">
                <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                {mounted ? t('subscription.subscriptionCancelled', { ns: 'content', defaultValue: '订阅已取消' }) : 'Subscription Cancelled'}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {mounted ? t('subscription.paymentCancelled', { ns: 'content', defaultValue: '您取消了订阅流程' }) : 'You cancelled the subscription process'}
              </p>
            </div>
          </div>

          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {mounted ? t('subscription.subscriptionNotCompleted', { ns: 'content', defaultValue: '没有完成订阅' }) : 'Subscription Not Completed'}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {mounted ? t('subscription.subscriptionNotCompletedDesc', { ns: 'content', defaultValue: '您可以随时重新开始订阅流程，享受Pro计划的所有功能' }) : 'You can restart the subscription process at any time to enjoy all the features of the Pro plan'}
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">
                    {mounted ? t('subscription.proPlanFeatures', { ns: 'content', defaultValue: 'Pro计划包含' }) : 'Pro Plan Includes'}
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-1 text-left">
                    <li>• {mounted ? t('subscription.unlimitedAI', { ns: 'content', defaultValue: '无限AI内容生成（交互式与动画）' }) : 'Unlimited AI content generation (Interactive & Animated)'}</li>
                    <li>• {mounted ? t('subscription.unlimitedContent', { ns: 'content', defaultValue: '无限内容创建与管理' }) : 'Unlimited content creation & management'}</li>
                    <li>• {mounted ? t('subscription.aiGuide', { ns: 'content', defaultValue: 'AI Guide (AI教师) - 个性化学习辅导' }) : 'AI Guide (AI Teacher) - Personalized learning assistance'}</li>
                    <li>• {mounted ? t('subscription.aiLearningAnalysis', { ns: 'content', defaultValue: 'AI学习分析 - 时间感知型学习轨迹洞察' }) : 'AI Learning Analysis - Time-aware learning trajectory insights'}</li>
                    <li>• {mounted ? t('subscription.contentFix', { ns: 'content', defaultValue: 'AI内容自动修复' }) : 'AI content auto-fix'}</li>
                    <li>• {mounted ? t('subscription.prioritySupport', { ns: 'content', defaultValue: '优先技术支持' }) : 'Priority technical support'}</li>
                  </ul>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => router.push('/subscription')}
                    className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {mounted ? t('subscription.resubscribe', { ns: 'content', defaultValue: '重新订阅' }) : 'Resubscribe'}
                  </button>
                  <button
                    onClick={() => router.push('/')}
                    className="flex-1 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {mounted ? t('subscription.backToHome', { ns: 'content', defaultValue: '返回首页' }) : 'Back to Home'}
                  </button>
                </div>

                <div className="text-center pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    {mounted ? t('subscription.needHelp', { ns: 'content', defaultValue: '有任何问题？请联系我们的客服团队' }) : 'Need help? Contact our support team'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SubscriptionCancel;
