'use client';
import React from 'react';
import SubscriptionManager from '@/components/SubscriptionManager';

export default function SubscriptionPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">订阅与升级</h1>
        <SubscriptionManager />
      </div>
    </div>
  );
}
