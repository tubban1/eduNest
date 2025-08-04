# 生产环境部署指南

## 🚀 部署到 Vercel

### 1. 必需的环境变量

在 Vercel 项目设置中添加以下环境变量：

#### 前端环境变量 (NEXT_PUBLIC_*)
```bash
NEXT_PUBLIC_API_BASE_URL=https://eduNest.app/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

#### 后端环境变量
```bash
PORT=3001
NODE_ENV=production
JWT_SECRET=your-secure-jwt-secret-32-chars-minimum
ARK_API_KEY=your-ark-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key
ALLOWED_ORIGINS=https://eduNest.app,https://www.eduNest.app
```

### 2. 可选的环境变量

```bash
# 功能开关
NEXT_PUBLIC_AI_GENERATION=true
NEXT_PUBLIC_USER_COLLECTIONS=true
NEXT_PUBLIC_RATINGS=true
NEXT_PUBLIC_ADMIN_PANEL=true
NEXT_PUBLIC_GOOGLE_AUTH=true

# 其他配置
JWT_EXPIRES_IN=7d
ARK_URL=https://ark.cn-beijing.volces.com/api/v3/chat/completions
ARK_MODEL=kimi-k2-250711
```

## 🔧 部署前检查

### 1. 运行配置检查脚本
```bash
node check-production.js
```

### 2. 检查清单
- [ ] 所有必需的环境变量已设置
- [ ] JWT_SECRET 不是默认值
- [ ] NODE_ENV 设置为 production
- [ ] API 端点指向正确的域名
- [ ] CORS 配置包含生产域名
- [ ] 数据库连接配置正确
- [ ] AI 服务 API 密钥有效

## 🛡️ 安全配置

### 1. JWT 密钥
```bash
# 生成安全的 JWT 密钥
openssl rand -base64 32
```

### 2. 环境变量安全
- 不要在代码中硬编码敏感信息
- 使用 Vercel 的环境变量管理
- 定期轮换 API 密钥

### 3. CORS 配置
确保 `ALLOWED_ORIGINS` 只包含生产域名：
```bash
ALLOWED_ORIGINS=https://eduNest.app,https://www.eduNest.app
```

## 📊 监控和日志

### 1. 错误监控
- 配置错误日志收集
- 设置错误告警
- 监控 API 响应时间

### 2. 性能监控
- 监控数据库连接
- 监控 AI 服务调用
- 监控用户行为

## 🔄 部署流程

### 1. 代码准备
```bash
# 确保所有硬编码已修复
git add .
git commit -m "Fix hardcoded values for production"
git push
```

### 2. Vercel 部署
1. 推送代码到 GitHub
2. Vercel 自动触发部署
3. 检查部署日志
4. 验证环境变量

### 3. 部署后验证
```bash
# 检查 API 健康状态
curl https://eduNest.app/api/health

# 检查前端页面
curl https://eduNest.app
```

## 🚨 常见问题

### 1. API 连接失败
- 检查 `NEXT_PUBLIC_API_BASE_URL` 配置
- 确认后端服务正常运行
- 检查 CORS 配置

### 2. 数据库连接失败
- 检查 Supabase 配置
- 确认数据库服务可用
- 验证 API 密钥

### 3. AI 服务不可用
- 检查 ARK API 密钥
- 确认 API 配额充足
- 验证服务端点

## 📞 支持

如果遇到部署问题：
1. 检查 Vercel 部署日志
2. 运行 `node check-production.js`
3. 验证所有环境变量
4. 检查网络连接和防火墙设置 