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
        console.log('Cleared localStorage session:', key);
      }
    });
    
    // 清除sessionStorage中的session
    const sessionKeys = Object.keys(sessionStorage);
    sessionKeys.forEach(key => {
      if (key.includes('sb-') && key.includes('-auth-token')) {
        sessionStorage.removeItem(key);
        console.log('Cleared sessionStorage session:', key);
      }
    });
    
    // 清除所有可能的cookie
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    
    console.log('All sessions cleared successfully');
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
      clearAllSessions();
      return;
    }
    
    // 验证当前session是否有效
    const isValid = await validateSession(currentSession);
    
    if (!isValid) {
      clearAllSessions();
      return;
    }
    
    // 清除其他可能的冲突session，但保留当前有效的session
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.includes('sb-') && key.includes('-auth-token') && key !== 'sb-zayoczhybuegvtpcsgso-auth-token') {
        localStorage.removeItem(key);
        console.log('Cleared conflicting session:', key);
      }
    });
    
    console.log('Single account enforced successfully');
  } catch (error) {
    console.error('Error enforcing single account:', error);
    // 出错时清除所有session
    clearAllSessions();
  }
}; 