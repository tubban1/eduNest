// Session管理工具，防止多账号同时登录冲突

/**
 * 检测是否存在多账号session冲突
 */
export const detectSessionConflict = (): boolean => {
  try {
    const keys = Object.keys(localStorage);
    const sessionKeys = keys.filter(key => 
      key.includes('sb-') && key.includes('-auth-token')
    );
    
    return sessionKeys.length > 1;
  } catch (error) {
    console.error('Session conflict detection error:', error);
    return false;
  }
};

/**
 * 清除所有可能的冲突session
 */
export const clearAllSessions = (): void => {
  try {
    // 清除localStorage中的session
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.includes('sb-') && key.includes('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
    
    // 清除sessionStorage中的session
    const sessionKeys = Object.keys(sessionStorage);
    sessionKeys.forEach(key => {
      if (key.includes('sb-') && key.includes('-auth-token')) {
        sessionStorage.removeItem(key);
      }
    });
    
    // 清除所有可能的cookie（但保留 visitor_user_id）
    document.cookie.split(";").forEach(function(c) { 
      const cookieName = c.replace(/^ +/, "").split("=")[0];
      // 保留 visitor_user_id，因为它是游客身份标识，不应该被清除
      if (cookieName !== 'visitor_user_id') {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      }
    });
    
  } catch (error) {
    console.error('Error clearing sessions:', error);
  }
};

/**
 * 获取当前活跃的session信息
 */
export const getCurrentSession = (): any => {
  try {
    const sessionStr = localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token');
    if (sessionStr) {
      return JSON.parse(sessionStr);
    }
    return null;
  } catch (error) {
    console.error('Error getting current session:', error);
    return null;
  }
};

/**
 * 验证session是否有效
 */
export const validateSession = async (session: any): Promise<boolean> => {
  try {
    if (!session?.access_token) {
      return false;
    }
    
    const response = await fetch('https://zayoczhybuegvtpcsgso.supabase.co/auth/v1/user', {
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
};

/**
 * 强制单账号登录：清除冲突session并保持当前session
 */
export const enforceSingleAccount = async (): Promise<void> => {
  try {
    const currentSession = getCurrentSession();
    
    if (!currentSession) {
      // 没有当前会话，不做破坏性清理，交由登录流程处理
      return;
    }
    
    // 验证当前session是否有效（加入最多2次重试）
    const maxAttempts = 3;
    let attempt = 0;
    let isValid = false;
    while (attempt < maxAttempts) {
      isValid = await validateSession(currentSession);
      if (isValid) break;
      // 指数退避 200ms, 400ms
      await new Promise(r => setTimeout(r, 200 * Math.pow(2, attempt)));
      attempt++;
    }
    
    if (!isValid) {
      // 验证仍失败，不强制清除所有；避免网络抖动误伤
      return;
    }
    
    // 仅在确实存在多个 Supabase 会话键时，清除其他键
    const keys = Object.keys(localStorage);
    const sessionKeys = keys.filter(key => key.includes('sb-') && key.includes('-auth-token'));
    if (sessionKeys.length > 1) {
      sessionKeys.forEach(key => {
        if (key !== 'sb-zayoczhybuegvtpcsgso-auth-token') {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.error('Error enforcing single account:', error);
    // 出错时不做破坏性清理，避免误登出
  }
}; 