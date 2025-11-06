#!/usr/bin/env node

/**
 * 数据迁移脚本：将 code_html, code_css, code_js 组合为 full_html
 * 
 * 用法：
 *   node migrate-code-blocks-to-full-html.js [--dry-run] [--limit=N] [--offset=N]
 * 
 * 选项：
 *   --dry-run    只显示会迁移的记录，不实际更新
 *   --limit=N    限制迁移数量（默认：100）
 *   --offset=N   跳过前 N 条记录（默认：0）
 *   --batch-size=N 每批处理的记录数（默认：10）
 */

const { Client } = require('pg');
require('dotenv').config();
const { combineCodeBlocksToFullHTML } = require('../src/utils/htmlCombiner');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    limit: 100,
    offset: 0,
    batchSize: 10
  };

  args.forEach(arg => {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]) || 100;
    } else if (arg.startsWith('--offset=')) {
      options.offset = parseInt(arg.split('=')[1]) || 0;
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1]) || 10;
    }
  });

  return options;
}

async function migrateContent(client, options) {
  console.log(`\n开始迁移...`);
  console.log(`选项:`, options);
  console.log(`查询条件: full_html IS NULL OR full_html = ''`);
  console.log(`  AND (code_html IS NOT NULL AND code_html != '')\n`);

  // 查询需要迁移的记录
  const query = `
    SELECT id, short_id, title, code_html, code_css, code_js, external_links, full_html
    FROM content
    WHERE (full_html IS NULL OR full_html = '')
      AND (code_html IS NOT NULL AND code_html != '')
    ORDER BY created_at ASC
    LIMIT $1 OFFSET $2
  `;

  const result = await client.query(query, [options.limit, options.offset]);

  if (result.rows.length === 0) {
    console.log('没有需要迁移的记录。');
    return { total: 0, success: 0, failed: 0, errors: [] };
  }

  console.log(`找到 ${result.rows.length} 条需要迁移的记录。\n`);

  let successCount = 0;
  let failedCount = 0;
  const errors = [];

  // 分批处理
  for (let i = 0; i < result.rows.length; i += options.batchSize) {
    const batch = result.rows.slice(i, i + options.batchSize);
    console.log(`处理批次 ${Math.floor(i / options.batchSize) + 1} (${batch.length} 条记录)...`);

    for (const row of batch) {
      try {
        // 组合为完整 HTML
        const fullHtml = combineCodeBlocksToFullHTML(
          row.code_html || '',
          row.code_css || '',
          row.code_js || '',
          row.external_links || []
        );

        if (options.dryRun) {
          console.log(`  [DRY RUN] ${row.short_id} (${row.title})`);
          console.log(`    HTML 长度: ${fullHtml.length} 字符`);
        } else {
          // 更新数据库
          const updateQuery = `
            UPDATE content
            SET full_html = $1, updated_at = NOW()
            WHERE id = $2
          `;
          await client.query(updateQuery, [fullHtml, row.id]);
          console.log(`  ✓ ${row.short_id} (${row.title}) - ${fullHtml.length} 字符`);
        }

        successCount++;
      } catch (error) {
        console.error(`  ✗ ${row.short_id} (${row.title}) - 错误: ${error.message}`);
        errors.push({
          id: row.id,
          short_id: row.short_id,
          title: row.title,
          error: error.message
        });
        failedCount++;
      }
    }

    // 批次间短暂延迟，避免数据库压力
    if (i + options.batchSize < result.rows.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return {
    total: result.rows.length,
    success: successCount,
    failed: failedCount,
    errors
  };
}

async function getMigrationStats(client) {
  const statsQuery = `
    SELECT 
      COUNT(*) FILTER (WHERE full_html IS NOT NULL AND full_html != '') as with_full_html,
      COUNT(*) FILTER (WHERE (full_html IS NULL OR full_html = '') AND (code_html IS NOT NULL AND code_html != '')) as needs_migration,
      COUNT(*) FILTER (WHERE (full_html IS NULL OR full_html = '') AND (code_html IS NULL OR code_html = '')) as empty_both,
      COUNT(*) as total
    FROM content
  `;

  const result = await client.query(statsQuery);
  return result.rows[0];
}

async function main() {
  const options = parseArgs();

  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  try {
    await client.connect();
    console.log('数据库连接成功。\n');

    // 显示迁移统计
    const stats = await getMigrationStats(client);
    console.log('当前数据库状态:');
    console.log(`  总记录数: ${stats.total}`);
    console.log(`  已有 full_html: ${stats.with_full_html}`);
    console.log(`  需要迁移: ${stats.needs_migration}`);
    console.log(`  两者皆空: ${stats.empty_both}`);

    if (options.dryRun) {
      console.log('\n[DRY RUN 模式 - 不会实际更新数据库]');
    }

    // 执行迁移
    const result = await migrateContent(client, options);

    // 显示结果
    console.log('\n迁移完成:');
    console.log(`  总计: ${result.total}`);
    console.log(`  成功: ${result.success}`);
    console.log(`  失败: ${result.failed}`);

    if (result.errors.length > 0) {
      console.log('\n错误详情:');
      result.errors.forEach(err => {
        console.log(`  - ${err.short_id} (${err.title}): ${err.error}`);
      });
    }

    // 再次显示统计
    if (!options.dryRun && result.success > 0) {
      console.log('\n更新后的数据库状态:');
      const newStats = await getMigrationStats(client);
      console.log(`  已有 full_html: ${newStats.with_full_html}`);
      console.log(`  需要迁移: ${newStats.needs_migration}`);
    }

  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error('未处理的错误:', error);
  process.exit(1);
});

