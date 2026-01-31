'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';

interface CreditsHistoryDialogProps {
  open: boolean;
  onClose: () => void;
}

interface CreditRecord {
  id: string;
  change_type: string;
  change_amount: number;
  related_user_id?: string | null;
  created_at: string;
}

export default function CreditsHistoryDialog({ open, onClose }: CreditsHistoryDialogProps) {
  const { t } = useTranslation(['common', 'credits', 'content']);
  const { currentLanguage } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [records, setRecords] = useState<CreditRecord[]>([]);
  const [recharging, setRecharging] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.get('/credits/history?limit=50&offset=0');
        if ((res as any)?.success) {
          setRecords((res as any).data || []);
        } else if (Array.isArray((res as any))) {
          setRecords(res as any);
        } else {
          setRecords([]);
        }
      } catch (e: any) {
        setError(e?.message || (mounted ? t('loadFailed', { ns: 'credits', defaultValue: '加载失败' }) : 'Load failed'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open]);

  const handleTopUp = async () => {
    setRecharging(true);
    try {
      // 创建支付会话，传递计划类型 lite
      const response = await api.createPaymentSession('lite', {
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
      console.error('充值失败:', error);
      alert(mounted ? t('credits.topUpFailed', { ns: 'credits', defaultValue: '充值失败，请稍后重试' }) : 'Top-up failed, please try again later');
    } finally {
      setRecharging(false);
    }
  };

  if (!open) return null;

  const dialogContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 w-11/12 max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-600 p-4 mx-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {mounted ? t('creditsHistory', { ns: 'credits', defaultValue: '积分明细' }) : 'Credits History'}
          </h2>
          <button className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" onClick={onClose}>✕</button>
        </div>
        
        {/* Lite 充值选项 */}
        <div className="mb-4 bg-[#a78bfa]/10 rounded-lg p-3 border border-[#a78bfa]/20">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                {mounted ? t('credits.liteTopUp', { ns: 'credits', defaultValue: 'Lite 充值' }) : 'Lite Top-up'}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                {mounted ? t('credits.liteTopUpDesc', { ns: 'credits', defaultValue: '$10 获得 500 积分' }) : '$10 for 500 credits'}
              </p>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">$10</span>
          </div>
          <button
            onClick={handleTopUp}
            disabled={recharging}
            className="ai-gradient-btn w-full py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {recharging 
              ? (mounted ? t('credits.processing', { ns: 'credits', defaultValue: '处理中...' }) : 'Processing...')
              : (mounted ? t('credits.topUpCredits', { ns: 'credits', defaultValue: '充值积分' }) : 'Top-up Credits')
            }
          </button>
        </div>
        {loading && (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            {mounted ? t('loading', { ns: 'credits', defaultValue: '加载中...' }) : 'Loading...'}
          </div>
        )}
        {error && (
          <div className="mb-3 p-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded">{error}</div>
        )}
        {!loading && !error && (
          <div className="max-h-80 overflow-y-auto divide-y">
            {records.length === 0 && (
              <div className="py-6 text-center text-gray-500 dark:text-gray-400">
                {mounted ? t('noRecords', { ns: 'credits', defaultValue: '暂无记录' }) : 'No records'}
              </div>
            )}
            {records.map((r) => (
              <div key={r.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {mounted ? t(`changeTypeLabels.${r.change_type}`, { ns: 'credits', defaultValue: r.change_type }) : r.change_type}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(r.created_at).toLocaleString(
                      currentLanguage === 'zh-CN' ? 'zh-CN' :
                      currentLanguage === 'de-DE' ? 'de-DE' :
                      currentLanguage === 'fr-FR' ? 'fr-FR' : 'en-US'
                    )}
                  </div>
                </div>
                <div className={`text-sm font-semibold ${r.change_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {r.change_amount > 0 ? `+${r.change_amount}` : r.change_amount}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(dialogContent, document.body) : null;
}