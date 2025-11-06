# 重构检查清单

## 归档阶段

- [ ] 执行归档脚本：`bash scripts/archive-current-version.sh`
- [ ] 确认归档分支和标签已创建
- [ ] 推送到远程仓库（如需要）
- [ ] 创建重构分支：`git checkout -b refactor/full-html-only`

## 数据库清理（可选）

- [ ] 备份数据库（如果需要）
- [ ] 执行 SQL 清理旧数据
- [ ] 验证数据库状态

## 后端重构

### AI 服务层
- [ ] 修改 `SYSTEM_PROMPT`，要求只生成 `full_html`
- [ ] 删除 `html`, `css`, `js` 分离格式的处理逻辑
- [ ] 更新 `generateEducationalContent` 函数
- [ ] 更新 `fixEducationalContent` 函数
- [ ] 删除 `combineCodeBlocksToFullHTML` 相关代码

### 数据库服务层
- [ ] 修改 `createContent`，只接受 `full_html`
- [ ] 修改 `updateContent`，只接受 `full_html`
- [ ] 删除所有 `code_html`, `code_css`, `code_js`, `external_links` 相关代码
- [ ] 简化验证逻辑

### API 层
- [ ] 修改 `POST /api/content`，只接受 `full_html`
- [ ] 修改 `PUT /api/content/:id`，只接受 `full_html`
- [ ] 修改 `POST /api/content/fix`，只处理 `full_html`
- [ ] 修改异步生成队列 `updateContentFromAIResult`
- [ ] 删除所有代码块相关的验证

### 工具和脚本
- [ ] 删除 `htmlCombiner.js`（不再需要）
- [ ] 删除迁移脚本（不再需要）
- [ ] 更新 `import-content-from-html.js`（如需要）

## 前端重构

### ContentForm 组件
- [ ] 删除 HTML/CSS/JS 分离编辑界面
- [ ] 只保留完整 HTML 编辑器
- [ ] 删除 `code_html`, `code_css`, `code_js`, `external_links` 状态
- [ ] 更新 `handleSave` 函数
- [ ] 更新 AI 生成结果处理

### 内容展示页面
- [ ] 统一使用 `FullHTMLRenderer`
- [ ] 删除 `SandboxRenderer` 的使用（或保留作为备用）
- [ ] 更新 `content/[short_id]/page.tsx`
- [ ] 更新 `c/[short_id]/page.tsx`

### API 客户端
- [ ] 更新 `Content` 接口定义
- [ ] 删除 `code_html`, `code_css`, `code_js`, `external_links` 字段
- [ ] 更新创建和更新 API 调用

## 清理无用代码

### 删除的文件
- [ ] `edu/backend/src/utils/htmlCombiner.js`
- [ ] `edu/backend/src/utils/htmlCombiner.test.js`
- [ ] `edu/backend/scripts/migrate-code-blocks-to-full-html.js`
- [ ] `edu/frontend/src/components/SandboxRenderer.tsx`（可选，可保留作为备用）
- [ ] `edu/frontend/src/components/WeChatCompatibleRenderer.tsx`（如果不再需要）

### 代码清理
- [ ] 删除所有 `code_html`, `code_css`, `code_js`, `external_links` 相关的导入
- [ ] 删除所有组合/分离相关的函数调用
- [ ] 清理未使用的变量和函数

## 测试验证

### 功能测试
- [ ] AI 生成功能正常
- [ ] 内容创建功能正常
- [ ] 内容编辑功能正常
- [ ] 内容渲染正常
- [ ] 内容列表显示正常
- [ ] 内容详情页显示正常

### 边界测试
- [ ] 空 HTML 处理
- [ ] 大 HTML 文件处理
- [ ] 特殊字符处理
- [ ] 错误处理

### 性能测试
- [ ] 大文件加载性能
- [ ] 渲染性能
- [ ] 编辑器性能

## 文档更新

- [ ] 更新 API 文档
- [ ] 更新开发文档
- [ ] 更新 README
- [ ] 更新数据库结构文档

## 部署准备

- [ ] 代码审查
- [ ] 测试环境验证
- [ ] 准备回滚方案
- [ ] 部署到生产环境
- [ ] 监控错误日志

