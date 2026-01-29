'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface PaymentFormProps {
  planType: string;
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ planType, amount, onSuccess, onCancel }) => {
  const { t } = useTranslation(['common']);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 这里应该集成Stripe Elements进行支付处理
      // 暂时模拟支付成功
      setTimeout(() => {
        onSuccess();
        setLoading(false);
      }, 2000);
    } catch (error) {
      console.error('支付失败:', error);
      alert('支付失败，请稍后重试');
      setLoading(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">支付信息</h2>
      
      <div className="mb-4 p-3 bg-primary/10 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-foreground font-medium">订阅计划</span>
          <span className="text-foreground font-bold">${amount}</span>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          {planType === 'pro' ? 'Pro 计划 - $20/月' : 'Lite 计划 - $5'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            持卡人姓名
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="请输入持卡人姓名"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            卡号
          </label>
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="1234 5678 9012 3456"
            maxLength={19}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              有效期
            </label>
            <input
              type="text"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="MM/YY"
              maxLength={5}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CVC
            </label>
            <input
              type="text"
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="123"
              maxLength={4}
              required
            />
          </div>
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="tile button flex-1"
          >
            <div className="tile w-full justify-center py-2 px-4 font-medium">取消</div>
          </button>
          <button
            type="submit"
            disabled={loading}
            className="tile button flex-1"
            data-state={loading ? 'down' : undefined}
          >
            <div className="tile w-full justify-center py-2 px-4 font-medium">
              {loading 
                ? (mounted ? t('processing', { ns: 'common', defaultValue: '处理中...' }) : '处理中...')
                : (mounted ? t('pay', { ns: 'common', defaultValue: `支付 $${amount}`, amount: amount.toString() }) : `支付 $${amount}`)
              }
            </div>
          </button>
        </div>
      </form>

      <div className="mt-4 text-xs text-gray-500">
        <p>• 支付信息通过SSL加密传输</p>
        <p>• 支持Visa、MasterCard、American Express等主流信用卡</p>
        <p>• 订阅将按月自动续费，可随时取消</p>
      </div>
    </div>
  );
};

export default PaymentForm;
