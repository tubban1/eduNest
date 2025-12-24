'use client';

import { useState, useEffect } from 'react';
import { Mail, CreditCard, Plus, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';

export default function AdminCreditsManager() {
  const { t } = useTranslation(['credits', 'common']);
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [creditsToAdd, setCreditsToAdd] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 增加积分
  const handleAddCredits = async () => {
    if (!email || !creditsToAdd) {
      setMessage({ type: 'error', text: '请输入邮箱和积分数量' });
      return;
    }
    
    const amount = parseInt(creditsToAdd);
    if (isNaN(amount) || amount <= 0) {
      setMessage({ type: 'error', text: '请输入有效的积分数量' });
      return;
    }

    try {
      setLoading(true);
      const response = await api.addCreditsToUser(
        email, // 直接使用邮箱
        amount,
        'admin_manual_add'
      );

      if (response.success) {
        setMessage({ type: 'success', text: `成功为用户 ${email} 增加 ${amount} 积分` });
        // 清空输入
        setEmail('');
        setCreditsToAdd('');
      }
    } catch (error) {
      console.error('增加积分失败:', error);
      setMessage({ type: 'error', text: '增加积分失败，请检查邮箱是否正确' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">积分充值</h3>
        <p className="text-sm text-gray-600">
          直接输入用户邮箱和要增加的积分数量进行充值
        </p>
      </div>

      {/* 邮箱输入 */}
      <div className="mb-6">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          用户邮箱
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            id="email"
            type="email"
            placeholder="输入用户邮箱地址..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 积分输入 */}
      <div className="mb-6">
        <label htmlFor="credits" className="block text-sm font-medium text-gray-700 mb-2">
          积分数量
        </label>
        <div className="relative">
          <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            id="credits"
            type="number"
            placeholder="输入要增加的积分数量"
            value={creditsToAdd}
            onChange={(e) => setCreditsToAdd(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min="1"
          />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="mb-6">
        <button
          onClick={handleAddCredits}
          disabled={loading || !email || !creditsToAdd}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>
            {loading 
              ? (mounted ? t('processing', { ns: 'credits', defaultValue: '处理中...' }) : '处理中...')
              : (mounted ? t('addCredits', { ns: 'credits', defaultValue: '增加积分' }) : '增加积分')
            }
          </span>
        </button>
      </div>

      {/* 消息提示 */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {message.type === 'success' ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <X className="w-5 h-5 text-red-600" />
              )}
              <span>{message.text}</span>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 