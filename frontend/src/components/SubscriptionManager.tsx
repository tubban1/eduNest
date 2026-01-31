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
  const { t } = useTranslation(['common', 'content']);
  const [mounted, setMounted] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');

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

  const handleUpgrade = async (planType: 'monthly' | 'yearly' = selectedPlan) => {
    setUpgrading(true);
    try {
      // 创建支付会话，传递计划类型（monthly 或 yearly）
      const response = await api.createPaymentSession(planType, {
        success_url: `${window.location.origin}/subscription/success`,
        cancel_url: `${window.location.origin}/subscription/cancel`,
      });
      
      console.log('支付会话响应:', response);
      
      // 后端返回格式: { success: true, session: { url: ... } }
      const sessionUrl = response?.session?.url || response?.url;
      
      if (sessionUrl) {
        // 重定向到Stripe支付页面
        window.location.href = sessionUrl;
      } else {
        console.error('响应中没有找到 session URL:', response);
        alert(mounted ? t('subscription.createSessionFailed', { ns: 'content', defaultValue: '创建支付会话失败' }) : '创建支付会话失败');
      }
    } catch (error) {
      console.error('升级失败:', error);
      alert(mounted ? t('subscription.upgradeFailed', { ns: 'content', defaultValue: '升级失败，请稍后重试' }) : '升级失败，请稍后重试');
    } finally {
      setUpgrading(false);
    }
  };

  const handleCancel = async () => {
    const confirmMessage = mounted 
      ? t('subscription.confirmCancel', { ns: 'content', defaultValue: '确定要取消订阅吗？订阅将在当前周期结束后失效。' })
      : 'Are you sure you want to cancel your subscription? It will expire at the end of the current period.';
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    try {
      await api.cancelSubscription();
      alert(mounted ? t('subscription.cancelled', { ns: 'content', defaultValue: '订阅已取消' }) : 'Subscription cancelled');
      fetchSubscriptionStatus();
    } catch (error) {
      console.error('取消订阅失败:', error);
      alert(mounted ? t('subscription.cancelFailed', { ns: 'content', defaultValue: '取消订阅失败，请稍后重试' }) : 'Failed to cancel subscription, please try again later');
    }
  };

  if (loading) {
    return <div className="p-4">{mounted ? t('loading', { ns: 'common', defaultValue: '加载中...' }) : '加载中...'}</div>;
  }

  const getUpgradeButtonText = () => {
    if (!subscription || subscription.status === 'free') {
      return mounted ? t('subscription.upgradeToPro', { ns: 'content', defaultValue: '升级到Pro' }) : 'Upgrade to Pro';
    }
    
    if (subscription.status === 'active' && subscription.cancel_at_period_end) {
      return mounted ? t('subscription.resumeSubscription', { ns: 'content', defaultValue: '恢复订阅' }) : 'Resume Subscription';
    }
    
    if (subscription.status === 'past_due') {
      return mounted ? t('subscription.retryPayment', { ns: 'content', defaultValue: '重试支付' }) : 'Retry Payment';
    }
    
    return mounted ? t('subscription.manageSubscription', { ns: 'content', defaultValue: '管理订阅' }) : 'Manage Subscription';
  };

  const getUpgradeButtonAction = () => {
    if (!subscription || subscription.status === 'free') {
      return () => handleUpgrade(selectedPlan);
    }
    
    if (subscription.status === 'active' && subscription.cancel_at_period_end) {
      return () => handleUpgrade(selectedPlan); // 重新订阅
    }
    
    if (subscription.status === 'past_due') {
      return () => handleUpgrade(selectedPlan); // 重试支付
    }
    
    return () => {}; // 管理订阅
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {mounted ? t('subscription.management', { ns: 'content', defaultValue: '订阅管理' }) : 'Subscription Management'}
      </h2>
      
      {/* 当前状态 */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          {mounted ? t('subscription.currentStatus', { ns: 'content', defaultValue: '当前状态' }) : 'Current Status'}
        </h3>
        <div className="bg-gray-50 rounded-lg p-4">
          {subscription ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {mounted ? t('subscription.planType', { ns: 'content', defaultValue: '计划类型' }) : 'Plan Type'}:
                </span>
                <span className="font-medium">
                  {subscription.plan === 'pro' ? 'Pro' : (mounted ? t('subscription.free', { ns: 'content', defaultValue: '免费' }) : 'Free')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {mounted ? t('subscription.status', { ns: 'content', defaultValue: '状态' }) : 'Status'}:
                </span>
                <span className={`font-medium ${
                  subscription.is_active ? 'text-green-600' : 'text-red-600'
                }`}>
                  {subscription.is_active 
                    ? (mounted ? t('subscription.active', { ns: 'content', defaultValue: '活跃' }) : 'Active')
                    : (mounted ? t('subscription.inactive', { ns: 'content', defaultValue: '非活跃' }) : 'Inactive')
                  }
                </span>
              </div>
              {subscription.current_period_end && (
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    {mounted ? t('subscription.expiryDate', { ns: 'content', defaultValue: '到期时间' }) : 'Expiry Date'}:
                  </span>
                  <span className="font-medium">
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">
              {mounted ? t('subscription.freeUser', { ns: 'content', defaultValue: '免费用户' }) : 'Free User'}
            </p>
          )}
        </div>
      </div>

      {/* 升级选项 */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          {mounted ? t('subscription.upgradeOptions', { ns: 'content', defaultValue: '升级选项' }) : '升级选项'}
        </h3>
        
        {/* 计划选择器 */}
        <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setSelectedPlan('monthly')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              selectedPlan === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {mounted ? t('subscription.monthly', { ns: 'content', defaultValue: '月付' }) : 'Monthly'}
          </button>
          <button
            onClick={() => setSelectedPlan('yearly')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              selectedPlan === 'yearly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {mounted ? t('subscription.yearly', { ns: 'content', defaultValue: '年付' }) : 'Yearly'}
          </button>
        </div>

        {/* 月付计划 */}
        {selectedPlan === 'monthly' && (
          <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-foreground">
                  {mounted ? t('subscription.proPlan', { ns: 'content', defaultValue: 'Pro 计划' }) : 'Pro Plan'}
                </h4>
                <p className="text-muted-foreground text-sm">
                  {mounted ? t('subscription.monthlyPrice', { ns: 'content', defaultValue: '$29.8/月（无限使用，订阅制）' }) : '$29.8/month (Unlimited usage, subscription)'}
                </p>
              </div>
              <span className="text-2xl font-bold text-foreground">$29.8</span>
            </div>
            <ul className="text-foreground text-sm space-y-1 mb-4">
              <li>• {mounted ? t('subscription.unlimitedAI', { ns: 'content', defaultValue: '无限AI内容生成（交互式与动画）' }) : 'Unlimited AI content generation (Interactive & Animated)'}</li>
              <li>• {mounted ? t('subscription.unlimitedContent', { ns: 'content', defaultValue: '无限内容创建与管理' }) : 'Unlimited content creation & management'}</li>
              <li>• {mounted ? t('subscription.aiGuide', { ns: 'content', defaultValue: 'AI Guide (AI教师) - 个性化学习辅导' }) : 'AI Guide (AI Teacher) - Personalized learning assistance'}</li>
              <li>• {mounted ? t('subscription.aiLearningAnalysis', { ns: 'content', defaultValue: 'AI学习分析 - 时间感知型学习轨迹洞察' }) : 'AI Learning Analysis - Time-aware learning trajectory insights'}</li>
              <li>• {mounted ? t('subscription.contentFix', { ns: 'content', defaultValue: 'AI内容自动修复' }) : 'AI content auto-fix'}</li>
              <li>• {mounted ? t('subscription.prioritySupport', { ns: 'content', defaultValue: '优先技术支持' }) : 'Priority technical support'}</li>
              <li>• {mounted ? t('subscription.advancedFeatures', { ns: 'content', defaultValue: '高级功能访问' }) : 'Advanced feature access'}</li>
            </ul>
            <button
              onClick={getUpgradeButtonAction()}
              disabled={upgrading}
              className="ai-gradient-btn w-full py-2.5 px-4 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {upgrading 
                ? (mounted ? t('subscription.processing', { ns: 'content', defaultValue: '处理中...' }) : 'Processing...')
                : getUpgradeButtonText()
              }
            </button>
          </div>
        )}

        {/* 年付计划 */}
        {selectedPlan === 'yearly' && (
          <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-foreground">
                  {mounted ? t('subscription.proPlan', { ns: 'content', defaultValue: 'Pro 计划' }) : 'Pro Plan'}
                </h4>
                <p className="text-muted-foreground text-sm">
                  {mounted ? t('subscription.yearlyPrice', { ns: 'content', defaultValue: '$240/年（一次性支付，节省$120）' }) : '$240/year (One-time payment, save $120)'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-foreground">$240</span>
                <div className="text-xs text-green-600 font-medium mt-1">
                  {mounted ? t('subscription.saveAmount', { ns: 'content', defaultValue: '节省 $118' }) : 'Save $118'}
                </div>
              </div>
            </div>
            <ul className="text-foreground text-sm space-y-1 mb-4">
              <li>• {mounted ? t('subscription.unlimitedAI', { ns: 'content', defaultValue: '无限AI内容生成（交互式与动画）' }) : 'Unlimited AI content generation (Interactive & Animated)'}</li>
              <li>• {mounted ? t('subscription.unlimitedContent', { ns: 'content', defaultValue: '无限内容创建与管理' }) : 'Unlimited content creation & management'}</li>
              <li>• {mounted ? t('subscription.aiGuide', { ns: 'content', defaultValue: 'AI Guide (AI教师) - 个性化学习辅导' }) : 'AI Guide (AI Teacher) - Personalized learning assistance'}</li>
              <li>• {mounted ? t('subscription.aiLearningAnalysis', { ns: 'content', defaultValue: 'AI学习分析 - 时间感知型学习轨迹洞察' }) : 'AI Learning Analysis - Time-aware learning trajectory insights'}</li>
              <li>• {mounted ? t('subscription.contentFix', { ns: 'content', defaultValue: 'AI内容自动修复' }) : 'AI content auto-fix'}</li>
              <li>• {mounted ? t('subscription.prioritySupport', { ns: 'content', defaultValue: '优先技术支持' }) : 'Priority technical support'}</li>
              <li>• {mounted ? t('subscription.advancedFeatures', { ns: 'content', defaultValue: '高级功能访问' }) : 'Advanced feature access'}</li>
            </ul>
            <button
              onClick={getUpgradeButtonAction()}
              disabled={upgrading}
              className="ai-gradient-btn w-full py-2.5 px-4 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {upgrading 
                ? (mounted ? t('subscription.processing', { ns: 'content', defaultValue: '处理中...' }) : 'Processing...')
                : getUpgradeButtonText()
              }
            </button>
          </div>
        )}
      </div>

      {/* 订阅管理 */}
      {subscription && subscription.status === 'active' && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            {mounted ? t('subscription.management', { ns: 'content', defaultValue: '订阅管理' }) : 'Subscription Management'}
          </h3>
          <div className="space-y-3">
            {subscription.cancel_at_period_end ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-yellow-800 text-sm">
                  {mounted ? t('subscription.willCancelAtPeriodEnd', { ns: 'content', defaultValue: '您的订阅将在当前周期结束后取消' }) : 'Your subscription will be cancelled at the end of the current period'}
                </p>
              </div>
            ) : (
              <button
                onClick={handleCancel}
                className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
              >
                {mounted ? t('subscription.cancelSubscription', { ns: 'content', defaultValue: '取消订阅' }) : 'Cancel Subscription'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;
