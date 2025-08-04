# AI 互动教育平台后端

基于 Node.js + Express + Supabase 的后端服务，提供内容管理、用户认证、AI 生成等功能。

## 技术栈

- **Node.js** - 运行时环境
- **Express** - Web 框架
- **Supabase** - 数据库和认证服务
- **OpenAI** - AI 内容生成
- **JWT** - 用户认证
- **Winston** - 日志记录

## 项目结构

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

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 环境配置

复制环境变量示例文件：

```bash
cp env.example .env
```

编辑 `.env` 文件，填入必要的配置：

```env
# 服务器配置
NODE_ENV=development
PORT=3001

# Supabase 配置
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_ANON_KEY=your_supabase_anon_key

# JWT 配置
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# OpenAI 配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo

# CORS 配置
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 3. 数据库迁移

```bash
npm run migrate
```

### 4. 启动服务

开发环境：
```bash
npm run dev
```

生产环境：
```bash
npm start
```

## API 文档

### 认证相关

#### 用户注册
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "用户名",
  "role": "user"
}
```

#### 用户登录
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### 获取当前用户
```
GET /api/auth/me
Authorization: Bearer <token>
```

### 内容管理

#### 获取内容列表
```
GET /api/contents?page=1&limit=10&grade=高中&subject=数学
```

#### 获取内容详情
```
GET /api/contents/:id
```

#### 创建内容
```
POST /api/contents
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "内容标题",
  "grade": "高中",
  "subject": "数学",
  "knowledge_points": ["知识点1", "知识点2"],
  "code_html": "<div>HTML 内容</div>",
  "code_js": "JavaScript 代码",
  "code_css": "CSS 样式"
}
```

#### 更新内容
```
PUT /api/contents/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "更新后的标题"
}
```

#### 删除内容
```
DELETE /api/contents/:id
Authorization: Bearer <token>
```

### 用户收藏

#### 获取用户收藏
```
GET /api/collections?page=1&limit=10
Authorization: Bearer <token>
```

#### 添加收藏
```
POST /api/collections
Authorization: Bearer <token>
Content-Type: application/json

{
  "content_id": "content-uuid",
  "tag_labels": ["标签1", "标签2"],
  "folder_path": "我的收藏/数学"
}
```

#### 删除收藏
```
DELETE /api/collections/:id
Authorization: Bearer <token>
```

### 评分系统

#### 添加评分
```
POST /api/ratings
Content-Type: application/json

{
  "content_id": "content-uuid",
  "rating": 5,
  "comment": "很棒的内容！"
}
```

#### 获取内容评分统计
```
GET /api/ratings/stats/:contentId
```

#### 获取内容评分列表
```
GET /api/ratings/:contentId
```

### AI 服务

#### 生成 Vue 代码
```
POST /api/ai/generate-code
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "创建一个简单的计数器组件",
  "grade": "高中",
  "subject": "信息技术",
  "context": "Vue.js 基础教学"
}
```

#### 优化代码
```
POST /api/ai/optimize-code
Authorization: Bearer <token>
Content-Type: application/json

{
  "existing_code": "现有代码",
  "feedback": "优化建议"
}
```

#### 生成知识点
```
POST /api/ai/generate-knowledge-points
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "内容描述",
  "grade": "高中",
  "subject": "数学"
}
```

## 数据库结构

### users 表
- `id` - 用户ID (UUID)
- `email` - 邮箱 (唯一)
- `password` - 加密密码
- `name` - 用户名
- `role` - 角色 (user/admin)
- `created_at` - 创建时间
- `updated_at` - 更新时间

### contents 表
- `id` - 内容ID (UUID)
- `title` - 标题
- `grade` - 年级
- `subject` - 学科
- `knowledge_point` - 知识点数组
- `language` - 语言
- `content_type` - 内容类型
- `content_data` - 内容数据 (JSONB)
- `created_at` - 创建时间
- `updated_at` - 更新时间

### user_collections 表
- `id` - 收藏ID (UUID)
- `user_id` - 用户ID
- `content_id` - 内容ID
- `tag_labels` - 标签数组
- `folder_path` - 文件夹路径
- `timeline` - 时间线
- `created_at` - 创建时间

### content_ratings 表
- `id` - 评分ID (UUID)
- `content_id` - 内容ID
- `user_id` - 用户ID (可选)
- `rating` - 评分 (1-5)
- `comment` - 评论
- `user_ip` - 用户IP
- `user_agent` - 用户代理
- `created_at` - 创建时间

## 部署

### 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0

### 生产环境部署

1. 设置环境变量
2. 安装依赖：`npm install --production`
3. 运行数据库迁移：`npm run migrate`
4. 启动服务：`npm start`

### Docker 部署

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
```

## 开发

### 代码规范

- 使用 ESLint 进行代码检查
- 遵循 RESTful API 设计原则
- 使用 JSDoc 注释

### 测试

```bash
npm test
```

### 日志

日志文件位于 `logs/` 目录：
- `combined.log` - 所有日志
- `error.log` - 错误日志

## 许可证

MIT License 