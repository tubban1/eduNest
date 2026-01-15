'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import Image from 'next/image';

// 映射后端错误消息到多语言
const mapErrorMessage = (errorMessage: string | undefined, t: any): string => {
  if (!errorMessage) {
    return t('claimBonus.errorMessage', { ns: 'common', defaultValue: '领取奖励时发生错误，请稍后重试' });
  }

  // 后端返回的中文错误消息映射
  const errorMap: Record<string, string> = {
    '无效或过期的链接': 'claimBonus.invalidOrExpiredLink',
    '无效的奖励链接': 'claimBonus.invalidBonusLink',
    '用户不存在': 'claimBonus.userNotFound',
    '发放奖励失败，请稍后重试': 'claimBonus.awardFailed',
    '服务器错误': 'claimBonus.serverError',
    '缺少token参数': 'claimBonus.missingToken',
  };

  // 检查是否是已知的错误消息
  const translationKey = errorMap[errorMessage];
  if (translationKey) {
    return t(translationKey, { ns: 'common', defaultValue: errorMessage });
  }

  // 如果错误消息不在映射中，尝试直接翻译（可能是英文或其他语言）
  // 或者返回原始错误消息
  return errorMessage;
};

const ClaimBonusContent: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, i18n } = useTranslation(['common', 'content']);
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already-claimed'>('loading');
  const [message, setMessage] = useState('');
  const [creditsAwarded, setCreditsAwarded] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setError(t('claimBonus.missingToken', { ns: 'common', defaultValue: '缺少奖励链接参数' }));
      return;
    }

    const claimBonus = async () => {
      try {
        setStatus('loading');
        setMessage(t('claimBonus.claiming', { ns: 'common', defaultValue: '正在领取奖励...' }));

        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
        const response = await fetch(`${apiUrl}/early-user-bonus/claim?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (!response.ok) {
          // 映射后端错误消息到多语言
          const errorMessage = mapErrorMessage(data.error, t);
          throw new Error(errorMessage);
        }

        if (data.success) {
          if (data.data.alreadyClaimed) {
            setStatus('already-claimed');
            // 始终使用翻译文本，忽略后端返回的硬编码消息
            setMessage(t('claimBonus.alreadyClaimedMessage', { ns: 'common', defaultValue: '您已经领取过额外奖励了' }));
            setBalance(data.data.balance);
          } else {
            setStatus('success');
            // 始终使用翻译文本，忽略后端返回的硬编码消息
            setMessage(t('claimBonus.successMessage', { ns: 'common', defaultValue: '成功领取50积分！' }));
            setCreditsAwarded(data.data.creditsAwarded || 50);
            setBalance(data.data.balance);
          }
        } else {
          // 映射后端错误消息到多语言
          const errorMessage = mapErrorMessage(data.error, t);
          throw new Error(errorMessage);
        }
      } catch (err: any) {
        setStatus('error');
        // 如果错误消息已经是翻译后的，直接使用；否则尝试映射
        const errorMessage = err.message || t('claimBonus.errorMessage', { ns: 'common', defaultValue: '领取奖励时发生错误，请稍后重试' });
        setError(mapErrorMessage(errorMessage, t));
        console.error('领取奖励失败:', err);
      }
    };

    claimBonus();
  }, [mounted, searchParams, t]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="w-full border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center">
              <Image
                src="/favicon.png"
                alt="EduNest AI"
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <span className="ml-2 text-xl font-semibold text-foreground">EduNest AI</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8">
            {status === 'loading' && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {mounted ? t('claimBonus.claiming', { ns: 'common', defaultValue: '正在领取奖励...' }) : '正在领取奖励...'}
                </h2>
                <p className="text-muted-foreground">{message || (mounted ? t('claimBonus.pleaseWait', { ns: 'common', defaultValue: '请稍候' }) : '请稍候')}</p>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {mounted ? t('claimBonus.successTitle', { ns: 'common', defaultValue: '🎉 领取成功！' }) : '🎉 领取成功！'}
                </h2>
                <p className="text-lg text-muted-foreground mb-4">{message}</p>
                {creditsAwarded && (
                  <div className="bg-primary/10 rounded-lg p-4 mb-4">
                    <p className="text-sm text-muted-foreground mb-1">
                      {mounted ? t('claimBonus.creditsAwarded', { ns: 'common', defaultValue: '获得积分' }) : '获得积分'}
                    </p>
                    <p className="text-3xl font-bold text-primary">+{creditsAwarded}</p>
                  </div>
                )}
                {balance !== null && (
                  <div className="mb-6">
                    <p className="text-sm text-muted-foreground">
                      {mounted ? t('claimBonus.currentBalance', { ns: 'common', defaultValue: '当前积分余额' }) : '当前积分余额'}
                    </p>
                    <p className="text-2xl font-semibold text-foreground">{balance}</p>
                  </div>
                )}
                <div className="flex space-x-3">
                  <Link
                    href="/"
                    className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    {mounted ? t('claimBonus.backToHome', { ns: 'common', defaultValue: '返回首页' }) : '返回首页'}
                  </Link>
                  <Link
                    href="/c"
                    className="flex-1 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    {mounted ? t('claimBonus.myContent', { ns: 'common', defaultValue: '我的内容' }) : '我的内容'}
                  </Link>
                </div>
              </div>
            )}

            {status === 'already-claimed' && (
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
                  <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {mounted ? t('claimBonus.alreadyClaimedTitle', { ns: 'common', defaultValue: '已领取' }) : '已领取'}
                </h2>
                <p className="text-muted-foreground mb-4">{message}</p>
                {balance !== null && (
                  <div className="mb-6">
                    <p className="text-sm text-muted-foreground">
                      {mounted ? t('claimBonus.currentBalance', { ns: 'common', defaultValue: '当前积分余额' }) : '当前积分余额'}
                    </p>
                    <p className="text-2xl font-semibold text-foreground">{balance}</p>
                  </div>
                )}
                <div className="flex space-x-3">
                  <Link
                    href="/"
                    className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    {mounted ? t('claimBonus.backToHome', { ns: 'common', defaultValue: '返回首页' }) : '返回首页'}
                  </Link>
                  <Link
                    href="/c"
                    className="flex-1 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    {mounted ? t('claimBonus.myContent', { ns: 'common', defaultValue: '我的内容' }) : '我的内容'}
                  </Link>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                  <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {mounted ? t('claimBonus.errorTitle', { ns: 'common', defaultValue: '领取失败' }) : '领取失败'}
                </h2>
                <p className="text-muted-foreground mb-4">{error}</p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    {mounted ? t('retry', { ns: 'common', defaultValue: '重试' }) : '重试'}
                  </button>
                  <Link
                    href="/"
                    className="flex-1 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    {mounted ? t('claimBonus.backToHome', { ns: 'common', defaultValue: '返回首页' }) : '返回首页'}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const LoadingFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const ClaimBonusPage: React.FC = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ClaimBonusContent />
    </Suspense>
  );
};

export default ClaimBonusPage;
