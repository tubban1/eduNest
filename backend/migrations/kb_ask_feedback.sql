-- Phase 3 反馈（有用/无用）：便于后续优化检索与知识库
-- 执行：在 Supabase SQL Editor 或 psql 中运行

CREATE TABLE IF NOT EXISTS kb_ask_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  helpful BOOLEAN NOT NULL,
  source_type TEXT,                    -- 'static' | 'exact' | 'vector'
  entry_id UUID REFERENCES kb_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_ask_feedback_created_at ON kb_ask_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_kb_ask_feedback_helpful ON kb_ask_feedback(helpful);
CREATE INDEX IF NOT EXISTS idx_kb_ask_feedback_source_type ON kb_ask_feedback(source_type);

COMMENT ON TABLE kb_ask_feedback IS '问一问回答反馈（有用/无用），用于统计与优化';
