## RAG 工具脚本（backend/rag）

这个目录用于集中管理与知识库 / 向量检索（RAG）相关的脚本。

### 1. 主要脚本

- `parse-kb-md.js`  
  - 作用：解析《经销商产品培训文档.md》为 `kb_entries` 条目。  
  - 用法（在 `backend` 目录）：
    - 仅解析并写入 JSON：  
      `node rag/parse-kb-md.js`
    - 解析并写入 Supabase：  
      `node rag/parse-kb-md.js --db`
    - 重跑并覆盖 zh-CN 条目：  
      `node rag/parse-kb-md.js --db --replace`

- `seed-kb-supplement.js`  
  - 作用：写入运营补充的 QA（退款、发票、「这是什么」「怎么用」等）。  
  - 用法：`node rag/seed-kb-supplement.js --db`

- `sync-kb-embeddings.js`  
  - 作用：为 `kb_entries` 中 `embedding IS NULL` 的记录生成向量。  
  - 用法：
    - 只看待处理条数：`node rag/sync-kb-embeddings.js --dry-run`
    - 实际写入：`node rag/sync-kb-embeddings.js --limit=100`

- `status.js`  
  - 作用：按 `source` 查看当前库中各来源条目数量与 embedding 完成情况。  
  - 用法：`node rag/status.js`

- `add-qa-batch.js`  
  - 作用：从 JSON 文件批量导入 QA 条目到 `kb_entries`。  
  - 用法：
    - 预览（不写入，会检查是否已存在）：`node rag/add-qa-batch.js qa-batch.json`
    - 实际写入（自动跳过已存在的）：`node rag/add-qa-batch.js qa-batch.json --db`
  - JSON 格式：参考 `qa-batch-template.json` 模板
  - 特性：导入前自动检查哪些问题已存在，只插入新问题

- `check-qa.js`  
  - 作用：检查单个问题或批量检查 JSON 文件中的问题是否已在数据库中存在。  
  - 用法：
    - 检查单个问题：`node rag/check-qa.js "如何使用 AI 生成功能？"`
    - 批量检查文件：`node rag/check-qa.js qa-batch.json`
    - 模糊匹配：`node rag/check-qa.js "AI生成" --fuzzy`

### 2. 典型流水线

1. 从培训文档解析并落库：

```bash
cd edu/backend
node rag/parse-kb-md.js --db --replace
```

2. 写入运营补充 QA：

```bash
node rag/seed-kb-supplement.js --db
```

3. 生成 / 补全 embedding：

```bash
node rag/sync-kb-embeddings.js --limit=200
```

4. 查看当前各来源与 embedding 状态：

```bash
node rag/status.js
```

5. 批量导入自定义 QA（如 100 条）：

```bash
# 1. 编辑 qa-batch.json（参考 qa-batch-template.json）

# 2. 检查哪些问题已存在（可选）
node rag/check-qa.js qa-batch.json

# 3. 预览（验证格式 + 检查重复）
node rag/add-qa-batch.js qa-batch.json

# 4. 实际写入（自动跳过已存在的）
node rag/add-qa-batch.js qa-batch.json --db

# 5. 生成 embedding
node rag/sync-kb-embeddings.js --limit=100
```

