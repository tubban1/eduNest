#!/usr/bin/env node

/*
  Import HTML pages into `content` table and bind to a collection_list using Supabase.
  Requirements:
  - content_type = 'vue'
  - full_html = complete HTML file content
  - title, description, tags extracted from HTML
  - language_code = 'zh-CN'
  - created_by = fixed UUID
  - knowledge_points = []
  - Dedup/update by short_id stored in HTML <meta name="author" content="short_id">
    * If meta author exists: update that content row, else insert new row and write back meta author with returned short_id
  - After all content stored, bind all to collection_list 16c34498-578c-455f-80f4-c7d28cdd0b62

  See scripts/README.md for usage examples.
*/

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const glob = require('fast-glob');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

// 加载环境变量 - 优先从项目根目录的 .env 文件加载
const projectRoot = path.resolve(__dirname, '../../');
const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const FIXED_CREATED_BY = '1145c642-0fc9-4c85-8f74-c3ef6f413242';
const TARGET_COLLECTION_LIST_ID = '16c34498-578c-455f-80f4-c7d28cdd0b62';
const FIXED_LANGUAGE_CODE = 'zh-CN';
const FIXED_CONTENT_TYPE = 'vue';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { dirs: [], dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') { out.dryRun = true; continue; }
    if (a === '--dirs') { out.dirs = (args[i+1] || '').split(',').map(s => s.trim()).filter(Boolean); i++; continue; }
  }
  if (out.dirs.length === 0) {
    out.dirs = [
      'public/math/*.html',
      'public/temp/*.html'
    ];
  }
  return out;
}

function uniqArray(arr) {
  return Array.from(new Set((arr || []).map(s => (s || '').trim()).filter(Boolean)));
}

async function extractFromHtml(filePath) {
  const raw = await readFile(filePath, 'utf-8');
  const $ = cheerio.load(raw, { decodeEntities: false });

  const title = ($('title').first().text() || $('h1').first().text() || path.basename(filePath, path.extname(filePath))).trim();
  const description = ($('meta[name="description"]').attr('content') || '').trim();

  const keywords = ($('meta[name="keywords"]').attr('content') || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const tags = uniqArray(keywords);

  const knowledge_points = [];
  const full_html = raw.trim();

  const metaAuthor = $('meta[name="author"]').attr('content');
  const currentShortId = (metaAuthor || '').trim();

  return {
    filePath,
    title,
    description,
    tags,
    knowledge_points,
    full_html,
    currentShortId,
    rawHtml: raw,
    $
  };
}

async function upsertContent(supabase, rec) {
  // If short_id exists in HTML -> update that row; else insert new and return short_id
  if (rec.currentShortId) {
    const { data: existing, error: selectError } = await supabase
      .from('content')
      .select('id, short_id')
      .eq('short_id', rec.currentShortId)
      .single();
    
    if (!selectError && existing) {
      const { error: updateError } = await supabase
        .from('content')
        .update({
          title: rec.title,
          description: rec.description,
          tags: rec.tags,
          knowledge_points: rec.knowledge_points,
          full_html: rec.full_html,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      if (updateError) {
        throw new Error(`Update failed: ${updateError.message}`);
      }
      
      return { id: existing.id, short_id: existing.short_id, mode: 'updated' };
    }
  }

  // Insert new row
  const { data: inserted, error: insertError } = await supabase
    .from('content')
    .insert({
      title: rec.title,
      description: rec.description,
      language_code: FIXED_LANGUAGE_CODE,
      tags: rec.tags,
      knowledge_points: rec.knowledge_points,
      full_html: rec.full_html,
      content_type: FIXED_CONTENT_TYPE,
      created_by: FIXED_CREATED_BY
    })
    .select('id, short_id')
    .single();
  
  if (insertError) {
    throw new Error(`Insert failed: ${insertError.message}`);
  }
  
  return { id: inserted.id, short_id: inserted.short_id, mode: 'inserted' };
}

async function writeShortIdToHtml(filePath, rawHtml, $, shortId) {
  const hasHead = $('head').length > 0;
  if (!hasHead) return;

  const authorMeta = $('meta[name="author"]').first();
  if (authorMeta.length > 0) {
    authorMeta.attr('content', shortId);
  } else {
    $('head').append(`\n  <meta name="author" content="${shortId}">`);
  }
  const updated = $.html();
  await writeFile(filePath, updated, 'utf-8');
}

async function bindAllToCollection(supabase, contentIds) {
  if (!contentIds.length) return 0;
  let bound = 0;
  for (const id of contentIds) {
    // Check if exists
    const { data: existing } = await supabase
      .from('user_collections')
      .select('id')
      .eq('content_id', id)
      .eq('list_id', TARGET_COLLECTION_LIST_ID)
      .single();
    
    if (!existing) {
      const { error } = await supabase
        .from('user_collections')
        .insert({
          content_id: id,
          list_id: TARGET_COLLECTION_LIST_ID,
          user_id: FIXED_CREATED_BY
        });
      
      if (!error) {
        bound++;
      } else {
        console.warn(`Failed to bind content ${id}: ${error.message}`);
      }
    }
  }
  return bound;
}

async function main() {
  const args = parseArgs();
  const files = await glob(args.dirs, { dot: false, onlyFiles: true, unique: true });
  if (!files.length) {
    console.log('No files matched.');
    process.exit(0);
  }

  // 初始化 Supabase 客户端
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ 缺少 Supabase 配置！');
    console.error('请在 .env 文件中配置：');
    console.error('  SUPABASE_URL=your_supabase_url');
    console.error('  SUPABASE_SERVICE_KEY=your_service_key');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log(`✅ 已连接到 Supabase: ${supabaseUrl.replace(/\/$/, '')}`);

  const results = [];
  let inserted = 0, updated = 0, skipped = 0;

  try {
    for (const file of files) {
      try {
        const rec = await extractFromHtml(file);

        if (!rec.title || !rec.full_html) {
          console.warn(`[skip] ${file} — missing title/full_html`);
          skipped++;
          continue;
        }

        if (args.dryRun) {
          console.log(JSON.stringify({ file, ...rec, rawHtml: undefined }, null, 2));
          continue;
        }

        const up = await upsertContent(supabase, rec);
        if (up.mode === 'inserted') inserted++; else updated++;
        results.push({ file, id: up.id, short_id: up.short_id, mode: up.mode });
        console.log(`[${up.mode}] ${file} -> short_id: ${up.short_id}`);

        // Write back meta author if needed
        if (!rec.currentShortId) {
          await writeShortIdToHtml(file, rec.rawHtml, rec.$, up.short_id);
        }
      } catch (e) {
        console.error(`[error] ${file}`, e.message);
        skipped++;
      }
    }

    if (!args.dryRun) {
      const ids = results.map(r => r.id);
      const bound = await bindAllToCollection(supabase, ids);
      console.log(`\n✅ Bind to collection_list ${TARGET_COLLECTION_LIST_ID}: ${bound} new relations.`);
    }

    console.log(`\n📊 Done. inserted=${inserted}, updated=${updated}, skipped=${skipped}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

