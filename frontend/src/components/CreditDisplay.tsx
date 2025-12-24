'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Coins, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CreditHistoryItem {
  id: string;
  change_type: string;
  change_amount: number;
  related_user_id?: string;
  created_at: string;
}

export default function CreditDisplay({ className = '' }: { className?: string }) {
  const { t } = useTranslation(['credits', 'common']);
  const [mounted, setMounted] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<CreditHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => { setMounted(true); }, []);

  const fetchBalance = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/credits/balance');
      if ((res as any)?.success) {
        setBalance((res as any).data.balance ?? 0);
      } else {
        setError(((res as any)?.error) || '获取积分失败');
      }
    } catch (e: any) {
      setError(e?.message || '获取积分失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      setError('');
      const res = await api.get('/credits/history?limit=20&offset=0');
      if ((res as any)?.success) {
        setHistory((res as any).data || []);
      } else {
        setError(((res as any)?.error) || '获取积分历史失败');
      }
    } catch (e: any) {
      setError(e?.message || '获取积分历史失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  useEffect(() => {
    if (open && history.length === 0) {
      fetchHistory();
    }
  }, [open]);

  return (
    <div className={`relative ${className}`}>
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm text-sm hover:bg-gray-50"
        onClick={() => setOpen(v => !v)}
        title="查看积分与历史"
      >
        <Coins className="w-4 h-4 text-amber-500" />
        <span className="font-medium text-gray-800">{loading ? '...' : (balance ?? '--')}</span>
        <History className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">当前积分</div>
              <div className="text-base font-semibold text-gray-900">{balance ?? '--'}</div>
            </div>
          </div>
          <div className="max-h-64 overflow-auto">
            {error && (
              <div className="p-3 text-sm text-red-600">{error}</div>
            )}
            {!error && (
              <ul className="divide-y">
                {historyLoading && (
                  <li className="p-3 text-sm text-gray-500">
                    {mounted ? t('loading', { ns: 'credits', defaultValue: '加载中...' }) : '加载中...'}
                  </li>
                )}
                {!historyLoading && history.length === 0 && (
                  <li className="p-3 text-sm text-gray-500">暂无记录</li>
                )}
                {!historyLoading && history.map(item => (
                  <li key={item.id} className="p-3 text-sm flex items-center justify-between">
                    <span className="text-gray-600">{item.change_type}</span>
                    <span className={`font-medium ${item.change_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.change_amount > 0 ? `+${item.change_amount}` : item.change_amount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

