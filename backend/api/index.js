// Vercel Serverless Function 入口点
const express = require('express');
const cors = require('cors');

const app = express();

// 基本中间件
app.use(cors({
  origin: ['https://www.edunest.app', 'https://edunest.app'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// 测试端点
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API 工作正常',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString()
  });
});

// 简单的集合列表端点
app.get('/api/collection_lists', (req, res) => {
  try {
    // 返回模拟数据，避免数据库连接问题
    res.json([
      {
        id: 'default',
        name: '默认收藏夹',
        visibility: 'public',
        order_index: 0
      }
    ]);
  } catch (error) {
    res.status(500).json({ 
      error: '获取收藏夹失败',
      message: error.message 
    });
  }
});

// 内容端点
app.get('/api/content', (req, res) => {
  try {
    const { created_by } = req.query;
    
    // 返回模拟数据
    res.json([
      {
        id: 'mock-content-1',
        short_id: 'c1234567',
        title: '示例内容',
        language_code: 'zh-CN',
        tags: ['示例'],
        knowledge_point: ['测试'],
        created_by: created_by || 'mock-user',
        created_at: new Date().toISOString()
      }
    ]);
  } catch (error) {
    res.status(500).json({ 
      error: '获取内容失败',
      message: error.message 
    });
  }
});

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: '接口不存在',
    path: req.originalUrl 
  });
});

// 错误处理
app.use((error, req, res, next) => {
  console.error('API错误:', error);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: error.message 
  });
});

// 导出Vercel函数
module.exports = app; 