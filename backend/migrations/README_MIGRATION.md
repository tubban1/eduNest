# AI Guide 数据迁移指南

## 📋 迁移概述

将 AI Guide 对话数据从 `ai_usage_logs` 表迁移到新的 `ai_conversations` 和 `ai_messages` 表。

## 🔄 迁移步骤

### 步骤 1：创建 Conversations（SQL 脚本）

**执行顺序：** 必须先执行此步骤

```bash
# 在 Supabase Dashboard 的 SQL Editor 中执行
# 或者使用 psql：
psql -h <host> -U <user> -d <database> -f migrate_ai_conversations.sql
```

**作用：**
- 从 `ai_usage_logs` 中提取并创建 `ai_conversations` 记录
- 批量执行，速度快
- 自动处理重复（ON CONFLICT）

**验证：**
```sql
SELECT COUNT(*) FROM ai_conversations;
-- 应该显示创建的 conversations 数量
```

### 步骤 2：迁移 Messages（JavaScript 脚本）

**执行顺序：** 在步骤 1 完成后执行

```bash
# 在 backend 目录下执行
cd edu/backend
node migrations/migrate_ai_messages.js
```

**作用：**
- 从 `ai_usage_logs.request_payload.messages` 提取历史消息
- 从 `user_query` 和 `response_metadata.reply` 提取当前消息
- 自动去重
- 批量插入，性能优化
- 支持断点续传（已存在的消息会跳过）

**特性：**
- ✅ 进度显示
- ✅ 错误处理
- ✅ 批量处理（每批 100 条 logs）
- ✅ 自动去重
- ✅ 统计报告

**验证：**
```sql
SELECT COUNT(*) FROM ai_messages;
-- 应该显示插入的 messages 数量

-- 检查消息分布
SELECT role, COUNT(*) 
FROM ai_messages 
GROUP BY role;
```

## 📊 迁移前后对比

### 迁移前（方案 1）
- 数据存储在 `ai_usage_logs` 表
- 消息存储在 JSONB 字段中
- 查询复杂，需要解析 JSONB

### 迁移后（方案 2）
- 数据存储在 `ai_conversations` 和 `ai_messages` 表
- 消息存储在独立表中
- 查询简单，直接 JOIN

## ⚠️ 注意事项

1. **备份数据库**：迁移前务必备份数据库
2. **执行顺序**：必须先执行 SQL 脚本，再执行 JavaScript 脚本
3. **执行时间**：根据数据量，可能需要几分钟到几十分钟
4. **错误处理**：脚本会自动处理重复数据，但会报告错误
5. **数据完整性**：迁移后验证数据完整性

## 🔍 验证脚本

迁移完成后，可以运行检查脚本验证：

```sql
-- 在 Supabase Dashboard 的 SQL Editor 中执行
\i migrations/check_ai_conversations_setup.sql
```

## 📈 预期结果

- ✅ 所有 conversations 已创建
- ✅ 所有 messages 已迁移
- ✅ 数据完整性验证通过
- ✅ 外键关系正确
- ✅ 索引已创建
- ✅ RLS 策略已配置

## 🐛 故障排除

### 问题 1：Conversations 创建失败

**原因：** `request_id` 格式不正确或为 NULL

**解决：**
```sql
-- 检查是否有无效的 request_id
SELECT COUNT(*) 
FROM ai_usage_logs 
WHERE action_type = 'ai_guide' 
AND (request_id IS NULL OR request_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
```

### 问题 2：Messages 插入失败

**原因：** conversation_id 不存在或外键约束失败

**解决：**
```javascript
// 在 migrate_ai_messages.js 中添加更详细的日志
// 检查 conversation 是否存在
const { data: conv } = await supabase
  .from('ai_conversations')
  .select('id')
  .eq('id', log.request_id)
  .single();

if (!conv) {
  console.warn(`Conversation ${log.request_id} 不存在`);
}
```

### 问题 3：重复数据

**说明：** 脚本会自动处理重复数据，使用 `ON CONFLICT` 和去重逻辑

**验证：**
```sql
-- 检查是否有重复的 conversation_id
SELECT conversation_id, COUNT(*) 
FROM ai_messages 
GROUP BY conversation_id 
HAVING COUNT(*) > 1000; -- 调整阈值
```

## 🚀 后续步骤

迁移完成后：

1. ✅ 验证数据完整性
2. ✅ 更新代码以使用新表结构
3. ✅ 测试恢复历史对话功能
4. ✅ 监控性能

## 📝 相关文件

- `create_ai_conversations_tables.sql` - 创建表结构
- `migrate_ai_conversations.sql` - 迁移 conversations（SQL）
- `migrate_ai_messages.js` - 迁移 messages（JavaScript）
- `check_ai_conversations_setup.sql` - 验证脚本
