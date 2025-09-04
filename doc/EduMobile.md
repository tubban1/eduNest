## EduMobile 移动化实施与安全保障规划

### 目标与原则
- **目标**: 在不影响现有 Web 产线的前提下，完成 iOS/Android 移动端落地，确保 AI 内容“生成即渲染”、支付合规、数据安全、可观测可回滚。
- **原则**: 单一来源复用（shared）、最小侵入、明确边界（原生/网页）、可灰度发布、严格审计与日志链路。

### 总体路线（荐）
- 外层壳: Flutter（导航/登录/订阅/设置/推送/权限）
- 内容渲染: InAppWebView 承载 AI 产物（HTML/CSS/JS/Vue/Canvas），直注入、秒开。
- 支付与合规: 原生 Stripe SDK + Apple Pay/Google Pay（或系统浏览器 SFSafariViewController/Custom Tabs），不在 WebView 内走原生支付。
- 仓库形态: Monorepo，新建 `apps/mobile-flutter`，逐步抽取 `packages/shared-*` 复用逻辑。

### 目录结构（Monorepo）
```
edu/
├─ backend/                     # Node/Express + Supabase
├─ frontend/                    # Next.js Web
├─ apps/
│  └─ mobile-flutter/           # Flutter 壳 + InAppWebView
├─ packages/
│  ├─ shared-api/               # API client、错误码、重试、鉴权
│  ├─ shared-domain/            # 领域模型（credits/subscriptions/payments/ai）
│  ├─ shared-i18n/              # 词条、语言/地区探测
│  ├─ shared-render/            # AI 渲染协议、JSON Schema 校验、依赖替换、缓存策略
│  └─ shared-security/          # token/签名、CSP 白名单、数据脱敏
└─ docs/
```

### 渲染链路（核心）
1) aiService 输出规范 JSON：`title/description/html/css/js/external_links/tags/content_type/language_code`
2) 端侧（WebView 容器页）：
   - JSON Schema 校验（shared-render）
   - external_links 白名单与映射（已实现 replaceWithSupportedLibraries）
   - 生成容器 HTML → 先注入 HTML/CSS → JS 分段/延迟执行
   - 骨架屏 + 渐进渲染，渲染状态上报 `/api/ai/log_render_status`
3) 缓存：按 `content_id/hash` 落地（IndexedDB/AsyncStorage），弱网先渲染缓存，在线增量更新

### 安全保障（端/云全链路）
- WebView 安全
  - iOS WKWebView / Android 默认 WebView，使用 `flutter_inappwebview`
  - 禁止 `javascriptInterface` 暴露高权限；仅用 `postMessage` 双向通信
  - 关闭危险 scheme：`file://`、`intent://`、自定义未授权 scheme
  - 强 CSP：仅允许受控 CDN/域名脚本执行（Vue、Tone.js 等映射后的稳定源）
  - 禁用 `eval`/内联脚本（能禁则禁，或严格域白名单）
- 鉴权与数据
  - 前端仅持 Bearer；服务端校验 `exp/aud/iss`，日志脱敏（email/PII）
  - Webhook 必须验签（Stripe），订阅状态更新幂等、重放保护
  - RLS：Supabase 表启用 RLS，服务端仅使用最低权限服务密钥
- 支付合规
  - 移动端优先原生支付 SDK，避免 WebView 支付兼容与政策风险
  - 订阅状态机：`active/past_due/canceled`，webhook 统一推进
  - 多地区支付：由后端/配置决定 payment methods 下发；端侧显示即可
- 供应链与依赖
  - 固定第三方库版本；启用 SRI（Web）与产物签名（移动端）
  - CDN 不可达兜底：常用库做本地镜像或应用内资源备份（升级时灰度）

### 网络与性能优化
- 预热 WebView（启动时隐藏实例）与实例复用，减少冷启动
- 资源合并与按需注入；首屏关键路径 < 1.5s
- Gzip/Brotli 与 HTTP/2，长连接复用
- 内容缓存命中率监控（本地/边缘/源站）

### 可观测性与回滚
- 统一 `request_id` 串联：客户端 → 服务端 → Webhook
- 结构化日志：`user_id`、接口、耗时、错误码、渲染成功率
- 指标：渲染首屏时长、失败率、重试次数、支付转化率
- 灰度发布：按用户/地区/版本开关能力；出错一键回滚（关闭新特性）

### 权限与配额（Phase 5 对齐）
- 中间件 `credits/subscription` 融合：AI 调用前校验，失败不扣分；成功幂等扣减
- 前端引导：积分不足/续费弹层，统一文案与埋点

### 国际化与地区适配
- 语言：`shared-i18n` 提供词条、语言探测（en/fr/de/zh）
- 地区：客户端探测（语言/时区）+ 后端兜底，支付方式动态调整（CH/US/CN/EU）
- 价格显示：后端返回本地化货币与文案

### CI/CD 与环境
- 环境：dev / staging / prod；独立 Stripe/Supabase Key 与 Webhook Secret
- CI：lint、typecheck、契约测试（OpenAPI）、轻量 e2e
- CD：
  - Backend（Render/Fly/自托管）
  - Frontend（Vercel）
  - Mobile（Fastlane iOS/Android 上架）

### 里程碑与清单
- M1（2-3 周）
  - [ ] 创建 `apps/mobile-flutter`，接入 InAppWebView 与基础路由
  - [ ] WebView 渲染 AI 产物（含 JSON 校验、依赖替换、骨架屏）
  - [ ] 订阅/支付流程贯通（原生/外部浏览器）与 webhook 联调
  - [ ] 本地缓存与弱网策略（按 content_id/hash）
  - [ ] CSP/白名单与危险 scheme 屏蔽
- M2（4-6 周）
  - [ ] 推送通知、深度链接、错误上报聚合
  - [ ] shared-* 抽取：api/domain/i18n/render/security
  - [ ] 地区适配完善（瑞士/美国/中国/欧洲）与价格本地化
  - [ ] 可观测性：指标/日志/告警仪表盘
- M3（>6 周）
  - [ ] A/B 支付方式与价格策略
  - [ ] 更多本地支付（CN/CH/DE）
  - [ ] 供应链安全/依赖扫描与自动修复

### 落地步骤（操作指南）
1) 新建 `apps/mobile-flutter`，引入 `flutter_inappwebview`
2) 建立 JS<->Dart 通信：仅白名单消息（loadContent/renderStatus/metrics）
3) 实现渲染容器页：接收 JSON → 校验 → 注入 → 上报
4) Stripe 原生集成（或 SFSafariViewController/Custom Tabs）
5) 启用 CSP/域白名单与库映射（服务端/端侧双保险）
6) 建立缓存层与失败回退（缓存/错误页/重试）
7) 灰度开关与观测面板，逐步放量

### 风险与对策
- WebView 兼容性：双端使用主流内核，提供降级渲染路径
- CDN 不可达：本地镜像与离线包
- Webhook 失败：重放队列与幂等键
- Token 失效：刷新/重登策略与统一错误码

---
如需，我可以在 `apps/mobile-flutter` 初始化基础骨架与示例渲染页，并补充一套最小可行的通信与缓存代码模版。

### 数据结构变更（移动端多支付通道适配）

为同时支持 Stripe、iOS IAP（App Store）与 Google Play Billing，并在后端统一“订阅权益”与“支付流水”，需对以下表进行扩展（保持向后兼容，先加列、再落地读写、最后清理旧字段）。

#### subscriptions（订阅权益，统一来源）
- 必加字段（通用）
  - `provider` text: 订阅来源，取值：`stripe` | `app_store` | `google_play`
  - `product_sku` text: 商品/方案标识（与三方后台的产品或价格/套餐对应）
  - `provider_subscription_id` text: 三方订阅标识（Stripe: subscription_id；App Store: original_transaction_id；Play: purchaseToken/订阅 id 映射）
  - `provider_customer_id` text: 三方侧用户/客户标识（Stripe: customer_id；App Store/Play 可为空）
- 已有字段复用
  - `status` text: 继续使用（active/past_due/canceled 等）
  - `current_period_start` timestamptz: 继续使用
  - `current_period_end` timestamptz: 继续使用
  - `cancel_at_period_end` boolean: 继续使用
- 可选补充（增强对账/合规）
  - `latest_renew_receipt_at` timestamptz: 最近一次续费时间
  - `canceled_at` timestamptz: 取消时间（与 cancel_at_period_end 配合）

备注：iOS/Android 订阅与 Stripe 同表统一口径，通过 `provider` 与 `provider_subscription_id` 区分来源，保持一用户一权益视图。

#### payments（支付流水，记录具体扣款事件）
- 新增字段（通用与多提供方）
  - `provider` text: 支付来源（`stripe` | `app_store` | `google_play`）
  - `provider_payment_id` text: 三方支付流水/支付意图/订单号（Stripe: payment_intent_id 或 charge_id；App Store: transaction_id；Play: orderId）
  - `provider_session_id` text: 会话/下单 id（Stripe: checkout_session_id；无则为空）
  - `provider_receipt` text: 原始收据/签名（App Store: latest_receipt；Play: purchaseToken/签名）
  - `provider_customer_id` text: 三方客户 id（Stripe: customer_id）
  - `product_sku` text: 对应商品/方案标识（与 subscriptions 对齐）
- 已有字段复用
  - `amount_usd` numeric: 建议保留，同时后续新增 `amount` 与 `currency` 已存在，后端可统一以 `amount`+`currency` 口径，`amount_usd` 作为历史兼容
  - `currency` text: 已存在
  - `status` text: 已存在（pending/succeeded/failed/refunded 等）
  - `stripe_session_id` text: 建议保留一段时间，但后续读写迁移至 `provider_session_id`

备注：payments 作为事实表，保留不同渠道的一次性扣款/续费/退款等事件，便于对账与审计。

#### 分步迁移清单（建议一步步做）
1) 第一步：加列（线上无破坏）
   - subscriptions: `provider`, `product_sku`, `provider_subscription_id`, `provider_customer_id`
   - payments: `provider`, `provider_payment_id`, `provider_session_id`, `provider_receipt`, `provider_customer_id`, `product_sku`
2) 第二步：写入打点
   - Stripe 流程：在 webhook/创建订阅处写入上述字段；`stripe_session_id` 同步写 `provider_session_id`
   - iOS IAP：落地“恢复购买/订阅创建”时写入 `provider=app_store`、`provider_subscription_id=original_transaction_id`、`provider_receipt`
   - Google Play：写入 `provider=google_play`、`provider_payment_id/orderId`、`provider_receipt/purchaseToken`
3) 第三步：读取切换
   - 业务读取统一走新字段（`provider_*` 系列），旧字段保留兼容但不再作为主读源
4) 第四步：审计与报表
   - 校验三方通知回填完整率；抽样对账（金额/周期/状态）
5) 第五步：清理与固化
   - 评估 `stripe_session_id` 等老字段是否下线（保留只读/迁移完成后清理）

#### 变更影响范围
- 仅涉及 `subscriptions` 与 `payments` 两张表（本阶段不改动 `users`/`ai_usage_logs` 等）。
- 后端需要：
  - API/DAO 层补齐新字段的写入与查询
  - Webhook（Stripe/App Store/Play）适配并回填新字段
  - 统一的 Subscription 状态推进逻辑使用 `provider` 分发
- 前端/移动端：
  - 不直接感知 provider 字段；只读取“权益状态/到期时间/可续费与否”等聚合字段

> 按以上清单逐步推进：先文档与加列→后端写入→读取切换→报表校验→清理收口。
