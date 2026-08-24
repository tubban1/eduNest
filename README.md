<div align="center">

```text
 ███████╗██████╗ ██╗███╗   ██╗███████╗███████╗████████╗
 ██╔════╝██╔══██╗██║████╗  ██║██╔════╝██╔════╝╚══██╔══╝
 █████╗  ██║  ██║██║██╔██╗ ██║█████╗  ███████╗   ██║   
 ██╔══╝  ██║  ██║██║██║╚██╗██║██╔══╝  ╚════██║   ██║   
 ███████╗██████╔╝██║██║ ╚████║███████╗███████║   ██║   
 ╚══════╝╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝   ╚═╝   
```

# eduNest — AI-Powered Interactive Education & Content Monorepo Platform

**Interactive Learning Platform Built with Next.js 14, Express, Kimi K2 / OpenAI Realtime, & Supabase**

[ 🇺🇸 **English** ](./README.md) • [ 🇨🇳 **中文文档** ](./README_CN.md)

---

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge&logo=mit)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-Backend-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![Supabase](https://img.shields.io/badge/Database-Supabase-00C7B7?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen?style=for-the-badge&logo=github-actions)](https://github.com/tubban1/eduNest)

</div>

---

## 💡 What is eduNest?

**eduNest** is an industrial-grade AI-powered interactive education monorepo platform. Combining **Next.js 14**, **Express**, **Kimi K2 LLM**, and **OpenAI Realtime Voice APIs**, eduNest transforms conventional learning materials into interactive H5 courseware, animated quizzes, and real-time voice-guided AI tutoring.

---

## ⚡ Key Features

<table width="100%">
<tr>
<td width="50%" valign="top">

### 🎓 1. AI Interactive Courseware & Exam Engine
* **H5 Dynamic Visualizations**: Solar system explorers, geometry labs, and physics simulations.
* **Kanton Bern Exam Archive**: Full solution walkthroughs for Swiss BM & Gymnasium entrance exams.

</td>
<td width="50%" valign="top">

### 🎙️ 2. Realtime Voice & RAG Knowledge Base
* **OpenAI Realtime Audio**: Low-latency bidirectional voice tutoring & speech Q&A.
* **Vector Embedding (RAG)**: Precise knowledge retrieval with `text-embedding-3-small`.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 💳 3. Multi-Tenant & Stripe Subscriptions
* **Paywall & Quota Control**: Integrated Stripe webhooks for Free and Pro tiers.
* **JWT & Supabase RLS**: Row Level Security protecting private test papers & learning logs.

</td>
<td width="50%" valign="top">

### 📱 4. Monorepo & Automated Social Pipeline
* **Monorepo Architecture**: Shared packages powering Next.js Web and Flutter Mobile.
* **Playwright Automation**: Automated courseware poster generation & social publishing.

</td>
</tr>
</table>

---

## 🛠️ Architecture & Workflow

```mermaid
graph TD
    A[🎓 Teacher / Student (Web / Mobile App)] <-->|WebSocket Realtime Voice| B(⚡ Express.js API Gateway)
    B -->|RAG Embedding & Kimi/OpenAI Prompts| C(🤖 LLM Courseware Synthesizer)
    C -->|Generate Interactive H5 / Quiz JSON| D(📱 Dynamic React / H5 Renderer)
    B -->|Persistence & Subscriptions| E[(🗄️ Supabase PostgreSQL)]
    C -->|Courseware Visual Posters| F(🚀 Playwright Social Automation)
    F -->|Automated Publishing| G[📱 Xiaohongshu / Social Channels]
```

---

## 📁 Directory Structure

```
edu/
├── backend/             # Express.js API service (JWT, Stripe, Realtime, Kimi K2)
├── frontend/            # Next.js 14 full-stack app (H5 courseware & quizzes)
├── apps/                # Mobile applications (Flutter)
├── packages/            # Shared Monorepo modules
├── scripts/             # Playwright social automation & data scrapers
├── doc/                 # Architecture & API specifications
├── LICENSE              # MIT Open-Source License
└── package.json         # Monorepo root config
```

---

## ⚡ Quick Start

```bash
# 1. Install dependencies across Monorepo
npm install

# 2. Configure environment variables in .env
cp env.example .env

# 3. Start development servers (Frontend :3000, Backend :3001)
npm run dev
```

---

## 🛡️ Open-Source Compliance Checklist

- [x] **License**: Officially licensed under the **MIT License**.
- [x] **Secret Protection**: `.env` and `.xhs.storage.json` ignored via `.gitignore`; zero hardcoded API keys.
- [x] **Environment Isolation**: Complete `env.example` template provided.
- [x] **Monorepo Integrity**: Automated `deploy.sh` and `init-db.sh` scripts verified.

---

## 🤝 License

Released under the **MIT License**.