# AI 互动教育平台设置指南

## 🚀 快速开始

### 1. 环境准备

确保已安装：
- Node.js >= 18.0.0
- npm >= 8.0.0

### 2. 后端设置

#### 2.1 安装依赖
```bash
cd backend
npm install
```

#### 2.2 配置环境变量
```bash
# 复制环境变量示例文件
cp env.example .env

# 编辑 .env 文件，填入你的 Supabase 配置
```

编辑 `backend/.env` 文件：
```env
# 服务器配置
NODE_ENV=development
PORT=3001

# Supabase 配置 - 请替换为你的实际配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
SUPABASE_ANON_KEY=your_anon_key_here

# JWT 配置
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# OpenAI 配置 (可选)
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo

# CORS 配置
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

#### 2.3 数据库迁移

运行迁移脚本：
```bash
npm run migrate
```

脚本会显示需要在 Supabase Dashboard 中执行的 SQL 语句。

#### 2.4 手动执行 SQL

登录 [Supabase Dashboard](https://supabase.com/dashboard)，进入你的项目，然后：

1. **创建 users 表**：
```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

2. **创建 content_ratings 表**：
```sql
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
```

3. **创建索引**：
```sql
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_content_ratings_content_id ON content_ratings(content_id);
CREATE INDEX IF NOT EXISTS idx_content_ratings_user_id ON content_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_content_ratings_rating ON content_ratings(rating);
```

4. **插入示例用户**：
```sql
INSERT INTO users (email, password, name, role) VALUES 
('admin@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.gSJmWm', '管理员', 'admin')
ON CONFLICT (email) DO NOTHING;
```
密码：`admin123`

#### 2.5 启动后端服务
```bash
npm run dev
```

### 3. 前端设置

#### 3.1 安装依赖
```bash
cd frontend
npm install
```

#### 3.2 配置环境变量
```bash
# 复制环境变量示例文件
cp env.local.example .env.local

# 编辑 .env.local 文件
```

编辑 `frontend/.env.local` 文件：
```env
# 后端 API 地址
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Umami 追踪 (可选)
NEXT_PUBLIC_UMAMI_API_URL=http://localhost:3001
NEXT_PUBLIC_UMAMI_WEBSITE_ID=your_umami_website_id
```

#### 3.3 启动前端服务
```bash
npm run dev
```

### 4. 验证设置

1. **后端服务**：访问 http://localhost:3001/health
2. **前端应用**：访问 http://localhost:3000

## 📋 功能验证

### 后端 API 测试

1. **健康检查**：
```bash
curl http://localhost:3001/health
```

2. **获取内容列表**：
```bash
curl http://localhost:3001/api/contents
```

3. **用户注册**：
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "测试用户"
  }'
```

### 前端功能测试

1. 访问首页，查看内容列表
2. 测试筛选功能
3. 尝试用户注册/登录

## 🔧 故障排除

### 常见问题

1. **Supabase 连接失败**
   - 检查环境变量是否正确
   - 确认 Supabase 项目配置
   - 验证 API 密钥权限

2. **数据库表不存在**
   - 确保已执行所有 SQL 语句
   - 检查表名是否正确
   - 验证 RLS 策略

3. **CORS 错误**
   - 检查 `ALLOWED_ORIGINS` 配置
   - 确认前端 URL 在允许列表中

4. **JWT 认证失败**
   - 检查 `JWT_SECRET` 配置
   - 确认令牌格式正确

### 日志查看

后端日志位于 `backend/logs/` 目录：
- `combined.log` - 所有日志
- `error.log` - 错误日志

## 📚 API 文档

### 认证 API
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户

### 内容 API
- `GET /api/contents` - 获取内容列表
- `GET /api/contents/:id` - 获取内容详情
- `POST /api/contents` - 创建内容
- `PUT /api/contents/:id` - 更新内容
- `DELETE /api/contents/:id` - 删除内容

### 收藏 API
- `GET /api/collections` - 获取用户收藏
- `POST /api/collections` - 添加收藏
- `DELETE /api/collections/:id` - 删除收藏

### 评分 API
- `POST /api/ratings` - 添加评分
- `GET /api/ratings/:contentId` - 获取内容评分
- `GET /api/ratings/stats/:contentId` - 获取评分统计

### AI API
- `POST /api/ai/generate-code` - 生成 Vue 代码
- `POST /api/ai/optimize-code` - 优化代码
- `POST /api/ai/generate-knowledge-points` - 生成知识点

## 🚀 部署

### 开发环境
```bash
# 后端
cd backend && npm run dev

# 前端
cd frontend && npm run dev
```

### 生产环境
```bash
# 后端
cd backend && npm start

# 前端
cd frontend && npm run build && npm start
```

## 📞 支持

如遇问题，请检查：
1. 环境变量配置
2. 数据库表结构
3. 网络连接
4. 日志文件

---

🎉 **设置完成！** 现在你可以开始使用 AI 互动教育平台了。 