# ⚡ 5 分钟极速上手 eduNest (Quick Start)

欢迎体验 **eduNest**！本指南将指引你在本地开发环境中以最快速度跑通全部核心服务。

---

## 📋 极简 3 步启动

### 第 1 步：克隆并安装依赖
```bash
git clone https://github.com/tubban1/eduNest.git
cd eduNest
npm install
```

### 第 2 步：配置环境变量
```bash
cp env.example .env
```
用编辑器打开 `.env`，填入基础测试配置（至少配置 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, 以及 AI 密钥 `ARK_API_KEY` 或 `KIMI_API_KEY`）。

### 第 3 步：一键启动全栈
```bash
npm run dev
```

打开浏览器访问：
- 🌐 前端互动教育平台：[http://localhost:3000](http://localhost:3000)
- 🔌 后端 API 服务状态：[http://localhost:3001/api/health](http://localhost:3001/api/health)

---

## 🎯 核心功能验证与体验

1. **AI 课件动态生成**：进入课件工作台，选择学科（如数学/物理）与年级，输入教学主题，观察 H5 动态仿真实验实时渲染。
2. **瑞士 Kanton Bern 题库**：进入题库解析模块，探索分步解答与语音 AI 辅导。
3. **Realtime 语音答疑**：点击右下方麦克风，即可与 AI 助教进行低延迟双向实时语音对话。
4. **社媒自动化工作流**：运行 `./scripts/publish_xiaohongshu.sh` 体验自动化课件图文合成生成。
