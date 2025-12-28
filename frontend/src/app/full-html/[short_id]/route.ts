import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_BASE_URL =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:3001/api';

interface ContentApiResponse {
  success?: boolean;
  data?: {
    title?: string;
    description?: string;
    full_html?: string;
  };
  error?: string;
}

function ensureDocumentMarkup(html: string, title?: string, isThumbnail?: boolean) {
  const trimmed = html.trim();
  const isFullDocument = /<!DOCTYPE/i.test(trimmed) || /<html[\s>]/i.test(trimmed);
  
  const safeTitle = (title || 'Edu Content')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Thumbnail generation script - set __PAGE_READY__ flag after page loads
  const thumbnailScript = isThumbnail ? `
    <script>
      (function() {
        // Wait for DOM and resources to load
        function setPageReady() {
          window.__PAGE_READY__ = true;
        }
        
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          // DOM already loaded
          setTimeout(setPageReady, 500);
        } else {
          // Wait for DOMContentLoaded
          document.addEventListener('DOMContentLoaded', function() {
            setTimeout(setPageReady, 500);
          });
        }
        
        // Fallback: set after window load
        window.addEventListener('load', function() {
          setTimeout(setPageReady, 1000);
        });
      })();
    </script>
  ` : '';

  if (isFullDocument) {
    // Inject script before </body> or </html>
    if (trimmed.includes('</body>')) {
      return trimmed.replace('</body>', `${thumbnailScript}</body>`);
    } else if (trimmed.includes('</html>')) {
      return trimmed.replace('</html>', `${thumbnailScript}</html>`);
    } else {
      return trimmed + thumbnailScript;
    }
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body>
    ${trimmed}
    ${thumbnailScript}
  </body>
</html>`;
}

function buildErrorHtml(message: string, status: number) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>内容不可用</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #F7F8FA; /* Background - 非纯白，护眼 */
        color: #2E2E2E; /* Text Main */
        margin: 0;
        padding: 40px 16px;
      }
      .container {
        max-width: 720px;
        margin: 0 auto;
        background: #FFFFFF; /* Card */
        border-radius: 16px;
        box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
        padding: 40px 32px;
        text-align: center;
      }
      h1 {
        font-size: 1.75rem;
        margin-bottom: 12px;
      }
      p {
        font-size: 1rem;
        line-height: 1.7;
        color: #6B7280; /* Text Sub */
      }
      .status {
        display: inline-block;
        padding: 6px 14px;
        border-radius: 999px;
        background: rgba(58, 110, 165, 0.1); /* Primary with opacity */
        color: #3A6EA5; /* Primary */
        font-weight: 600;
        margin-bottom: 20px;
        font-size: 0.95rem;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="status">状态：${status}</div>
      <h1>内容暂时无法访问</h1>
      <p>${message}</p>
    </div>
  </body>
</html>`;
}

export async function GET(
  request: Request,
  { params }: { params: { short_id: string } }
) {
  const shortId = params.short_id;
  const url = new URL(request.url);
  const isThumbnail = url.searchParams.get('thumbnail') === '1';

  if (!shortId) {
    return NextResponse.json({ error: '缺少 short_id 参数' }, { status: 400 });
  }

  try {
    const apiResponse = await fetch(
      `${API_BASE_URL}/content/short/${encodeURIComponent(shortId)}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (apiResponse.status === 404) {
      const html = buildErrorHtml('未找到对应的内容，请确认链接是否正确。', 404);
      return new Response(html, {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    if (!apiResponse.ok) {
      const html = buildErrorHtml('内容服务暂时不可用，请稍后重试。', apiResponse.status);
      return new Response(html, {
        status: apiResponse.status,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    const payload = (await apiResponse.json()) as ContentApiResponse;
    const content = payload?.data;

    if (!payload?.success || !content?.full_html) {
      const html = buildErrorHtml(
        payload?.error || '内容缺少可渲染的 HTML 数据。',
        404
      );
      return new Response(html, {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    const finalHtml = ensureDocumentMarkup(
      content.full_html,
      content.title || content.description,
      isThumbnail
    );

    return new Response(finalHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Source': 'full-html',
      },
    });
  } catch (error) {
    console.error('[full-html] Render error:', error);
    const html = buildErrorHtml('服务器处理请求时发生异常，请稍后再试。', 500);
    return new Response(html, {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }
}

