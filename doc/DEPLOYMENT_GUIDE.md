# 🚀 eduNest 生产级部署全指南 (Deployment Guide)

本文档提供 **eduNest** 在不同云环境与本地服务器下的完整部署指南，包括 Docker Compose 容器化、Vercel 云端部署、宝塔面板及传统 Node.js 原生部署。

---

## 目录
1. [方案一：Docker Compose 一键部署（推荐）](#方案一docker-compose-一键部署推荐)
2. [方案二：Vercel + 独立后端云托管](#方案二vercel--独立后端云托管)
3. [方案三：宝塔 Linux 面板部署](#方案三宝塔-linux-面板部署)
4. [方案四：Node.js 原生部署 (PM2)](#方案四nodejs-原生部署-pm2)
5. [环境变量详细对照表](#环境变量详细对照表)

---

## 方案一：Docker Compose 一键部署（推荐）

通过 Docker Compose 可以快速在 Linux 服务器上一键拉起 Next.js 前端与 Express 后端网关。

### 1. 准备工作
确保服务器已安装 Docker (>= 24.0) 与 Docker Compose (>= 2.0)：
```bash
docker --version
docker compose version
```

### 2. 克隆仓库与配置环境
```bash
git clone https://github.com/tubban1/eduNest.git
cd eduNest

# 复制环境变量模板
cp env.example .env

# 编辑 .env 文件，填入真实密钥 (Supabase、Kimi/OpenAI、Stripe 等)
nano .env # 或 vim .env
```

### 3. 一键构建与启动
```bash
docker compose up -d --build
```

### 4. 检查服务状态
```bash
# 查看容器运行状态
docker compose ps

# 查看实时日志
docker compose logs -f
```

- 前端平台访问：`http://your-server-ip:3000`
- 后端 API 访问：`http://your-server-ip:3001/api`

---

## 方案二：Vercel + 独立后端云托管

### 1. 前端部署到 Vercel
1. 在 GitHub 上 Fork 本仓库。
2. 登录 [Vercel](https://vercel.com/)，点击 **Add New Project** 并导入仓库。
3. **Root Directory** 选择 `frontend`。
4. 在 **Environment Variables** 中配置：
   - `NEXT_PUBLIC_API_BASE_URL`: `https://api.yourdomain.com/api`
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://your-project.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `your-supabase-anon-key`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: `pk_live_xxx`
5. 点击 **Deploy** 即可完成秒级自动化上线。

### 2. 后端部署到 Railway / Zeabur / 云服务器
将 `backend/` 目录通过 Dockerfile 部署至 Railway/Zeabur 或配置 Nginx 反向代理至 Node.js 实例。

---

## 方案三：宝塔 Linux 面板部署

1. **安装 Node.js 版本管理器**：在宝塔软件商店安装 Node.js 版本管理器，安装 Node v20.x。
2. **添加 Node 项目**：
   - **后端项目**：
     - 根目录选择 `/www/wwwroot/eduNest/backend`
     - 启动选项：`node src/server.js`，端口 `3001`
   - **前端项目**：
     - 根目录选择 `/www/wwwroot/eduNest/frontend`
     - 执行构建：`npm run build`
     - 启动选项：`npm run start`，端口 `3000`
3. **配置 Nginx 反代与 SSL**：
   - 为域名申请免费 SSL 证书开启 HTTPS
   - 在 Nginx 配置文件中设置 WebSocket 支持：
   ```nginx
   location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
   }
   ```

---

## 方案四：Node.js 原生部署 (PM2)

```bash
# 全局安装 PM2
npm install -g pm2

# 根目录安装依赖
npm install

# 编译前端
npm run build:frontend

# 使用 PM2 启动前后端服务
pm2 start backend/src/server.js --name "edunest-backend"
pm2 start "npm --prefix frontend start" --name "edunest-frontend"

# 保存 PM2 进程状态
pm2 save
pm2 startup
```

---

## 环境变量详细对照表

| 变量名 | 必填 | 默认示例 | 描述 |
| :--- | :--- | :--- | :--- |
| `PORT` | 否 | `3001` | 后端服务监听端口 |
| `JWT_SECRET` | 是 | `your-secret-key` | JWT 鉴权签名密钥（生产环境请务必修改） |
| `SUPABASE_URL` | 是 | `https://xxx.supabase.co` | Supabase 项目 URL |
| `SUPABASE_SERVICE_KEY`| 是 | `eyJhbGciOi...` | Supabase Service Role 密钥 (用于服务端提权操作) |
| `SUPABASE_ANON_KEY` | 是 | `eyJhbGciOi...` | Supabase Anon 客户端公钥 |
| `ARK_API_KEY` | 选填 | `volc-xxx` | 火山引擎 ARK (Kimi K2) API Key |
| `KIMI_API_KEY` | 选填 | `sk-xxx` | Moonshot AI API Key |
| `DEFAULT_AI_PROVIDER` | 否 | `ark` | 默认生成大模型提供商 (`ark` 或 `kimi`) |
| `GPT_REALTIME_API_KEY`| 是 | `sk-xxx` | OpenAI Realtime 语音与 RAG Embedding Key |
| `STRIPE_SECRET_KEY` | 选填 | `sk_live_xxx` | Stripe 生产私钥 |
| `STRIPE_WEBHOOK_SECRET`| 选填 | `whsec_xxx` | Stripe Webhook 验证签名 |
| `NEXT_PUBLIC_API_BASE_URL` | 是 | `http://localhost:3001/api` | 前端请求后端的 API 前缀 |
