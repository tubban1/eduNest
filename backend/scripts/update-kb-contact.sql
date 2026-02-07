-- 将 kb_entries 中所有邮箱统一为 info@tubban.com，并添加 WhatsApp 联系电话
-- 在 Supabase SQL Editor 中执行

-- 1. 替换所有 support/sales/tech@edunest.com → info@tubban.com
UPDATE kb_entries
SET
  title   = REPLACE(REPLACE(REPLACE(COALESCE(title,''),   'support@edunest.com','info@tubban.com'), 'sales@edunest.com','info@tubban.com'), 'tech@edunest.com','info@tubban.com'),
  content = REPLACE(REPLACE(REPLACE(COALESCE(content,''), 'support@edunest.com','info@tubban.com'), 'sales@edunest.com','info@tubban.com'), 'tech@edunest.com','info@tubban.com'),
  question= REPLACE(REPLACE(REPLACE(COALESCE(question,''),'support@edunest.com','info@tubban.com'), 'sales@edunest.com','info@tubban.com'), 'tech@edunest.com','info@tubban.com'),
  answer  = REPLACE(REPLACE(REPLACE(COALESCE(answer,''),  'support@edunest.com','info@tubban.com'), 'sales@edunest.com','info@tubban.com'), 'tech@edunest.com','info@tubban.com')
WHERE title LIKE '%edunest.com%' OR content LIKE '%edunest.com%' OR question LIKE '%edunest.com%' OR answer LIKE '%edunest.com%';

-- 2. 联系方式类条目：合并重复的 info@tubban.com 并添加 WhatsApp
UPDATE kb_entries
SET
  content = REPLACE(REPLACE(content,
    '客服邮箱：info@tubban.com；销售咨询：info@tubban.com；技术支持：info@tubban.com',
    '邮箱：info@tubban.com，联系电话 WhatsApp +41 78 889 3391'),
    '客服：info@tubban.com；销售：info@tubban.com；技术支持：info@tubban.com',
    '邮箱：info@tubban.com，联系电话 WhatsApp +41 78 889 3391'),
  answer = REPLACE(REPLACE(answer,
    '客服邮箱：info@tubban.com；销售咨询：info@tubban.com；技术支持：info@tubban.com。',
    '邮箱：info@tubban.com，联系电话 WhatsApp +41 78 889 3391。'),
    '客服邮箱：info@tubban.com；销售咨询：info@tubban.com；技术支持：info@tubban.com',
    '邮箱：info@tubban.com，联系电话 WhatsApp +41 78 889 3391')
WHERE content LIKE '%info@tubban.com%info@tubban.com%' OR answer LIKE '%info@tubban.com%info@tubban.com%';
