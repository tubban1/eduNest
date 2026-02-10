#!/usr/bin/env node

/**
 * RAG 管道入口：补充运营维护的知识库条目
 *
 * 说明：
 * - 实际逻辑在 `scripts/seed-kb-supplement.js` 中，这里只是统一的 RAG 入口包装。
 * - 用法（在 backend 目录）：
 *     node rag/seed-kb-supplement.js [--db]
 *
 * 将与 RAG 相关的脚本统一收拢到 `rag/` 目录，便于记忆与维护。
 */

require('../scripts/seed-kb-supplement.js');

