/**
 * CodePen风格的HTML生成器
 * 分析CodePen为什么能在微信中正常渲染
 */

export interface CodePenContent {
  html: string;
  css: string;
  js: string;
  externalLinks: string | string[];
  title?: string;
}

export function generateCodePenStyleHTML(content: CodePenContent): string {
  const { html, css, js, externalLinks, title = 'CodePen Style Sandbox' } = content;
  
  // CodePen风格的外部链接处理
  const renderExternalLinks = (links: string | string[]) => {
    let arr: string[] = [];
    if (Array.isArray(links)) {
      arr = links;
    } else if (typeof links === 'string') {
      arr = links
        .split(/\n|,|;/)
        .map(link => link.trim())
        .filter(Boolean);
    }
    
    // CodePen通常只加载必要的库，不加载太多
    const essentialLinks = arr.slice(0, 2); // 最多2个
    
    return essentialLinks.map(link => 
      `<script src="${link}" crossorigin="anonymous"></script>`
    ).join('\n');
  };

  // CodePen风格的HTML结构
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  
  <!-- CodePen风格：简单的外部库加载 -->
  ${renderExternalLinks(externalLinks)}
  
  <!-- CodePen风格：内联样式，避免外部CSS -->
  <style>
    /* CodePen基础重置 */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      color: #333;
      background: #fff;
    }
    
    /* CodePen容器样式 */
    #app, [data-v-app] {
      width: 100%;
      min-height: 100vh;
      display: block;
    }
    
    /* 用户自定义样式 */
    ${css}
  </style>
</head>
<body>
  <!-- CodePen风格：简单的HTML结构 -->
  ${html}
  
  <!-- CodePen风格：内联脚本，避免复杂的外部脚本 -->
  <script>
    // CodePen风格：简单的初始化
    console.log('CodePen style sandbox loaded');
    
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCodePen);
    } else {
      initCodePen();
    }
    
    function initCodePen() {
      console.log('CodePen style sandbox initialized');
      
      // 检查Vue是否可用
      if (typeof Vue !== 'undefined') {
        console.log('Vue available:', Vue.version);
      }
      
      // 执行用户代码
      try {
        ${js}
        console.log('User code executed successfully');
      } catch (error) {
        console.error('User code error:', error);
      }
    }
    
    // CodePen风格：简单的错误处理
    window.addEventListener('error', function(e) {
      console.error('CodePen error:', e.message);
    });
  </script>
</body>
</html>`;
}

/**
 * 生成CodePen风格的Data URL
 */
export function generateCodePenDataURL(content: CodePenContent): string {
  const html = generateCodePenStyleHTML(content);
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

/**
 * 下载CodePen风格的HTML文件
 */
export function downloadCodePenHTML(content: CodePenContent, filename: string = 'codepen-style.html') {
  const html = generateCodePenStyleHTML(content);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
} 