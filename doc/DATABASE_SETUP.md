CREATE TABLE content_node (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  node_type text NOT NULL,
  -- grade / subject / domain / topic / subtopic / skill / exam_scope

  title text NOT NULL,
  -- 当前语言下展示的标题，如：一元一次方程

  key text,
  -- 规范化跨语言 key，如: linear_equation_1
  -- 同一知识在不同语言/国家可以共用

  parent_id uuid REFERENCES content_node(id) ON DELETE CASCADE,

  path text NOT NULL,
  -- 物化路径，如:
  -- /cn/gb/math/grade7/semester1/algebra/linear_equation_1

  country_code text,
  -- CN / CH / DE / GLOBAL

  curriculum_system text,
  -- 国标 / IB / A-Level / Lehrplan / Shanghai / Hunan

  language_code text,
  -- zh-CN / de-DE / en-GB
  -- ⚠️ 注意：这是“节点语言”，不是 content 语言

  order_index int DEFAULT 0,

  visibility text DEFAULT 'public',
  -- public / hidden / internal

  metadata jsonb,
  -- icon, color, 教学目标, 解锁条件, 年级建议等

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE content_node_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  content_id uuid NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES content_node(id) ON DELETE CASCADE,

  role text NOT NULL,
  -- primary / secondary / exercise / example / extension

  weight int DEFAULT 100,
  -- 推荐权重、排序权重

  created_at timestamptz DEFAULT now(),

  UNIQUE (content_id, node_id, role)
);
