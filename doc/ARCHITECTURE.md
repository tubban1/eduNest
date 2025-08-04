# AI 互动教育平台 - 整体架构

## 📁 项目结构

```
edu/
├── .env.example              # 统一环境配置示例
├── env.example               # 环境配置示例 (根目录)
├── ARCHITECTURE.md           # 架构说明文档
├── README.md                 # 项目说明
├── supabase-setup.sql        # 数据库初始化脚本
│
├── backend/                  # 后端服务
│   ├── src/
│   │   ├── api/             # API 路由
│   │   ├── config/          # 配置管理
│   │   ├── middleware/      # 中间件
│   │   ├── services/        # 业务服务
│   │   ├── utils/           # 工具函数
│   │   └── server.js        # 服务器入口
│   ├── logs/                # 日志文件
│   ├── package.json         # 后端依赖
│   └── README.md            # 后端说明
│
├── frontend/                 # 前端应用
│   ├── src/
│   │   ├── app/             # Next.js 页面
│   │   ├── components/      # React 组件
│   │   ├── hooks/           # 自定义 Hooks
│   │   ├── lib/             # 工具库
│   │   └── styles/          # 样式文件
│   ├── public/              # 静态资源
│   ├── package.json         # 前端依赖
│   └── README.md            # 前端说明
│
└── doc/                     # 项目文档
    ├── ADMIN_GUIDE.md       # 管理员指南
    ├── DATABASE_SETUP.md    # 数据库设置
    └── API_DOCS.md          # API 文档
```

## 🔧 技术栈

### 后端 (Backend)
- **Node.js** + **Express.js** - 服务器框架
- **Supabase** - 数据库和认证服务
- **JWT** - 身份验证
- **bcryptjs** - 密码加密
- **OpenAI API** - AI 内容生成
- **Redis** - 缓存 (可选)
- **Winston** - 日志管理

### 前端 (Frontend)
- **Next.js 14** - React 框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **Supabase Client** - 数据库客户端
- **React Hooks** - 状态管理

## 🌐 服务架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端应用      │    │   后端 API      │    │   Supabase      │
│  (Next.js)      │◄──►│  (Express.js)   │◄──►│   (PostgreSQL)  │
│  Port: 3000     │    │  Port: 3001     │    │   (认证/存储)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   OpenAI API    │    │   Redis Cache   │    │   Umami Analytics│
│  (AI 生成)      │    │   (可选缓存)    │    │   (数据分析)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔐 认证流程

1. **用户注册/登录** → 后端验证 → 生成 JWT Token
2. **API 请求** → 携带 Token → 后端验证 → 返回数据
3. **前端路由保护** → 检查用户状态 → 重定向或显示内容

## 📊 数据流

### 内容管理
```
用户创建内容 → 前端验证 → 后端 API → Supabase 存储 → 返回结果
```

### AI 内容生成
```
用户输入提示 → 前端发送请求 → 后端调用 OpenAI → 生成内容 → 保存到数据库
```

### 用户认证
```
用户登录 → 验证凭据 → 生成 JWT → 前端存储 → 后续请求携带 Token
```

## 🚀 部署架构

### 开发环境
- 前端: `http://localhost:3000`
- 后端: `http://localhost:3001`
- 数据库: Supabase (云服务)

### 生产环境
- 前端: Vercel/Netlify
- 后端: Railway/Render
- 数据库: Supabase (云服务)
- 缓存: Redis (可选)

## 🔧 环境配置

### 统一配置管理
- 根目录 `.env.example` 包含所有配置项
- 前后端共享相同的环境变量
- 开发时复制为 `.env` 并填入实际值

### 配置分类
1. **后端专用配置** - 服务器、数据库、JWT 等
2. **前端专用配置** - 公共 URL、客户端密钥等
3. **共享配置** - API 密钥、服务 URL 等

## 📝 开发指南

### 启动开发环境
```bash
# 1. 安装依赖
cd edu/backend && npm install
cd ../frontend && npm install

# 2. 配置环境变量
cp env.example .env
# 编辑 .env 文件，填入实际配置

# 3. 启动服务
# 终端 1: 启动后端
cd edu/backend && npm start

# 终端 2: 启动前端
cd edu/frontend && npm run dev
```

### 数据库初始化
```bash
# 1. 在 Supabase 中创建项目
# 2. 获取项目 URL 和 API 密钥
# 3. 运行数据库初始化脚本
psql -h your-supabase-host -U postgres -d postgres -f supabase-setup.sql
```

## 🔒 安全考虑

1. **环境变量** - 敏感信息不提交到代码库
2. **JWT 令牌** - 使用强密钥，设置过期时间
3. **密码加密** - 使用 bcrypt 加密存储
4. **CORS 配置** - 限制允许的域名
5. **输入验证** - 前后端双重验证
6. **权限控制** - 基于角色的访问控制

## 📈 监控和分析

1. **日志记录** - Winston 记录应用日志
2. **错误追踪** - 统一的错误处理机制
3. **性能监控** - Umami 分析用户行为
4. **健康检查** - API 端点监控服务状态

---

🎯 **这个架构设计确保了代码的可维护性、可扩展性和安全性，同时提供了清晰的开发指南。** 