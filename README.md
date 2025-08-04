# AI 互动教育平台

基于 AI 生成的互动教学内容平台，支持创建、编辑、收藏和分享教育内容。

## 🚀 快速部署

### 部署到 Vercel

1. **克隆项目**
```bash
git clone <your-repo-url>
cd edu
```

2. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，填入你的配置
```

3. **部署**
```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel --prod
```

### 环境变量配置

在 Vercel 项目设置中配置以下环境变量：

#### 必需变量
- `NEXT_PUBLIC_API_BASE_URL`: 后端API地址
- `SUPABASE_URL`: Supabase 项目URL
- `SUPABASE_SERVICE_KEY`: Supabase 服务密钥
- `SUPABASE_ANON_KEY`: Supabase 匿名密钥
- `JWT_SECRET`: JWT 密钥

#### 可选变量
- `KIMI_API_KEY`: KIMI AI API 密钥
- `KIMI_MODEL`: KIMI 模型名称
- `ALLOWED_ORIGINS`: CORS 允许的域名

## 🛠️ 本地开发

### 环境要求
- Node.js >= 18.0.0
- npm >= 8.0.0

### 安装依赖
```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 启动服务
```bash
# 启动后端 (端口 3001)
cd backend
npm start

# 启动前端 (端口 3000)
cd frontend
npm run dev
```

## 📁 项目结构

```
edu/
├── backend/          # 后端服务 (Express.js)
├── frontend/         # 前端应用 (Next.js)
├── doc/             # 项目文档
├── .env             # 环境变量
├── .env.example     # 环境变量示例
├── vercel.json      # Vercel 配置
└── deploy.sh        # 部署脚本
```

## 🔧 主要功能

- **内容管理**: 创建、编辑、删除教育内容
- **AI 生成**: 基于知识点和学习阶段生成互动内容
- **收藏系统**: 收藏和管理喜欢的内容
- **用户认证**: JWT 认证系统
- **响应式设计**: 支持移动端和桌面端

## 📚 API 文档

### 认证 API
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/auth/me` - 获取当前用户信息

### 内容 API
- `GET /api/content` - 获取内容列表
- `POST /api/content` - 创建内容
- `PUT /api/content/:id` - 更新内容
- `DELETE /api/content/:id` - 删除内容

### 用户内容互动 API
- `POST /api/user_content/:contentId/like` - 喜欢内容
- `DELETE /api/user_content/:contentId/like` - 取消喜欢
- `GET /api/user_content/liked` - 获取喜欢的内容

### 收藏 API
- `GET /api/user_collections/group/:groupId` - 获取收藏内容
- `POST /api/user_collections` - 添加到收藏
- `DELETE /api/user_collections/:contentId/:listId` - 从收藏移除

## 🚀 部署检查清单

- [ ] 环境变量配置完成
- [ ] 数据库连接正常
- [ ] API 端点可访问
- [ ] 前端构建成功
- [ ] CORS 配置正确
- [ ] 域名配置完成

## 📞 支持

如有问题，请查看：
- [项目文档](./doc/)
- [架构说明](./doc/ARCHITECTURE.md)
- [环境配置](./doc/ENVIRONMENT_SETUP.md) 