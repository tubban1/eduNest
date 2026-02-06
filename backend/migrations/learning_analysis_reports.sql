-- 学习分析报告表（与 Interactive_Learning.md、Learning_Analysis_Report_Example.md 对齐）
-- 执行：在 Supabase SQL Editor 或 psql 中执行本文件

CREATE TABLE IF NOT EXISTS learning_analysis_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  report_type text NOT NULL,
  report_period_start timestamptz,
  report_period_end timestamptz,

  report_data jsonb NOT NULL,

  generated_at timestamptz DEFAULT now(),
  generated_by text DEFAULT 'system',

  UNIQUE(user_id, report_type, report_period_start)
);

CREATE INDEX IF NOT EXISTS idx_learning_analysis_reports_user
  ON learning_analysis_reports (user_id, generated_at DESC);

COMMENT ON TABLE learning_analysis_reports IS 'AI Guide 学习分析报表，数据来源 ai_messages.metadata、ai_usage_logs.request_payload';
