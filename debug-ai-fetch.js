// AI生成Fetch错误诊断工具
// 在浏览器控制台中运行此脚本来诊断问题

async function diagnoseAIFetch() {
  console.log('🔍 开始诊断AI生成Fetch错误...');
  
  // 1. 检查环境变量
  console.log('\n1. 检查环境变量:');
  console.log('NEXT_PUBLIC_API_BASE_URL:', process.env.NEXT_PUBLIC_API_BASE_URL || '未设置');
  
  // 2. 检查API基础URL
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
  console.log('\n2. API基础URL:', baseUrl);
  
  // 3. 检查网络连接
  console.log('\n3. 检查网络连接:');
  try {
    const response = await fetch(baseUrl + '/health');
    console.log('✅ 后端服务可访问');
  } catch (error) {
    console.log('❌ 后端服务不可访问:', error.message);
  }
  
  // 4. 检查认证状态
  console.log('\n4. 检查认证状态:');
  try {
    const sessionStr = localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token');
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      console.log('✅ 本地有认证token');
      console.log('Token过期时间:', new Date(session.expires_at * 1000));
      console.log('当前时间:', new Date());
      console.log('Token是否过期:', new Date() > new Date(session.expires_at * 1000));
    } else {
      console.log('❌ 本地没有认证token');
    }
  } catch (error) {
    console.log('❌ 认证token解析失败:', error.message);
  }
  
  // 5. 测试AI生成请求
  console.log('\n5. 测试AI生成请求:');
  try {
    const testRequest = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token') ? JSON.parse(localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token')).access_token : ''}`
      },
      body: JSON.stringify({
        knowledgePoint: '测试知识点',
        learningStage: 'understanding',
        description: '测试描述',
        language_code: 'zh-CN'
      })
    };
    
    console.log('请求配置:', testRequest);
    
    const response = await fetch(baseUrl + '/ai/generate', testRequest);
    console.log('响应状态:', response.status);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('错误响应:', errorText);
    } else {
      const data = await response.json();
      console.log('✅ AI生成请求成功:', data);
    }
  } catch (error) {
    console.log('❌ AI生成请求失败:', error.message);
    console.log('错误详情:', error);
  }
  
  // 6. 检查CORS
  console.log('\n6. 检查CORS配置:');
  try {
    const response = await fetch(baseUrl + '/ai/generate', {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      }
    });
    console.log('CORS预检响应状态:', response.status);
  } catch (error) {
    console.log('CORS预检失败:', error.message);
  }
  
  console.log('\n🎯 诊断完成！请查看上述信息来定位问题。');
}

// 运行诊断
diagnoseAIFetch();
