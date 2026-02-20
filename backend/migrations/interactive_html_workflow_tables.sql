-- Interactive HTML Skill Workflow 相关数据结构
-- 参考：edu/doc/Interactive_HTML_Skill_Workflow.md
-- 执行：在 Supabase SQL Editor 或 psql 中执行本文件

-- ============================================
-- 1. collection_lists 表扩展：添加语言字段
-- ============================================

-- 添加 language_code 字段（单一语言，BCP47 格式）
-- 语言代码格式：BCP47（如 'zh-CN', 'en-US', 'de-DE', 'fr-FR'）
-- NULL 表示未设置或不限语言（多语言列表可用 NULL 或创建多个单语言列表）
ALTER TABLE collection_lists 
ADD COLUMN IF NOT EXISTS language_code TEXT DEFAULT NULL;

-- 添加索引（用于按语言筛选列表）
CREATE INDEX IF NOT EXISTS idx_collection_lists_language_code 
ON collection_lists(language_code) WHERE language_code IS NOT NULL;

-- 添加注释说明
COMMENT ON COLUMN collection_lists.language_code IS '列表的主要语言代码（BCP47格式），如 zh-CN、en-US。NULL 表示未设置或不限语言。如需多语言列表，可创建多个单语言列表或使用 NULL。';

-- 为现有记录设置默认值（可选：根据列表中的 content.language_code 推断）
-- 示例：UPDATE collection_lists cl SET language_code = (
--   SELECT c.language_code FROM user_collections uc
--   JOIN content c ON uc.content_id = c.id
--   WHERE uc.list_id = cl.id AND c.language_code IS NOT NULL
--   LIMIT 1
-- ) WHERE cl.language_code IS NULL;

-- ============================================
-- 2. access_keys 表：密钥管理
-- ============================================

CREATE TABLE IF NOT EXISTS access_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 密钥信息（存储 hash，不存储明文）
  key_hash text NOT NULL UNIQUE,
  -- 密钥原始格式示例：'ABCDE-FGHIJ-KLMNO'（用于显示给用户）
  key_display text,
  
  -- 关联的列表或产品
  list_id uuid REFERENCES collection_lists(id) ON DELETE CASCADE,
  product_id uuid, -- 可选：未来扩展为课程包等产品
  
  -- 设备绑定限制
  max_devices integer DEFAULT 3 NOT NULL CHECK (max_devices > 0),
  
  -- 状态
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'revoked')),
  
  -- 元数据
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text,
  
  -- 约束：list_id 和 product_id 至少有一个
  CONSTRAINT access_keys_list_or_product CHECK (
    (list_id IS NOT NULL AND product_id IS NULL) OR
    (list_id IS NULL AND product_id IS NOT NULL)
  )
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_access_keys_list_id ON access_keys(list_id) WHERE list_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_keys_product_id ON access_keys(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_keys_status ON access_keys(status);
CREATE INDEX IF NOT EXISTS idx_access_keys_key_hash ON access_keys(key_hash);

-- 注释
COMMENT ON TABLE access_keys IS '访问密钥表，用于列表/课程包的密钥解锁机制。每个密钥最多可绑定 max_devices 台设备。';
COMMENT ON COLUMN access_keys.key_hash IS '密钥的哈希值（用于验证，不存储明文）';
COMMENT ON COLUMN access_keys.key_display IS '密钥的显示格式（如 ABCDE-FGHIJ-KLMNO），用于展示给用户';
COMMENT ON COLUMN access_keys.max_devices IS '该密钥最多可绑定的设备数量，默认 3 台';

-- ============================================
-- 3. access_key_devices 表：密钥与设备绑定
-- ============================================

CREATE TABLE IF NOT EXISTS access_key_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联的密钥
  access_key_id uuid NOT NULL REFERENCES access_keys(id) ON DELETE CASCADE,
  
  -- 设备标识（UUID 格式，前端通过 localStorage 持久化）
  -- 推荐复用 visitor_id（格式：visitor-{uuid}），也可单独生成纯 UUID
  -- 前端实现：首次访问时生成 UUID → 存 localStorage → 后续一直使用
  device_id text NOT NULL,
  
  -- 用户标识（可选，已登录时记录）
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  
  -- 激活时间
  activated_at timestamptz DEFAULT now(),
  
  -- 元数据
  user_agent text,
  ip_address text,
  created_at timestamptz DEFAULT now(),
  
  -- 唯一约束：同一密钥在同一设备上只能激活一次
  UNIQUE(access_key_id, device_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_access_key_devices_access_key_id ON access_key_devices(access_key_id);
CREATE INDEX IF NOT EXISTS idx_access_key_devices_device_id ON access_key_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_access_key_devices_user_id ON access_key_devices(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_key_devices_list_device ON access_key_devices(device_id, access_key_id);

-- 注释
COMMENT ON TABLE access_key_devices IS '密钥与设备绑定表，记录哪些设备已激活哪些密钥。设备一旦激活，后续访问该列表无需再次输入密钥。';
COMMENT ON COLUMN access_key_devices.device_id IS '设备唯一标识（UUID 格式）。前端首次访问时生成 UUID 并存储到 localStorage，后续一直使用该 ID。推荐复用 visitor_id（格式：visitor-{uuid}），也可单独生成纯 UUID。';
COMMENT ON COLUMN access_key_devices.user_id IS '用户ID（可选，已登录时记录，用于关联用户与设备）';

-- ============================================
-- 4. 辅助视图：快速查询设备是否已解锁某列表
-- ============================================

CREATE OR REPLACE VIEW list_device_access AS
SELECT DISTINCT
  akd.device_id,
  akd.user_id,
  ak.list_id,
  ak.status AS key_status,
  akd.activated_at,
  ak.max_devices,
  -- 统计该密钥已绑定的设备数
  (SELECT COUNT(*) FROM access_key_devices WHERE access_key_id = ak.id) AS bound_device_count
FROM access_key_devices akd
JOIN access_keys ak ON akd.access_key_id = ak.id
WHERE ak.status = 'active'
  AND ak.list_id IS NOT NULL;

COMMENT ON VIEW list_device_access IS '快速查询视图：设备是否已通过密钥解锁某列表。用于 getCollectionListByShortId 中的访问判定。';

-- ============================================
-- 5. 触发器：自动更新 updated_at
-- ============================================

-- access_keys 表的 updated_at 触发器
CREATE OR REPLACE FUNCTION update_access_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_access_keys_updated_at ON access_keys;
CREATE TRIGGER trigger_update_access_keys_updated_at
  BEFORE UPDATE ON access_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_access_keys_updated_at();

-- ============================================
-- 6. RLS（Row Level Security）策略（可选）
-- ============================================

-- 如果需要启用 RLS，可参考以下策略（根据实际需求调整）

-- ALTER TABLE access_keys ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE access_key_devices ENABLE ROW LEVEL SECURITY;

-- access_keys: 创建者可查看自己创建的密钥
-- CREATE POLICY "Users can view their own access keys"
--   ON access_keys FOR SELECT
--   USING (created_by = auth.uid());

-- access_key_devices: 用户可查看自己设备的绑定记录
-- CREATE POLICY "Users can view their own device bindings"
--   ON access_key_devices FOR SELECT
--   USING (user_id = auth.uid() OR device_id = current_setting('app.device_id', true));

-- ============================================
-- 7. 数据迁移：为现有列表设置默认语言（可选）
-- ============================================

-- 如果现有列表需要根据其内容推断语言，可执行以下查询：
-- UPDATE collection_lists cl
-- SET language_code = (
--   SELECT c.language_code
--   FROM user_collections uc
--   JOIN content c ON uc.content_id = c.id
--   WHERE uc.list_id = cl.id
--     AND c.language_code IS NOT NULL
--   LIMIT 1  -- 取第一个内容的语言作为列表语言
-- )
-- WHERE cl.language_code IS NULL;

-- ============================================
-- 8. access_keys 表扩展：渠道名（可选）
-- ============================================

ALTER TABLE access_keys 
ADD COLUMN IF NOT EXISTS channel_name TEXT;

CREATE INDEX IF NOT EXISTS idx_access_keys_channel_name 
ON access_keys(channel_name) WHERE channel_name IS NOT NULL;

COMMENT ON COLUMN access_keys.channel_name IS '渠道名称，用于按渠道分组密钥（如「线下活动」「合作方 A」）';

-- ============================================
-- 完成
-- ============================================

-- 验证表结构
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'collection_lists' AND column_name = 'language_code') THEN
    RAISE NOTICE '✓ collection_lists.language_code 字段已添加';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'access_keys') THEN
    RAISE NOTICE '✓ access_keys 表已创建';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'access_key_devices') THEN
    RAISE NOTICE '✓ access_key_devices 表已创建';
  END IF;
END $$;
