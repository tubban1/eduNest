# 数据库设置指南

## 1. 登录 Supabase Dashboard

1. 访问 https://supabase.com/dashboard
2. 选择你的项目：`zayoczhybuegvtpcsgso`
3. 进入 SQL Editor

## 2. 执行数据库表创建脚本

复制以下 SQL 脚本并在 SQL Editor 中执行：

```sql
-- AI 互动教育平台数据库表结构

-- 1. 创建 contents 表
CREATE TABLE IF NOT EXISTS contents (
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

-- 2. 创建 user_collections 表
CREATE TABLE IF NOT EXISTS user_collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

-- 3. 启用 Row Level Security (RLS)
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;

-- 4. 创建 RLS 策略

-- contents 表策略：所有用户都可以读取
CREATE POLICY "contents_select_policy" ON contents
  FOR SELECT USING (true);

-- contents 表策略：只有认证用户才能创建
CREATE POLICY "contents_insert_policy" ON contents
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- contents 表策略：只有创建者才能更新
CREATE POLICY "contents_update_policy" ON contents
  FOR UPDATE USING (auth.uid() = auth.uid());

-- contents 表策略：只有创建者才能删除
CREATE POLICY "contents_delete_policy" ON contents
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

-- 5. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_contents_grade ON contents(grade);
CREATE INDEX IF NOT EXISTS idx_contents_subject ON contents(subject);
CREATE INDEX IF NOT EXISTS idx_contents_language ON contents(language);
CREATE INDEX IF NOT EXISTS idx_contents_created_at ON contents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_collections_user_id ON user_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_content_id ON user_collections(content_id);

-- 6. 插入示例数据
INSERT INTO contents (title, grade, subject, knowledge_point, language, content_type, content_data) VALUES
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
```

## 3. 验证表创建

执行完成后，检查：

1. **Table Editor** 中应该能看到 `contents` 和 `user_collections` 表
2. **contents** 表中应该有 3 条示例数据
3. **RLS** 策略应该已启用

## 4. 测试连接

执行完成后，刷新浏览器页面，应该能看到示例内容而不是"暂无内容"。

## 5. 故障排除

如果遇到问题：

1. **表不存在错误**：确保 SQL 脚本执行成功
2. **权限错误**：检查 RLS 策略是否正确创建
3. **连接错误**：确认环境变量中的 Supabase URL 和 Key 正确

## 6. 下一步

数据库设置完成后，可以：

1. 开发 Admin 登录功能
2. 创建内容管理页面
3. 实现用户收藏功能
4. 集成 AI 内容生成 