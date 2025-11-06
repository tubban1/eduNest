# 项目归档与重构指南

## 归档当前版本

### 步骤 1: 创建归档分支

```bash
cd /Users/wahaha/Documents/Me/Project/cursor/edu

# 确保当前更改已提交或暂存
git add .
git commit -m "归档：代码块模式版本 (code_html/css/js)"

# 创建归档分支
git branch archive/code-blocks-mode

# 创建归档标签（可选，更易识别）
git tag -a archive/v1.0-code-blocks -m "归档：代码块模式 v1.0"

# 推送到远程（如果需要）
git push origin archive/code-blocks-mode
git push origin archive/v1.0-code-blocks
```

### 步骤 2: 创建重构分支

```bash
# 从当前分支创建重构分支
git checkout -b refactor/full-html-only

# 或从 main/master 创建
git checkout main
git pull
git checkout -b refactor/full-html-only
```

## 重构方案（简化版）

### 核心原则

1. **只使用 `full_html`**：删除所有 `code_html`, `code_css`, `code_js`, `external_links` 相关代码
2. **不保留向后兼容**：旧数据不需要迁移，直接使用新格式
3. **简化架构**：移除组合/分离逻辑，统一使用完整 HTML

### 重构步骤

#### 阶段一：数据库清理（可选）

如果确定要清空旧数据，可以执行：

```sql
-- 清空 content 表（谨慎操作！）
TRUNCATE TABLE content;

-- 或只删除旧数据，保留 full_html 不为空的记录
DELETE FROM content WHERE full_html IS NULL OR full_html = '';
```

#### 阶段二：AI 生成层重构

**文件**: `edu/backend/src/services/aiService.js`

**变更**：
- 修改 `SYSTEM_PROMPT`，要求 AI 只生成 `full_html`
- 删除所有 `html`, `css`, `js` 分离格式的处理逻辑
- 输出格式简化为：

```json
{
  "title": "项目标题",
  "description": "项目描述",
  "full_html": "<!DOCTYPE html><html>...</html>",
  "tags": ["..."],
  "content_type": "vue",
  "language_code": "zh-CN"
}
```

#### 阶段三：数据库层重构

**文件**: `edu/backend/src/services/database.js`

**变更**：
- `createContent`: 只接受 `full_html`，删除 `code_html`, `code_css`, `code_js`, `external_links`
- `updateContent`: 同上
- 简化验证逻辑

#### 阶段四：API 层重构

**文件**: 
- `edu/backend/src/api/content.js`
- `edu/backend/src/api/content_fix.js`
- `edu/backend/src/services/asyncGenerationQueue.js`

**变更**：
- 删除所有代码块相关的验证和处理
- 只处理 `full_html` 字段
- 简化请求/响应格式

#### 阶段五：前端重构

**文件**:
- `edu/frontend/src/components/ContentForm.tsx`
- `edu/frontend/src/app/content/[short_id]/page.tsx`
- `edu/frontend/src/app/c/[short_id]/page.tsx`

**变更**：
- 删除所有 HTML/CSS/JS 分离编辑界面
- 只保留完整 HTML 编辑器
- 统一使用 `FullHTMLRenderer` 渲染

#### 阶段六：清理无用代码

**删除文件**：
- `edu/frontend/src/components/SandboxRenderer.tsx` (或保留作为备用)
- `edu/frontend/src/components/WeChatCompatibleRenderer.tsx` (如果不再需要)

**删除工具**：
- `edu/backend/src/utils/htmlCombiner.js` (不再需要组合功能)
- `edu/backend/scripts/migrate-code-blocks-to-full-html.js` (不需要迁移)

## 快速开始

### 1. 执行归档

```bash
# 在项目根目录执行
cd /Users/wahaha/Documents/Me/Project/cursor/edu
bash scripts/archive-current-version.sh
```

### 2. 开始重构

按照上述阶段逐步重构，每完成一个阶段提交一次。

### 3. 测试验证

重构完成后，确保：
- AI 生成功能正常
- 内容创建/编辑功能正常
- 内容渲染正常
- 所有页面正常显示

