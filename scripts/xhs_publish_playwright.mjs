#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STORAGE_STATE = process.env.XHS_STORAGE_STATE || path.join(ROOT, '.xhs.storage.json');
const DEFAULT_URL = process.env.XHS_CREATOR_URL || 'https://creator.xiaohongshu.com/publish/publish';
const DEBUG_DIR = path.join(ROOT, 'logs', 'xhs-debug');
const MANUAL_SWITCH = process.env.XHS_MANUAL_SWITCH === '1';
const REQUIRE_TITLE = process.env.XHS_REQUIRE_TITLE === '1';
const SAVE_DRAFT = process.env.XHS_SAVE_DRAFT === '1';
const STRICT_VERIFY = process.env.XHS_STRICT_VERIFY !== '0'; // default on for automation

function parseArgs(argv) {
  const args = { login: false, file: '' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--login') args.login = true;
    if (a === '--file' && argv[i + 1]) {
      args.file = argv[i + 1];
      i++;
    }
  }
  return args;
}

function parseDraft(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  let title = '';
  const body = [];
  for (const line of lines) {
    if (!title && line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').trim();
      continue;
    }
    if (!title && /^Title:/i.test(line)) {
      title = line.replace(/^Title:\s*/i, '').trim();
      continue;
    }
    body.push(line);
  }
  if (!title) {
    title = `AI教育分享 ${new Date().toISOString().slice(0, 10)}`;
  }
  return { title, content: body.join('\n').trim() };
}

function isoTsSafe() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function waitEnter(promptText) {
  process.stdout.write(`${promptText}\n按回车继续... `);
  await new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', () => resolve());
  });
}

async function loginAndSave() {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://creator.xiaohongshu.com', { waitUntil: 'domcontentloaded' });
  await waitEnter('请在打开的页面完成登录（扫码/账号登录均可）。');
  await context.storageState({ path: STORAGE_STATE });
  await browser.close();
  console.log(`登录态已保存: ${STORAGE_STATE}`);
}

async function tryFill(page, selectors, value) {
  const frames = page.frames();
  for (const frame of frames) {
    for (const s of selectors) {
      const el = frame.locator(s).first();
      if (await el.count()) {
        await el.click({ timeout: 2500 }).catch(() => {});
        try {
          await el.fill(value);
          return true;
        } catch {
          const handle = await el.elementHandle();
          if (handle) {
            await frame.evaluate(
              ({ node, text }) => {
                const tag = node.tagName?.toLowerCase();
                if (tag === 'textarea' || tag === 'input') {
                  node.value = text;
                  node.dispatchEvent(new Event('input', { bubbles: true }));
                  node.dispatchEvent(new Event('change', { bubbles: true }));
                  return;
                }
                node.focus();
                node.textContent = text;
                node.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
              },
              { node: handle, text: value }
            );
            return true;
          }
        }
      }
    }
  }
  return false;
}

async function clickFirstVisible(page, selectors) {
  for (const s of selectors) {
    const el = page.locator(s).first();
    if (await el.count()) {
      await el.click({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(600);
      return true;
    }
  }
  return false;
}

async function forceClickText(page, text) {
  return page.evaluate((t) => {
    const nodes = Array.from(document.querySelectorAll('a,button,div,span,li'));
    const hit = nodes.find((n) => {
      const s = (n.textContent || '').trim();
      if (!s || !s.includes(t)) return false;
      const rect = n.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (!hit) return false;
    hit.click();
    return true;
  }, text).catch(() => false);
}

async function clickTopUploadGraphicTab(page) {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('a,button,div,span,li'));
    const candidates = nodes.filter((n) => {
      const t = (n.textContent || '').trim();
      if (t !== '上传图文') return false;
      const r = n.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      // Top main tab area, avoid left dropdown items.
      return r.top >= 140 && r.top <= 250 && r.left >= 230;
    });
    if (!candidates.length) return false;
    candidates.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    candidates[0].click();
    return true;
  }).catch(() => false);
}

async function hasNoteEditor(page) {
  const frames = page.frames();
  const selectors = [
    'input[placeholder*="标题"]',
    'textarea[placeholder*="标题"]',
    '[contenteditable="true"][data-placeholder*="标题"]',
    '[contenteditable="true"][placeholder*="标题"]',
    'textarea[placeholder*="正文"]',
    'textarea[placeholder*="写点什么"]',
    '[role="textbox"]',
    '[contenteditable="true"]',
  ];
  for (const frame of frames) {
    for (const s of selectors) {
      if (await frame.locator(s).count()) return true;
    }
  }
  return false;
}

async function dismissCommonPopups(page) {
  await clickFirstVisible(page, [
    'button:has-text("屏蔽")',
    'button:has-text("拒绝")',
    'button:has-text("稍后")',
    'button:has-text("以后再说")',
    'button:has-text("知道了")',
    'button:has-text("我知道了")',
    '[aria-label="关闭"]',
  ]);
  await page.keyboard.press('Escape').catch(() => {});
}

async function ensureNoteMode(page) {
  // Some accounts land on video publish. Keep trying until note editor appears.
  for (let i = 0; i < 45; i++) {
    if (await hasNoteEditor(page)) return true;
    if (i === 0) {
      console.log('正在尝试进入图文编辑器。如果有浏览器权限弹窗，请先手动点击“屏蔽”。');
    }
    if (i % 5 === 0) {
      console.log(`切换图文尝试中... (${i + 1}/45)`);
    }

    await dismissCommonPopups(page);
    const openMenu = await clickFirstVisible(page, [
      'button:has-text("发布笔记")',
      'a:has-text("发布笔记")',
      '[role="menuitem"]:has-text("发布笔记")',
      '.publish-tab:has-text("发布笔记")',
      'text=发布笔记',
    ]);
    if (!openMenu) {
      await forceClickText(page, '发布笔记');
    }

    // Must click top tab next to "上传视频".
    let switched = await clickTopUploadGraphicTab(page);
    if (!switched) {
      switched = await clickFirstVisible(page, [
        'li:has-text("上传图文")',
        'a:has-text("上传图文")',
        'button:has-text("上传图文")',
      ]);
    }
    if (!switched) {
      switched = await forceClickText(page, '上传图文');
    }
    if (switched) {
      console.log('已点击“上传图文”');
    }

    await clickFirstVisible(page, [
      'button:has-text("图文")',
      'a:has-text("图文")',
      'button:has-text("写图文")',
      'button:has-text("普通笔记")',
      'text=图文',
    ]);

    // If still on video page, refresh route once in case of SPA navigation glitch.
    if (i === 10 || i === 25) {
      await page.goto(DEFAULT_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
    }
    await page.waitForTimeout(1000);
  }
  return false;
}

async function fallbackFillEditors(page, title, content) {
  const frames = page.frames();
  let titleOK = false;
  let contentOK = false;
  let titleY = null;

  const fillElement = async (frame, el, text) => {
    await el.click({ timeout: 2000 }).catch(() => {});
    try {
      await el.fill(text);
      return true;
    } catch {
      const h = await el.elementHandle();
      if (!h) return false;
      await frame.evaluate(
        ({ node, value }) => {
          const tag = node.tagName?.toLowerCase();
          if (tag === 'input' || tag === 'textarea') {
            node.value = value;
            node.dispatchEvent(new Event('input', { bubbles: true }));
            node.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            node.focus();
            node.textContent = value;
            node.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
          }
        },
        { node: h, value: text }
      );
      return true;
    }
  };

  for (const frame of frames) {
    const all = frame.locator('input, textarea, [contenteditable="true"], [role="textbox"]');
    const n = await all.count();
    const candidates = [];
    for (let i = 0; i < n; i++) {
      const item = all.nth(i);
      const h = await item.elementHandle();
      if (!h) continue;
      const box = await h.boundingBox();
      if (!box) continue;
      if (box.width < 80 || box.height < 16) continue;
      candidates.push({ item, box });
    }

    if (!titleOK) {
      const titleCandidate = candidates
        .filter(({ box }) => box.y < 430 && box.height <= 90 && box.width > 220)
        .sort((a, b) => a.box.y - b.box.y)[0];
      if (titleCandidate) {
        titleOK = await fillElement(frame, titleCandidate.item, title);
        titleY = titleCandidate.box.y;
      }
    }

    if (!contentOK) {
      const contentCandidate = candidates
        .filter(({ box }) => box.height >= 90 && box.width > 300 && (titleY == null || box.y >= titleY))
        .sort((a, b) => b.box.height - a.box.height)[0];
      if (contentCandidate) {
        contentOK = await fillElement(frame, contentCandidate.item, content);
      }
    }

    if (titleOK && contentOK) {
      break;
    }
  }
  return { titleOK, contentOK };
}

async function dumpDebug(page) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  const ts = isoTsSafe();
  const shot = path.join(DEBUG_DIR, `xhs-${ts}.png`);
  const html = path.join(DEBUG_DIR, `xhs-${ts}.html`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  fs.writeFileSync(html, await page.content(), 'utf8');
  console.log(`debug saved: ${shot}`);
  console.log(`debug saved: ${html}`);
}

async function recordIncident(page, stage, extra = {}) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  const ts = isoTsSafe();
  const shot = path.join(DEBUG_DIR, `incident-${stage}-${ts}.png`);
  const html = path.join(DEBUG_DIR, `incident-${stage}-${ts}.html`);
  const json = path.join(DEBUG_DIR, `incident-${stage}-${ts}.json`);

  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  fs.writeFileSync(html, await page.content().catch(() => ''), 'utf8');
  fs.writeFileSync(
    json,
    JSON.stringify(
      {
        ts: new Date().toISOString(),
        stage,
        url: page.url(),
        extra,
        artifacts: { screenshot: shot, html }
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`incident saved: ${shot}`);
  console.log(`incident saved: ${html}`);
  console.log(`incident saved: ${json}`);
  return { shot, html, json };
}

async function waitForToastOrStateChange(page, opts) {
  const { saveDraft, timeoutMs = 20000 } = opts;

  // Prefer deterministic UI/DOM signals. These are heuristics; extend as needed.
  const okTexts = saveDraft
    ? ['保存成功', '已保存', '草稿已保存', '已存入草稿', '保存到草稿']
    : ['发布成功', '已发布', '发布完成', '发布成功啦', '发布成功啦', '发布成功！', '发布成功!'];

  const toastCandidates = [
    '[role="alert"]',
    '[aria-live="polite"]',
    '[aria-live="assertive"]',
    '.Toast',
    '.toast',
    '.snackbar',
  ];

  const startUrl = page.url();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // URL change sometimes indicates navigation/submit success.
    if (page.url() !== startUrl) return { ok: true, signal: 'url_changed' };

    // Look for any success text on page.
    for (const t of okTexts) {
      const loc = page.locator(`text=${t}`).first();
      if (await loc.count()) {
        const visible = await loc.isVisible().catch(() => false);
        if (visible) return { ok: true, signal: `text:${t}` };
      }
    }

    // Look for toast containers containing success text.
    for (const sel of toastCandidates) {
      const toast = page.locator(sel).first();
      if (await toast.count()) {
        const txt = (await toast.innerText().catch(() => '')).trim();
        if (txt) {
          if (okTexts.some((t) => txt.includes(t))) return { ok: true, signal: `toast:${sel}` };
        }
      }
    }

    await page.waitForTimeout(500);
  }

  return { ok: false, signal: 'timeout_no_success_signal' };
}

async function publishWithState(file) {
  if (!fs.existsSync(STORAGE_STATE)) {
    throw new Error(`缺少登录态文件: ${STORAGE_STATE}，请先运行: node scripts/xhs_publish_playwright.mjs --login`);
  }
  const { title, content } = parseDraft(file);

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await context.newPage();

  await page.goto(DEFAULT_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  console.log(`已打开发布页: ${page.url()}`);
  let noteReady = false;
  if (MANUAL_SWITCH) {
    console.log('手动切页模式已开启：请你手动点击顶部“上传图文”，我只负责填充并发布。');
    for (let i = 0; i < 180; i++) {
      if (await hasNoteEditor(page)) {
        noteReady = true;
        break;
      }
      if (i % 15 === 0) {
        console.log(`等待你切到图文编辑器... (${Math.floor(i / 2)}s)`);
      }
      await page.waitForTimeout(500);
    }
  } else {
    if (page.url().includes('target=video')) {
      console.log('检测到视频发布页，优先切换到“上传图文”...');
      for (let k = 0; k < 3; k++) {
        await clickFirstVisible(page, ['text=发布笔记', 'button:has-text("发布笔记")']);
        await page.waitForTimeout(300);
        await clickTopUploadGraphicTab(page);
        await clickFirstVisible(page, ['li:has-text("上传图文")', 'a:has-text("上传图文")', 'button:has-text("上传图文")']);
        await clickTopUploadGraphicTab(page);
        await page.waitForTimeout(600);
        if (await hasNoteEditor(page)) break;
      }
    }
    noteReady = await ensureNoteMode(page);
  }

  if (!noteReady) {
    throw new Error('未能进入图文编辑器。请先在弹窗中点“屏蔽”，并切到顶部“上传图文”后重试。');
  }
  console.log('已进入图文编辑器，开始填充内容...');

  const titleOK = await tryFill(page, [
    'input[placeholder*="标题"]',
    'textarea[placeholder*="标题"]',
    'input[placeholder*="填写标题"]',
    '[contenteditable="true"][data-placeholder*="标题"]',
    '[contenteditable="true"][placeholder*="标题"]',
    '[role="textbox"][aria-label*="标题"]',
  ], title);

  let contentOK = await tryFill(page, [
    'textarea[placeholder*="正文"]',
    'textarea[placeholder*="输入正文"]',
    'textarea[placeholder*="写点什么"]',
    '[contenteditable="true"][data-placeholder*="正文"]',
    '[contenteditable="true"][placeholder*="正文"]',
    '[contenteditable="true"][data-placeholder*="写点什么"]',
    '[contenteditable="true"][placeholder*="写点什么"]',
    '[role="textbox"][aria-label*="正文"]',
    '[role="textbox"]',
    '[contenteditable="true"]',
  ], content);

  let finalTitleOK = titleOK;
  let finalContentOK = contentOK;
  if (!titleOK || !contentOK) {
    const fallback = await fallbackFillEditors(page, title, content);
    finalTitleOK = titleOK || fallback.titleOK;
    finalContentOK = contentOK || fallback.contentOK;
  }
  console.log(`fill status: title=${finalTitleOK} content=${finalContentOK}`);

  const imagePaths = (process.env.XHS_IMAGE_PATHS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => path.resolve(ROOT, p));

  if (imagePaths.length > 0) {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count()) {
      await fileInput.setInputFiles(imagePaths);
      await page.waitForTimeout(2000);
    }
  }

  if (!finalContentOK || (REQUIRE_TITLE && !finalTitleOK)) {
    await dumpDebug(page);
    console.log('未完全匹配到编辑器控件，已打开发布页并保留填充结果。请手动检查后发布。');
    await waitEnter('检查完成后可手动发布，或关闭浏览器结束。');
    await browser.close();
    return;
  }

  if (!finalTitleOK && finalContentOK) {
    console.log('未检测到独立标题框，按“写文字”模式继续发布。');
  }

  if (process.env.XHS_AUTO_CONFIRM === '1') {
    const actionBtn = SAVE_DRAFT
      ? page.locator('button:has-text("保存草稿"), button:has-text("存草稿"), button:has-text("草稿")').first()
      : page.locator('button:has-text("发布"), button:has-text("立即发布"), button:has-text("发布笔记")').first();
    if (await actionBtn.count()) {
      // Reduce "element is outside of the viewport" and overlay flakiness.
      await actionBtn.scrollIntoViewIfNeeded().catch(() => {});
      await recordIncident(page, SAVE_DRAFT ? 'before_save_draft' : 'before_publish', {
        strict_verify: STRICT_VERIFY,
      });

      await actionBtn.click({ timeout: 8000 }).catch(async (e) => {
        await recordIncident(page, SAVE_DRAFT ? 'click_save_draft_failed' : 'click_publish_failed', {
          error: String(e?.message || e),
        });
        throw e;
      });

      // Post-check: wait for deterministic signals that submit actually happened.
      const verify = await waitForToastOrStateChange(page, { saveDraft: SAVE_DRAFT, timeoutMs: 25000 });
      if (!verify.ok) {
        await recordIncident(page, SAVE_DRAFT ? 'verify_save_draft_failed' : 'verify_publish_failed', {
          verify,
          strict_verify: STRICT_VERIFY,
        });
        const msg = SAVE_DRAFT
          ? '已点击“保存草稿”，但未观察到保存成功信号（toast/跳转）。'
          : '已点击发布，但未观察到发布成功信号（toast/跳转）。';
        if (STRICT_VERIFY) throw new Error(msg);
        console.log(`WARN: ${msg}`);
      } else {
        console.log(`postcheck ok: ${verify.signal}`);
      }

      console.log(SAVE_DRAFT ? '已自动执行“保存草稿”。' : '已自动执行发布按钮点击。');
    } else {
      console.log(SAVE_DRAFT ? '未找到“保存草稿”按钮，请手动点保存草稿。' : '未找到发布按钮，请手动点击发布。');
      await waitEnter(SAVE_DRAFT ? '保存草稿后按回车退出。' : '发布后按回车退出。');
    }
  } else {
    console.log('内容已填充完成。当前为手动确认模式（XHS_AUTO_CONFIRM!=1）。');
    await waitEnter('确认无误后请手动点击发布，再按回车退出。');
  }

  await browser.close();
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.login) {
    await loginAndSave();
    return;
  }
  if (!args.file) {
    throw new Error('缺少 --file 参数');
  }
  if (!fs.existsSync(args.file)) {
    throw new Error(`草稿文件不存在: ${args.file}`);
  }
  await publishWithState(args.file);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
