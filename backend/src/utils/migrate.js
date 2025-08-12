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

// 1. 创建 users 表（扩展 auth.users）
console.log('1️⃣ 创建 users 表（扩展 auth.users）:');
console.log(`
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`);

// 2. 创建 content 表
console.log('2️⃣ 创建 content 表:');
console.log(`
CREATE TABLE IF NOT EXISTS content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  grade TEXT NOT NULL,
  subject TEXT NOT NULL,
  knowledge_point TEXT[] NOT NULL,
  language TEXT NOT NULL DEFAULT 'zh-CN',
  content_type TEXT NOT NULL DEFAULT 'vue',
  content_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`);

// 3. 创建 user_collections 表
console.log('3️⃣ 创建 user_collections 表:');
console.log(`
CREATE TABLE IF NOT EXISTS user_collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);
`);

// 4. 启用 Row Level Security (RLS)
console.log('4️⃣ 启用 Row Level Security (RLS):');
console.log(`
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;
`);

// 5. 创建 RLS 策略
console.log('5️⃣ 创建 RLS 策略:');
console.log(`
-- users 表策略：用户只能查看和修改自己的信息
CREATE POLICY "users_select_policy" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert_policy" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_policy" ON users
  FOR UPDATE USING (auth.uid() = id);

-- content 表策略：所有用户都可以读取
CREATE POLICY "content_select_policy" ON content
  FOR SELECT USING (true);

-- content 表策略：只有认证用户才能创建
CREATE POLICY "content_insert_policy" ON content
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- content 表策略：只有创建者才能更新
CREATE POLICY "content_update_policy" ON content
  FOR UPDATE USING (auth.uid() = auth.uid());

-- content 表策略：只有创建者才能删除
CREATE POLICY "content_delete_policy" ON content
  FOR DELETE USING (auth.uid() = auth.uid());

-- user_collections 表策略：用户只能看到自己的收藏
CREATE POLICY "user_collections_select_policy" ON user_collections
  FOR SELECT USING (auth.uid() = user_id);

-- user_collections 表策略：用户只能创建自己的收藏
CREATE POLICY "user_collections_insert_policy" ON user_collections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_collections 表策略：用户只能删除自己的收藏
CREATE POLICY "user_collections_delete_policy" ON user_collections
  FOR DELETE USING (auth.uid() = user_id);
`);

// 6. 创建索引
console.log('6️⃣ 创建索引:');
console.log(`
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_content_grade ON content(grade);
CREATE INDEX IF NOT EXISTS idx_content_subject ON content(subject);
CREATE INDEX IF NOT EXISTS idx_content_language ON content(language);
CREATE INDEX IF NOT EXISTS idx_content_created_at ON content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_collections_user_id ON user_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_content_id ON user_collections(content_id);
`);

// 7. 创建触发器函数，自动创建用户记录
console.log('7️⃣ 创建触发器函数，自动创建用户记录:');
console.log(`
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`);

// 8. 创建触发器
console.log('8️⃣ 创建触发器:');
console.log(`
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
`);

// 9. 插入示例数据
console.log('9️⃣ 插入示例数据:');
console.log(`
INSERT INTO content (title, grade, subject, knowledge_point, language, content_type, content_data) VALUES
(
  'Vue.js 基础语法',
  '高中',
  '信息技术',
  ARRAY['Vue.js', '前端开发', 'JavaScript'],
  'zh-CN',
  'vue',
  '{"template": "<div>Hello Vue!</div>", "script": "export default { name: \"HelloVue\" }", "style": "div { color: blue; }"}'
),
(
  'React Hooks 使用',
  '大学',
  '计算机科学',
  ARRAY['React', 'Hooks', '前端开发'],
  'zh-CN',
  'vue',
  '{"template": "<div>React Hooks Demo</div>", "script": "import { useState } from \"react\"; export default function App() { const [count, setCount] = useState(0); return <div>{count}</div>; }", "style": "div { font-size: 20px; }"}'
),
(
  'Python 基础语法',
  '初中',
  '信息技术',
  ARRAY['Python', '编程基础', '算法'],
  'zh-CN',
  'vue',
  '{"template": "<div>Python 学习</div>", "script": "print(\"Hello Python!\")", "style": "div { background: #f0f0f0; }"}'
);
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
console.log('- 确保 Google OAuth 已在 Supabase 中正确配置');
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
    .from('content')
    .select('id')
    .limit(1)
    .then(({ data, error }) => {
      if (error) {
        console.log('❌ 连接失败:', error.message);
      } else {
        console.log('✅ 连接成功！');
        console.log(`📊 content 表有 ${data?.length || 0} 条记录`);
      }
    })
    .catch(error => {
      console.log('❌ 连接测试失败:', error.message);
    });
}

console.log('');
console.log('✨ 迁移工具执行完成！'); 