import { supabase } from '@/lib/supabase';

/**
 * Token监控工具类
 * 用于监控和自动刷新Supabase JWT token
 */
export class TokenMonitor {
  private static instance: TokenMonitor;
  private intervalId: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  private constructor() {}

  public static getInstance(): TokenMonitor {
    if (!TokenMonitor.instance) {
      TokenMonitor.instance = new TokenMonitor();
    }
    return TokenMonitor.instance;
  }

  /**
   * 开始监控token状态
   * @param intervalMs 检查间隔（毫秒），默认5分钟
   */
  public startMonitoring(intervalMs: number = 5 * 60 * 1000): void {
    if (this.isMonitoring) {
      console.log('Token监控已在运行中');
      return;
    }

    console.log(`开始Token监控，检查间隔: ${intervalMs / 1000}秒`);
    this.isMonitoring = true;

    // 立即检查一次
    this.checkTokenStatus();

    // 设置定期检查
    this.intervalId = setInterval(() => {
      this.checkTokenStatus();
    }, intervalMs);
  }

  /**
   * 停止监控
   */
  public stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isMonitoring = false;
    console.log('Token监控已停止');
  }

  /**
   * 检查token状态
   */
  private async checkTokenStatus(): Promise<void> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Token状态检查失败:', error);
        return;
      }

      if (!session?.access_token) {
        console.log('Token状态: 无有效session');
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at || 0;
      const timeUntilExpiry = expiresAt - now;


      // 如果token即将过期，尝试刷新
      if (timeUntilExpiry < 300 && timeUntilExpiry > 0) {
        await this.refreshToken();
      } else if (timeUntilExpiry <= 0) {
        console.warn('Token已过期，需要重新登录');
        this.handleTokenExpired();
      }
    } catch (error) {
      console.error('Token状态检查异常:', error);
    }
  }

  /**
   * 刷新token
   */
  private async refreshToken(): Promise<boolean> {
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Token自动刷新失败:', refreshError);
        this.handleTokenExpired();
        return false;
      }

      if (refreshData?.session?.access_token) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token刷新异常:', error);
      this.handleTokenExpired();
      return false;
    }
  }

  /**
   * 处理token过期
   */
  private handleTokenExpired(): void {
    
    // 清除本地存储
    localStorage.removeItem('sb-zayoczhybuegvtpcsgso-auth-token');
    
    // 停止监控
    this.stopMonitoring();
    
    // 重定向到登录页
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  /**
   * 获取当前token状态
   */
  public async getTokenStatus(): Promise<{
    isValid: boolean;
    expiresAt?: Date;
    timeUntilExpiry?: number;
    needsRefresh?: boolean;
  }> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session?.access_token) {
        return { isValid: false };
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at || 0;
      const timeUntilExpiry = expiresAt - now;

      return {
        isValid: timeUntilExpiry > 0,
        expiresAt: new Date(expiresAt * 1000),
        timeUntilExpiry,
        needsRefresh: timeUntilExpiry < 300
      };
    } catch (error) {
      console.error('获取token状态失败:', error);
      return { isValid: false };
    }
  }
}

// 导出单例实例
export const tokenMonitor = TokenMonitor.getInstance();
