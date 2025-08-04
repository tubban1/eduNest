# 环境配置设置指南

## 📋 概述

本项目使用统一的环境配置文件 `.env`，所有环境变量都集中管理在项目根目录下。

## 🚀 快速开始

### 1. 复制环境配置模板

```bash
# 在项目根目录下
cp .env.example .env
```

### 2. 配置必要的环境变量

编辑 `.env` 文件，配置以下必要参数：

#### 后端必需配置

```bash
# Supabase 数据库配置
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_ANON_KEY=your_supabase_anon_key

# JWT 认证配置
JWT_SECRET=your_jwt_secret_key_here

# OpenAI API 配置
OPENAI_API_KEY=your_openai_api_key
```

#### 前端必需配置

```bash
# API 基础URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
```

## 🔧 详细配置说明

### 后端配置

| 配置项 | 说明 | 必需 | 默认值 |
|--------|------|------|--------|
| `NODE_ENV` | 运行环境 | 是 | `development` |
| `PORT` | 服务器端口 | 否 | `3001` |
| `SUPABASE_URL` | Supabase项目URL | 是 | - |
| `SUPABASE_SERVICE_KEY` | Supabase服务密钥 | 是 | - |
| `SUPABASE_ANON_KEY` | Supabase匿名密钥 | 是 | - |
| `JWT_SECRET` | JWT签名密钥 | 是 | - |
| `JWT_EXPIRES_IN` | JWT过期时间 | 否 | `7d` |
| `OPENAI_API_KEY` | OpenAI API密钥 | 是 | - |
| `OPENAI_MODEL` | OpenAI模型 | 否 | `gpt-3.5-turbo` |
| `REDIS_URL` | Redis连接URL | 否 | `redis://localhost:6379` |
| `ALLOWED_ORIGINS` | CORS允许的域名 | 否 | `http://localhost:3000,http://localhost:3001` |
| `MAX_FILE_SIZE` | 最大文件上传大小 | 否 | `10485760` (10MB) |
| `RATE_LIMIT_WINDOW` | 速率限制窗口 | 否 | `900000` (15分钟) |
| `RATE_LIMIT_MAX` | 速率限制最大请求数 | 否 | `100` |
| `LOG_LEVEL` | 日志级别 | 否 | `info` |

### 前端配置

| 配置项 | 说明 | 必需 | 默认值 |
|--------|------|------|--------|
| `NEXT_PUBLIC_API_BASE_URL` | API基础URL | 是 | - |
| `NEXT_PUBLIC_APP_NAME` | 应用名称 | 否 | `AI 互动教育平台` |
| `NEXT_PUBLIC_APP_URL` | 应用URL | 否 | `http://localhost:3000` |
| `NEXT_PUBLIC_ENABLE_AI_GENERATION` | 启用AI生成功能 | 否 | `true` |
| `NEXT_PUBLIC_ENABLE_USER_COLLECTIONS` | 启用用户收藏功能 | 否 | `true` |
| `NEXT_PUBLIC_ENABLE_RATINGS` | 启用评分功能 | 否 | `true` |
| `NEXT_PUBLIC_ENABLE_ADMIN_PANEL` | 启用管理面板 | 否 | `true` |

## 🔐 安全配置

### JWT 密钥生成

```bash
# 生成安全的JWT密钥
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Supabase 配置获取

1. 登录 [Supabase](https://supabase.com)
2. 创建新项目或选择现有项目
3. 在项目设置中获取以下信息：
   - Project URL
   - Service Role Key (用于后端)
   - Anon Key (用于前端)

### OpenAI API 配置

1. 注册 [OpenAI](https://openai.com) 账户
2. 在 API Keys 页面生成新的API密钥
3. 将密钥配置到 `OPENAI_API_KEY` 环境变量

## 🌍 环境特定配置

### 开发环境

```bash
NODE_ENV=development
LOG_LEVEL=debug
DEBUG=app:*
```

### 生产环境

```bash
NODE_ENV=production
LOG_LEVEL=warn
ALLOWED_ORIGINS=https://yourdomain.com
```

### 测试环境

```bash
NODE_ENV=test
LOG_LEVEL=error
```

## 🔍 配置验证

### 后端配置验证

启动后端服务时，系统会自动验证配置：

```bash
cd backend
npm start
```

如果配置有误，会显示相应的错误信息。

### 前端配置验证

前端会在开发模式下检查配置：

```bash
cd frontend
npm run dev
```

## 🚨 常见问题

### 1. Supabase 连接失败

**问题**: 后端显示 "Supabase 配置无效"

**解决方案**:
- 检查 `SUPABASE_URL` 和 `SUPABASE_SERVICE_KEY` 是否正确
- 确保 Supabase 项目已创建并激活
- 验证网络连接

### 2. JWT 认证失败

**问题**: 用户登录后无法访问受保护的资源

**解决方案**:
- 确保 `JWT_SECRET` 已正确设置
- 检查 JWT 密钥是否足够复杂
- 验证令牌过期时间设置

### 3. OpenAI API 调用失败

**问题**: AI 功能无法正常工作

**解决方案**:
- 检查 `OPENAI_API_KEY` 是否正确
- 验证 API 密钥是否有效
- 确认账户余额充足

### 4. CORS 错误

**问题**: 前端无法访问后端API

**解决方案**:
- 检查 `ALLOWED_ORIGINS` 配置
- 确保前端URL在允许列表中
- 验证端口配置

## 📝 环境变量最佳实践

1. **安全性**: 不要在代码中硬编码敏感信息
2. **版本控制**: 不要将 `.env` 文件提交到版本控制
3. **备份**: 定期备份环境配置
4. **文档**: 及时更新配置文档
5. **验证**: 部署前验证所有配置

## 🔄 配置更新流程

1. 更新 `.env.example` 文件
2. 更新相关文档
3. 通知团队成员
4. 在测试环境验证
5. 部署到生产环境

---

**注意**: 请确保在生产环境中使用强密码和安全的密钥，并定期轮换敏感配置。 