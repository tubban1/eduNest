-- ============================================
-- 早期用户奖励：给所有现有用户充100积分
-- ============================================
-- 
-- 执行前请先备份数据库
-- 此脚本会：
-- 1. 检查 users 表中的用户（注意：不是 auth.users）
-- 2. 为每个用户发放100积分（change_type = 'early_user'）
-- 3. 避免重复发放（如果已有 'early_user' 类型记录则跳过）
-- 4. 用户可以通过邮件中的链接额外领取50积分（change_type = 'early_user_bonus'）
--
-- 重要提示：
-- - user_credits 表的外键指向 users 表，所以必须从 users 表查询
-- - 如果 auth.users 中有用户但 users 表中没有，需要先执行 sync_auth_users_to_users.sql 同步
-- - 可以使用步骤5的查询检查未同步的用户
--
-- 执行顺序：
-- 1. 如果 auth.users 中有用户但 users 表中没有，先执行 sync_auth_users_to_users.sql
-- 2. 然后执行此脚本发放积分
--
-- 使用方法：
-- 在 Supabase SQL Editor 中执行此脚本
-- 或使用 psql 连接数据库后执行
-- ============================================

-- 1. 检查总用户数（users表）
DO $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users WHERE email IS NOT NULL;
    RAISE NOTICE '总用户数（users表，有邮箱）: %', user_count;
END $$;

-- 2. 发放早期用户奖励（避免重复发放）
-- 只给 users 表中存在且有邮箱的用户发放（因为需要发送邮件通知）
-- 注意：user_credits 表的外键指向 users 表，所以必须从 users 表查询
INSERT INTO user_credits (user_id, change_type, change_amount, created_at)
SELECT 
    u.id as user_id,
    'early_user' as change_type,
    100 as change_amount,
    NOW() as created_at
FROM users u
WHERE u.email IS NOT NULL
  -- 避免重复发放：检查是否已有 'early_user' 类型的积分记录
  AND NOT EXISTS (
    SELECT 1 
    FROM user_credits uc 
    WHERE uc.user_id = u.id 
    AND uc.change_type = 'early_user'
  );

-- 3. 验证发放结果
SELECT 
    COUNT(*) as total_awarded_users,
    SUM(change_amount) as total_credits_awarded
FROM user_credits
WHERE change_type = 'early_user'
AND created_at >= CURRENT_DATE;

-- 4. 查看发放详情（可选，取消注释以查看）
/*
SELECT 
    u.email,
    u.name,
    uc.change_amount,
    uc.created_at,
    (SELECT SUM(change_amount) FROM user_credits WHERE user_id = u.id) as total_credits
FROM user_credits uc
JOIN users u ON u.id = uc.user_id
WHERE uc.change_type = 'early_user'
AND uc.created_at >= CURRENT_DATE
ORDER BY uc.created_at DESC;
*/

-- 5. 检查是否有 auth.users 中的用户未同步到 users 表（可选）
-- 如果发现未同步的用户，需要先同步到 users 表才能发放积分
/*
SELECT 
    au.id,
    au.email,
    au.created_at as auth_created_at,
    CASE 
        WHEN u.id IS NULL THEN '未同步到 users 表'
        ELSE '已同步'
    END as sync_status
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
WHERE au.email IS NOT NULL
ORDER BY au.created_at DESC;
*/
