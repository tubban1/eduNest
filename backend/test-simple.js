// 逐步测试文件 - 测试基本依赖
const express = require('express');

const app = express();

// 基本中间件
app.use(express.json());

// 测试端点
app.get('/api/test', (req, res) => {
  try {
    res.json({
      message: 'Express测试成功',
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.url,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: !!process.env.VERCEL,
        PORT: process.env.PORT
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Express测试失败',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 测试配置模块
app.get('/api/test-config', (req, res) => {
  try {
    // 测试配置模块导入
    const config = require('./src/config');
    
    res.json({
      message: '配置模块测试成功',
      timestamp: new Date().toISOString(),
      config: {
        isValid: config.isConfigValid,
        hasSupabase: !!config.SUPABASE_URL,
        hasJwt: !!config.JWT_SECRET,
        nodeEnv: config.NODE_ENV
      }
    });
  } catch (error) {
    res.status(500).json({
      error: '配置模块测试失败',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 测试数据库服务
app.get('/api/test-db', (req, res) => {
  try {
    // 测试数据库服务导入
    const DatabaseService = require('./src/services/database');
    
    res.json({
      message: '数据库服务测试成功',
      timestamp: new Date().toISOString(),
      hasService: !!DatabaseService
    });
  } catch (error) {
    res.status(500).json({
      error: '数据库服务测试失败',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 测试API路由模块导入
app.get('/api/test-routes', (req, res) => {
  try {
    const results = {};
    
    // 测试各个API模块导入
    try {
      const authRoutes = require('./src/api/auth');
      results.auth = '成功';
    } catch (error) {
      results.auth = `失败: ${error.message}`;
    }
    
    try {
      const contentRoutes = require('./src/api/content');
      results.content = '成功';
    } catch (error) {
      results.content = `失败: ${error.message}`;
    }
    
    try {
      const collectionListsRoutes = require('./src/api/collection_lists');
      results.collectionLists = '成功';
    } catch (error) {
      results.collectionLists = `失败: ${error.message}`;
    }
    
    try {
      const userCollectionsRoutes = require('./src/api/user_collections');
      results.userCollections = '成功';
    } catch (error) {
      results.userCollections = `失败: ${error.message}`;
    }
    
    try {
      const userContentRoutes = require('./src/api/user_content');
      results.userContent = '成功';
    } catch (error) {
      results.userContent = `失败: ${error.message}`;
    }
    
    res.json({
      message: 'API路由模块测试完成',
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error) {
    res.status(500).json({
      error: 'API路由模块测试失败',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 测试中间件模块导入
app.get('/api/test-middleware', (req, res) => {
  try {
    const results = {};
    
    try {
      const { authenticateToken } = require('./src/middleware/auth');
      results.auth = '成功';
    } catch (error) {
      results.auth = `失败: ${error.message}`;
    }
    
    try {
      const { errorHandler } = require('./src/utils/errorHandler');
      results.errorHandler = '成功';
    } catch (error) {
      results.errorHandler = `失败: ${error.message}`;
    }
    
    try {
      const logger = require('./src/utils/logger');
      results.logger = '成功';
    } catch (error) {
      results.logger = `失败: ${error.message}`;
    }
    
    res.json({
      message: '中间件模块测试完成',
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error) {
    res.status(500).json({
      error: '中间件模块测试失败',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: '接口不存在',
    path: req.originalUrl,
    available: [
      '/api/test', 
      '/api/test-config', 
      '/api/test-db',
      '/api/test-routes',
      '/api/test-middleware'
    ]
  });
});

module.exports = app; 