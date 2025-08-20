// 生产版Vercel函数 - 使用真实数据库连接
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

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

// 初始化Supabase客户端
let supabase = null;
try {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase客户端初始化成功');
  } else {
    console.warn('⚠️ 缺少Supabase配置，使用模拟数据');
  }
} catch (error) {
  console.error('❌ Supabase客户端初始化失败:', error.message);
}

// 测试端点
app.get('/api/test', (req, res) => {
  res.json({ 
    message: '生产版API工作正常',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    features: ['cors', 'logging', 'error-handling', 'supabase'],
    supabase: {
      connected: !!supabase,
      hasUrl: !!process.env.SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_SERVICE_KEY
    }
  });
});

// 集合列表端点
app.get('/api/collection_lists', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('collection_lists')
        .select('*')
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      res.json(data || []);
    } else {
      res.json([
        { id: 'default', name: '默认收藏夹', visibility: 'public', order_index: 0 }
      ]);
    }
  } catch (error) {
    console.error('集合列表错误:', error);
    res.status(500).json({ error: '获取收藏夹失败', message: error.message });
  }
});

// 内容端点
app.get('/api/content', async (req, res) => {
  try {
    const { created_by, limit = 10 } = req.query;
    
    if (supabase) {
      let query = supabase.from('content').select('*').order('created_at', { ascending: false });
      if (created_by) query = query.eq('created_by', created_by);
      if (limit) query = query.limit(parseInt(limit));
      
      const { data, error } = await query;
      if (error) throw error;
      res.json(data || []);
    } else {
      res.json([
        { id: 'mock-1', title: '示例内容', language_code: 'zh-CN', created_by: 'mock-user' }
      ]);
    }
  } catch (error) {
    console.error('内容获取错误:', error);
    res.status(500).json({ error: '获取内容失败', message: error.message });
  }
});

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({ error: '接口不存在', path: req.originalUrl });
});

// 错误处理
app.use((error, req, res, next) => {
  console.error('生产版API错误:', error);
  res.status(500).json({ error: '服务器内部错误', message: error.message });
});

module.exports = app; 