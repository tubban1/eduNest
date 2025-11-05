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
支持通过 `--dirs` 指定多个目录（逗号分隔的 glob），以及 `--dry-run` 仅打印不入库。

- 仅预览（不入库，不写回 short_id，不绑定 collection）：
```bash
node scripts/import-content-from-html.js \
  --dirs "edu/frontend/public/math/*.html,edu/frontend/public/temp/*.html" \
  --dry-run
```

- 正式导入（入库 + 写回 short_id + 绑定到指定 collection_list）：
```bash
node scripts/import-content-from-html.js \
  --dirs "edu/frontend/public/math/*.html,edu/frontend/public/temp/*.html"
```

- 默认扫描目录（未提供 `--dirs` 时）：
```
edu/frontend/public/math/*.html
edu/frontend/public/temp/*.html
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

## 常见问题
- 预览为空：确认 `--dirs` 的路径匹配；可用引号包裹 glob 并逐步缩小范围。
- 未写回 `short_id`：只在非 `--dry-run` 下写回；确认 HTML 存在 `<head>`。
- 无 `<body>`：`code_html` 为空，将跳过并打印 `[skip]`。
- 数据库连接失败：检查 `.env` 配置，或尝试本地 `psql` 连接排查。

## 安全与建议
- 建议先 `--dry-run` 预览，确认字段抽取符合预期后再正式导入。
- 如需更严格去重，可扩展为基于文件相对路径哈希的唯一键策略（需要调整表结构或脚本逻辑）。
