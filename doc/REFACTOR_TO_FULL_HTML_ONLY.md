# 重构到 Full HTML Only 计划

## 重构目标

**只保留 `full_html` 相关的内容和生成、保存逻辑，删除所有代码块相关代码（`code_html`, `code_css`, `code_js`, `external_links`）**

## 核心原则

1. **数据库不修改**：保留所有字段，但代码中不再使用旧字段
2. **只使用 `full_html`**：所有创建、更新、展示都只使用 `full_html`
3. **删除所有组合逻辑**：不再需要 `htmlCombiner.js` 等工具
4. **简化架构**：统一使用完整 HTML

## 重构范围

### 1. 后端重构

#### AI 服务层
- [x] 修改 `SYSTEM_PROMPT`，只要求生成 `full_html`
- [x] 删除所有 `html`, `css`, `js` 分离格式的处理
- [x] 删除组合逻辑相关代码

#### 数据库服务层
- [x] `createContent`: 只接受 `full_html`
- [x] `updateContent`: 只接受 `full_html`
- [x] 删除所有代码块相关的验证和处理

#### API 层
- [x] 内容创建 API: 只接受 `full_html`
- [x] 内容更新 API: 只接受 `full_html`
- [x] 内容修复 API: 只处理 `full_html`
- [x] 异步生成队列: 只更新 `full_html`

### 2. 前端重构

#### ContentForm 组件
- [ ] 删除 HTML/CSS/JS 分离编辑界面
- [ ] 只保留完整 HTML 编辑器
- [ ] 删除所有代码块相关的状态和逻辑
- [ ] 更新保存逻辑

#### 内容展示
- [ ] 统一使用 `FullHTMLRenderer`
- [ ] 删除 `SandboxRenderer` 的使用
- [ ] 更新所有内容详情页

#### API 客户端
- [ ] 删除代码块相关的字段
- [ ] 更新接口定义

### 3. 清理工作

#### 删除文件
- [ ] `htmlCombiner.js`
- [ ] `htmlCombiner.test.js`
- [ ] 迁移脚本

#### 删除代码
- [ ] 所有 `code_html`, `code_css`, `code_js`, `external_links` 相关的代码
- [ ] 所有组合/分离相关的函数
- [ ] 所有代码块相关的验证

## 实施步骤

### 阶段 1: AI 生成层重构
### 阶段 2: 数据库服务层重构
### 阶段 3: API 层重构
### 阶段 4: 前端重构
### 阶段 5: 清理和测试

