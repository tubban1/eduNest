import { config } from './config';

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

export class AppError extends Error {
  public code: string;
  public details?: any;

  constructor(message: string, code: string = 'UNKNOWN_ERROR', details?: any) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

// 错误处理工具
export const errorHandler = {
  // 处理API错误
  handleApiError: (error: any): ApiError => {
    if (error instanceof AppError) {
      return {
        message: error.message,
        code: error.code,
        details: error.details,
      };
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        message: config.MESSAGES.NETWORK_ERROR,
        code: 'NETWORK_ERROR',
      };
    }

    // 保留原始错误信息
    if (error.message) {
      return {
        message: error.message,
        code: 'API_ERROR',
      };
    }

    return {
      message: config.MESSAGES.SERVER_ERROR,
      code: 'UNKNOWN_ERROR',
    };
  },

  // 处理验证错误
  handleValidationError: (errors: any[]): ApiError => {
    const messages = errors.map(err => err.message).join(', ');
    return {
      message: `${config.MESSAGES.VALIDATION_ERROR}: ${messages}`,
      code: 'VALIDATION_ERROR',
      details: errors,
    };
  },

  // 处理认证错误
  handleAuthError: (error: any): ApiError => {
    return {
      message: config.MESSAGES.AUTH_ERROR,
      code: 'AUTH_ERROR',
      details: error,
    };
  },

  // 处理权限错误
  handlePermissionError: (error: any): ApiError => {
    return {
      message: config.MESSAGES.PERMISSION_ERROR,
      code: 'PERMISSION_ERROR',
      details: error,
    };
  },

  // 创建自定义错误
  createError: (message: string, code: string = 'CUSTOM_ERROR', details?: any): AppError => {
    return new AppError(message, code, details);
  },
};

// 错误日志记录
export const logError = (error: any, context?: string) => {
  const errorInfo = {
    message: error.message,
    code: error.code,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  };

  // 在生产环境中可以发送到错误监控服务
  if (process.env.NODE_ENV === 'production') {
    // TODO: 集成错误监控服务
    // sendToErrorMonitoring(errorInfo);
  }
};

// 全局错误处理器
export const setupGlobalErrorHandler = () => {
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      logError(event.error, 'Global Error');
    });

    window.addEventListener('unhandledrejection', (event) => {
      logError(event.reason, 'Unhandled Promise Rejection');
    });
  }
}; 