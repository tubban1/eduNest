# 架构更新说明

## 变更概述

已将数据库相关功能完全转移到后端，前端不再直接操作数据库，改为通过 API 调用后端服务。

## 主要变更

### 1. 后端架构重构

**技术栈：**
- Node.js + Express
- Supabase (数据库 + 认证)
- OpenAI (AI 内容生成)
- JWT (用户认证)
- Winston (日志记录)

**项目结构：**
```
backend/
├── src/
│   ├── api/           # API 路由
│   │   ├── auth.js    # 认证相关
│   │   ├── content.js # 内容管理
│   │   ├── collection.js # 用户收藏
│   │   ├── rating.js  # 评分系统
│   │   └── ai.js      # AI 服务
│   ├── services/      # 业务逻辑
│   │   ├── database.js # 数据库操作
│   │   └── aiService.js # AI 服务
│   ├── middleware/    # 中间件
│   │   └── auth.js    # 认证中间件
│   ├── utils/         # 工具函数
│   │   ├── logger.js  # 日志工具
│   │   ├── errorHandler.js # 错误处理
│   │   └── migrate.js # 数据库迁移
│   ├── config/        # 配置
│   │   └── index.js   # 环境配置
│   └── server.js      # 服务器入口
├── logs/              # 日志文件
├── package.json       # 依赖配置
├── env.example        # 环境变量示例
└── README.md          # 项目文档
```

### 2. 前端架构调整

**移除的组件：**
- `src/lib/supabase.ts` - 直接数据库操作
- `src/lib/umami.ts` - Umami 追踪 (暂时禁用)
- 所有直接的数据库查询

**新增的组件：**
- `src/lib/api.js` - API 客户端
- `src/hooks/useAuth.js` - 认证 Hook (重构)
- `src/hooks/useContents.js` - 内容 Hook (重构)
- `src/components/LoadingSpinner.jsx` - 加载动画
- `src/components/FilterBar.jsx` - 筛选栏
- `src/components/ContentCard.jsx` - 内容卡片

### 3. API 设计

**认证 API：**
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户
- `POST /api/auth/refresh` - 刷新令牌

**内容管理 API：**
- `GET /api/contents` - 获取内容列表
- `GET /api/contents/:id` - 获取内容详情
- `POST /api/contents` - 创建内容
- `PUT /api/contents/:id` - 更新内容
- `DELETE /api/contents/:id` - 删除内容

**收藏管理 API：**
- `GET /api/collections` - 获取用户收藏
- `POST /api/collections` - 添加收藏
- `DELETE /api/collections/:id` - 删除收藏
- `GET /api/collections/check/:contentId` - 检查是否已收藏

**评分系统 API：**
- `POST /api/ratings` - 添加评分
- `GET /api/ratings/:contentId` - 获取内容评分
- `GET /api/ratings/stats/:contentId` - 获取评分统计

**AI 服务 API：**
- `POST /api/ai/generate-code` - 生成 Vue 代码
- `POST /api/ai/optimize-code` - 优化代码
- `POST /api/ai/generate-knowledge-points` - 生成知识点

### 4. 数据库结构

**users 表：**
```sql
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**content_ratings 表：**
```sql
CREATE TABLE content_ratings (
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

### 5. 环境变量配置

**后端环境变量 (.env)：**
```env
NODE_ENV=development
PORT=3001
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_ANON_KEY=your_supabase_anon_key
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

**前端环境变量 (.env.local)：**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_UMAMI_API_URL=http://localhost:3001
NEXT_PUBLIC_UMAMI_WEBSITE_ID=your_umami_website_id
```

## 部署说明

### 1. 后端部署

1. 安装依赖：
```bash
cd backend
npm install
```

2. 配置环境变量：
```bash
cp env.example .env
# 编辑 .env 文件，填入必要的配置
```

3. 运行数据库迁移：
```bash
npm run migrate
```

4. 启动服务：
```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

### 2. 前端部署

1. 安装依赖：
```bash
cd frontend
npm install
```

2. 配置环境变量：
```bash
cp env.local.example .env.local
# 编辑 .env.local 文件
```

3. 启动服务：
```bash
npm run dev
```

## 优势

1. **安全性提升**：前端不再直接操作数据库，所有数据操作通过后端 API
2. **架构清晰**：前后端职责分离，便于维护和扩展
3. **统一认证**：使用 JWT 统一管理用户认证
4. **错误处理**：后端统一处理错误，提供更好的用户体验
5. **日志记录**：完整的请求日志和错误日志
6. **API 文档**：清晰的 API 接口文档

## 下一步

1. 完善前端组件（登录、注册、内容详情页等）
2. 实现用户收藏和评分功能
3. 集成 AI 内容生成功能
4. 添加内容预览功能
5. 实现管理员后台
6. 部署到生产环境 