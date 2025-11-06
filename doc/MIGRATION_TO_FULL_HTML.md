# 迁移到 Full HTML 框架的重构方案

## ⚠️ 重要说明

**本方案已更新为简化版本，不保留向后兼容性。**

- ✅ 不需要数据迁移（旧数据将被清空或忽略）
- ✅ 不需要保留代码块模式作为备用
- ✅ 直接删除所有 `code_html`, `code_css`, `code_js`, `external_links` 相关代码
- ✅ 只使用 `full_html` 字段

**在开始重构前，请先执行归档操作：**
```bash
bash scripts/archive-current-version.sh
```

## 概述

将整个项目从分离的代码块模式（`code_html`, `code_css`, `code_js`, `external_links`）完全迁移到完整的 HTML 文件模式（`full_html`）。

## 核心原则

1. **唯一模式**：`full_html` - 完整的 HTML 文件，包含所有样式和脚本
2. **删除旧字段**：完全移除 `code_html`, `code_css`, `code_js`, `external_links` 相关代码
3. **简化架构**：不再需要组合/分离逻辑，统一使用完整 HTML

## 重构计划

### 阶段一：AI 生成层重构

#### 1.1 修改 AI 系统提示词
**文件**: `edu/backend/src/services/aiService.js`

**变更**：
- 修改 `SYSTEM_PROMPT`，要求 AI 生成完整的 HTML 文件
- 输出格式从分离的 `html`, `css`, `js` 改为单个 `full_html` 字段
- 保留 `external_links` 作为元数据（用于依赖分析，但不强制）

**新的输出格式**：
```json
{
  "title": "项目标题",
  "description": "项目描述",
  "full_html": "<!DOCTYPE html><html>...</html>",
  "external_links": ["..."] // 可选，用于依赖分析
  "tags": ["..."],
  "content_type": "vue",
  "language_code": "zh-CN"
}
```

**注意**：
- AI 必须返回 `full_html` 字段，不接受分离格式
- 如果 AI 返回分离格式，视为错误，需要重新生成

#### 1.2 修改 AI 响应处理
**文件**: `edu/backend/src/services/aiService.js`

**变更**：
- 在 `generateEducationalContent` 函数中，只提取 `full_html`
- 如果 AI 返回中没有 `full_html`，返回错误
- 删除所有组合逻辑相关代码

### 阶段二：数据库层重构

#### 2.1 数据库清理（可选）

如果确定要清空旧数据：

```sql
-- 清空 content 表（谨慎操作！）
TRUNCATE TABLE content;
```

或者只删除没有 `full_html` 的记录：

```sql
DELETE FROM content WHERE full_html IS NULL OR full_html = '';
```

#### 2.2 数据库字段处理

**策略**：
- `full_html` 字段保持为必填（NOT NULL）
- `code_html`, `code_css`, `code_js`, `external_links` 字段可以保留（数据库层面），但代码中不再使用
- 或者创建新的数据库迁移脚本删除这些字段（推荐）

### 阶段三：API 层重构

#### 3.1 内容创建 API
**文件**: `edu/backend/src/api/content.js`

**变更**：
- 创建内容时，优先使用 `full_html`
- 如果只提供了 `code_html`, `code_css`, `code_js`，自动组合为 `full_html`
- 验证：`full_html` 或 `code_html` 至少一个非空

**新验证逻辑**：
```javascript
// 验证 full_html 或 code_html 至少存在一个
if (!full_html && !code_html) {
  return res.status(400).json({ error: '必须提供 full_html 或 code_html' });
}
```

#### 3.2 内容更新 API
**文件**: `edu/backend/src/api/content.js`

**变更**：
- 更新时，如果提供了 `full_html`，优先使用
- 如果只提供了代码块，组合后更新 `full_html`
- 保持向后兼容：旧代码仍可更新分离的代码块

#### 3.3 异步生成队列更新
**文件**: `edu/backend/src/services/asyncGenerationQueue.js`

**变更**：
- `updateContentFromAIResult` 函数优先使用 `full_html`
- 如果没有 `full_html`，从 `html`, `css`, `js` 组合生成

**修改函数**：
```javascript
async updateContentFromAIResult(contentId, aiData) {
  // 优先使用 full_html
  let fullHtml = aiData.full_html;
  
  // 如果没有 full_html，从分离的代码块组合
  if (!fullHtml && aiData.html) {
    fullHtml = combineCodeBlocksToFullHTML(
      aiData.html,
      aiData.css || '',
      aiData.js || '',
      aiData.external_links || []
    );
  }
  
  const updateData = {
    title: aiData.title || 'AI生成内容',
    description: aiData.description || '',
    full_html: fullHtml || '', // 主要字段
    code_html: aiData.html || '', // 备用字段
    code_css: aiData.css || '', // 备用字段
    code_js: aiData.js || '', // 备用字段
    external_links: aiData.external_links || [], // 备用字段
    tags: aiData.tags || [],
    language_code: aiData.language_code || 'zh-CN',
    updated_at: new Date().toISOString()
  };
  
  // 更新数据库...
}
```

#### 3.4 内容修复 API
**文件**: `edu/backend/src/api/content_fix.js`

**变更**：
- AI 修复时，接收完整的 `full_html` 或分离的代码块
- 修复后返回 `full_html`（优先）或组合后的 HTML
- 保持向后兼容：仍支持分离的代码块格式

**修改**：
```javascript
// AI 修复函数应返回 full_html
const aiResult = await aiService.fixEducationalContent({
  full_html: fullHtml, // 优先
  html, css, js, external_links, // 备用
  // ...
});

// 返回时优先返回 full_html
return res.json({
  success: true,
  full_html: aiResult.data.full_html || combineCodeBlocksToFullHTML(...),
  html: aiResult.data.html, // 备用
  css: aiResult.data.css, // 备用
  js: aiResult.data.js, // 备用
  fixed: aiResult.data.fixed
});
```

### 阶段四：前端层重构

#### 4.1 内容表单重构
**文件**: `edu/frontend/src/components/ContentForm.tsx`

**变更**：
- 添加 `full_html` 状态管理
- 添加"完整 HTML"编辑模式（代码编辑器）
- 保留分离代码块编辑作为"高级模式"（可选）
- 保存时优先保存 `full_html`

**新 UI 设计**：
- 主要编辑区：完整的 HTML 编辑器（Monaco Editor 或 CodeMirror）
- 高级模式切换：允许切换到分离的 HTML/CSS/JS 编辑（向后兼容）

**状态管理**：
```typescript
const [fullHtml, setFullHtml] = useState('');
const [editMode, setEditMode] = useState<'full' | 'split'>('full'); // 编辑模式
const [codeHtml, setCodeHtml] = useState('');
const [codeCss, setCodeCss] = useState('');
const [codeJs, setCodeJs] = useState('');
```

#### 4.2 AI 生成结果处理
**文件**: `edu/frontend/src/components/ContentForm.tsx`

**变更**：
- `handleSyncAiGenerate` 和 `handleReload` 优先读取 `full_html`
- 如果没有 `full_html`，从分离的代码块组合显示
- 预览时使用 `FullHTMLRenderer`

**修改**：
```typescript
if (response.success && response.data) {
  const { full_html, html, css, js, ... } = response.data;
  
  // 优先使用 full_html
  if (full_html) {
    setFullHtml(full_html);
    setEditMode('full');
  } else if (html) {
    // 组合显示，但标记为分离模式
    setFullHtml(combineCodeBlocksToFullHTML(html, css, js, external_links));
    setEditMode('split');
    setCodeHtml(html);
    setCodeCss(css);
    setCodeJs(js);
  }
}
```

#### 4.3 内容列表和详情页
**文件**: 
- `edu/frontend/src/app/content/page.tsx`
- `edu/frontend/src/app/content/[short_id]/page.tsx`
- `edu/frontend/src/app/c/[short_id]/page.tsx`

**变更**：
- 统一使用 `FullHTMLRenderer` 渲染
- 渲染逻辑：优先使用 `full_html`，如果没有则从代码块组合生成

**统一渲染函数**：
```typescript
function getRenderedHTML(content: Content): string | null {
  // 优先使用 full_html
  if (content.full_html) {
    return content.full_html;
  }
  
  // 备用：从代码块组合
  if (content.code_html) {
    return combineCodeBlocksToFullHTML(
      content.code_html,
      content.code_css || '',
      content.code_js || '',
      content.external_links || []
    );
  }
  
  return null;
}
```

#### 4.4 API 客户端更新
**文件**: `edu/frontend/src/lib/api.ts`

**变更**：
- `Content` 接口确保包含 `full_html` 字段
- 创建和更新 API 调用优先传递 `full_html`

### 阶段五：工具脚本重构

#### 5.1 HTML 导入脚本
**文件**: `edu/frontend/scripts/import-content-from-html.js`

**现状**：已支持 `full_html`
**变更**：无需修改，已符合新架构

#### 5.2 数据迁移脚本
**新建文件**: `edu/backend/scripts/migrate-code-blocks-to-full-html.js`

**功能**：
- 批量将旧代码块组合为 `full_html`
- 支持干运行（dry-run）模式
- 生成迁移报告

## 实施步骤

### 第一步：后端核心函数实现

1. **实现组合函数** (`edu/backend/src/utils/htmlCombiner.js`)
   - `combineCodeBlocksToFullHTML(html, css, js, externalLinks)`
   - 测试覆盖：各种边界情况

2. **修改 AI 服务**
   - 更新系统提示词
   - 修改响应处理逻辑
   - 添加自动组合逻辑

3. **修改数据库服务**
   - 更新 `createContent` 和 `updateContent`
   - 添加组合逻辑

### 第二步：API 层更新

1. **内容创建 API**
   - 添加 `full_html` 支持
   - 添加自动组合逻辑
   - 更新验证规则

2. **内容更新 API**
   - 支持 `full_html` 更新
   - 保持向后兼容

3. **异步生成队列**
   - 更新内容更新逻辑
   - 优先使用 `full_html`

### 第三步：前端重构

1. **ContentForm 重构**
   - 添加完整 HTML 编辑器
   - 实现编辑模式切换
   - 更新保存逻辑

2. **AI 生成处理**
   - 更新结果解析逻辑
   - 优先使用 `full_html`

3. **渲染统一**
   - 所有页面使用 `FullHTMLRenderer`
   - 实现统一的 HTML 获取逻辑

### 第四步：数据迁移

1. **创建迁移脚本**
2. **执行迁移**（分批，避免锁表）
3. **验证迁移结果**

### 第五步：测试和验证

1. **单元测试**
   - 组合函数测试
   - API 测试

2. **集成测试**
   - 端到端流程测试
   - 向后兼容性测试

3. **性能测试**
   - 大文件处理
   - 批量迁移性能

## 向后兼容策略

### 读取兼容
- 优先读取 `full_html`
- 如果没有，自动从代码块组合生成
- 对用户透明

### 写入兼容
- 接受 `full_html`（优先）
- 接受分离的代码块（自动组合）
- 两种方式都存储到数据库

### 编辑兼容
- 新内容：默认完整 HTML 编辑
- 旧内容：自动解析为完整 HTML 显示
- 高级用户：可切换到分离编辑模式

## 风险评估

### 高风险
1. **数据迁移**：大量现有内容需要迁移
   - 缓解：分批迁移，保留旧数据
   - 回滚：保留旧字段，可随时回退

2. **AI 生成格式变更**：AI 可能返回旧格式
   - 缓解：自动组合逻辑作为备用

### 中风险
1. **前端编辑器性能**：大 HTML 文件编辑可能卡顿
   - 缓解：使用虚拟滚动，代码折叠

2. **API 响应大小**：完整 HTML 可能很大
   - 缓解：压缩，分页（如需要）

### 低风险
1. **渲染性能**：完整 HTML 渲染可能稍慢
   - 缓解：`FullHTMLRenderer` 已优化

## 回滚计划

如果迁移出现问题，可以快速回滚：

1. **数据库**：旧字段已保留，无需恢复
2. **API**：恢复旧逻辑（从 Git 历史）
3. **前端**：恢复使用 `SandboxRenderer`（保留在代码中）

## 时间估算

- **阶段一**（AI 生成层）：2-3 天
- **阶段二**（数据库层）：1 天
- **阶段三**（API 层）：2-3 天
- **阶段四**（前端层）：3-4 天
- **阶段五**（工具脚本）：1 天
- **测试和修复**：2-3 天

**总计**：11-15 个工作日

## 检查清单

### 开发前
- [ ] 创建功能分支
- [ ] 备份数据库
- [ ] 文档化当前 API 行为

### 开发中
- [ ] 实现组合函数
- [ ] 更新 AI 服务
- [ ] 更新 API 层
- [ ] 更新前端
- [ ] 编写单元测试

### 部署前
- [ ] 执行数据迁移（测试环境）
- [ ] 端到端测试
- [ ] 性能测试
- [ ] 向后兼容性测试

### 部署后
- [ ] 监控错误日志
- [ ] 验证新内容生成
- [ ] 验证旧内容显示
- [ ] 收集用户反馈

## 后续优化

1. **编辑器增强**
   - 语法高亮
   - 代码提示
   - 实时预览

2. **性能优化**
   - HTML 压缩
   - 懒加载
   - 缓存策略

3. **功能增强**
   - HTML 模板库
   - 组件库集成
   - 版本控制

