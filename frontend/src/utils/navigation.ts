import { useRouter } from 'next/navigation';

/**
 * 智能返回逻辑
 * 根据来源页面智能选择返回目标
 */
export const useSmartBack = () => {
  const router = useRouter();

  const getBackTarget = () => {
    // 检查是否有来源页面
    if (typeof window === 'undefined') return '/';
    
    const referrer = document.referrer;
    if (!referrer) return '/'; // 无来源，返回首页
    
    try {
      const referrerUrl = new URL(referrer);
      const currentOrigin = window.location.origin;
      
      // 如果是同域名的来源
      if (referrerUrl.origin === currentOrigin) {
        const pathname = referrerUrl.pathname;
        
        // 从内容列表页面来，返回到内容列表
        if (pathname === '/c') return '/c';
        
        // 从首页来，返回到首页
        if (pathname === '/') return '/';
        
        // 从其他页面来，使用浏览器返回
        return null; // null 表示使用 router.back()
      }
    } catch (error) {
      // URL解析失败，返回首页
      console.warn('Failed to parse referrer URL:', error);
    }
    
    // 跨域或其他情况，返回首页
    return '/';
  };

  const handleSmartBack = () => {
    const target = getBackTarget();
    
    if (target === null) {
      // 使用浏览器返回
      router.back();
    } else {
      // 导航到指定页面
      router.push(target);
    }
  };

  return { handleSmartBack, getBackTarget };
};
