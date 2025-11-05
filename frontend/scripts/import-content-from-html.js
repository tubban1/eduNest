#!/usr/bin/env node

/*
  Import HTML pages into `content` table and bind to a collection_list.
  Requirements:
  - content_type = 'vue'
  - code_html = only the <body> innerHTML
  - external_links = only script[src^http] and link[href^http]
  - knowledge_points = []
  - created_by = fixed UUID
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
const { Client } = require('pg');
require('dotenv').config();

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const FIXED_CREATED_BY = '1145c642-0fc9-4c85-8f74-c3ef6f413242';
const TARGET_COLLECTION_LIST_ID = '16c34498-578c-455f-80f4-c7d28cdd0b62';

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
      'edu/frontend/public/math/*.html',
      'edu/frontend/public/temp/*.html'
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

  // Basic fields
  const title = ($('title').first().text() || $('h1').first().text() || path.basename(filePath, path.extname(filePath))).trim();
  const description = ($('meta[name="description"]').attr('content') || '').trim();
  const language_code = ($('html').attr('lang') || 'zh-CN').trim();

  const keywords = ($('meta[name="keywords"]').attr('content') || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const tags = uniqArray(keywords);

  // Knowledge points as empty per requirement
  const knowledge_points = [];

  // External links: only script/link absolute http(s)
  const scriptLinks = $('script[src^="http"],script[src^="https"]').map((_, el) => $(el).attr('src')).get();
  const cssLinks = $('link[rel="stylesheet"][href^="http"],link[rel="stylesheet"][href^="https"]').map((_, el) => $(el).attr('href')).get();
  const external_links = uniqArray([...scriptLinks, ...cssLinks]);

  // code_html: body innerHTML only
  const bodyInner = $('body').html() || '';
  const code_html = bodyInner.trim();

  // Merge <style> and inline <script> (no src) contents
  const code_css = $('style').map((_, el) => $(el).html() || '').get().join('\n\n').trim();
  const code_js = $('script:not([src])').map((_, el) => $(el).html() || '').get().join('\n\n').trim();

  // content_type
  const content_type = 'vue';

  // meta author as short_id holder
  const metaAuthor = $('meta[name="author"]').attr('content');
  const currentShortId = (metaAuthor || '').trim();

  return {
    filePath,
    title,
    description,
    language_code,
    tags,
    knowledge_points,
    external_links,
    code_html,
    code_css,
    code_js,
    content_type,
    currentShortId,
    rawHtml: raw,
    $
  };
}

async function upsertContent(client, rec) {
  // If short_id exists in HTML -> update that row; else insert new and return short_id
  if (rec.currentShortId) {
    // Check if exists
    const sel = await client.query('SELECT id, short_id FROM content WHERE short_id = $1', [rec.currentShortId]);
    if (sel.rowCount > 0) {
      const row = sel.rows[0];
      await client.query(
        `UPDATE content
         SET title = $2, description = $3, language_code = $4,
             tags = $5, knowledge_points = $6, external_links = $7,
             code_html = $8, code_css = $9, code_js = $10,
             content_type = $11, updated_at = now()
         WHERE id = $1`,
        [row.id, rec.title, rec.description, rec.language_code,
         rec.tags, rec.knowledge_points, rec.external_links,
         rec.code_html, rec.code_css, rec.code_js,
         rec.content_type]
      );
      return { id: row.id, short_id: row.short_id, mode: 'updated' };
    }
  }

  // Insert new row
  const ins = await client.query(
    `INSERT INTO content (
       title, description, language_code, tags, knowledge_points,
       external_links, code_html, code_css, code_js, content_type,
       created_by
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
     ) RETURNING id, short_id`,
    [rec.title, rec.description, rec.language_code, rec.tags, rec.knowledge_points,
     rec.external_links, rec.code_html, rec.code_css, rec.code_js, rec.content_type,
     FIXED_CREATED_BY]
  );
  return { id: ins.rows[0].id, short_id: ins.rows[0].short_id, mode: 'inserted' };
}

async function writeShortIdToHtml(filePath, rawHtml, $, shortId) {
  // Ensure <meta name="author" content="short_id"> exists in <head>
  const hasHead = $('head').length > 0;
  if (!hasHead) return; // refuse to mutate broken docs

  const authorMeta = $('meta[name="author"]').first();
  if (authorMeta.length > 0) {
    authorMeta.attr('content', shortId);
  } else {
    $('head').append(`\n  <meta name="author" content="${shortId}">`);
  }
  const updated = $.html();
  await writeFile(filePath, updated, 'utf-8');
}

async function bindAllToCollection(client, contentIds) {
  if (!contentIds.length) return 0;
  let bound = 0;
  for (const id of contentIds) {
    // Insert if not exists
    const exists = await client.query(
      'SELECT 1 FROM user_collections WHERE content_id = $1 AND list_id = $2 LIMIT 1',
      [id, TARGET_COLLECTION_LIST_ID]
    );
    if (exists.rowCount === 0) {
      await client.query(
        'INSERT INTO user_collections (content_id, list_id) VALUES ($1, $2)',
        [id, TARGET_COLLECTION_LIST_ID]
      );
      bound++;
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

  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  await client.connect();

  const results = [];
  let inserted = 0, updated = 0, skipped = 0;

  try {
    for (const file of files) {
      try {
        const rec = await extractFromHtml(file);

        if (!rec.title || !rec.code_html) {
          console.warn(`[skip] ${file} — missing title/code_html`);
          skipped++;
          continue;
        }

        if (args.dryRun) {
          console.log(JSON.stringify({ file, ...rec, rawHtml: undefined }, null, 2));
          continue;
        }

        const up = await upsertContent(client, rec);
        if (up.mode === 'inserted') inserted++; else updated++;
        results.push({ file, id: up.id, short_id: up.short_id, mode: up.mode });

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
      // Bind all content to the given collection_list
      const ids = results.map(r => r.id);
      const bound = await bindAllToCollection(client, ids);
      console.log(`Bind to collection_list ${TARGET_COLLECTION_LIST_ID}: ${bound} new relations.`);
    }

    console.log(`Done. inserted=${inserted}, updated=${updated}, skipped=${skipped}`);
  } finally {
    await client.end();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
