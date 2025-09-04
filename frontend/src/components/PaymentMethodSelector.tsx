import React, { useState, useEffect } from 'react';
import { 
  getAllAvailablePaymentMethods, 
  detectUserRegion, 
  type PaymentMethod 
} from '../utils/regionUtils';

interface PaymentMethodSelectorProps {
  onSelectionChange: (selectedMethods: string[]) => void;
  selectedMethods?: string[];
}

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  onSelectionChange,
  selectedMethods = []
}) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRegion, setUserRegion] = useState(detectUserRegion());

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      
      // 使用地区适配获取支付方式
      const availableMethods = getAllAvailablePaymentMethods();
      setPaymentMethods(availableMethods);
      
      // 默认选择第一个支付方式
      if (availableMethods.length > 0 && selectedMethods.length === 0) {
        onSelectionChange([availableMethods[0].id]);
      }
      
    } catch (error) {
      console.error('获取支付方式错误:', error);
      setError('获取支付方式失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMethodToggle = (methodId: string) => {
    const newSelection = selectedMethods.includes(methodId)
      ? selectedMethods.filter(id => id !== methodId)
      : [...selectedMethods, methodId];
    
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    const allMethodIds = paymentMethods.map(method => method.id);
    onSelectionChange(allMethodIds);
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-gray-600">加载支付方式...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-600 mb-2">{error}</p>
        <button
          onClick={fetchPaymentMethods}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 地区信息显示 */}
      <div className="bg-blue-50 p-3 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">
              检测到您的地区: {userRegion.name}
            </p>
            <p className="text-xs text-blue-700">
              货币: {userRegion.currency} | 时区: {userRegion.timezone}
            </p>
          </div>
          <div className="text-xs text-blue-600">
            自动适配支付方式
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">选择支付方式</h3>
        <div className="flex space-x-2">
          <button
            onClick={handleSelectAll}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            全选
          </button>
          <button
            onClick={handleClearAll}
            className="text-sm text-gray-600 hover:text-gray-700"
          >
            清空
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {paymentMethods.map((method) => (
          <label
            key={method.id}
            className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedMethods.includes(method.id)}
              onChange={() => handleMethodToggle(method.id)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-3 text-sm font-medium text-gray-900">
              {method.name}
            </span>
            <span className="ml-2 text-xs text-gray-500">
              ({method.description})
            </span>
          </label>
        ))}
      </div>

      {selectedMethods.length === 0 && (
        <p className="text-sm text-orange-600">
          请至少选择一种支付方式
        </p>
      )}

      {selectedMethods.length > 0 && (
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            已选择: {selectedMethods.length} 种支付方式
          </p>
        </div>
      )}
    </div>
  );
};

export default PaymentMethodSelector;
