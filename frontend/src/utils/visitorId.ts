/**
 * Visitor ID 管理工具
 * 用于生成和管理游客的持久身份标识
 */

/**
 * 获取或创建 Visitor ID
 * 优先从 localStorage 读取，如果不存在则从 Cookie 读取，最后才生成新的
 * 确保 localStorage 和 Cookie 中的值保持一致
 */
export function getVisitorId(): string {
  // 1. 优先从 localStorage 读取
  let visitorId = localStorage.getItem('visitor_user_id');
  
  // 2. 如果 localStorage 不存在，尝试从 Cookie 读取（兜底方案）
  if (!visitorId) {
    visitorId = getVisitorIdFromCookie();
    
    // 如果从 Cookie 读取到了，同步到 localStorage
    if (visitorId) {
      localStorage.setItem('visitor_user_id', visitorId);
    }
  }
  
  // 3. 如果两者都不存在，生成新的 Visitor ID
  if (!visitorId) {
    visitorId = `visitor-${crypto.randomUUID()}`;
    localStorage.setItem('visitor_user_id', visitorId);
  }
  
  // 4. 确保 Cookie 也存在且值一致（同步）
  const cookieId = getVisitorIdFromCookie();
  if (!cookieId || cookieId !== visitorId) {
    // Cookie 不存在或值不一致，更新 Cookie
    document.cookie = `visitor_user_id=${visitorId}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
  }
  
  return visitorId;
}

/**
 * 从 Cookie 读取 Visitor ID（兜底方案）
 */
export function getVisitorIdFromCookie(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const match = document.cookie.match(/visitor_user_id=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * 清除 Visitor ID（登录后调用）
 */
export function clearVisitorId(): void {
  localStorage.removeItem('visitor_user_id');
  document.cookie = 'visitor_user_id=; path=/; max-age=0';
}

/**
 * 验证 Visitor ID 格式
 */
export function isValidVisitorId(visitorId: string): boolean {
  if (!visitorId || typeof visitorId !== 'string') {
    return false;
  }
  return /^visitor-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(visitorId);
}

/**
 * 判断一个 ID 是 visitor_id 还是 user_id
 */
export function isVisitorId(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return isValidVisitorId(id);
}

