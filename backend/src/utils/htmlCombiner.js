/**
 * HTML 组合工具
 * 将分离的 HTML、CSS、JS 代码块组合成完整的 HTML 文件
 */

/**
 * 组合代码块为完整的 HTML 文件
 * @param {string} html - HTML 代码
 * @param {string} css - CSS 代码
 * @param {string} js - JS 代码
 * @param {string[]} externalLinks - 外部链接数组
 * @returns {string} 完整的 HTML 文件字符串
 */
function combineCodeBlocksToFullHTML(html, css, js, externalLinks = []) {
  if (!html) {
    throw new Error('HTML 代码不能为空');
  }

  // 分离外部链接为 CSS 和 JS
  const cssLinks = [];
  const jsLinks = [];
  
  (externalLinks || []).forEach(link => {
    const trimmedLink = (link || '').trim();
    if (!trimmedLink) return;
    
    if (trimmedLink.endsWith('.css') || trimmedLink.includes('/css/')) {
      cssLinks.push(trimmedLink);
    } else {
      // JS 文件或未知类型，都当作 JS 处理
      jsLinks.push(trimmedLink);
    }
  });

  // 构建 <head> 部分
  let headContent = '';
  
  // 添加外部 CSS 链接
  cssLinks.forEach(link => {
    headContent += `  <link rel="stylesheet" href="${escapeHtml(link)}">\n`;
  });
  
  // 添加内部 CSS
  if (css && css.trim()) {
    headContent += `  <style>\n${css.trim()}\n  </style>\n`;
  }

  // 添加外部 JS 链接（在 </body> 前）
  let bodyEndContent = '';
  jsLinks.forEach(link => {
    bodyEndContent += `  <script src="${escapeHtml(link)}"></script>\n`;
  });
  
  // 添加内部 JS
  if (js && js.trim()) {
    bodyEndContent += `  <script>\n${js.trim()}\n  </script>\n`;
  }

  // 检查 HTML 是否已经是完整的文档
  const htmlLower = html.trim().toLowerCase();
  const hasDoctype = htmlLower.startsWith('<!doctype');
  const hasHtmlTag = htmlLower.includes('<html');
  const hasHeadTag = htmlLower.includes('<head');
  const hasBodyTag = htmlLower.includes('<body');

  let fullHTML = '';

  if (hasDoctype && hasHtmlTag && hasHeadTag && hasBodyTag) {
    // 已经是完整文档，注入 CSS 和 JS
    fullHTML = injectIntoFullDocument(html, headContent, bodyEndContent);
  } else if (hasHtmlTag && hasHeadTag && hasBodyTag) {
    // 缺少 DOCTYPE，添加
    fullHTML = injectIntoFullDocument(html, headContent, bodyEndContent);
    if (!htmlLower.startsWith('<!doctype')) {
      fullHTML = '<!DOCTYPE html>\n' + fullHTML;
    }
  } else if (hasBodyTag) {
    // 只有 body，包装成完整文档
    const bodyContent = extractBodyContent(html);
    fullHTML = buildFullDocument(bodyContent, headContent, bodyEndContent);
  } else {
    // 只有内容片段，包装成完整文档
    fullHTML = buildFullDocument(html, headContent, bodyEndContent);
  }

  return fullHTML;
}

/**
 * 注入到完整文档中
 */
function injectIntoFullDocument(html, headContent, bodyEndContent) {
  let result = html;

  // 注入到 </head> 前
  if (headContent) {
    if (result.includes('</head>')) {
      result = result.replace('</head>', `${headContent}</head>`);
    } else if (result.includes('<body')) {
      // 没有 </head>，在 <body> 前插入
      result = result.replace('<body', `<head>\n${headContent}</head>\n<body`);
    }
  }

  // 注入到 </body> 前
  if (bodyEndContent) {
    if (result.includes('</body>')) {
      result = result.replace('</body>', `${bodyEndContent}</body>`);
    } else if (result.includes('</html>')) {
      // 没有 </body>，在 </html> 前插入
      result = result.replace('</html>', `${bodyEndContent}</html>`);
    } else {
      // 都没有，追加到末尾
      result += `\n${bodyEndContent}`;
    }
  }

  return result;
}

/**
 * 提取 body 内容
 */
function extractBodyContent(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    return bodyMatch[1];
  }
  
  const bodyOpenMatch = html.match(/<body[^>]*>([\s\S]*)$/i);
  if (bodyOpenMatch) {
    return bodyOpenMatch[1];
  }
  
  return html;
}

/**
 * 构建完整文档
 */
function buildFullDocument(bodyContent, headContent, bodyEndContent) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Content</title>
${headContent}</head>
<body>
${bodyContent}
${bodyEndContent}</body>
</html>`;
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * 从完整 HTML 中提取代码块（反向操作，用于编辑模式切换）
 * @param {string} fullHtml - 完整的 HTML 文件
 * @returns {object} { html, css, js, externalLinks }
 */
function extractCodeBlocksFromFullHTML(fullHtml) {
  if (!fullHtml) {
    return { html: '', css: '', js: [], externalLinks: [] };
  }

  // 提取外部 CSS 链接
  const cssLinkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const cssLinks = [];
  let match;
  while ((match = cssLinkRegex.exec(fullHtml)) !== null) {
    cssLinks.push(match[1]);
  }

  // 提取外部 JS 链接
  const jsLinkRegex = /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi;
  const jsLinks = [];
  while ((match = jsLinkRegex.exec(fullHtml)) !== null) {
    jsLinks.push(match[1]);
  }

  // 提取内部 CSS
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const cssBlocks = [];
  while ((match = styleRegex.exec(fullHtml)) !== null) {
    cssBlocks.push(match[1]);
  }
  const css = cssBlocks.join('\n\n').trim();

  // 提取内部 JS（排除外部链接的 script 标签）
  const scriptRegex = /<script(?!\s+src)[^>]*>([\s\S]*?)<\/script>/gi;
  const jsBlocks = [];
  while ((match = scriptRegex.exec(fullHtml)) !== null) {
    jsBlocks.push(match[1]);
  }
  const js = jsBlocks.join('\n\n').trim();

  // 提取 body 内容作为 HTML
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let html = '';
  if (bodyMatch) {
    html = bodyMatch[1]
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // 移除 script 标签
      .trim();
  } else {
    // 没有 body，尝试提取主要内容
    html = fullHtml
      .replace(/<!DOCTYPE[^>]*>/i, '')
      .replace(/<html[^>]*>/i, '')
      .replace(/<\/html>/i, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/i, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .trim();
  }

  return {
    html: html || '<div id="app"></div>',
    css: css,
    js: js,
    externalLinks: [...cssLinks, ...jsLinks]
  };
}

module.exports = {
  combineCodeBlocksToFullHTML,
  extractCodeBlocksFromFullHTML
};

