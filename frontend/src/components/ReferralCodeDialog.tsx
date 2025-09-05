'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Share2, Gift, Users, Star, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ReferralCodeDialogProps {
  open: boolean;
  onClose: () => void;
  referralCode: string;
  onShare: () => void;
}

export default function ReferralCodeDialog({ 
  open, 
  onClose, 
  referralCode, 
  onShare 
}: ReferralCodeDialogProps) {
  const { t } = useTranslation(['common', 'referral']);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/signup?ref=${encodeURIComponent(referralCode)}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Gift className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {mounted ? t('referralProgram', { ns: 'referral', defaultValue: '邀请码计划' }) : '邀请码计划'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-6">
          {/* 邀请码展示 */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {mounted ? t('yourReferralCode', { ns: 'referral', defaultValue: '您的邀请码' }) : '您的邀请码'}
              </h3>
              <div className="flex items-center justify-center gap-3 mb-4">
                <code className="text-2xl font-mono font-bold text-blue-600 bg-white px-4 py-2 rounded-lg border-2 border-blue-200">
                  {referralCode || '---'}
                </code>
                <button
                  onClick={handleCopyCode}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title={mounted ? t('copyCode', { ns: 'referral', defaultValue: '复制邀请码' }) : '复制邀请码'}
                >
                  {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-sm text-gray-600">
                {mounted ? t('shareThisCode', { ns: 'referral', defaultValue: '分享此邀请码给朋友，双方都能获得奖励！' }) : '分享此邀请码给朋友，双方都能获得奖励！'}
              </p>
            </div>
          </div>

          {/* 邀请规则 */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              {mounted ? t('howItWorks', { ns: 'referral', defaultValue: '邀请规则' }) : '邀请规则'}
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 font-semibold text-sm">1</span>
                </div>
                <div>
                  <p className="text-sm text-gray-700">
                    {mounted ? t('step1', { ns: 'referral', defaultValue: '分享您的邀请码给朋友' }) : '分享您的邀请码给朋友'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 font-semibold text-sm">2</span>
                </div>
                <div>
                  <p className="text-sm text-gray-700">
                    {mounted ? t('step2', { ns: 'referral', defaultValue: '朋友使用邀请码注册并完成首次订阅' }) : '朋友使用邀请码注册并完成首次订阅'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 font-semibold text-sm">3</span>
                </div>
                <div>
                  <p className="text-sm text-gray-700">
                    {mounted ? t('step3', { ns: 'referral', defaultValue: '您和朋友都将获得积分奖励' }) : '您和朋友都将获得积分奖励'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 奖励说明 */}
          <div className="bg-yellow-50 rounded-lg p-4">
            <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Gift className="w-5 h-5 text-yellow-600" />
              {mounted ? t('rewards', { ns: 'referral', defaultValue: '奖励说明' }) : '奖励说明'}
            </h4>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>{mounted ? t('inviterReward', { ns: 'referral', defaultValue: '邀请者：每邀请1人获得3积分' }) : '邀请者：每邀请1人获得3积分'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-600" />
                <span>{mounted ? t('milestoneReward', { ns: 'referral', defaultValue: '里程碑奖励：每邀请5人额外获得10积分' }) : '里程碑奖励：每邀请5人额外获得10积分'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-green-600" />
                <span>{mounted ? t('inviteeReward', { ns: 'referral', defaultValue: '被邀请者：注册后获得3积分' }) : '被邀请者：注册后获得3积分'}</span>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button
              onClick={handleCopyLink}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
              {mounted ? t('copyLink', { ns: 'referral', defaultValue: '复制邀请链接' }) : '复制邀请链接'}
            </button>
            <button
              onClick={onShare}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              {mounted ? t('share', { ns: 'referral', defaultValue: '分享' }) : '分享'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
