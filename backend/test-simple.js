// 极简测试文件 - 没有任何外部依赖
module.exports = (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    // 返回基本信息
    res.json({
      message: '极简测试成功',
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type']
      },
      env: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: !!process.env.VERCEL,
        PORT: process.env.PORT
      }
    });
  } catch (error) {
    res.status(500).json({
      error: '极简测试失败',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}; 