// 前端环境配置
export const config = {
  // API 配置 - 使用环境变量，生产环境应该设置为 https://www.edunest.app/api
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === 'production' ? 'https://www.edunest.app/api' : 'http://localhost:3001/api'),
  
  // Supabase 配置 - 添加默认值避免undefined
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zayoczhybuegvtpcsgso.supabase.co',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpheW9jeWh5YnVlZ3Z0cGNzZ3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NTA1MDksImV4cCI6MjA2MzUyNjUwOX0.ptIKB-kR6q9hvQo5dYiU-wPC5EY2PQf1zidmo9w5nU8',
  
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