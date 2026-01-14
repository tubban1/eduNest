-- 迁移脚本：从 ai_usage_logs 创建 ai_conversations
-- 步骤 1：快速创建 conversations（批量执行）
-- 注意：这个脚本只需要执行一次，如果 conversations 已存在会跳过（使用 ON CONFLICT）

-- ============================================
-- 从 ai_usage_logs 提取并创建 conversations
-- ============================================
INSERT INTO ai_conversations (id, user_id, visitor_id, content_id, entry_point, language_code, created_at, updated_at)
SELECT DISTINCT ON (request_id)
  request_id::uuid as id,
  user_id,
  visitor_id,
  content_id,
  'ai_guide'::text as entry_point, -- 默认值
  COALESCE(
    (SELECT language_code FROM content WHERE id = ai_usage_logs.content_id),
    'zh-CN'
  ) as language_code,
  MIN(created_at) as created_at,
  MAX(updated_at) as updated_at
FROM ai_usage_logs
WHERE action_type = 'ai_guide' 
  AND request_id IS NOT NULL
  -- 排除已存在的 conversation（使用 ON CONFLICT 处理）
GROUP BY request_id, user_id, visitor_id, content_id
ON CONFLICT (id) DO NOTHING; -- 如果已存在，跳过

-- ============================================
-- 验证创建结果
-- ============================================
SELECT 
  'Conversations 创建结果' AS check_type,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE user_id IS NOT NULL) AS with_user_id,
  COUNT(*) FILTER (WHERE visitor_id IS NOT NULL) AS with_visitor_id,
  COUNT(*) FILTER (WHERE content_id IS NOT NULL) AS with_content_id,
  COUNT(*) FILTER (WHERE content_id IS NULL) AS null_content_id,
  COUNT(*) FILTER (WHERE created_at IS NOT NULL) AS with_created_at
FROM ai_conversations;

-- ============================================
-- 检查 content_id 为 NULL 的情况
-- ============================================
SELECT 
  '检查 NULL content_id' AS check_type,
  COUNT(*) AS null_content_id_count,
  COUNT(DISTINCT user_id) AS affected_users,
  COUNT(DISTINCT visitor_id) AS affected_visitors
FROM ai_conversations
WHERE content_id IS NULL;

-- ============================================
-- 检查是否有遗漏的 conversations
-- ============================================
SELECT 
  '检查遗漏的 conversations' AS check_type,
  COUNT(*) AS missing_count
FROM (
  SELECT DISTINCT request_id
  FROM ai_usage_logs
  WHERE action_type = 'ai_guide' 
    AND request_id IS NOT NULL
    AND request_id::uuid NOT IN (SELECT id FROM ai_conversations)
) AS missing;
