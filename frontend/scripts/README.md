# HTML 内容导入脚本使用说明

文件：`scripts/import-content-from-html.js`

> 说明：所有使用示例仅在本 README 中，脚本内不再包含示例代码片段。

## 功能概述
- 扫描指定目录下的 HTML 文件，抽取字段并写入数据库的 `content` 表。
- 字段规则：
  - `content_type`: 固定 `vue`
  - `code_html`: 仅 `<body>` 的 innerHTML（不含 `<body>` 标签），用于渲染器。
  - `external_links`: 仅收集外部脚本/样式的绝对链接（`<script src^=http(s)>`、`<link rel=stylesheet href^=http(s)>`）。
  - `knowledge_points`: 固定空数组 `[]`。
  - `created_by`: 固定 `1145c642-0fc9-4c85-8f74-c3ef6f413242`。
- 去重/更新依据：HTML 的 `<meta name="author" content="short_id">`。
  - 若 HTML 已包含 `short_id`：按此 `short_id` 更新对应 `content` 记录。
  - 若没有：插入新内容并把返回的 `short_id` 写回 HTML 的 `<head>` 成为 `<meta name="author" content="...">`。
- 入库完成后，将本次所有写入/更新的 `content` 绑定到 `collection_list`：`16c34498-578c-455f-80f4-c7d28cdd0b62`。

## 安装依赖
项目根目录执行（如依赖已安装可跳过）：

```bash
npm i pg cheerio fast-glob dotenv
```

## 数据库环境变量（.env）
确保 `.env` 中存在以下配置：

```
PGHOST=your_host
PGPORT=5432
PGDATABASE=your_db
PGUSER=your_user
PGPASSWORD=your_password
```

## 运行方式
支持通过 `--dirs` 指定多个目录（逗号分隔的 glob），以及 `--dry-run` 仅打印不入库，`--update-only` 仅更新已有内容。

### 1. 导入/更新模式（默认）
同时支持插入新内容和更新已有内容：
```bash
node scripts/import-content-from-html-supabase.js \
  --dirs "edu/frontend/public/buzz/*.html"
```

### 2. 仅更新模式（推荐用于代码更新）
只更新已有 short_id 的内容，跳过新文件：
```bash
node scripts/import-content-from-html-supabase.js \
  --dirs "edu/frontend/public/buzz/*.html" \
  --update-only
```

### 3. 预览模式（不入库）
仅预览，不实际写入数据库：
```bash
node scripts/import-content-from-html-supabase.js \
  --dirs "edu/frontend/public/buzz/*.html" \
  --dry-run
```

### 4. 组合使用
预览 + 仅更新模式：
```bash
node scripts/import-content-from-html-supabase.js \
  --dirs "edu/frontend/public/buzz/*.html" \
  --update-only \
  --dry-run
```

### 默认扫描目录（未提供 `--dirs` 时）
```
public/math/*.html
public/temp/*.html
```

## 字段抽取规则（简要）
- `title`: `<title>`；若无则首个 `<h1>`；再无用文件名（去后缀）
- `description`: `<meta name="description">`
- `language_code`: `<html lang>`（默认 `zh-CN`）
- `tags`: `<meta name="keywords">` 逗号拆分为数组（去重/去空格）
- `knowledge_points`: `[]`（固定空）
- `external_links`: `script[src^http(s)]` 与 `link[rel=stylesheet][href^http(s)]`
- `code_html`: `<body>` innerHTML
- `code_css`: 合并所有 `<style>` 文本
- `code_js`: 合并所有内联 `<script>`（无 src）文本
- `content_type`: `vue`
- `created_by`: 固定 UUID

## 去重与写回 short_id
- 若 HTML 无 `<meta name="author">`，脚本在插入成功后会把返回的 `short_id` 自动写入 `<head>`：

```html
<meta name="author" content="{short_id}">
```

- 下次运行脚本时，会按该 `short_id` 定位后进行更新（幂等）。

## 绑定到 collection_list
- 脚本在本次导入/更新结束后，会将所有 `content_id` 绑定到 `collection_list`：

```
16c34498-578c-455f-80f4-c7d28cdd0b62
```

（若对应关系已存在则跳过）

## 模式说明

### 导入/更新模式（默认）
- 如果 HTML 文件有 `short_id`（在 `<meta name="author">` 中），则更新数据库中的对应记录
- 如果 HTML 文件没有 `short_id`，则插入新记录，并将返回的 `short_id` 写回 HTML 文件
- 适用于首次导入或混合场景

### 仅更新模式（--update-only）
- **只处理已有 `short_id` 的文件**
- 如果文件没有 `short_id`，会跳过并给出警告
- 如果 `short_id` 在数据库中不存在，会报错
- **不会插入新记录，不会写回 `short_id`**
- **推荐用于本地代码更新后同步到数据库的场景**

## 常见问题
- 预览为空：确认 `--dirs` 的路径匹配；可用引号包裹 glob 并逐步缩小范围。
- 未写回 `short_id`：只在非 `--dry-run` 且非 `--update-only` 模式下写回；确认 HTML 存在 `<head>`。
- 无 `<body>`：`full_html` 为空，将跳过并打印 `[skip]`。
- 数据库连接失败：检查 `.env` 配置中的 `SUPABASE_URL` 和 `SUPABASE_SERVICE_KEY`。
- 更新模式跳过文件：使用 `--update-only` 时，没有 `short_id` 的文件会被跳过，这是正常行为。

## 安全与建议
- 建议先 `--dry-run` 预览，确认字段抽取符合预期后再正式导入。
- 如需更严格去重，可扩展为基于文件相对路径哈希的唯一键策略（需要调整表结构或脚本逻辑）。
