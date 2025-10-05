'use client';

import React from 'react';
import PendingCard from './PendingCard';
import ProcessingCard from './ProcessingCard';
import FailedCard from './FailedCard';

// 测试用的内容数据
const testContent = {
  id: 'test-content-id',
  title: '测试内容标题',
  created_at: new Date().toISOString()
};

const StatusCardTest: React.FC = () => {
  const [retryCount, setRetryCount] = React.useState(0);
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      setIsRetrying(false);
      setRetryCount(prev => prev + 1);
    }, 2000);
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">状态卡片测试</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 等待状态 */}
        <div>
          <h3 className="text-lg font-semibold mb-3">等待中 (Pending)</h3>
          <PendingCard content={testContent} />
        </div>
        
        {/* 生成中状态 */}
        <div>
          <h3 className="text-lg font-semibold mb-3">生成中 (Processing)</h3>
          <ProcessingCard 
            content={testContent} 
            progress={65} 
            retryCount={1} 
          />
        </div>
        
        {/* 失败状态 */}
        <div>
          <h3 className="text-lg font-semibold mb-3">失败 (Failed)</h3>
          <FailedCard 
            content={testContent} 
            errorMessage="AI服务暂时不可用，请稍后重试"
            retryCount={retryCount}
            onRetry={handleRetry}
            isRetrying={isRetrying}
          />
        </div>
        
        {/* 正常内容卡片 */}
        <div>
          <h3 className="text-lg font-semibold mb-3">正常内容 (Done)</h3>
          <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            <div className="p-4">
              <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2">
                {testContent.title}
              </h3>
              <div className="text-sm text-gray-500 mb-3">
                {new Date(testContent.created_at).toLocaleDateString()}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                  已完成
                </span>
                <button className="text-blue-600 hover:text-blue-800 text-sm">
                  查看 →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2">测试说明：</h4>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• 等待中：显示灰色骨架屏效果</li>
          <li>• 生成中：显示进度条和旋转动画</li>
          <li>• 失败：显示错误信息和重试按钮</li>
          <li>• 点击重试按钮可以看到重试动画效果</li>
        </ul>
      </div>
    </div>
  );
};

export default StatusCardTest;
