"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 身份与偏好已合并到同一页 /onboard/role，本路径仅做重定向。
 */
export default function OnboardContextPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/onboard/role');
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">跳转中...</p>
    </div>
  );
}
