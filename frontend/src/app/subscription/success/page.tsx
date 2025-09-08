'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useLanguage } from '../../../contexts/LanguageContext';
import { api } from '../../../lib/api';

const SubscriptionSuccessContent: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      // 这里可以验证支付会话状态
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

    fetchSubscription();
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在验证订阅状态...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            订阅成功！
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            感谢您选择我们的Pro计划
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Pro计划已激活
              </h3>
              <p className="text-gray-600 mb-4">
                您现在可以享受无限AI使用和所有高级功能
              </p>
              
              {subscription && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">
                    <p>订阅状态: <span className="font-medium text-green-600">{subscription.status}</span></p>
                    <p>计划类型: <span className="font-medium">{subscription.plan}</span></p>
                    {subscription.current_period_end && (
                      <p>下次续费: <span className="font-medium">
                        {new Date(subscription.current_period_end).toLocaleDateString()}
                      </span></p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                开始使用
              </button>
              <button
                onClick={() => router.push('/subscription')}
                className="flex-1 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                管理订阅
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">正在加载...</p>
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
