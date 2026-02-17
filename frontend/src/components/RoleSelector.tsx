"use client";

import { useState } from 'react';
import { api } from '@/lib/api';

type RoleType = 'student' | 'parent' | 'teacher';

interface RoleSelectorProps {
  onRoleUpdated?: (role: RoleType) => void;
}

/**
 * 登录后选择角色的简单组件：
 * - 提供 学生 / 家长 / 老师 三个按钮
 * - 调用 PATCH /api/auth/me/role 更新 users.role
 */
export default function RoleSelector({ onRoleUpdated }: RoleSelectorProps) {
  const [submitting, setSubmitting] = useState<RoleType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectRole = async (role: RoleType) => {
    try {
      setSubmitting(role);
      setError(null);

      const res = await api.auth.updateRole(role);
      if (!res?.success) {
        throw new Error(res?.message || res?.error || '更新角色失败');
      }

      if (onRoleUpdated) {
        onRoleUpdated(role);
      }
    } catch (e: any) {
      setError(e?.message || '更新角色失败，请稍后重试');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <h2 className="text-lg font-semibold">请选择你在平台上的主要身份</h2>
      <p className="text-sm text-gray-500">这有助于我们为你定制更合适的体验，后续可以在设置中调整。</p>
      <div className="flex gap-3 mt-4">
        <button
          disabled={!!submitting}
          onClick={() => handleSelectRole('student')}
          className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          🎓 我是学生
        </button>
        <button
          disabled={!!submitting}
          onClick={() => handleSelectRole('parent')}
          className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          👨‍👩‍👧 我是家长
        </button>
        <button
          disabled={!!submitting}
          onClick={() => handleSelectRole('teacher')}
          className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          👩‍🏫 我是老师
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}

