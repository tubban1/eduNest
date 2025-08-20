const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// 确保环境变量在配置验证之前加载
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = require('./config');
const authRoutes = require('./api/auth');
const contentRoutes = require('./api/content');
const ratingRoutes = require('./api/rating');
const collectionListsRoutes = require('./api/collection_lists');
const userCollectionsRoutes = require('./api/user_collections');
const userContentRoutes = require('./api/user_content');
const aiRoutes = require('./api/ai');
const contentFixRoutes = require('./api/content_fix');
const { errorHandler } = require('./utils/errorHandler');
const logger = require('./utils/logger');
const { supabase } = require('./services/database');

// 验证配置
if (!config.isConfigValid) {
  logger.error('配置验证失败，请检查环境变量');
  if (!process.env.VERCEL) {
    process.exit(1);
  }
}

const app = express();
app.set('supabase', supabase);

// 安全中间件
app.use(helmet());

// CORS 配置
console.log('CORS 配置的允许源:', config.ALLOWED_ORIGINS);
app.use(cors({
  origin: config.ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 速率限制
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX,
  message: '请求过于频繁，请稍后再试'
});
app.use('/api/', limiter);

// 解析 JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.NODE_ENV
  });
});

// API 测试端点
app.get('/api/test', (req, res) => {
  try {
    res.json({ 
      message: 'API 工作正常',
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      config: {
        hasSupabaseUrl: !!config.SUPABASE_URL,
        hasSupabaseKey: !!config.SUPABASE_SERVICE_KEY,
        hasJwtSecret: !!config.JWT_SECRET,
        hasArkKey: !!config.ARK_API_KEY
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'API 测试失败',
      message: error.message 
    });
  }
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/content/fix', contentFixRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/collection_lists', collectionListsRoutes);
app.use('/api/user_collections', userCollectionsRoutes);
app.use('/api/user_content', userContentRoutes);
app.use('/api/ai', aiRoutes);

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: '接口不存在',
    path: req.originalUrl 
  });
});

// 错误处理中间件
app.use(errorHandler);

// 在Vercel环境中，不需要启动HTTP服务器
if (!process.env.VERCEL) {
  const PORT = config.PORT || 3001;
  
  // 启动服务器
  const startServer = async () => {
    try {
      // 验证数据库连接（仅在非Vercel环境中）
      try {
        const DatabaseService = require('./services/database');
        await DatabaseService.getContents();
        logger.info('数据库连接验证成功');
      } catch (dbError) {
        logger.warn('数据库连接验证失败，但继续启动服务器:', dbError.message);
      }
      
      app.listen(PORT, () => {
        logger.info(`服务器运行在端口 ${PORT}`);
        logger.info(`环境: ${config.NODE_ENV}`);
        logger.info(`API 文档: http://localhost:${PORT}/api/docs`);
        logger.info('✅ 服务器启动成功');
      });
    } catch (error) {
      logger.error('服务器启动失败:', error.message);
      process.exit(1);
    }
  };
  
  startServer();
}

module.exports = app; 