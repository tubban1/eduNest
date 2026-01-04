-- 迁移脚本：为 ai_usage_logs 表添加 image_url 字段
-- 用于存储上传到 freeimage.host 后的图片 URL

-- 1. 检查字段是否已存在（可选，如果字段已存在会报错）
-- 如果字段已存在，可以跳过此迁移

-- 2. 添加 image_url 字段
ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 3. 添加注释（可选）
COMMENT ON COLUMN ai_usage_logs.image_url IS '图片URL，上传到freeimage.host后返回的URL';

-- 4. 如果需要创建索引（如果将来需要根据image_url查询）
-- CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_image_url ON ai_usage_logs(image_url) WHERE image_url IS NOT NULL;

-- 验证：查询字段是否添加成功
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'ai_usage_logs' AND column_name = 'image_url';

