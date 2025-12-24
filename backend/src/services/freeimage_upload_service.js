const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Upload image to Freeimage.host
 * @param {string} base64Data - Base64 encoded image data
 * @param {string} filename - Filename
 * @param {string} mimeType - MIME type, default 'image/png'
 * @returns {Promise<{url: string, displayUrl?: string, viewerUrl?: string, imageId?: string}>}
 */
async function uploadToFreeimageHost(base64Data, filename, mimeType = 'image/png') {
  const apiKey = process.env.FREEIMAGE_HOST_API_KEY;
  
  if (!apiKey) {
    throw new Error('FREEIMAGE_HOST_API_KEY is not configured');
  }

  try {
    console.log('[Freeimage Upload] Starting upload to Freeimage.host:', { 
      filename, 
      base64Length: base64Data.length,
      apiKey: apiKey.substring(0, 8) + '...' // Only show first 8 chars for debugging
    });

    const buffer = Buffer.from(base64Data, 'base64');

    const formData = new FormData();
    formData.append('key', apiKey);
    formData.append('action', 'upload');
    formData.append('format', 'json');
    formData.append('source', buffer, {
      filename,
      contentType: mimeType,
    });

    const response = await axios.post(
      'https://freeimage.host/api/1/upload',
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000, // 30 seconds timeout
      }
    );

    if (response.data?.status_code === 200 && response.data?.success) {
      const imageData = response.data.image;
      
      console.log(`[Freeimage Upload] ✅ Image uploaded successfully:`);
      console.log(`  - Image ID: ${imageData.id_encoded || imageData.id || 'N/A'}`);
      console.log(`  - URL: ${imageData.url}`);
      console.log(`  - Viewer URL: ${imageData.url_viewer || 'N/A'}`);
      console.log(`  - Display URL: ${imageData.display_url || imageData.url}`);

      return {
        url: imageData.url, // Original URL for download
        displayUrl: imageData.display_url || imageData.url, // Display URL for showing
        viewerUrl: imageData.url_viewer,
        imageId: imageData.id_encoded || imageData.id?.toString(),
        deleteHash: imageData.storage_id || undefined,
      };
    }

    throw new Error(response.data?.status_txt || 'Upload failed: unknown error');
  } catch (error) {
    // Detailed error logging
    const errorDetails = {
      message: error?.message,
      code: error?.code,
      response: error?.response?.data,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
    };

    console.error('[Freeimage Upload] Upload failed - details:', JSON.stringify(errorDetails, null, 2));

    // Extract more user-friendly error message
    let errorMessage = 'Upload failed';
    
    if (error?.response?.data?.status_txt) {
      errorMessage = error.response.data.status_txt;
    } else if (error?.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error?.response?.status === 403) {
      errorMessage = 'Freeimage.host API access denied, please check if API Key is correct';
    } else if (error?.response?.status === 400) {
      errorMessage = 'Invalid image format or data too large';
    } else if (error?.response?.status === 429) {
      errorMessage = 'Upload rate limit exceeded, please try again later';
    } else if (error?.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
}

module.exports = { uploadToFreeimageHost };

