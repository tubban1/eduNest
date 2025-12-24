'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';

interface SubscriptionStatus {
  status: string;
  plan: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  is_active: boolean;
}

const SubscriptionManager: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation(['common']);
  const [mounted, setMounted] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      fetchSubscriptionStatus();
    }
  }, [user]);

  const fetchSubscriptionStatus = async () => {
    try {
      const data = await api.getSubscriptionStatus();
      setSubscription(data);
    } catch (error) {
      console.error('获取订阅状态失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planType: string) => {
    setUpgrading(true);
    try {
      // 创建支付会话
      const session = await api.createPaymentSession(planType, {
        success_url: `${window.location.origin}/subscription/success`,
        cancel_url: `${window.location.origin}/subscription/cancel`,
      });
      
      if (session?.url) {
        // 重定向到Stripe支付页面
        window.location.href = session.url;
      } else {
        alert('创建支付会话失败');
      }
    } catch (error) {
      console.error('升级失败:', error);
      alert('升级失败，请稍后重试');
    } finally {
      setUpgrading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('确定要取消订阅吗？订阅将在当前周期结束后失效。')) {
      return;
    }
    
    try {
      await api.cancelSubscription();
      alert('订阅已取消');
      fetchSubscriptionStatus();
    } catch (error) {
      console.error('取消订阅失败:', error);
      alert('取消订阅失败，请稍后重试');
    }
  };

  if (loading) {
    return <div className="p-4">{mounted ? t('loading', { ns: 'common', defaultValue: '加载中...' }) : '加载中...'}</div>;
  }

  const getUpgradeButtonText = () => {
    if (!subscription || subscription.status === 'free') {
      return '升级到Pro';
    }
    
    if (subscription.status === 'active' && subscription.cancel_at_period_end) {
      return '恢复订阅';
    }
    
    if (subscription.status === 'past_due') {
      return '重试支付';
    }
    
    return '管理订阅';
  };

  const getUpgradeButtonAction = () => {
    if (!subscription || subscription.status === 'free') {
      return () => handleUpgrade('pro');
    }
    
    if (subscription.status === 'active' && subscription.cancel_at_period_end) {
      return () => handleUpgrade('pro'); // 重新订阅
    }
    
    if (subscription.status === 'past_due') {
      return () => handleUpgrade('pro'); // 重试支付
    }
    
    return () => {}; // 管理订阅
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">订阅管理</h2>
      
      {/* 当前状态 */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">当前状态</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          {subscription ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">计划类型:</span>
                <span className="font-medium">
                  {subscription.plan === 'pro' ? 'Pro' : '免费'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">状态:</span>
                <span className={`font-medium ${
                  subscription.is_active ? 'text-green-600' : 'text-red-600'
                }`}>
                  {subscription.is_active ? '活跃' : '非活跃'}
                </span>
              </div>
              {subscription.current_period_end && (
                <div className="flex justify-between">
                  <span className="text-gray-600">到期时间:</span>
                  <span className="font-medium">
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">免费用户</p>
          )}
        </div>
      </div>

      {/* 升级选项 */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">升级选项</h3>
        <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-semibold text-foreground">Pro 计划</h4>
              <p className="text-muted-foreground text-sm">$20/月（无限使用，订阅制）</p>
            </div>
            <span className="text-2xl font-bold text-foreground">$20</span>
          </div>
          <ul className="text-foreground text-sm space-y-1 mb-4">
            <li>• 无限AI内容生成</li>
            <li>• 无限内容创建</li>
            <li>• 优先技术支持</li>
            <li>• 高级功能访问</li>
          </ul>
          <button
            onClick={getUpgradeButtonAction()}
            disabled={upgrading}
            className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {upgrading ? '处理中...' : getUpgradeButtonText()}
          </button>
        </div>
      </div>

      {/* 订阅管理 */}
      {subscription && subscription.status === 'active' && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">订阅管理</h3>
          <div className="space-y-3">
            {subscription.cancel_at_period_end ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-yellow-800 text-sm">
                  您的订阅将在当前周期结束后取消
                </p>
              </div>
            ) : (
              <button
                onClick={handleCancel}
                className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
              >
                取消订阅
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;
