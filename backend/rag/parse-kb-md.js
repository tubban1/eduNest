#!/usr/bin/env node

/**
 * RAG 管道入口：解析《经销商产品培训文档》为知识库条目
 *
 * 说明：
 * - 实际逻辑在 `scripts/parse-kb-md.js` 中，这里只是统一的 RAG 入口包装。
 * - 用法（在 backend 目录）：
 *     node rag/parse-kb-md.js [--db] [--dry-run] [--replace]
 *
 * 这样可以把所有与 RAG 相关的脚本都放在 `rag/` 目录下统一管理，
 * 同时不影响现有脚本路径和实现。
 */

require('../scripts/parse-kb-md.js');

