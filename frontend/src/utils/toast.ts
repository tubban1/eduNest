/**
 * 简单的 Toast 通知工具
 * 用于显示临时消息提示
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

class ToastManager {
  private toasts: Toast[] = [];
  private listeners: Set<(toasts: Toast[]) => void> = new Set();
  private toastIdCounter = 0;

  subscribe(listener: (toasts: Toast[]) => void) {
    this.listeners.add(listener);
    // 立即通知新订阅者当前状态
    listener([...this.toasts]);
    
    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(listener => listener([...this.toasts]));
  }

  show(message: string, type: ToastType = 'info', duration: number = 3000) {
    const id = `toast-${++this.toastIdCounter}`;
    const toast: Toast = { id, message, type, duration };
    
    this.toasts.push(toast);
    this.notify();

    // 自动移除
    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }

    return id;
  }

  remove(id: string) {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.notify();
  }

  clear() {
    this.toasts = [];
    this.notify();
  }

  getToasts(): Toast[] {
    return [...this.toasts];
  }
}

export const toastManager = new ToastManager();

// 便捷方法
export const toast = {
  success: (message: string, duration?: number) => toastManager.show(message, 'success', duration),
  error: (message: string, duration?: number) => toastManager.show(message, 'error', duration),
  warning: (message: string, duration?: number) => toastManager.show(message, 'warning', duration),
  info: (message: string, duration?: number) => toastManager.show(message, 'info', duration),
};

