// 增强版Vercel函数 - 逐步添加功能
const express = require('express');
const cors = require('cors');

const app = express();

// 基本中间件
app.use(cors({
  origin: ['https://www.edunest.app', 'https://edunest.app'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 测试端点
app.get('/api/test', (req, res) => {
  res.json({ 
    message: '增强版API工作正常',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    features: ['cors', 'logging', 'error-handling']
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: 'enhanced-1.0'
  });
});

// 集合列表端点
app.get('/api/collection_lists', (req, res) => {
  try {
    // 返回增强的模拟数据
    res.json([
      {
        id: 'default',
        name: '默认收藏夹',
        visibility: 'public',
        order_index: 0,
        created_at: new Date().toISOString()
      },
      {
        id: 'personal',
        name: '个人收藏',
        visibility: 'private',
        order_index: 1,
        created_at: new Date().toISOString()
      }
    ]);
  } catch (error) {
    console.error('集合列表错误:', error);
    res.status(500).json({ 
      error: '获取收藏夹失败',
      message: error.message 
    });
  }
});

// 内容端点
app.get('/api/content', (req, res) => {
  try {
    const { created_by, limit = 10 } = req.query;
    
    // 返回增强的模拟数据
    const mockContents = [];
    for (let i = 1; i <= Math.min(parseInt(limit), 5); i++) {
      mockContents.push({
        id: `mock-content-${i}`,
        short_id: `c${String(i).padStart(7, '0')}`,
        title: `示例内容 ${i}`,
        language_code: 'zh-CN',
        tags: ['示例', '测试'],
        knowledge_point: ['测试知识点'],
        created_by: created_by || 'mock-user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    res.json(mockContents);
  } catch (error) {
    console.error('内容获取错误:', error);
    res.status(500).json({ 
      error: '获取内容失败',
      message: error.message 
    });
  }
});

// 用户内容端点
app.get('/api/user_content', (req, res) => {
  try {
    const { user_id } = req.query;
    
    res.json([
      {
        id: 'user-content-1',
        short_id: 'uc1234567',
        title: '用户创建的内容',
        language_code: 'zh-CN',
        created_by: user_id || 'mock-user',
        created_at: new Date().toISOString()
      }
    ]);
  } catch (error) {
    console.error('用户内容错误:', error);
    res.status(500).json({ 
      error: '获取用户内容失败',
      message: error.message 
    });
  }
});

// 用户收藏端点
app.get('/api/user_collections', (req, res) => {
  try {
    const { user_id } = req.query;
    
    res.json([
      {
        id: 'user-collection-1',
        user_id: user_id || 'mock-user',
        content_id: 'mock-content-1',
        list_id: 'default',
        added_at: new Date().toISOString()
      }
    ]);
  } catch (error) {
    console.error('用户收藏错误:', error);
    res.status(500).json({ 
      error: '获取用户收藏失败',
      message: error.message 
    });
  }
});

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: '接口不存在',
    path: req.originalUrl,
    available_endpoints: [
      '/api/test',
      '/api/collection_lists',
      '/api/content',
      '/api/user_content',
      '/api/user_collections'
    ]
  });
});

// 错误处理
app.use((error, req, res, next) => {
  console.error('增强版API错误:', error);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// 导出Vercel函数
module.exports = app; 