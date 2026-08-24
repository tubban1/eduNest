<div align="center">

```text
 ███████╗██████╗ ██╗███╗   ██╗███████╗███████╗████████╗
 ██╔════╝██╔══██╗██║████╗  ██║██╔════╝██╔════╝╚══██╔══╝
 █████╗  ██║  ██║██║██╔██╗ ██║█████╗  ███████╗   ██║   
 ██╔══╝  ██║  ██║██║██║╚██╗██║██╔══╝  ╚════██║   ██║   
 ███████╗██████╔╝██║██║ ╚████║███████╗███████║   ██║   
 ╚══════╝╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝   ╚═╝   
```

# eduNest — AI 驱动的全场景互动教育与自动化生成 Monorepo 平台

**基于 Next.js 14 + Express + Kimi K2 / OpenAI Realtime + Supabase 的多端 AI 互动教学与内容矩阵系统**

[ 🇺🇸 **English** ](./README.md) • [ 🇨🇳 **中文文档** ](./README_CN.md)

---

[![License: MIT](https://img.shields.io/badge/开源协议-MIT-yellow.svg?style=for-the-badge&logo=mit)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-Backend-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![Supabase](https://img.shields.io/badge/数据库-Supabase-00C7B7?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Build Status](https://img.shields.io/badge/构建状态-Passing-brightgreen?style=for-the-badge&logo=github-actions)](https://github.com/tubban1/eduNest)

</div>

---

## 💡 什么是 eduNest？

**eduNest** 是一套工业级、全闭环的 AI 驱动互动教育与自动化课件生成平台。系统采用了标准的 **Monorepo** 架构，整合了 Next.js 14 前端、Express 后端、Flutter 移动端及 AI 媒体矩阵自动发布流，旨在通过大语言模型与实时语音交互改变传统 K12 及高阶备考（如瑞士 Kanton Bern 升学考试）的教学模式。

> 🚀 **零门槛互动教学**：eduNest 不仅支持根据知识点生成交互式 HTML5 试题与动画课件，还集成了 **OpenAI Realtime 双向语音 API** 与 **Kimi K2 大模型**，提供即时语音答疑与个性化学习路径！

---

## ⚡ 核心架构特色

<table width="100%">
<tr>
<td width="50%" valign="top">

### 🎓 1. AI 全场景互动课件与试题生成
* **交互式 H5 课件生成**：支持几何探索、太阳系交互、物理实验等 H5 动态可视化。
* **瑞士真题库与分级推演**：内置 Kanton Bern (BM/Gymnasium) 数学与德语考题全量解析。

</td>
<td width="50%" valign="top">

### 🎙️ 2. Realtime 语音与 RAG 知识库检索
* **OpenAI Realtime 双向语音**：低延迟实时语音对话答疑与极速语音讲解。
* **Vector Embedding (RAG)**：基于 `text-embedding-3-small` 实现精准知识库检索。

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 💳 3. 完整的订阅支付与多租户权限
* **Stripe 订阅关卡闭环**：内置 Stripe Webhook，支持免费/Pro 会员订阅控制。
* **JWT & Supabase 行级安全 (RLS)**：确保学员学习记录与私有试卷安全性。

</td>
<td width="50%" valign="top">

### 📱 4. Monorepo 多端与矩阵营销 Pipeline
* **Monorepo 代码组织**：共享 packages，同时支持 Web 端与 Flutter 移动端。
* **Playwright 自主内容分发**：支持自动图文合成并发布至小红书等社媒平台。

</td>
</tr>
</table>

---

## 🛠️ 架构与 Workflow 流程图

```mermaid
graph TD
    A[🎓 教师 / 学员交互 (Web / Mobile App)] <-->|WebSocket Realtime Voice| B(⚡ Express.js 后端网关)
    B -->|RAG 知识库检索 & Kimi/OpenAI 提示词| C(🤖 LLM 互动课件生成引擎)
    C -->|生成交互式 HTML5 / 试题 JSON| D(📱 Dynamic React / H5 Renderer)
    B -->|数据落盘 & 订阅鉴权| E[(🗄️ Supabase PostgreSQL 数据库)]
    C -->|课件文案与宣传海报| F(🚀 Playwright 社媒自动化分发 Pipeline)
    F -->|无痕自动发布| G[📱 小红书 / 微信公众号等渠道]
```

---

## 🛠️ 固化标准化生产工具链 (CLI Tools)

| 工具脚本 | 命令 | 功能描述 |
| :--- | :--- | :--- |
| **全栈双端启动** | `npm run dev` | 同时启动后端 (端口 3001) 与前端 (端口 3000) 开发服务 |
| **后端单端启动** | `npm run dev:backend` | 仅启动 Express API 热重载开发服务 |
| **前端单端启动** | `npm run dev:frontend` | 仅启动 Next.js 14 开发者服务 |
| **全栈编译构建** | `npm run build` | 编译前端应用与后端生产目标包 |
| **社媒自动发布** | `./scripts/publish_xiaohongshu.sh` | 启动 Playwright 无痕发布课件海报至小红书 |
| **数据库结构初始化** | `./init-db.sh` | 自动化初始化 Supabase 数据库表结构 |

---

## 📁 目录结构

```
edu/
├── backend/             # Express.js 后端 API 服务 (JWT, Stripe, Realtime, Kimi K2)
├── frontend/            # Next.js 14 前端全栈应用 (包含 H5 互动课件与试题渲染)
│   ├── public/          # 瑞士真题库与小红书自动化生成视觉资产
│   └── src/             # React 18 / Next.js 页面路由与国际化 (i18n)
├── apps/                # 移动端应用 (apps/mobile-flutter)
├── packages/            # Monorepo 共享包库
├── scripts/             # Playwright 小红书发布与数据清洗工具
├── doc/                 # 架构设计、环境变量与 API 开发规范
├── vercel.json          # Vercel 云端全自动部署配置
├── LICENSE              # 标准 MIT 开源协议许可
└── package.json         # Monorepo 统一依赖与工作区配置
```

---

## ⚡ 快速开始

### 1. 配置环境变量
复制根目录与后端环境变量文件：

```bash
cp env.example .env
```

配置核心参数：
```ini
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_key
JWT_SECRET=your_jwt_secret
ARK_API_KEY=your_kimi_or_ark_key
STRIPE_SECRET_KEY=sk_test_...
```

### 2. 安装依赖并启动

```bash
# 在 Monorepo 根目录下安装全量依赖
npm install

# 启动全栈开发环境
npm run dev
```

访问地址：
* 前端平台：`http://localhost:3000`
* 后端 API：`http://localhost:3001/api`

---

## 🛡️ 开源合规检查清单 (Open-Source Compliance)

- [x] **开源协议**：包含标准的 **MIT License** 文件。
- [x] **敏感数据脱敏**：`.env` 与私密 Session 缓存文件 (`.xhs.storage.json`) 已全量列入 `.gitignore`，无硬编码 API Token。
- [x] **环境隔离**：提供完备的 `env.example` 配置样板，支持零残留安全复现。
- [x] **Monorepo 完整性**：提供跨平台 `deploy.sh` 与 `init-db.sh` 自动化脚本。

---

## 🤝 开源协议 (License)

本项目基于 **MIT License** 开源。

<div align="center">
  <sub>eduNest 工程团队精心打造。基于 Next.js 14, Express, Kimi K2, OpenAI Realtime 与 Supabase 构建。</sub>
</div>
