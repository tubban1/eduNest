# EduNest（AI 互动教育平台）— 整体架构

本文档描述 `edu/` 仓库的整体架构、目录结构、技术栈与核心数据流。文档位置：`edu/doc/ARCHITECTURE.md`。

---

## 1. 仓库与项目结构

```
edu/                              # 项目根（Monorepo）
├── .env.example                  # 环境变量示例（根目录统一）
├── env.example                   # 同上，兼容用
├── package.json                  # 根 workspace：dev / build / test
├── README.md
├── deploy.sh / start.sh          # 部署与启动脚本
├── init-db.sh                    # 数据库初始化
├── vercel.json                   # Vercel 部署配置
│
├── backend/                      # 后端服务（Node.js + Express）
│   ├── src/
│   │   ├── server.js             # HTTP + WebSocket 入口
│   │   ├── api/                  # REST 路由
│   │   ├── config/               # 配置
│   │   ├── middleware/           # 认证、VisitorId 等
│   │   ├── services/             # 业务与第三方服务
│   │   └── utils/                # 日志、错误处理、i18n 等
│   ├── rag/                      # RAG 知识库管道（向量化、QA 批量导入）
│   ├── migrations/               # SQL 迁移
│   ├── scripts/                 # 一次性迁移/工具脚本
│   ├── config/                  # 业务配置（如 libraries_cn.json）
│   ├── templates/                # HTML 模板（3D、数学等）
│   ├── package.json
│   └── README.md
│
├── frontend/                     # 前端应用（Next.js 14）
│   ├── src/
│   │   ├── app/                  # App Router 页面
│   │   ├── components/           # React 组件
│   │   ├── contexts/            # React 上下文（如语言）
│   │   ├── hooks/                # 自定义 Hooks
│   │   ├── i18n/                 # 多语言配置与文案
│   │   ├── lib/                  # API 封装、Supabase、配置
│   │   └── utils/                # 前端工具
│   ├── public/                   # 静态资源与预置 HTML
│   ├── next.config.js
│   ├── package.json
│   └── README.md
│
└── doc/                          # 项目文档
    ├── ARCHITECTURE.md           # 本架构文档
    ├── PRD.md / DataStructure.md / 各类功能与设计文档
    └── ...
```

---

## 2. 后端结构（backend/）

### 2.1 API 路由（src/api/）

| 模块 | 路径 | 说明 |
|------|------|------|
| 认证 | `/api/auth` | 注册、登录、JWT |
| 内容 | `/api/content` | 内容 CRUD、列表、详情 |
| 内容修复 | `/api/content/fix` | 基于 RendererEngine 的自动修复 |
| 积分 | `/api/credits` | 积分查询、消耗、历史 |
| 推荐/邀请 | `/api/referrals` | 邀请与奖励 |
| 评分 | `/api/ratings` | 内容评分 |
| 合集 | `/api/collection_lists`, `/api/user_collections`, `/api/user_content` | 合集与用户收藏 |
| AI 生成 | `/api/ai` | 提交生成任务、轮询状态、流式等 |
| AI Guide | `/api/ai-guide` | 知识库问答、对话；实时语音走 WebSocket |
| 支付/订阅 | `/api/subscriptions`, `/api/payments` | Stripe 订阅与 Webhook |
| 访客 | `/api/visitor` | 访客 ID、未登录使用记录 |
| 埋点 | `/api/page-views` | 页面浏览上报 |
| 知识库 | `/api/kb` | 知识库条目、推荐、问答（RAG） |
| 其他 | `/api/early-user-bonus`, `/api/renderer-test`, `/api/test-sharp-thumbnail` | 运营与测试 |

### 2.2 核心服务（src/services/）

| 服务 | 职责 |
|------|------|
| **database** | Supabase 客户端与统一访问 |
| **aiService** | AI 内容生成（提示词、模板、多轮生成逻辑） |
| **aiProviderFactory** | 多 AI 厂商（OpenAI/Ark/等）的 Chat Completion 封装 |
| **asyncGenerationQueue** | 异步生成队列：消费任务、更新状态、超时与卡住任务处理 |
| **aiGuideService** | 知识库问答：静态规则 → 精确匹配 → 向量检索 → LLM 生成 |
| **kbEmbeddingService** | 单条文本 / kb_entry 的 Embedding（OpenAI text-embedding-3-small） |
| **kbAskService** | RAG 检索与回答生成（精确匹配、match_kb_entries、LLM） |
| **realtimeProxy** | AI Guide 实时语音：WebSocket 与上游服务桥接 |
| **rendererEngine** | HTML 内容渲染与修复（Checker + Fixer：数学、运行时、库等） |
| **thumbnailService** | 缩略图生成（Sharp 等） |
| **pageViewService** | 页面浏览与统计 |
| **visitorUsageService** | 访客使用与配额 |
| **teachingSnapshot** / **learningAnalysisService** | 教学快照与学习分析（若已接入） |

### 2.3 RAG 管道（backend/rag/）

- **add-qa-batch.js**：从 JSON 批量导入 QA 到 `kb_entries`（可 `--db`、`--skip-embedding`）。
- **sync-kb-embeddings.js**：为 `kb_entries` 中 embedding 为空的条目生成向量（入口，具体逻辑可能在 scripts 或内联）。
- **parse-kb-md.js**：解析 Markdown（如《经销商产品培训文档》）为知识库条目。
- **status.js** / **check-qa.js**：状态检查与 QA 校验。
- **向量化方案对比.md**：问答 vs 整篇 vs 切片向量化的对比与选型说明。

---

## 3. 前端结构（frontend/）

### 3.1 路由（src/app/，App Router）

- **/**：首页（若存在）或重定向。
- **/c**：内容相关（列表、创建、短链 `/c/[short_id]`）。
- **/login**、**/auth/callback**、**/auth/forgot**：登录与认证回调。
- **/help**：帮助页。
- **/subscription**、**/subscription/success**、**/subscription/cancel**：订阅与支付结果。
- **/claim-bonus**：领取奖励等。

### 3.2 核心模块

- **components/**：AI 生成（ContentAIGenerator、generation 状态卡）、AI Guide（AIGuidedLearning、AIGuideDrawer、AIGuideRealtime）、收藏/合集、支付（StripeCheckout、PaymentForm）、Credits、多语言与 UI 等。
- **lib/**：后端 API 调用（api.ts）、Supabase 客户端、前端配置、Umami 统计等。
- **i18n/**：i18next 配置与 locales（zh-CN、en-US、de-DE、fr-FR 等）。
- **hooks/**：useAuth、useContent、useLanguage、useNetworkError 等。
- **contexts/**：如 LanguageContext。
- **utils/**：内容页生成、生成状态轮询、会话、访客 ID、缩略图等。

### 3.3 静态资源（public/）

- 预置交互内容：`3d/`、`buzz/`、`chuzhong/`、`math/`、`stem/`、`zhongkao/` 等目录下的 HTML，供 iframe 或直链使用。

---

## 4. 技术栈

### 4.1 后端（backend）

- **运行与框架**：Node.js ≥20，Express。
- **数据库与认证**：Supabase（PostgreSQL + Auth）。
- **安全与限流**：Helmet、express-rate-limit、CORS；JWT（jsonwebtoken）、bcryptjs。
- **AI**：OpenAI SDK（Chat + Embedding）、aiProviderFactory 多厂商。
- **渲染与图片**：Playwright（无头渲染）、Sharp、pngjs。
- **支付**：Stripe。
- **实时**：ws（WebSocket）。
- **任务与定时**：node-cron（若使用）；异步队列在内存/Redis（若接入）。
- **日志与校验**：Winston、Joi/express-validator。
- **可选**：Redis 缓存。

### 4.2 前端（frontend）

- **框架**：Next.js 14（App Router）、React 18、TypeScript。
- **样式**：Tailwind CSS。
- **数据与认证**：Supabase Client；后端 API 通过 lib/api 调用。
- **支付**：@stripe/react-stripe-js、@stripe/stripe-js。
- **多语言**：i18next、react-i18next、语言检测。
- **数学与 Markdown**：KaTeX、react-markdown、remark-math、rehype-katex。
- **分析**：Umami（lib/umami）。

---

## 5. 服务与数据流概览

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    前端 (Next.js)                         │
                    │  App Router / 组件 / i18n / API 调用 / Stripe / Supabase  │
                    └───────────────────────────┬─────────────────────────────┘
                                                │ HTTPS (REST)
                    ┌───────────────────────────▼─────────────────────────────┐
                    │                    后端 (Express)                        │
                    │  API 路由 / 认证中间件 / 限流 / 错误处理                   │
                    │  ├── 内容、用户、合集、积分、推荐、埋点、访客              │
                    │  ├── AI 生成（/api/ai）→ asyncGenerationQueue → aiService │
                    │  ├── AI Guide（/api/ai-guide + WebSocket /realtime）     │
                    │  │      → kbAskService（规则→精确→向量→LLM）              │
                    │  └── 支付/订阅（Stripe Webhook + subscriptions）          │
                    └───────────────┬─────────────────────┬───────────────────┘
                                    │                     │
              ┌─────────────────────▼──────┐   ┌──────────▼──────────┐
              │  Supabase                  │   │  外部/可选           │
              │  PostgreSQL / Auth         │   │  OpenAI / Ark       │
              │  pgvector（match_kb_entries）│   │  Stripe / Redis     │
              │  ai_usage_logs / contents  │   │  Umami               │
              └───────────────────────────┘   └─────────────────────┘
```

### 5.1 认证

- 注册/登录 → 后端校验 → 签发 JWT → 前端存 Token，请求带 `Authorization`。
- 受保护接口经 `authenticateToken`（及可选 `requireAdmin`）校验。

### 5.2 内容与 AI 生成

- 用户在前端提交「生成」→ POST `/api/ai` 创建任务，写入队列与 `ai_usage_logs`。
- 后端 `asyncGenerationQueue` 消费任务，调用 `aiService` 生成 HTML，Playwright 渲染、缩略图等，更新状态。
- 前端轮询或 SSE 获取状态，完成后跳转/展示内容。

### 5.3 知识库问答（RAG）

- 用户提问 → POST `/api/kb/ask`。
- **kbAskService**：先静态规则与精确匹配（主语言）；未命中则对问题做 Embedding，`match_kb_entries` 向量检索，再取 top-k 条目交给 LLM 生成回答。
- 向量由 **kbEmbeddingService** 生成；数据来源为 `kb_entries`（含 question/answer 等），通过 `rag/add-qa-batch.js`、`sync-kb-embeddings.js` 等维护。

### 5.4 支付与订阅

- 订阅与支付通过 Stripe；Webhook 在 `/api/payments/webhook` 处理，需 raw body 验签。
- 前端 Stripe Checkout / Payment Element，成功后跳转 `/subscription/success` 等。

---

## 6. 环境与部署

### 6.1 环境变量

- 根目录 `.env.example` / `env.example` 为模板；实际使用复制为 `.env` 并填写。
- 常用：Supabase URL/Service Key、JWT_SECRET、OpenAI/Ark 等 API Key、Stripe 相关、ALLOWED_ORIGINS、PORT 等；后端会从 `edu/.env` 加载（如 server.js 中 path 指向上一级）。

### 6.2 开发

```bash
# 根目录
cd edu
npm install
cp .env.example .env   # 并编辑 .env

# 后端
npm run dev:backend    # 或 cd backend && npm run dev   → 默认 3001

# 前端
npm run dev:frontend   # 或 cd frontend && npm run dev   → 默认 3000
```

- 后端在非 Vercel 环境下会启动 HTTP 服务器与 WebSocket（`/api/ai-guide/realtime`），并挂载 `asyncGenerationQueue` 的优雅关闭。

### 6.3 生产

- 前端与 API 可部署到 **Vercel**（vercel.json）；后端在 Vercel 上以 Serverless 形式运行，不启动长驻 HTTP/WS，队列与 WebSocket 需另行部署或使用托管服务。
- 数据库：Supabase 云。
- 可选：Redis、独立 Node 进程跑队列与 WebSocket。

---

## 7. 安全与运维要点

- 敏感配置仅放在环境变量，不提交 `.env`。
- JWT 强密钥与合理过期；密码 bcrypt；Stripe Webhook 校验签名。
- CORS、Helmet、API 限流（按用户/IP）已启用。
- 输入校验：前后端双重；管理员接口使用 `requireAdmin`。
- 日志：Winston；错误由统一 errorHandler 处理。
- 运维脚本：`backend/rag/` 下 RAG 管道；`backend/scripts/`、`backend/migrations/` 下迁移与工具；卡住任务可参考 `fix-stuck-task.js`（若启用需单独配置或 cron）。

---

## 8. 相关文档

- **doc/PRD.md**、**doc/DataStructure.md**：产品与数据结构。
- **doc/Product_Knowledgebase_Chatbot.md**、**doc/Unified_AI_Entry.md**：知识库与统一 AI 入口。
- **doc/Subscription_PAYMENTs.md**、**STRIPE_SETUP_GUIDE.md**：订阅与 Stripe。
- **backend/rag/README.md**、**backend/rag/向量化方案对比.md**：RAG 使用与向量化选型。
- **doc/SETUP_GUIDE.md**、**doc/DATABASE_SETUP.md**（若存在）：环境与数据库初始化。

---

*文档最后更新与代码库结构核对后生成，如有新增 API 或服务，请同步更新本架构说明。*
