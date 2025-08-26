'use client';

import AdminCreditsManager from '@/components/AdminCreditsManager';

export default function AdminCreditsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">积分管理</h1>
        <p className="mt-2 text-sm text-gray-600">
          管理员可以手动为用户增加积分
        </p>
      </div>
      
      <AdminCreditsManager />
    </div>
  );
} 