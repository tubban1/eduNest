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

// 环境变量检查端点
app.get('/api/debug/env', (req, res) => {
  res.json({
    message: '环境变量检查',
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      SUPABASE_URL: process.env.SUPABASE_URL ? '已设置' : '未设置',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? '已设置' : '未设置',
      JWT_SECRET: process.env.JWT_SECRET ? '已设置' : '未设置',
      ARK_API_KEY: process.env.ARK_API_KEY ? '已设置' : '未设置'
    },
    supabase: {
      connected: !!supabase,
      url: process.env.SUPABASE_URL || '未设置',
      keyLength: process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.length : 0
    }
  });
});

// 集合列表端点
app.get('/api/collection_lists', async (req, res) => {
  try {
    if (supabase) {
      // 使用真实数据库
      const { data, error } = await supabase
        .from('collection_lists')
        .select('*')
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      
      // 返回前端期望的格式
      res.json({
        success: true,
        data: data || []
      });
    } else {
      // 使用模拟数据
      res.json({
        success: true,
        data: [
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
        ]
      });
    }
  } catch (error) {
    console.error('集合列表错误:', error);
    res.status(500).json({ 
      success: false,
      error: '获取收藏夹失败',
      message: error.message 
    });
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
      
      // 返回前端期望的格式
      res.json({
        success: true,
        data: data || []
      });
    } else {
      // 使用模拟数据
      res.json({
        success: true,
        data: [
          { id: 'mock-1', title: '示例内容', language_code: 'zh-CN', created_by: 'mock-user' }
        ]
      });
    }
  } catch (error) {
    console.error('内容获取错误:', error);
    res.status(500).json({ 
      success: false,
      error: '获取内容失败',
      message: error.message 
    });
  }
});

// 用户内容端点
app.get('/api/user_content', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (supabase && user_id) {
      // 使用真实数据库
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('created_by', user_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      res.json({
        success: true,
        data: data || []
      });
    } else {
      // 使用模拟数据
      res.json({
        success: true,
        data: [
          {
            id: 'user-content-1',
            short_id: 'uc1234567',
            title: '用户创建的内容',
            language_code: 'zh-CN',
            created_by: user_id || 'mock-user',
            created_at: new Date().toISOString()
          }
        ]
      });
    }
  } catch (error) {
    console.error('用户内容错误:', error);
    res.status(500).json({ 
      success: false,
      error: '获取用户内容失败',
      message: error.message 
    });
  }
});

// 用户收藏端点
app.get('/api/user_collections', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (supabase && user_id) {
      // 使用真实数据库
      const { data, error } = await supabase
        .from('user_collections')
        .select(`
          *,
          content:content_id(*),
          list:list_id(*)
        `)
        .eq('user_id', user_id)
        .order('added_at', { ascending: false });
      
      if (error) throw error;
      
      res.json({
        success: true,
        data: data || []
      });
    } else {
      // 使用模拟数据
      res.json({
        success: true,
        data: [
          {
            id: 'user-collection-1',
            user_id: user_id || 'mock-user',
            content_id: 'mock-content-1',
            list_id: 'default',
            added_at: new Date().toISOString()
          }
        ]
      });
    }
  } catch (error) {
    console.error('用户收藏错误:', error);
    res.status(500).json({ 
      success: false,
      error: '获取用户收藏失败',
      message: error.message 
    });
  }
});

// 用户收藏分组端点（支持前端的分组功能）
app.get('/api/user_collections/group/:listId', async (req, res) => {
  try {
    const { listId } = req.params;
    const { user_id } = req.query;
    
    if (supabase && user_id && listId !== 'all') {
      // 使用真实数据库
      const { data, error } = await supabase
        .from('user_collections')
        .select(`
          *,
          content:content_id(*)
        `)
        .eq('user_id', user_id)
        .eq('list_id', listId)
        .order('added_at', { ascending: false });
      
      if (error) throw error;
      
      res.json({
        success: true,
        data: data || []
      });
    } else {
      // 使用模拟数据
      res.json({
        success: true,
        data: [
          {
            id: 'user-collection-1',
            content: {
              id: 'mock-content-1',
              title: '示例收藏内容',
              language_code: 'zh-CN'
            },
            added_at: new Date().toISOString()
          }
        ]
      });
    }
  } catch (error) {
    console.error('用户收藏分组错误:', error);
    res.status(500).json({ 
      success: false,
      error: '获取用户收藏分组失败',
      message: error.message 
    });
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