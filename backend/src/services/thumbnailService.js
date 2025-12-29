const { uploadToFreeimageHost } = require('./freeimage_upload_service');
const DatabaseService = require('./database');
const logger = require('../utils/logger');

/**
 * Generate content thumbnail using Playwright (only for test-thumbnail page)
 * @param {string} contentId - Content ID
 * @param {string} shortId - Content short_id
 * @param {string} baseUrl - Frontend base URL
 * @param {boolean} usePlaywright - Must be true, this function only supports Playwright
 */
async function generateThumbnail(contentId, shortId, baseUrl, usePlaywright = true) {
  const startTime = Date.now();
  
  if (!usePlaywright) {
    throw new Error('generateThumbnail now only supports Playwright. Set usePlaywright=true.');
  }
  
  try {
    logger.info(`[Thumbnail] ========== Starting thumbnail generation (Playwright only) ==========`);
    logger.info(`[Thumbnail] Content ID: ${contentId}`);
    logger.info(`[Thumbnail] Short ID: ${shortId}`);
    logger.info(`[Thumbnail] Base URL: ${baseUrl}`);
    
    // 1. Update status to generating
    await DatabaseService.supabase
      .from('content')
      .update({ 
        thumbnail_status: 'generating',
        thumbnail_updated_at: new Date().toISOString()
      })
      .eq('id', contentId);

    // 2. Get content info
    const { data: content, error: contentError } = await DatabaseService.supabase
      .from('content')
      .select('id, full_html, title, svg_thumbnail')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      throw new Error(`Content not found: ${contentId}`);
    }

    if (!content.full_html || content.full_html.trim().length === 0) {
      throw new Error(`Content has no full_html: ${contentId}`);
    }

    logger.info(`[Thumbnail] Content found - Title: "${content.title || 'N/A'}"`);
    logger.info(`[Thumbnail] HTML length: ${content.full_html.length} characters`);

    // 3. Use Playwright to render page and screenshot
    logger.info(`[Thumbnail] ========== Strategy: Playwright Rendering ==========`);
    logger.info(`[Thumbnail] Using Playwright to render page and detect best screenshot area...`);
    
    let imageData = null;
    
    try {
      const { chromium } = require('playwright');
      const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      
      const url = `${baseUrl}/full-html/${shortId}?thumbnail=1`;
      logger.info(`[Thumbnail] Loading page: ${url}`);
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for page ready flag
      try {
        await page.waitForFunction(
          () => window.__PAGE_READY__ === true,
          { timeout: 10000 }
        );
        logger.info('[Thumbnail] Page ready flag detected');
      } catch (e) {
        logger.warn('[Thumbnail] Page ready flag timeout, waiting additional time...');
        await page.waitForTimeout(2000);
      }
      
      // Additional wait for canvas/animations to render
      const hasCanvas = await page.$('canvas').catch(() => null);
      const hasSvg = await page.$('svg').catch(() => null);
      const hasVideo = await page.$('video').catch(() => null);
      
      if (hasCanvas || hasSvg || hasVideo) {
        logger.info('[Thumbnail] Detected interactive elements (canvas/svg/video), waiting longer...');
        await page.waitForTimeout(2000);
      } else {
        await page.waitForTimeout(1000);
      }
      
      // Use smart detection to find the best area to screenshot
      const screenshotBuffer = await detectAndScreenshot(page);
      imageData = screenshotBuffer.toString('base64');
      logger.info(`[Thumbnail] ✅ Screenshot captured using smart detection`);
      logger.info(`[Thumbnail] Image size: ${screenshotBuffer.length} bytes`);
      
      await browser.close();
    } catch (playwrightError) {
      logger.error(`[Thumbnail] ❌ Playwright rendering failed: ${playwrightError.message}`);
      throw new Error(`Playwright screenshot failed: ${playwrightError.message}`);
    }

    // 4. Upload to Freeimage.host
    if (!imageData) {
      throw new Error('No screenshot data available');
    }

    logger.info(`[Thumbnail] ========== Uploading to Freeimage.host ==========`);
    
    const uploadResult = await uploadToFreeimageHost(
      imageData,
      `thumbnail-${shortId}.png`,
      'image/png'
    );

    logger.info(`[Thumbnail] Upload result: ${JSON.stringify({
      success: uploadResult.success,
      url: uploadResult.url?.substring(0, 100),
      displayUrl: uploadResult.displayUrl?.substring(0, 100)
    })}`);

    // 5. Update database
    const thumbnailUrl = uploadResult.displayUrl || uploadResult.url;
    logger.info(`[Thumbnail] ========== Saving to Database ==========`);
    logger.info(`[Thumbnail] Final thumbnail URL: ${thumbnailUrl}`);
    
    await DatabaseService.supabase
      .from('content')
      .update({
        thumbnail_url: thumbnailUrl,
        thumbnail_status: 'ready',
        thumbnail_updated_at: new Date().toISOString()
      })
      .eq('id', contentId);

    const duration = Date.now() - startTime;
    logger.info(`[Thumbnail] ========== Thumbnail Generation Complete ==========`);
    logger.info(`[Thumbnail] ✅ Thumbnail generated successfully`);
    logger.info(`[Thumbnail] Final URL: ${thumbnailUrl}`);
    logger.info(`[Thumbnail] Total time: ${duration}ms`);
    
    return {
      success: true,
      thumbnail_url: thumbnailUrl
    };

  } catch (error) {
    logger.error('[Thumbnail] Generation failed:', error);
    
    // On failure, mark as failed
    try {
      await DatabaseService.supabase
        .from('content')
        .update({
          thumbnail_status: 'failed',
          thumbnail_updated_at: new Date().toISOString()
        })
        .eq('id', contentId);
    } catch (updateError) {
      logger.error('[Thumbnail] Failed to update status to failed:', updateError);
    }

    throw error;
  }
}

/**
 * Smart detection and screenshot of best area
 * Priority: Canvas > SVG > Video > iframe > largest visible element > entire viewport
 */
async function detectAndScreenshot(page) {
  const TARGET_WIDTH = 640;
  const TARGET_HEIGHT = 360;
  const TARGET_RATIO = TARGET_WIDTH / TARGET_HEIGHT; // 16:9

  // Strategy 1: Detect Canvas element
  try {
    const canvas = await page.$('canvas');
    if (canvas) {
      const box = await canvas.boundingBox();
      if (box && box.width > 50 && box.height > 50) {
        logger.info('[Thumbnail] ✅ Detected Canvas element, size:', Math.round(box.width), 'x', Math.round(box.height));
        return await canvas.screenshot({ type: 'png' });
      }
    }
  } catch (error) {
    logger.warn('[Thumbnail] Canvas detection failed:', error.message);
  }

  // Strategy 2: Detect SVG element
  try {
    const svg = await page.$('svg');
    if (svg) {
      const box = await svg.boundingBox();
      if (box && box.width > 50 && box.height > 50) {
        logger.info('[Thumbnail] ✅ Detected SVG element, size:', Math.round(box.width), 'x', Math.round(box.height));
        return await svg.screenshot({ type: 'png' });
      }
    }
  } catch (error) {
    logger.warn('[Thumbnail] SVG detection failed:', error.message);
  }

  // Strategy 3: Detect Video element
  try {
    const video = await page.$('video');
    if (video) {
      const box = await video.boundingBox();
      if (box && box.width > 50 && box.height > 50) {
        logger.info('[Thumbnail] ✅ Detected Video element, size:', Math.round(box.width), 'x', Math.round(box.height));
        return await video.screenshot({ type: 'png' });
      }
    }
  } catch (error) {
    logger.warn('[Thumbnail] Video detection failed:', error.message);
  }

  // Strategy 4: Detect iframe element
  try {
    const iframe = await page.$('iframe');
    if (iframe) {
      const box = await iframe.boundingBox();
      if (box && box.width > 50 && box.height > 50) {
        logger.info('[Thumbnail] ✅ Detected iframe element, size:', Math.round(box.width), 'x', Math.round(box.height));
        return await iframe.screenshot({ type: 'png' });
      }
    }
  } catch (error) {
    logger.warn('[Thumbnail] iframe detection failed:', error.message);
  }

  // Strategy 5: Detect largest visible child element under body
  try {
    const elementInfo = await page.evaluate(() => {
      const body = document.body;
      if (!body) return null;

      let maxArea = 0;
      let maxElement = null;

      const children = Array.from(body.children);
      
      for (const child of children) {
        const tagName = child.tagName.toLowerCase();
        if (['script', 'style', 'meta', 'link', 'noscript', 'title'].includes(tagName)) {
          continue;
        }

        const style = window.getComputedStyle(child);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          continue;
        }

        const rect = child.getBoundingClientRect();
        const area = rect.width * rect.height;
        
        if (rect.width >= 200 && rect.height >= 150 && area > maxArea) {
          maxArea = area;
          maxElement = child;
        }
      }

      if (maxElement) {
        if (maxElement.id) {
          return { selector: `#${maxElement.id}`, tagName: maxElement.tagName, area: maxArea };
        }
        
        if (maxElement.className && typeof maxElement.className === 'string') {
          const classes = maxElement.className.split(/\s+/).filter(c => c && !c.startsWith('_')).slice(0, 2);
          if (classes.length > 0) {
            return { selector: `.${classes.join('.')}`, tagName: maxElement.tagName, area: maxArea };
          }
        }
        
        const parent = maxElement.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(el => 
            el.tagName === maxElement.tagName
          );
          const index = siblings.indexOf(maxElement) + 1;
          return { 
            selector: `${maxElement.tagName.toLowerCase()}:nth-of-type(${index})`, 
            tagName: maxElement.tagName,
            area: maxArea 
          };
        }
      }

      return null;
    });

    if (elementInfo && elementInfo.selector) {
      try {
        const element = await page.$(elementInfo.selector);
        if (element) {
          const box = await element.boundingBox();
          if (box && box.width > 0 && box.height > 0) {
            logger.info(`[Thumbnail] ✅ Detected largest visible element: ${elementInfo.tagName} (${elementInfo.selector}), size:`, 
              Math.round(box.width), 'x', Math.round(box.height));
            return await element.screenshot({ type: 'png' });
          }
        }
      } catch (error) {
        logger.warn('[Thumbnail] Largest element screenshot failed, falling back to viewport:', error.message);
      }
    }
  } catch (error) {
    logger.warn('[Thumbnail] Largest element detection failed:', error.message);
  }

  // Strategy 6: Screenshot entire viewport with smart crop to 16:9
  logger.info('[Thumbnail] 📸 Using viewport screenshot, smart crop to 16:9');
  const viewportSize = page.viewportSize();
  const viewportWidth = viewportSize?.width || 1280;
  const viewportHeight = viewportSize?.height || 720;

  let clipWidth = viewportWidth;
  let clipHeight = viewportHeight;
  let clipX = 0;
  let clipY = 0;

  const viewportRatio = viewportWidth / viewportHeight;

  if (viewportRatio > TARGET_RATIO) {
    clipHeight = viewportHeight;
    clipWidth = viewportHeight * TARGET_RATIO;
    clipX = (viewportWidth - clipWidth) / 2;
  } else {
    clipWidth = viewportWidth;
    clipHeight = viewportWidth / TARGET_RATIO;
    clipY = (viewportHeight - clipHeight) / 2;
  }

  clipWidth = Math.min(clipWidth, viewportWidth);
  clipHeight = Math.min(clipHeight, viewportHeight);
  clipX = Math.max(0, Math.min(clipX, viewportWidth - clipWidth));
  clipY = Math.max(0, Math.min(clipY, viewportHeight - clipHeight));

  logger.info('[Thumbnail] Viewport crop params:', {
    viewport: `${viewportWidth}x${viewportHeight}`,
    clip: `${Math.round(clipWidth)}x${Math.round(clipHeight)}`,
    offset: `(${Math.round(clipX)}, ${Math.round(clipY)})`
  });

  return await page.screenshot({
    type: 'png',
    clip: {
      x: Math.round(clipX),
      y: Math.round(clipY),
      width: Math.round(clipWidth),
      height: Math.round(clipHeight)
    }
  });
}

module.exports = { generateThumbnail };
