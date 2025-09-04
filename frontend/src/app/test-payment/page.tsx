'use client';

import React, { useState } from 'react';
import StripeCheckout from '@/components/StripeCheckout';

const TestPaymentPage: React.FC = () => {
  const [showCheckout, setShowCheckout] = useState(false);

  const handleSuccess = (subscription: any) => {
    console.log('订阅成功:', subscription);
    alert('订阅成功！');
    setShowCheckout(false);
  };

  const handleError = (error: string) => {
    console.error('支付错误:', error);
    alert(`支付错误: ${error}`);
  };

  const handleCancel = () => {
    console.log('用户取消支付');
    setShowCheckout(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Stripe支付测试页面
          </h1>
          <p className="text-gray-600">
            测试Stripe Checkout集成和支付流程
          </p>
        </div>

        {!showCheckout ? (
          <div className="max-w-md mx-auto">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                开始测试支付
              </h2>
              <p className="text-gray-600 mb-6">
                点击下面的按钮开始测试Stripe支付流程
              </p>
              <button
                onClick={() => setShowCheckout(true)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                测试Pro订阅支付
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto">
            <StripeCheckout
              planType="pro"
              onSuccess={handleSuccess}
              onError={handleError}
              onCancel={handleCancel}
            />
          </div>
        )}

        <div className="mt-8 max-w-2xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              测试说明
            </h3>
            <div className="space-y-3 text-sm text-gray-600">
              <p>• 这是一个测试页面，用于验证Stripe支付集成</p>
              <p>• 使用Stripe测试模式，不会产生真实费用</p>
              <p>• 可以使用测试卡号：4242 4242 4242 4242</p>
              <p>• 任意未来日期和任意CVC都可以</p>
              <p>• 支付成功后会重定向到成功页面</p>
              <p>• 取消支付会重定向到取消页面</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPaymentPage;
