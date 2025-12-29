const express = require('express');
const router = express.Router();
const sharp = require('sharp');
const logger = require('../utils/logger');

/**
 * Test endpoint for Sharp thumbnail generation
 * POST /api/test-sharp-thumbnail
 * Body: { svgContent: string }
 */
router.post('/', async (req, res) => {
  try {
    const { svgContent } = req.body;

    if (!svgContent || typeof svgContent !== 'string') {
      return res.status(400).json({ error: 'svgContent is required' });
    }

    logger.info('[Test Sharp] Starting SVG to PNG conversion test');
    logger.info(`[Test Sharp] SVG content length: ${svgContent.length} characters`);

    const svgBuffer = Buffer.from(svgContent, 'utf-8');
    logger.info(`[Test Sharp] SVG buffer length: ${svgBuffer.length} bytes`);
    logger.info(`[Test Sharp] SVG preview (first 300 chars): ${svgContent.substring(0, 300)}...`);

    // Step 1: Convert SVG to PNG (let Sharp determine size from SVG)
    logger.info('[Test Sharp] Step 1: Converting SVG to PNG...');
    
    let step1Png;
    let step1Method = 'unknown';
    try {
      // Try method 1: with density option
      try {
        logger.info('[Test Sharp] Trying method 1: with density=144...');
        step1Png = await sharp(svgBuffer, {
          density: 144 // Higher DPI for better text rendering
        })
          .png()
          .toBuffer();
        
        step1Method = 'with-density';
        logger.info(`[Test Sharp] ✅ Step 1 success (method: with-density): ${step1Png.length} bytes`);
      } catch (densityError) {
        logger.warn(`[Test Sharp] Method 1 (with density) failed: ${densityError.message}`);
        logger.warn(`[Test Sharp] Method 1 error details: ${JSON.stringify({
          name: densityError.name,
          message: densityError.message,
          stack: densityError.stack?.substring(0, 300)
        })}`);
        
        // Try method 2: without density option
        try {
          logger.info('[Test Sharp] Trying method 2: without density option...');
          step1Png = await sharp(svgBuffer)
            .png()
            .toBuffer();
          
          step1Method = 'without-density';
          logger.info(`[Test Sharp] ✅ Step 1 success (method: without-density): ${step1Png.length} bytes`);
        } catch (noDensityError) {
          logger.warn(`[Test Sharp] Method 2 (without density) failed: ${noDensityError.message}`);
          
          // Try method 3: with explicit width/height in SVG options
          logger.info('[Test Sharp] Trying method 3: with explicit width/height...');
          step1Png = await sharp(svgBuffer, {
            density: 72, // Lower density
            limitInputPixels: false // Disable pixel limit
          })
            .png()
            .toBuffer();
          
          step1Method = 'with-explicit-options';
          logger.info(`[Test Sharp] ✅ Step 1 success (method: with-explicit-options): ${step1Png.length} bytes`);
        }
      }
    } catch (step1Error) {
      logger.error(`[Test Sharp] ❌ Step 1 failed: ${step1Error.message}`);
      logger.error(`[Test Sharp] Step 1 error name: ${step1Error.name}`);
      logger.error(`[Test Sharp] Step 1 error stack: ${step1Error.stack?.substring(0, 800)}`);
      throw new Error(`Step 1 (SVG to PNG) failed: ${step1Error.message}`);
    }

    // Step 2: Resize the PNG to target dimensions
    logger.info('[Test Sharp] Step 2: Resizing PNG to 640x360...');
    let step2Png;
    try {
      step2Png = await sharp(step1Png)
        .resize(640, 360, {
          fit: 'fill' // Use 'fill' to ensure exact size
        })
        .png()
        .toBuffer();
      
      logger.info(`[Test Sharp] ✅ Step 2 success: ${step2Png.length} bytes`);
    } catch (step2Error) {
      logger.error(`[Test Sharp] ❌ Step 2 failed: ${step2Error.message}`);
      throw new Error(`Step 2 (Resize) failed: ${step2Error.message}`);
    }

    // Return results
    res.json({
      success: true,
      step1: step1Png.toString('base64'),
      step1Size: step1Png.length,
      step1Method: step1Method,
      step2: step2Png.toString('base64'),
      step2Size: step2Png.length,
      final: step2Png.toString('base64'),
      finalSize: step2Png.length,
    });

  } catch (error) {
    logger.error('[Test Sharp] Error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;

