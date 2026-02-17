"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { hasInitContext } from '@/utils/initContext';

/**
 * 全局角色守卫：
 * - 已登录且 needChooseRole = true 时，自动跳转到 /onboard/role
 * - 已有角色但未填写 init_context 且当前在 / 或 /learn 时，跳转到 /onboard/context
 * - 避免在 /login、/onboard/role、/onboard/context 自身重复跳转
 */
export default function RoleGuard() {
  const { user, loading, needChooseRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    if (needChooseRole) {
      if (pathname === '/login' || pathname === '/onboard/role') return;
      router.replace('/onboard/role');
      return;
    }

    const hasRole = ['student', 'parent', 'teacher'].includes(user.role || '');
    if (hasRole && !hasInitContext() && (pathname === '/' || pathname === '/learn')) {
      router.replace('/onboard/role');
    }
  }, [user, loading, needChooseRole, pathname, router]);

  return null;
}

