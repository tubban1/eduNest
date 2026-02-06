const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { WebSocketServer } = require('ws');
const { handleClientConnection } = require('./services/realtimeProxy');

// 确保环境变量在配置验证之前加载
// .env 文件在 edu/ 目录下（backend 的上一级目录）
// server.js 在 backend/src/，所以需要 ../.. 才能到 edu/
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), override: true });

const config = require('./config');
const authRoutes = require('./api/auth');
const contentRoutes = require('./api/content');
const ratingRoutes = require('./api/rating');
const collectionListsRoutes = require('./api/collection_lists');
const userCollectionsRoutes = require('./api/user_collections');
const userContentRoutes = require('./api/user_content');
const aiRoutes = require('./api/ai');
const aiServiceRoutes = require('./services/aiService').router;
const aiGuideRoutes = require('./api/ai_guide');
const contentFixRoutes = require('./api/content_fix');
const creditsRoutes = require('./api/credits');
const referralsRoutes = require('./api/referrals');
const subscriptionsRoutes = require("./api/subscriptions");
const paymentsRoutes = require("./api/payments");
const visitorRoutes = require('./api/visitor');
const pageViewsRoutes = require('./api/page_views');
const testSharpThumbnailRoutes = require('./api/test-sharp-thumbnail');
const earlyUserBonusRoutes = require('./api/early_user_bonus');
const rendererTestRoutes = require('./api/renderer-test');
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

// Disable default compression for SSE
// If compression is added later, it needs to be configured to ignore text/event-stream
// app.use(compression(...)); 

// CORS 配置
console.log('CORS 配置的允许源:', config.ALLOWED_ORIGINS);
app.use(cors({
  origin: config.ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Visitor-Id']
}));

// 速率限制
const limiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'production' ? (60 * 1000) : (60 * 1000),
  max: process.env.NODE_ENV === 'production' ? 120 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, _res) => {
    try {
      // 认证后优先按用户ID限流，否则回退IP
      return (req.user && req.user.id) ? `uid:${req.user.id}` : `ip:${req.ip}`;
    } catch {
      return `ip:${req.ip}`;
    }
  },
  message: '请求过于频繁，请稍后再试'
});
app.use('/api/', limiter);

// Stripe webhook 需要原始请求体来验证签名
// 必须在 express.json() 之前处理 webhook 路由
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// 解析 JSON（增加限制以支持大图片 base64 编码）
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.NODE_ENV
  });
});

// 简单诊断端点 - 测试基本功能
app.get('/api/diagnose', (req, res) => {
  try {
    res.json({
      message: '诊断端点工作正常',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      vercel: !!process.env.VERCEL,
      config: {
        isValid: config.isConfigValid,
        hasSupabase: !!config.SUPABASE_URL,
        hasJwt: !!config.JWT_SECRET
      }
    });
  } catch (error) {
    res.status(500).json({
      error: '诊断端点失败',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
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
app.use('/api/credits', creditsRoutes);
app.use('/api/referrals', referralsRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/collection_lists', collectionListsRoutes);
app.use('/api/user_collections', userCollectionsRoutes);
app.use('/api/user_content', userContentRoutes);
app.use("/api/subscriptions", subscriptionsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/ai-guide", aiGuideRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/ai", aiServiceRoutes);
app.use("/api/visitor", visitorRoutes);
app.use("/api/page-views", pageViewsRoutes);
app.use("/api/test-sharp-thumbnail", testSharpThumbnailRoutes);
app.use("/api/early-user-bonus", earlyUserBonusRoutes);
app.use("/api/renderer-test", rendererTestRoutes);
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
  const server = http.createServer(app);

  // 实时语音 WebSocket（AI Guide）
  const wss = new WebSocketServer({ noServer: true });
  wss.on('connection', handleClientConnection);

  server.on('upgrade', (request, socket, head) => {
    const pathname = require('url').parse(request.url).pathname;
    if (pathname === '/api/ai-guide/realtime') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  const startServer = async () => {
    try {
      if (process.env.VERCEL) return;

      try {
        const DatabaseService = require('./services/database');
        await DatabaseService.getContents();
      } catch (dbError) {
        logger.warn('数据库连接验证失败，但继续启动服务器:', dbError.message);
      }

      server.listen(PORT, () => {
        logger.info(`Server listening on port ${PORT}`);
      });
    } catch (error) {
      logger.error('服务器启动失败:', error.message);
      if (!process.env.VERCEL) process.exit(1);
    }
  };

  startServer();
}

module.exports = app; 