-- 迁移脚本：为 ai_usage_logs 和 content 表添加 visitor_id 支持
-- 用于支持未登录用户的 visitor_id（格式：visitor-{uuid}）

-- ============================================
-- 1. ai_usage_logs 表：添加 visitor_id 字段
-- ============================================

-- 添加 visitor_id 字段
ALTER TABLE ai_usage_logs 
  ADD COLUMN IF NOT EXISTS visitor_id TEXT;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_visitor_id ON ai_usage_logs(visitor_id);

-- ============================================
-- 2. content 表：两种方案可选
-- ============================================

-- 方案 A：添加 visitor_id 字段（推荐，保持 created_by 为 UUID）
-- 优点：保持 created_by 的类型一致性，不影响外键约束
-- 缺点：需要两个字段（created_by 和 visitor_id）

ALTER TABLE content 
  ADD COLUMN IF NOT EXISTS visitor_id TEXT;

CREATE INDEX IF NOT EXISTS idx_content_visitor_id ON content(visitor_id);

-- 方案 B：将 created_by 改为 TEXT（符合 PRD 文档）
-- 优点：符合 PRD 要求，只使用一个字段
-- 缺点：需要修改 created_by 字段类型，可能影响外键约束
-- 
-- 如果需要使用方案 B，请取消下面的注释，并注释掉上面的方案 A：
--
-- -- 删除外键约束（如果存在）
-- ALTER TABLE content 
--   DROP CONSTRAINT IF EXISTS content_created_by_fkey;
--
-- -- 将 created_by 改为 TEXT
-- ALTER TABLE content 
--   ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;

-- ============================================
-- 说明
-- ============================================
-- 
-- 数据存储逻辑（方案 A）：
-- 
-- ai_usage_logs 表：
--   - 已登录用户：user_id 有值（UUID），visitor_id 为 NULL
--   - 未登录用户：user_id 为 NULL，visitor_id 有值（格式：visitor-{uuid}）
-- 
-- content 表（方案 A）：
--   - 已登录用户：created_by 有值（UUID），visitor_id 为 NULL
--   - 未登录用户：created_by 为 NULL，visitor_id 有值（格式：visitor-{uuid}）
-- 
-- content 表（方案 B）：
--   - 已登录用户：created_by 存储纯 UUID（550e8400-...）
--   - 未登录用户：created_by 存储 visitor_id（visitor-550e8400-...）
--   - 通过格式前缀区分：isVisitorId(created_by) 判断
-- 
-- 查询时：
--   - ai_usage_logs：使用 user_id 或 visitor_id 来关联用户
--   - content（方案 A）：使用 created_by 或 visitor_id 来关联用户
--   - content（方案 B）：created_by 直接存储 visitor_id 或 user_id，通过格式判断
-- 
-- 用户注册后数据合并：
--   - ai_usage_logs：将 visitor_id 更新为 user_id，清除 visitor_id
--   - content（方案 A）：将 visitor_id 更新为 created_by，清除 visitor_id
--   - content（方案 B）：将 created_by 中的 visitor-{uuid} 更新为真实的 user_id
