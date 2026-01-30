'use client';

import React, { useState, useEffect } from 'react';
import Sidebar, { MobileMenuButton } from '@/components/Sidebar';
import SubscriptionManager from '@/components/SubscriptionManager';
import { useTranslation } from 'react-i18next';

export default function SubscriptionPage() {
  const { t } = useTranslation(['common', 'content', 'navigation']);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      {/* 桌面端侧边栏 */}
      <div className="hidden lg:block h-screen sticky top-0 left-0 z-30">
        <Sidebar variant="desktop" />
      </div>
      
      {/* 移动端侧边栏 */}
      <Sidebar 
        variant="mobile" 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <main className="flex-1 bg-white overflow-y-auto">
        {/* 移动端头部（固定） */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <MobileMenuButton onClick={() => setSidebarOpen(true)} />
          <div className="w-10" /> {/* 占位，保持居中 */}
        </div>
        
        {/* 顶部预留占位，避免内容被固定头部遮挡 */}
        <div className="lg:hidden h-14" />

        <div className="px-4 py-8 sm:px-6 lg:p-8">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">
              {mounted ? t('subscription.title', { ns: 'content', defaultValue: '订阅与升级' }) : 'Subscription & Upgrade'}
            </h1>
            <SubscriptionManager />
          </div>
        </div>
      </main>
    </div>
  );
}
