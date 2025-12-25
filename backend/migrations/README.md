# 数据库迁移说明

## add_visitor_id_to_tables.sql

### 问题描述
为了支持未登录用户的免费试用功能，需要在 `ai_usage_logs` 和 `content` 表中添加 `visitor_id` 字段，用于存储未登录用户的标识（格式：`visitor-{uuid}`）。

### 解决方案
**不修改 `user_id`/`created_by` 字段类型**（保持 UUID 类型），而是添加一个新的 `visitor_id` 字段（TEXT 类型）来存储 visitor_id。

- **已登录用户**：`user_id`/`created_by` 有值（UUID），`visitor_id` 为 NULL
- **未登录用户**：`user_id`/`created_by` 为 NULL，`visitor_id` 有值（格式：`visitor-{uuid}`）

### 执行步骤

1. **备份数据库**（重要！）
   ```bash
   # 使用 Supabase CLI 或 pg_dump 备份数据库
   ```

2. **执行迁移脚本**
   ```bash
   # 在 Supabase Dashboard 的 SQL Editor 中执行
   # 或者使用 psql 连接数据库执行
   psql -h <host> -U <user> -d <database> -f add_visitor_id_to_tables.sql
   ```

3. **验证迁移结果**
   ```sql
   -- 检查 ai_usage_logs 表的 visitor_id 字段
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'ai_usage_logs' AND column_name = 'visitor_id';
   -- 应该显示 data_type = 'text'
   
   -- 检查 content 表的 visitor_id 字段
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'content' AND column_name = 'visitor_id';
   -- 应该显示 data_type = 'text'
   
   -- 检查索引
   SELECT indexname FROM pg_indexes 
   WHERE tablename IN ('ai_usage_logs', 'content') 
   AND indexname LIKE '%visitor_id%';
   ```

### 注意事项

1. **不影响现有数据**：迁移脚本只是添加新字段，不会修改现有数据。

2. **向后兼容**：现有的查询逻辑仍然有效，`user_id`/`created_by` 字段保持 UUID 类型。

3. **查询逻辑**：代码会自动判断传入的是 `visitor_id` 还是 `user_id`，并相应地查询 `visitor_id` 或 `user_id` 字段。

4. **数据合并**：当用户注册后，`visitor_id` 字段的数据会被合并到 `user_id`/`created_by` 字段，`visitor_id` 会被清除。

### 代码变更

以下文件已更新以支持新的 `visitor_id` 字段：

1. **`database.js`**：`logAIUsage` 函数会自动判断并存储到正确的字段
2. **`aiGuideService.js`**：`handleChat`、`getMessages`、`getConversations` 函数支持通过 `visitor_id` 或 `user_id` 查询
3. **`visitorUsageService.js`**：`mergeVisitorDataToUser` 函数更新为使用 `visitor_id` 字段进行查询和合并

---

## add_visitor_id_to_ai_usage_logs.sql（已废弃）

### 问题描述
`ai_usage_logs` 表的 `user_id` 字段是 UUID 类型，无法存储 `visitor-{uuid}` 格式的 visitor_id，导致初始化对话时出现错误：
```
invalid input syntax for type uuid: "visitor-6217f9a8-1a40-4068-a292-95189f45279e"
```

### 解决方案
**不修改 `user_id` 字段类型**（保持 UUID 类型），而是添加一个新的 `visitor_id` 字段（TEXT 类型）来存储 visitor_id。

- **已登录用户**：`user_id` 有值（UUID），`visitor_id` 为 NULL
- **未登录用户**：`user_id` 为 NULL，`visitor_id` 有值（格式：`visitor-{uuid}`）

### 执行步骤

1. **备份数据库**（重要！）
   ```bash
   # 使用 Supabase CLI 或 pg_dump 备份数据库
   ```

2. **执行迁移脚本**
   ```bash
   # 在 Supabase Dashboard 的 SQL Editor 中执行
   # 或者使用 psql 连接数据库执行
   psql -h <host> -U <user> -d <database> -f add_visitor_id_to_ai_usage_logs.sql
   ```

3. **验证迁移结果**
   ```sql
   -- 检查 visitor_id 字段是否存在
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'ai_usage_logs' AND column_name = 'visitor_id';
   -- 应该显示 data_type = 'text'
   
   -- 检查索引
   SELECT indexname FROM pg_indexes WHERE tablename = 'ai_usage_logs' AND indexname = 'idx_ai_usage_logs_visitor_id';
   ```

### 注意事项

1. **不影响现有数据**：迁移脚本只是添加新字段，不会修改现有数据。

2. **向后兼容**：现有的查询逻辑仍然有效，`user_id` 字段保持 UUID 类型。

3. **查询逻辑**：代码会自动判断传入的是 `visitor_id` 还是 `user_id`，并相应地查询 `visitor_id` 或 `user_id` 字段。

4. **数据合并**：当用户注册后，`visitor_id` 字段的数据会被合并到 `user_id` 字段，`visitor_id` 会被清除。

### 代码变更

以下文件已更新以支持新的 `visitor_id` 字段：

1. **`database.js`**：`logAIUsage` 函数会自动判断并存储到正确的字段
2. **`aiGuideService.js`**：`handleChat`、`getMessages`、`getConversations` 函数支持通过 `visitor_id` 或 `user_id` 查询
3. **`visitorUsageService.js`**：`mergeVisitorDataToUser` 函数更新为使用 `visitor_id` 字段进行查询和合并

