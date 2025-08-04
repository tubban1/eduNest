require('dotenv').config();

console.log('🔧 AI 互动教育平台数据库迁移工具');
console.log('=====================================');
console.log('');

// 检查环境变量
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_ANON_KEY'
];

console.log('📋 环境变量检查:');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${varName}: 未设置`);
  }
});

console.log('');
console.log('📝 请在 Supabase Dashboard 的 SQL Editor 中执行以下 SQL 语句:');
console.log('');

// 1. 创建 users 表
console.log('1️⃣ 创建 users 表:');
console.log(`
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`);

// 2. 创建 content_ratings 表
console.log('2️⃣ 创建 content_ratings 表:');
console.log(`
CREATE TABLE IF NOT EXISTS content_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  user_ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(content_id, user_id)
);
`);

// 3. 创建索引
console.log('3️⃣ 创建索引:');
console.log(`
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_content_ratings_content_id ON content_ratings(content_id);
CREATE INDEX IF NOT EXISTS idx_content_ratings_user_id ON content_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_content_ratings_rating ON content_ratings(rating);
`);

// 4. 插入示例用户
console.log('4️⃣ 插入示例用户:');
console.log(`
INSERT INTO users (email, password, name, role) VALUES 
('admin@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.gSJmWm', '管理员', 'admin')
ON CONFLICT (email) DO NOTHING;
`);
console.log('密码: admin123');

// 5. 检查现有表
console.log('5️⃣ 检查现有表结构:');
console.log(`
-- 检查 contents 表
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'contents' 
ORDER BY ordinal_position;

-- 检查 user_collections 表
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_collections' 
ORDER BY ordinal_position;
`);

console.log('');
console.log('🎯 执行步骤:');
console.log('1. 登录 Supabase Dashboard');
console.log('2. 进入 SQL Editor');
console.log('3. 依次执行上述 SQL 语句');
console.log('4. 检查表结构是否正确');
console.log('5. 运行: npm run migrate 验证结果');
console.log('');

console.log('💡 提示:');
console.log('- 如果表已存在，可以跳过创建表的步骤');
console.log('- 确保 Supabase 项目已正确配置');
console.log('- 环境变量需要在 .env 文件中正确设置');
console.log('');

// 如果环境变量都设置了，尝试连接测试
if (requiredEnvVars.every(varName => process.env[varName])) {
  console.log('🔍 尝试连接测试...');
  
  const { createClient } = require('@supabase/supabase-js');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // 测试连接
  supabase
    .from('contents')
    .select('id')
    .limit(1)
    .then(({ data, error }) => {
      if (error) {
        console.log('❌ 连接失败:', error.message);
      } else {
        console.log('✅ 连接成功！');
        console.log(`📊 contents 表有 ${data?.length || 0} 条记录`);
      }
    })
    .catch(error => {
      console.log('❌ 连接测试失败:', error.message);
    });
}

console.log('');
console.log('✨ 迁移工具执行完成！'); 