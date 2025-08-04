# AI 互动教育平台

基于 Next.js 14 + Supabase + Umami 的 AI 驱动互动教育平台。

## 技术栈

- **前端**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **后端**: Supabase (PostgreSQL, Auth, Storage)
- **行为追踪**: Umami Cloud
- **AI 生成**: OpenAI / Claude / Gemini LLMs
- **部署**: Vercel (前端), Supabase (后端), Umami Cloud (追踪)

## 环境变量配置

复制 `.env.local.example` 到 `.env.local` 并填入实际配置：

```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Umami 配置
NEXT_PUBLIC_UMAMI_API_URL=https://your-umami-instance.com
NEXT_PUBLIC_UMAMI_WEBSITE_ID=your_website_id

# OpenAI 配置 (用于 AI 内容生成)
OPENAI_API_KEY=your_openai_api_key

# 应用配置
NEXT_PUBLIC_APP_NAME=AI 互动教育平台
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 数据库结构

### contents 表
```sql
CREATE TABLE contents (
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
```

### user_collections 表
```sql
CREATE TABLE user_collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);
```

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

## 部署

1. **前端部署到 Vercel**
   - 连接 GitHub 仓库
   - 设置环境变量
   - 自动部署

2. **后端使用 Supabase**
   - 创建 Supabase 项目
   - 执行数据库迁移
   - 配置 RLS 策略

3. **行为追踪使用 Umami Cloud**
   - 创建 Umami 账户
   - 添加网站
   - 配置追踪脚本

## 项目结构

```
src/
├── app/                    # App Router 页面
│   ├── layout.tsx         # 根布局
│   ├── page.tsx           # 首页
│   └── globals.css        # 全局样式
├── components/             # 复用组件
├── hooks/                  # React Hooks
│   ├── useAuth.ts         # 用户认证
│   └── useContents.ts     # 内容管理
├── lib/                    # 工具库
│   ├── supabase.ts        # Supabase 客户端
│   ├── umami.ts           # Umami 追踪
│   └── api.ts             # API 封装
└── styles/                 # 样式文件
```
