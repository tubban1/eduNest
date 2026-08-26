# 🤝 eduNest 贡献指南 (Contributing Guide)

感谢您关注并愿意为 **eduNest** 做出贡献！无论是提交代码、修复文档错误、提出新想法还是报告 Bug，我们都非常欢迎。

---

## 🌟 快速参与方式

1. **🌟 Star 本仓库**：关注项目进展并给予支持。
2. **💬 参与讨论**：在 [GitHub Discussions](https://github.com/tubban1/eduNest/discussions) 中提出疑问或分享案例。
3. **🐛 提交 Issue**：发现 Bug 或有新功能想法，通过 [Issue Templates](https://github.com/tubban1/eduNest/issues/new/choose) 提交。
4. **🚀 提交 PR**：贡献代码、优化算法、补充测试用例或完善文档。

---

## 🛠️ 本地开发工作流

### 1. Fork & Clone
```bash
git clone https://github.com/<your-username>/eduNest.git
cd eduNest
```

### 2. 环境准备
- Node.js >= 20.0.0
- npm >= 9.0.0
- Docker & Docker Compose (可选)

### 3. 安装依赖与配置环境
```bash
# 安装 Monorepo 所有依赖
npm install

# 配置环境变量
cp env.example .env
```

### 4. 启动开发服务器
```bash
# 全栈双端热重载开发 (前端 3000, 后端 3001)
npm run dev

# 仅启动后端
npm run dev:backend

# 仅启动前端
npm run dev:frontend
```

---

## 📐 Git 提交规范 (Commit Convention)

本项目推荐遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/) 规范：

```text
<type>(<scope>): <subject>
```

### 常用 Type 类型：
- `feat`: 新增功能 (Feature)
- `fix`: 修复 Bug
- `docs`: 文档变更
- `style`: 样式或代码格式调整 (不影响逻辑)
- `refactor`: 代码重构 (既不是修复 bug 也不是新增功能)
- `perf`: 性能优化
- `test`: 增加或修改测试用例
- `chore`: 构建系统、依赖更新或工具链变动

### 示例：
```bash
feat(ai): 增加 kimi-k2 课件动态参数优化
fix(auth): 修复 Supabase RLS 权限过期刷新逻辑
docs(readme): 优化 Docker 一键部署说明
```

---

## 🛡️ 代码质量与规范
- 提交 PR 前请务必执行本地校验：
```bash
# 语法检查
npm run lint

# 前端生产构建校验
npm run build:frontend
```
- 请勿在代码中提交任何私钥、Token 或敏感个人数据。

---

## 🏆 成为贡献者

所有通过 PR 并合并至主分支的开发者都将自动收录至项目的 **Contributors** 荣誉墙。再次感谢您的支持！
