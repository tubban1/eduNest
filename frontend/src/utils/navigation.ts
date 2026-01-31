import { useRouter } from 'next/navigation';

/**
 * 智能返回逻辑
 * - 只返回平台内页面（同域）
 * - 使用浏览器返回以恢复前一个具体浏览位置（滚动位置）
 */
export const useSmartBack = () => {
  const router = useRouter();

  const isPlatformReferrer = () => {
    if (typeof window === 'undefined') return false;
    const referrer = document.referrer;
    if (!referrer) return false;
    try {
      const referrerUrl = new URL(referrer);
      return referrerUrl.origin === window.location.origin;
    } catch {
      return false;
    }
  };

  const handleSmartBack = () => {
    if (isPlatformReferrer()) {
      // 同域来源：使用浏览器返回，自动恢复滚动位置
      router.back();
    } else {
      // 外部来源或无来源：返回首页
      router.push('/');
    }
  };

  return { handleSmartBack, isPlatformReferrer };
};
