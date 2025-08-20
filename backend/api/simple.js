// 最简单的Vercel函数测试版本
module.exports = (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', 'https://www.edunest.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    // 根据路径返回不同的响应
    const path = req.url;
    
    if (path === '/api/test' || path === '/api/test/') {
      res.json({
        message: '简单API测试成功',
        timestamp: new Date().toISOString(),
        path: path,
        method: req.method
      });
    } else if (path === '/api/collection_lists' || path === '/api/collection_lists/') {
      res.json([
        {
          id: 'simple-1',
          name: '简单收藏夹',
          visibility: 'public'
        }
      ]);
    } else if (path.startsWith('/api/content')) {
      res.json([
        {
          id: 'simple-content',
          title: '简单内容',
          language_code: 'zh-CN'
        }
      ]);
    } else {
      res.json({
        message: '简单API工作正常',
        path: path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('简单API错误:', error);
    res.status(500).json({
      error: '简单API错误',
      message: error.message
    });
  }
}; 