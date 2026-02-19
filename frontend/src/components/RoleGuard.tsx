"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

/**
 * 全局角色守卫：
 * - 已登录且 needChooseRole = true（尚无角色或角色为 user）时，自动跳转到 /onboard/role
 * - 已有角色（student/parent/teacher/admin）时不再跳转 onboard/role，直接使用当前页
 * - 避免在 /login、/onboard/role 自身重复跳转
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
    }
  }, [user, loading, needChooseRole, pathname, router]);

  return null;
}

