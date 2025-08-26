'use client';

import { useEffect, useState } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [records, setRecords] = useState<CreditRecord[]>([]);

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
        setError(e?.message || '加载失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-11/12 max-w-lg rounded-2xl shadow-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">积分明细</h2>
          <button className="text-gray-500 hover:text-black" onClick={onClose}>✕</button>
        </div>
        {loading && (
          <div className="py-8 text-center text-gray-500">加载中...</div>
        )}
        {error && (
          <div className="mb-3 p-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded">{error}</div>
        )}
        {!loading && !error && (
          <div className="max-h-80 overflow-y-auto divide-y">
            {records.length === 0 && (
              <div className="py-6 text-center text-gray-500">暂无记录</div>
            )}
            {records.map((r) => (
              <div key={r.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{r.change_type}</div>
                  <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</div>
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
}