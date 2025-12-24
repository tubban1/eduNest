import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface AIProvider {
  key: string;
  name: string;
  model: string;
  configured: boolean;
}

interface AIProviderSelectorProps {
  selectedProvider?: string;
  onProviderChange?: (provider: string) => void;
  disabled?: boolean;
  className?: string;
}

const AIProviderSelector: React.FC<AIProviderSelectorProps> = ({
  selectedProvider,
  onProviderChange,
  disabled = false,
  className = ''
}) => {
  const { t, i18n } = useTranslation('aiProvider');
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  // 移除调试日志

  // 获取可用的AI提供商列表（调用后端 API 基地址）
  const fetchProviders = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/ai/providers`);
      const data = await response.json();
      
      if (data.success) {
        setProviders(data.providers);
      } else {
        console.error('获取AI提供商失败:', data.error);
      }
    } catch (error) {
      console.error('获取AI提供商失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 测试提供商连接
  const testProvider = async (providerKey: string) => {
    setTesting(providerKey);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/ai/test-provider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider: providerKey }),
      });
      
      const data = await response.json();
      const success = data.success && data.result?.success;
      
      setTestResults(prev => ({
        ...prev,
        [providerKey]: success
      }));
      
      return success;
    } catch (error) {
      console.error(`测试提供商 ${providerKey} 失败:`, error);
      setTestResults(prev => ({
        ...prev,
        [providerKey]: false
      }));
      return false;
    } finally {
      setTesting(null);
    }
  };

  // 获取当前默认提供商
  const fetchDefaultProvider = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/ai/default-provider`);
      const data = await response.json();
      
      if (data.success && onProviderChange) {
        onProviderChange(data.defaultProvider);
      }
    } catch (error) {
      console.error('获取默认提供商失败:', error);
    }
  };

  useEffect(() => {
    fetchProviders();
    fetchDefaultProvider();
  }, []);

  const handleProviderChange = (providerKey: string) => {
    if (onProviderChange) {
      onProviderChange(providerKey);
    }
  };

  const handleTestClick = async (e: React.MouseEvent, providerKey: string) => {
    e.stopPropagation();
    await testProvider(providerKey);
  };

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        <span className="text-sm text-muted-foreground">{t('loading')}</span>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-foreground">
          {t('title')}
        </label>
        <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">
          {t('adminOnly')}
        </span>
      </div>
      
      <div className="space-y-2">
        {providers.map((provider) => (
          <div
            key={provider.key}
            className={`
              relative flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all
              ${selectedProvider === provider.key
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-border/80'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${!provider.configured ? 'opacity-50' : ''}
            `}
            onClick={() => !disabled && provider.configured && handleProviderChange(provider.key)}
          >
            <div className="flex items-center space-x-3">
              <div className={`
                w-4 h-4 rounded-full border-2 flex items-center justify-center
                ${selectedProvider === provider.key
                  ? 'border-primary bg-primary'
                  : 'border-border'
                }
              `}>
                {selectedProvider === provider.key && (
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                )}
              </div>
              
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">
                    {provider.name}
                  </span>
                  {!provider.configured && (
                    <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                      {t('notConfigured')}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {t('model')}: {provider.model}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {testResults[provider.key] !== undefined && (
                <div className={`
                  w-2 h-2 rounded-full
                  ${testResults[provider.key] ? 'bg-green-500' : 'bg-red-500'}
                `}></div>
              )}
              
              <button
                type="button"
                onClick={(e) => handleTestClick(e, provider.key)}
                disabled={disabled || !provider.configured || testing === provider.key}
                className={`
                  px-3 py-1 text-xs rounded transition-colors
                  ${testing === provider.key
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }
                  ${disabled || !provider.configured ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {testing === provider.key ? (
                  <div className="flex items-center space-x-1">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-400"></div>
                    <span>{t('testing')}</span>
                  </div>
                ) : (
                  t('test')
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {providers.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          {t('noProviders')}
        </div>
      )}
    </div>
  );
};

export default AIProviderSelector;
