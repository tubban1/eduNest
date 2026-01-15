-- ============================================
-- 同步 auth.users 到 users 表
-- ============================================
-- 
-- 此脚本将 auth.users 中不存在于 users 表的用户同步到 users 表
-- 执行此脚本后，再执行 award_early_user_credits.sql 即可给所有用户发放积分
--
-- 使用方法：
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 检查需要同步的用户数量
DO $$
DECLARE
    unsynced_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unsynced_count
    FROM auth.users au
    LEFT JOIN users u ON u.id = au.id
    WHERE u.id IS NULL
    AND au.email IS NOT NULL;
    
    RAISE NOTICE '需要同步的用户数: %', unsynced_count;
END $$;

-- 2. 同步用户（从 auth.users 插入到 users 表）
INSERT INTO users (id, email, name, role, created_at)
SELECT 
    au.id,
    au.email,
    COALESCE(
        au.raw_user_meta_data->>'name',
        au.raw_user_meta_data->>'full_name',
        SPLIT_PART(au.email, '@', 1),
        'User'
    ) as name,
    COALESCE(
        au.raw_user_meta_data->>'role',
        'user'
    ) as role,
    au.created_at
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
WHERE u.id IS NULL  -- 只同步不存在的用户
AND au.email IS NOT NULL  -- 只同步有邮箱的用户
ON CONFLICT (id) DO NOTHING;  -- 如果冲突（并发插入），忽略

-- 3. 验证同步结果
SELECT 
    COUNT(*) as total_synced_users,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as synced_today
FROM users;

-- 4. 查看同步的用户详情（可选）
/*
SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    u.created_at
FROM users u
WHERE u.created_at >= CURRENT_DATE
ORDER BY u.created_at DESC;
*/
