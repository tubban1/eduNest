const path = require('path');

// 在Vercel环境中，让dotenv自动查找环境变量
if (process.env.VERCEL) {
  require('dotenv').config();
} else {
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
}

const config = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ARK_API_KEY: process.env.ARK_API_KEY,
  ARK_URL: process.env.ARK_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  ARK_MODEL: process.env.ARK_MODEL || 'kimi-k2-250711',
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  // 生产环境CORS配置
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    (process.env.NODE_ENV === 'production' ? 
      ['https://eduNest.app', 'https://www.eduNest.app'] : 
      ['http://localhost:3000', 'http://127.0.0.1:3000']
    ),
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15分钟
  RATE_LIMIT_MAX: 100, // 最大请求数
};

// 生产环境强制检查 - 在Vercel环境中跳过
if (config.NODE_ENV === 'production' && !process.env.VERCEL) {
  const missingConfigs = [];
  if (!process.env.JWT_SECRET) missingConfigs.push('JWT_SECRET');
  if (!process.env.ARK_API_KEY) missingConfigs.push('ARK_API_KEY');
  if (!process.env.SUPABASE_URL) missingConfigs.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_KEY) missingConfigs.push('SUPABASE_SERVICE_KEY');
  if (!process.env.SUPABASE_ANON_KEY) missingConfigs.push('SUPABASE_ANON_KEY');

  if (missingConfigs.length > 0) {
    console.error(`❌ 生产环境缺少必要的环境变量: ${missingConfigs.join(', ')}`);
    process.exit(1);
  }
  
  // 生产环境配置检查通过
} else {
  // 开发模式或Vercel环境：只检查基本配置
  const basicConfigs = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missingConfigs = basicConfigs.filter(config => !process.env[config]);
  
  if (missingConfigs.length > 0 && !process.env.VERCEL) {
    // 开发模式警告：某些功能可能不可用
    console.warn('⚠️ 开发模式缺少基本配置:', missingConfigs);
  }
}

// 在Vercel环境中，总是标记配置为有效
if (process.env.VERCEL) {
  config.isConfigValid = true;
  console.log('✅ Vercel环境配置验证通过');
} else {
  config.isConfigValid = true;
}

module.exports = config; 