# import-content-from-html.js 脚本检查报告

## ✅ 功能检查

### 1. 数据提取 ✓
- ✅ 从 HTML 中提取 `title`（从 `<title>` 或 `<h1>` 或文件名）
- ✅ 从 HTML 中提取 `description`（从 `<meta name="description">`）
- ✅ 从 HTML 中提取 `tags`（从 `<meta name="keywords">`，逗号分隔）
- ✅ 提取完整的 `full_html`（整个 HTML 文件内容）
- ✅ 提取 `short_id`（从 `<meta name="author">`，用于去重）

### 2. 数据库插入 - content 表 ✓
- ✅ `title`: 提取的标题
- ✅ `description`: 提取的描述
- ✅ `language_code`: 固定为 `'zh-CN'`
- ✅ `content_type`: 固定为 `'vue'`
- ✅ `full_html`: 完整的 HTML 内容
- ✅ `tags`: 从 keywords 提取的标签数组
- ✅ `knowledge_points`: 固定为空数组 `[]`
- ✅ `created_by`: 固定为 `'1145c642-0fc9-4c85-8f74-c3ef6f413242'` ✓
- ✅ `short_id`: 自动生成（如果不存在）或从 HTML 的 meta author 读取

### 3. 数据库插入 - user_collections 表 ✓
- ✅ `content_id`: 从 content 表插入返回的 `id`
- ✅ `list_id`: 固定为 `'16c34498-578c-455f-80f4-c7d28cdd0b62'` ✓
- ✅ `user_id`: 固定为 `'1145c642-0fc9-4c85-8f74-c3ef6f413242'` ✓（已修复）

### 4. 去重和更新机制 ✓
- ✅ 如果 HTML 中存在 `<meta name="author" content="short_id">`，则更新对应的 content 记录
- ✅ 如果不存在，则插入新记录，并将返回的 `short_id` 写回 HTML 文件

### 5. 绑定到 collection_list ✓
- ✅ 所有成功插入/更新的 content 记录都会被绑定到指定的 `list_id`
- ✅ 使用去重机制，避免重复绑定

## 🔧 修复的问题

### 问题 1: user_collections 缺少 user_id
**问题描述**：
- 原脚本在插入 `user_collections` 时只设置了 `content_id` 和 `list_id`
- 缺少 `user_id` 字段，虽然该字段是可选的，但为了数据完整性应该设置

**修复方案**：
```javascript
// 修复前
await client.query(
  'INSERT INTO user_collections (content_id, list_id) VALUES ($1, $2)',
  [id, TARGET_COLLECTION_LIST_ID]
);

// 修复后
await client.query(
  'INSERT INTO user_collections (content_id, list_id, user_id) VALUES ($1, $2, $3)',
  [id, TARGET_COLLECTION_LIST_ID, FIXED_CREATED_BY]
);
```

## ✅ 验证结果

### 脚本功能完整性
1. ✅ **数据提取**: 正确从 HTML 提取所有必需字段
2. ✅ **content 表插入**: 所有字段都正确设置，包括 `created_by`
3. ✅ **user_collections 表插入**: 已修复，现在包含 `content_id`、`list_id` 和 `user_id`
4. ✅ **去重机制**: 基于 `short_id` 的正确去重和更新
5. ✅ **short_id 回写**: 新插入的内容会将 `short_id` 写回 HTML 文件

### 常量验证
- ✅ `FIXED_CREATED_BY = '1145c642-0fc9-4c85-8f74-c3ef6f413242'`
- ✅ `TARGET_COLLECTION_LIST_ID = '16c34498-578c-455f-80f4-c7d28cdd0b62'`

## 📝 使用示例

### 预览模式（不实际写入数据库）
```bash
node edu/frontend/scripts/import-content-from-html.js \
  --dirs "edu/frontend/public/math/*.html" \
  --dry-run
```

### 正式导入
```bash
node edu/frontend/scripts/import-content-from-html.js \
  --dirs "edu/frontend/public/math/*.html"
```

## ⚠️ 注意事项

1. **环境变量**: 确保 `.env` 文件中配置了正确的数据库连接信息：
   - `PGHOST`
   - `PGPORT`
   - `PGDATABASE`
   - `PGUSER`
   - `PGPASSWORD`

2. **依赖安装**: 确保已安装所需依赖：
   ```bash
   npm install pg cheerio fast-glob dotenv
   ```

3. **HTML 文件格式**: HTML 文件应该包含：
   - `<title>` 或 `<h1>` 标签（用于提取标题）
   - `<meta name="description">` 标签（可选，用于描述）
   - `<meta name="keywords">` 标签（可选，用于标签）
   - `<meta name="author">` 标签（可选，用于去重，会自动创建）

4. **权限**: 确保脚本有写入 HTML 文件的权限（用于写回 short_id）

## ✅ 结论

脚本已经**完全符合要求**，可以正确：
1. ✅ 提取 HTML 文件中的数据
2. ✅ 插入到 `content` 表，使用指定的 `created_by`
3. ✅ 插入到 `user_collections` 表，使用指定的 `list_id` 和 `user_id`
4. ✅ 处理去重和更新
5. ✅ 写回 `short_id` 到 HTML 文件

脚本已修复并可以正常使用。

