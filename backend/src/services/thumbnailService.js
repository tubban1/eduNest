const { chromium } = require('playwright');
const { uploadToFreeimageHost } = require('./freeimage_upload_service');
const DatabaseService = require('./database');

/**
 * Generate content thumbnail
 * @param {string} contentId - Content ID
 * @param {string} shortId - Content short_id
 * @param {string} baseUrl - Frontend base URL, e.g. 'https://edunest.app' or 'http://localhost:3000'
 */
async function generateThumbnail(contentId, shortId, baseUrl) {
  let browser = null;
  
  try {
    // 1. Update status to generating
    await DatabaseService.supabase
      .from('content')
      .update({ 
        thumbnail_status: 'generating',
        thumbnail_updated_at: new Date().toISOString()
      })
      .eq('id', contentId);

    // 2. Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    // 3. Visit content page (with thumbnail=1 parameter)
    // Note: edu project uses /full-html/[short_id] route to access HTML content
    const url = `${baseUrl}/full-html/${shortId}?thumbnail=1`;
    console.log(`[Thumbnail] Visiting page: ${url}`);
    
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', // Use domcontentloaded instead of networkidle for faster loading
        timeout: 60000 // Increase timeout to 60 seconds
      });
    } catch (error) {
      console.error(`[Thumbnail] Failed to load page ${url}:`, error.message);
      throw new Error(`Page load timeout or failed: ${error.message}`);
    }

    // 4. Wait for page ready flag (with longer timeout)
    try {
      await page.waitForFunction(
        () => window.__PAGE_READY__ === true,
        { timeout: 20000 } // Increase to 20 seconds
      );
      console.log('[Thumbnail] ✅ Page ready flag detected');
    } catch (error) {
      console.warn('[Thumbnail] Page did not set __PAGE_READY__ within timeout, waiting additional time...');
      // Wait longer for page to fully render
      await page.waitForTimeout(3000); // Increase to 3 seconds
    }

    // 5. Additional wait to ensure animations/rendering complete
    // Check if there are canvas, svg, or video elements that might need more time
    const hasCanvas = await page.$('canvas').catch(() => null);
    const hasSvg = await page.$('svg').catch(() => null);
    const hasVideo = await page.$('video').catch(() => null);
    
    if (hasCanvas || hasSvg || hasVideo) {
      console.log('[Thumbnail] Detected interactive elements (canvas/svg/video), waiting longer...');
      await page.waitForTimeout(2000); // Wait 2 more seconds for animations
    } else {
      await page.waitForTimeout(1000); // Standard 1 second wait
    }

    // 6. Smart detection of best screenshot area (does not depend on HTML structure)
    const screenshotBuffer = await detectAndScreenshot(page);

    // 7. Convert to base64
    const base64Data = screenshotBuffer.toString('base64');

    // 8. Upload to Freeimage.host
    const uploadResult = await uploadToFreeimageHost(
      base64Data,
      `thumbnail-${shortId}.png`,
      'image/png'
    );

    // 9. Update database (use displayUrl for frontend display)
    const thumbnailUrl = uploadResult.displayUrl || uploadResult.url;
    await DatabaseService.supabase
      .from('content')
      .update({
        thumbnail_url: thumbnailUrl,
        thumbnail_status: 'ready',
        thumbnail_updated_at: new Date().toISOString()
      })
      .eq('id', contentId);

    console.log(`[Thumbnail] ✅ Thumbnail generated successfully: ${thumbnailUrl}`);
    
    return {
      success: true,
      thumbnail_url: thumbnailUrl
    };

  } catch (error) {
    console.error('[Thumbnail] Generation failed:', error);
    
    // Update status to failed
    try {
      await DatabaseService.supabase
        .from('content')
        .update({
          thumbnail_status: 'failed',
          thumbnail_updated_at: new Date().toISOString()
        })
        .eq('id', contentId);
    } catch (updateError) {
      console.error('[Thumbnail] Failed to update status to failed:', updateError);
    }

    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Smart detection and screenshot of best area
 * Priority: Canvas > SVG > Video > iframe > largest visible element > entire viewport
 * 
 * Advantages:
 * - No need to modify HTML structure or AI Prompt
 * - Automatically adapts to various content types
 * - Intelligently selects core visual area
 */
async function detectAndScreenshot(page) {
  const TARGET_WIDTH = 640;
  const TARGET_HEIGHT = 360;
  const TARGET_RATIO = TARGET_WIDTH / TARGET_HEIGHT; // 16:9

  // Strategy 1: Detect Canvas element (most common, Three.js, charts, etc.)
  try {
    const canvas = await page.$('canvas');
    if (canvas) {
      const box = await canvas.boundingBox();
      if (box && box.width > 50 && box.height > 50) {
        console.log('[Thumbnail] ✅ Detected Canvas element, size:', Math.round(box.width), 'x', Math.round(box.height));
        return await canvas.screenshot({ type: 'png' });
      }
    }
  } catch (error) {
    console.warn('[Thumbnail] Canvas detection failed:', error.message);
  }

  // Strategy 2: Detect SVG element (vector graphics, charts)
  try {
    const svg = await page.$('svg');
    if (svg) {
      const box = await svg.boundingBox();
      if (box && box.width > 50 && box.height > 50) {
        console.log('[Thumbnail] ✅ Detected SVG element, size:', Math.round(box.width), 'x', Math.round(box.height));
        return await svg.screenshot({ type: 'png' });
      }
    }
  } catch (error) {
    console.warn('[Thumbnail] SVG detection failed:', error.message);
  }

  // Strategy 3: Detect Video element
  try {
    const video = await page.$('video');
    if (video) {
      const box = await video.boundingBox();
      if (box && box.width > 50 && box.height > 50) {
        console.log('[Thumbnail] ✅ Detected Video element, size:', Math.round(box.width), 'x', Math.round(box.height));
        return await video.screenshot({ type: 'png' });
      }
    }
  } catch (error) {
    console.warn('[Thumbnail] Video detection failed:', error.message);
  }

  // Strategy 4: Detect iframe element (embedded content)
  try {
    const iframe = await page.$('iframe');
    if (iframe) {
      const box = await iframe.boundingBox();
      if (box && box.width > 50 && box.height > 50) {
        console.log('[Thumbnail] ✅ Detected iframe element, size:', Math.round(box.width), 'x', Math.round(box.height));
        return await iframe.screenshot({ type: 'png' });
      }
    }
  } catch (error) {
    console.warn('[Thumbnail] iframe detection failed:', error.message);
  }

  // Strategy 5: Detect largest visible child element under body (smart detection)
  try {
    const elementInfo = await page.evaluate(() => {
      const body = document.body;
      if (!body) return null;

      let maxArea = 0;
      let maxElement = null;

      // Traverse direct children of body
      const children = Array.from(body.children);
      
      for (const child of children) {
        // Skip invisible elements
        const tagName = child.tagName.toLowerCase();
        if (['script', 'style', 'meta', 'link', 'noscript', 'title'].includes(tagName)) {
          continue;
        }

        // Check if element is visible
        const style = window.getComputedStyle(child);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          continue;
        }

        const rect = child.getBoundingClientRect();
        const area = rect.width * rect.height;
        
        // Only consider visible elements with certain size (minimum 200x150)
        if (rect.width >= 200 && rect.height >= 150 && area > maxArea) {
          maxArea = area;
          maxElement = child;
        }
      }

      // If found, return selector information
      if (maxElement) {
        // Prefer ID
        if (maxElement.id) {
          return { selector: `#${maxElement.id}`, tagName: maxElement.tagName, area: maxArea };
        }
        
        // Then use class (take first two)
        if (maxElement.className && typeof maxElement.className === 'string') {
          const classes = maxElement.className.split(/\s+/).filter(c => c && !c.startsWith('_')).slice(0, 2);
          if (classes.length > 0) {
            return { selector: `.${classes.join('.')}`, tagName: maxElement.tagName, area: maxArea };
          }
        }
        
        // Use tagName + nth-child as fallback
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
            console.log(`[Thumbnail] ✅ Detected largest visible element: ${elementInfo.tagName} (${elementInfo.selector}), size:`, 
              Math.round(box.width), 'x', Math.round(box.height));
            return await element.screenshot({ type: 'png' });
          }
        }
      } catch (error) {
        console.warn('[Thumbnail] Largest element screenshot failed, falling back to viewport screenshot:', error.message);
      }
    }
  } catch (error) {
    console.warn('[Thumbnail] Largest element detection failed:', error.message);
  }

  // Strategy 6: Screenshot entire viewport, intelligently crop to 16:9 (final fallback)
  console.log('[Thumbnail] 📸 Using viewport screenshot, intelligently crop to 16:9');
  const viewportSize = page.viewportSize();
  const viewportWidth = viewportSize?.width || 1280;
  const viewportHeight = viewportSize?.height || 720;

  // Calculate best crop area (maintain 16:9 ratio, center crop)
  let clipWidth = viewportWidth;
  let clipHeight = viewportHeight;
  let clipX = 0;
  let clipY = 0;

  const viewportRatio = viewportWidth / viewportHeight;

  if (viewportRatio > TARGET_RATIO) {
    // Viewport is wider, crop by height (maintain height, crop left/right)
    clipHeight = viewportHeight;
    clipWidth = viewportHeight * TARGET_RATIO;
    clipX = (viewportWidth - clipWidth) / 2; // Center
  } else {
    // Viewport is taller, crop by width (maintain width, crop top/bottom)
    clipWidth = viewportWidth;
    clipHeight = viewportWidth / TARGET_RATIO;
    clipY = (viewportHeight - clipHeight) / 2; // Center
  }

  // Ensure within viewport range
  clipWidth = Math.min(clipWidth, viewportWidth);
  clipHeight = Math.min(clipHeight, viewportHeight);
  clipX = Math.max(0, Math.min(clipX, viewportWidth - clipWidth));
  clipY = Math.max(0, Math.min(clipY, viewportHeight - clipHeight));

  console.log('[Thumbnail] Viewport crop parameters:', {
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

