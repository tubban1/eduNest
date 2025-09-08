import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { api } from '../lib/api';
import PaymentMethodSelector from './PaymentMethodSelector';
import { detectUserRegion } from '../utils/regionUtils';

interface StripeCheckoutProps {
  planType: 'pro';
  onSuccess?: (subscription: any) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

// 简化的Checkout组件，使用Stripe Checkout Session
const StripeCheckout: React.FC<StripeCheckoutProps> = ({
  planType,
  onSuccess,
  onError,
  onCancel,
}) => {
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [userRegion] = useState(detectUserRegion());

  const handleCheckout = async () => {
    setIsLoading(true);
    setError('');

    try {
      // 创建支付会话
      const response = await api.createPaymentSession(planType, {
        success_url: `${window.location.origin}/subscription/success`,
        cancel_url: `${window.location.origin}/subscription/cancel`,
        payment_methods: selectedPaymentMethods,
        region: userRegion.code,
      });


      // 检查响应结构
      if (response?.success && response?.session?.url) {
        // 重定向到Stripe Checkout页面
        window.location.href = response.session.url;
      } else if (response?.session?.url) {
        // 直接包含session的情况
        window.location.href = response.session.url;
      } else {
        console.error('响应中没有找到session URL:', response);
        throw new Error('Failed to create checkout session - no URL found');
      }
    } catch (error) {
      console.error('创建支付会话失败:', error);
      const errorMsg = '创建支付会话失败，请稍后重试';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {planType === 'pro' ? '升级到Pro' : '订阅计划'}
        </h2>
        <p className="text-gray-600">
          享受无限AI使用和高级功能
        </p>
      </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium text-gray-900">
            Pro 计划
          </h3>
          <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
            {userRegion.name} ({userRegion.currency})
          </div>
        </div>
        <p className="text-gray-600 mb-4">
          无限AI使用，高级功能，优先支持
        </p>
        <div className="text-2xl font-bold text-gray-900">
          $20<span className="text-lg font-normal text-gray-600">/月</span>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-gray-600">
          <li>✓ 无限AI内容生成</li>
          <li>✓ 无限内容修复</li>
          <li>✓ 高级功能访问</li>
          <li>✓ 优先客户支持</li>
        </ul>
      </div>

      {/* 支付方式选择 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-900">支付方式</h3>
          <button
            type="button"
            onClick={() => setShowPaymentSelector(!showPaymentSelector)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showPaymentSelector ? '隐藏选项' : '选择支付方式'}
          </button>
        </div>
        
        {showPaymentSelector ? (
          <PaymentMethodSelector
            onSelectionChange={setSelectedPaymentMethods}
            selectedMethods={selectedPaymentMethods}
          />
        ) : (
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              {selectedPaymentMethods.length > 0 
                ? `已选择 ${selectedPaymentMethods.length} 种支付方式`
                : '点击"选择支付方式"来配置可用的支付选项'
              }
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-600 text-sm">{error}</div>
        </div>
      )}

      <div className="flex space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleCheckout}
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              处理中...
            </span>
          ) : (
            '开始订阅'
          )}
        </button>
      </div>
    </div>
  );
};

export default StripeCheckout;
