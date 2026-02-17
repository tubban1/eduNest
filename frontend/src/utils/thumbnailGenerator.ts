/**
 * 从 HTML 内容中提取 Canvas 或 SVG 作为缩略图
 * 支持多种方案：
 * 1. 提取第一个 Canvas 元素并转换为 base64 图片
 * 2. 提取第一个 SVG 元素并转换为 base64 图片
 * 3. 使用隐藏的 iframe 渲染 HTML，然后截图
 */

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number; // 0-1，用于 Canvas toDataURL
  timeout?: number; // 超时时间（毫秒）
}

/**
 * 从 HTML 字符串中提取第一个 Canvas 的截图
 * 使用隐藏的 iframe 渲染 HTML，等待 Canvas 渲染完成，然后截图
 */
export async function generateThumbnailFromHTML(
  htmlContent: string,
  options: ThumbnailOptions = {}
): Promise<string | null> {
  const {
    width = 400,
    height = 300,
    quality = 0.8,
    timeout = 5000
  } = options;

  return new Promise((resolve, reject) => {
    // 创建隐藏的 iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = `${width}px`;
    iframe.style.height = `${height}px`;
    iframe.style.border = 'none';
    
    let timeoutId: NodeJS.Timeout;
    let resolved = false;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    };

    const resolveOnce = (result: string | null) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(result);
    };

    // 设置超时
    timeoutId = setTimeout(() => {
      resolveOnce(null);
    }, timeout);

    // 监听 iframe 加载完成
    iframe.onload = () => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
          resolveOnce(null);
          return;
        }

        // 等待内容渲染完成 - 尝试多次，因为 Canvas 可能需要 JavaScript 执行
        let attempts = 0;
        const maxAttempts = 10;
        const attemptInterval = 300; // 每次尝试间隔 300ms
        
        const tryExtractCanvas = async () => {
          attempts++;
          
          try {
            // 尝试找到 Canvas 元素
            const canvas = iframeDoc.querySelector('canvas') as HTMLCanvasElement | null;
            if (canvas && canvas.width > 0 && canvas.height > 0) {
              try {
                // 尝试将 Canvas 转换为图片
                // 注意：对于需要 JS 绘制的 Canvas，可能需要等待 JS 执行完成
                // 我们通过多次尝试来等待内容渲染
                try {
                  // 将 Canvas 转换为图片
                  const dataUrl = canvas.toDataURL('image/png', quality);
                  
                  // 检查是否是空白 Canvas（全透明或全白）
                  // 如果已经是最后一次尝试，即使可能是空白也返回
                  if (attempts >= maxAttempts) {
                    // 最后一次尝试，直接返回
                    if (canvas.width !== width || canvas.height !== height) {
                      const resizedDataUrl = await resizeCanvasImage(dataUrl, width, height);
                      resolveOnce(resizedDataUrl);
                    } else {
                      resolveOnce(dataUrl);
                    }
                    return true;
                  }
                  
                  // 检查 Canvas 是否有内容
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    try {
                      // 检查一小块区域是否有内容
                      const checkSize = Math.min(50, canvas.width, canvas.height);
                      const imageData = ctx.getImageData(0, 0, checkSize, checkSize);
                      let hasNonWhitePixels = false;
                      let hasNonTransparentPixels = false;
                      
                      for (let i = 0; i < imageData.data.length; i += 4) {
                        const r = imageData.data[i];
                        const g = imageData.data[i + 1];
                        const b = imageData.data[i + 2];
                        const a = imageData.data[i + 3];
                        
                        // 检查是否有非透明像素
                        if (a > 0) {
                          hasNonTransparentPixels = true;
                          // 检查是否有非白色像素（容差）
                          if (r < 250 || g < 250 || b < 250) {
                            hasNonWhitePixels = true;
                            break;
                          }
                        }
                      }
                      
                      // 如果有内容，就截图
                      if (hasNonTransparentPixels && (hasNonWhitePixels || attempts >= 3)) {
                        if (canvas.width !== width || canvas.height !== height) {
                          const resizedDataUrl = await resizeCanvasImage(dataUrl, width, height);
                          resolveOnce(resizedDataUrl);
                        } else {
                          resolveOnce(dataUrl);
                        }
                        return true;
                      }
                    } catch (checkError) {
                      // 如果检查失败（可能是跨域问题），在多次尝试后直接返回
                      if (attempts >= 3) {
                        if (canvas.width !== width || canvas.height !== height) {
                          const resizedDataUrl = await resizeCanvasImage(dataUrl, width, height);
                          resolveOnce(resizedDataUrl);
                        } else {
                          resolveOnce(dataUrl);
                        }
                        return true;
                      }
                    }
                  }
                } catch (toDataUrlError) {
                  // toDataURL 可能因为跨域等问题失败
                  if (attempts >= maxAttempts) {
                    console.warn('Canvas toDataURL failed:', toDataUrlError);
                    resolveOnce(null);
                    return true;
                  }
                }
              } catch (e) {
                // 如果 toDataURL 失败（可能是跨域问题），继续尝试或返回 null
                if (attempts >= maxAttempts) {
                  console.warn('Canvas toDataURL failed after max attempts:', e);
                  resolveOnce(null);
                  return true;
                }
              }
            }
          } catch (e) {
            console.warn('Error checking canvas:', e);
          }
          
          // 如果还没有成功且还有尝试次数，继续等待
          if (attempts < maxAttempts) {
            setTimeout(tryExtractCanvas, attemptInterval);
            return false;
          } else {
            // 尝试次数用完，尝试直接截图（即使可能没有内容）
            try {
              const canvas = iframeDoc.querySelector('canvas') as HTMLCanvasElement | null;
              if (canvas) {
                const dataUrl = canvas.toDataURL('image/png', quality);
                if (canvas.width !== width || canvas.height !== height) {
                  const resizedDataUrl = await resizeCanvasImage(dataUrl, width, height);
                  resolveOnce(resizedDataUrl);
                } else {
                  resolveOnce(dataUrl);
                }
                return true;
              }
            } catch (e) {
              console.warn('Final canvas extraction failed:', e);
            }
            return false;
          }
        };
        
        // 开始尝试提取
        tryExtractCanvas().then((success) => {
          if (!success) {
            // 如果 Canvas 提取失败，尝试 SVG
            try {
              const svg = iframeDoc.querySelector('svg');
              if (svg) {
                try {
                  const svgDataUrl = svgToDataUrl(svg);
                  resolveOnce(svgDataUrl);
                  return;
                } catch (e) {
                  console.warn('SVG conversion failed:', e);
                }
              }
            } catch (e) {
              console.warn('Error checking SVG:', e);
            }
            
            // 如果都没有，返回 null
            resolveOnce(null);
          }
        });
      } catch (error) {
        console.error('Error accessing iframe content:', error);
        resolveOnce(null);
      }
    };

    iframe.onerror = () => {
      resolveOnce(null);
    };

    // 将 HTML 内容写入 iframe
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();
    } else {
      resolveOnce(null);
    }
  });
}

/**
 * 调整 Canvas 图片大小
 */
function resizeCanvasImage(dataUrl: string, targetWidth: number, targetHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL('image/png', 0.8));
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * 将 SVG 元素转换为 Data URL
 */
function svgToDataUrl(svg: SVGElement): string {
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svg);
  
  // 确保 SVG 有宽度和高度
  if (!svg.getAttribute('width') || !svg.getAttribute('height')) {
    const viewBox = svg.getAttribute('viewBox');
    if (viewBox) {
      const [, , w, h] = viewBox.split(/\s+|,/).map(parseFloat);
      if (w && h) {
        svg.setAttribute('width', w.toString());
        svg.setAttribute('height', h.toString());
        svgString = serializer.serializeToString(svg);
      }
    }
  }
  
  // 转换为 base64
  const svg64 = btoa(unescape(encodeURIComponent(svgString)));
  return `data:image/svg+xml;base64,${svg64}`;
}

/**
 * 从 HTML 字符串中直接提取 Canvas 或 SVG 的代码
 * 这是一个轻量级方案，不需要渲染 HTML
 */
export function extractThumbnailFromHTML(htmlContent: string): {
  type: 'canvas' | 'svg' | 'none';
  data: string | null;
  /** 原始 SVG 字符串，用于内联渲染（对话历史栏等） */
  rawSvg?: string | null;
} {
  // 尝试提取 SVG
  const svgMatch = htmlContent.match(/<svg[^>]*>[\s\S]*?<\/svg>/i);
  if (svgMatch) {
    const svgString = svgMatch[0];
    // 确保 SVG 有合适的尺寸
    let processedSvg = svgString;
    if (!processedSvg.includes('width=') || !processedSvg.includes('height=')) {
      const viewBoxMatch = processedSvg.match(/viewBox=["']([^"']+)["']/i);
      if (viewBoxMatch) {
        const parts = viewBoxMatch[1].split(/\s+|,/).map(parseFloat);
        const w = parts[2];
        const h = parts[3];
        if (w && h) {
          processedSvg = processedSvg.replace(/<svg/i, `<svg width="${w}" height="${h}"`);
        }
      }
    }
    const svg64 = btoa(unescape(encodeURIComponent(processedSvg)));
    return {
      type: 'svg',
      data: `data:image/svg+xml;base64,${svg64}`,
      rawSvg: processedSvg,
    };
  }

  // 尝试提取 Canvas（需要运行时渲染，这里只返回标记）
  const canvasMatch = htmlContent.match(/<canvas[^>]*>/i);
  if (canvasMatch) {
    return {
      type: 'canvas',
      data: null, // Canvas 需要运行时渲染
    };
  }

  return {
    type: 'none',
    data: null,
  };
}

/**
 * 使用服务端 API 生成缩略图（如果可用）
 */
export async function generateThumbnailViaAPI(
  contentId: string,
  htmlContent: string
): Promise<string | null> {
  try {
    // 这里可以调用后端 API 生成缩略图
    // 暂时返回 null，等待后端实现
    return null;
  } catch (error) {
    console.error('Failed to generate thumbnail via API:', error);
    return null;
  }
}

