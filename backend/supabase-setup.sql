-- AI 互动教育平台数据库表结构

-- 1. 创建 users 表（扩展 auth.users）
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建 content 表
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

-- 3. 创建 user_collections 表
CREATE TABLE IF NOT EXISTS user_collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

-- 4. 启用 Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;

-- 5. 创建 RLS 策略

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

-- 6. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_content_grade ON content(grade);
CREATE INDEX IF NOT EXISTS idx_content_subject ON content(subject);
CREATE INDEX IF NOT EXISTS idx_content_language ON content(language);
CREATE INDEX IF NOT EXISTS idx_content_created_at ON content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_collections_user_id ON user_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_content_id ON user_collections(content_id);

-- 7. 创建触发器函数，自动创建用户记录
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

-- 8. 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 9. 插入示例数据
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