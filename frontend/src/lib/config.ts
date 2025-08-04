// 前端环境配置
export const config = {
  // API 配置 - 移除硬编码的localhost
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === 'production' ? 'https://eduNest.app/api' : 'http://localhost:3001/api'),
  
  // Supabase 配置
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  
  // 应用配置
  APP_NAME: 'AI 互动教育平台',
  APP_VERSION: '1.0.0',
  
  // 功能开关 - 支持环境变量控制
  FEATURES: {
    AI_GENERATION: process.env.NEXT_PUBLIC_AI_GENERATION !== 'false',
    USER_COLLECTIONS: process.env.NEXT_PUBLIC_USER_COLLECTIONS !== 'false',
    RATINGS: process.env.NEXT_PUBLIC_RATINGS !== 'false',
    ADMIN_PANEL: process.env.NEXT_PUBLIC_ADMIN_PANEL !== 'false',
    GOOGLE_AUTH: process.env.NEXT_PUBLIC_GOOGLE_AUTH !== 'false',
  },
  
  // 分页配置
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 50,
  },
  
  // 文件上传配置
  UPLOAD: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  },
  
  // 缓存配置
  CACHE: {
    CONTENT_TTL: 5 * 60 * 1000, // 5分钟
    USER_TTL: 30 * 60 * 1000, // 30分钟
  },
  
  // 错误消息
  MESSAGES: {
    NETWORK_ERROR: '网络连接失败，请检查网络设置',
    AUTH_ERROR: '认证失败，请重新登录',
    PERMISSION_ERROR: '权限不足，无法执行此操作',
    VALIDATION_ERROR: '输入数据格式不正确',
    SERVER_ERROR: '服务器内部错误，请稍后重试',
  },
  
  // 验证规则
  VALIDATION: {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PASSWORD_MIN_LENGTH: 6,
    TITLE_MIN_LENGTH: 2,
    TITLE_MAX_LENGTH: 100,
  },
};

// 环境检查
export const validateEnvironment = () => {
  const requiredEnvVars = [
    'NEXT_PUBLIC_API_BASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  const missingVars = requiredEnvVars.filter(
    varName => !process.env[varName]
  );
  
  if (missingVars.length > 0) {
    console.warn('缺少环境变量:', missingVars);
    return false;
  }
  
  return true;
};

// 生产环境强制检查
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  if (!validateEnvironment()) {
    console.error('生产环境缺少必要的环境变量');
  }
}

// 开发环境检查
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  validateEnvironment();
} 