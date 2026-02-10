#!/usr/bin/env node

/**
 * RAG 管道入口：为 kb_entries 生成 embedding
 *
 * 说明：
 * - 实际逻辑在 `scripts/sync-kb-embeddings.js` 中，这里只是统一的 RAG 入口包装。
 * - 用法（在 backend 目录）：
 *     node rag/sync-kb-embeddings.js [--dry-run] [--limit=N]
 *
 * 统一入口后，所有 RAG 相关的脚本都可以从 `rag/` 目录调用。
 */

require('../scripts/sync-kb-embeddings.js');

