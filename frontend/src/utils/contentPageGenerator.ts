/**
 * 独立内容页面生成器
 * 生成完整的HTML页面，避免iframe兼容性问题
 */

export interface ContentPageData {
  html: string;
  css: string;
  js: string;
  externalLinks: string | string[];
  title?: string;
  description?: string;
  keywords?: string;
  author?: string;
}

export function generateStandaloneContentPage(data: ContentPageData): string {
  const { html, css, js, externalLinks, title = 'Interactive Content', description = 'AI Generated Interactive Content', keywords = 'interactive, content, ai, education', author = 'AI Education Platform' } = data;
  
  // 处理外部链接
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
    
    // 过滤并验证链接
    const validLinks = arr.filter(link => {
      try {
        const urlObj = new URL(link);
        return urlObj.protocol === 'https:';
      } catch {
        return false;
      }
    });
    
    // 确保Vue.js在插件之前加载
    const cssFiles = validLinks.filter(link => link.endsWith('.css'));
    const jsFiles = validLinks.filter(link => !link.endsWith('.css'));
    const vueFiles = jsFiles.filter(link => link.includes('vue'));
    const otherFiles = jsFiles.filter(link => !link.includes('vue'));
    const sortedJsFiles = [...vueFiles, ...otherFiles];
    
    const cssLinks = cssFiles.map(link => `<link rel="stylesheet" href="${link}" crossorigin="anonymous">`).join('\n');
    const jsScripts = sortedJsFiles.map(link => `<script src="${link}" crossorigin="anonymous"></script>`).join('\n');
    
    return `${cssLinks}\n${jsScripts}`;
  };

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no, maximum-scale=1, minimum-scale=1">
  <meta name="format-detection" content="telephone=no, email=no, address=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="msapplication-tap-highlight" content="no">
  
  <!-- SEO Meta Tags -->
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="keywords" content="${keywords}">
  <meta name="author" content="${author}">
  
  <!-- 微信环境优化 -->
  <meta name="x5-orientation" content="portrait">
  <meta name="x5-fullscreen" content="true">
  <meta name="x5-page-mode" content="app">
  <meta name="x5-browser-ua" content="true">
  
  <!-- 兼容性处理 -->
  <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
  
  <!-- 外部资源 -->
  ${renderExternalLinks(externalLinks)}
  
  <!-- 页面样式 -->
  <style>
    /* 基础重置样式 - 兼容各种浏览器 */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
    
    /* 允许文本选择 */
    p, span, div, h1, h2, h3, h4, h5, h6, label, input, textarea, button {
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
      user-select: text;
    }
    
    html, body {
      width: 100%;
      min-height: 100vh;
      border: none;
      outline: none;
      overflow-x: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      font-size: 16px;
      line-height: 1.5;
      color: #333;
      background: #fff;
    }
    
    /* 根元素样式 */
    #root, #app, [data-v-app] {
      width: 100%;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    /* 触摸优化 */
    button, input, textarea, select {
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      border-radius: 0;
      outline: none;
      -webkit-tap-highlight-color: transparent;
    }
    
    /* 游戏容器优化 */
    .game-container {
      max-width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    
    .game-content {
      flex-wrap: wrap;
      justify-content: center;
      gap: 15px;
    }
    
    .game-board {
      max-width: 100%;
      height: auto;
      min-height: 400px;
    }
    
    .side-panel {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .game-title {
      font-size: 2rem !important;
    }
    
    .game-subtitle {
      font-size: 0.9rem !important;
    }
    
    /* 响应式设计 - 移动端优先 */
    @media (max-width: 768px) {
      html, body {
        font-size: 14px;
      }
      
      .game-container {
        transform: scale(0.95);
        transform-origin: top center;
      }
      
      .game-content {
        flex-direction: column;
        align-items: center;
      }
      
      .game-board {
        width: 100%;
        max-width: 320px;
        height: auto;
      }
      
      .side-panel {
        flex-direction: row;
        justify-content: center;
        flex-wrap: wrap;
      }
      
      .game-title {
        font-size: 1.5rem !important;
        text-align: center;
      }
      
      .game-subtitle {
        font-size: 0.8rem !important;
        text-align: center;
      }
    }
    
    /* 微信环境特殊处理 */
    @media screen and (-webkit-min-device-pixel-ratio: 0) {
      /* WebKit浏览器 */
      .game-container {
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
      }
    }
    
    /* 确保页面内容完整显示 */
    body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      overflow-x: hidden;
    }
    
    #app {
      min-height: 100vh;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .ocean-background {
      min-height: 100vh;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
      box-sizing: border-box;
    }
    
    /* 用户自定义样式 */
    ${css}
  </style>
</head>
<body>
  <!-- 页面头部 -->
  <header style="position: fixed; top: 0; left: 0; right: 0; background: rgba(0,0,0,0.8); color: white; padding: 10px; z-index: 1000; text-align: center;">
    <h1 style="margin: 0; font-size: 16px;">${title}</h1>
    <div style="font-size: 12px; opacity: 0.8;">独立页面 - 微信完全兼容</div>
  </header>
  
  <!-- 主要内容 -->
  <main style="margin-top: 60px; padding: 20px;">
    ${html}
  </main>
  
  <!-- 页面脚本 -->
  <script>
    // 页面加载状态
    console.log('Standalone content page loading...');
    
    // 微信浏览器检测
    var isWeChat = /MicroMessenger/i.test(navigator.userAgent);
    var isWeChatBrowser = isWeChat || /X5Browser/i.test(navigator.userAgent);
    
    if (isWeChatBrowser) {
      console.log('WeChat browser detected in standalone page');
      document.title = '${title} - 微信兼容版';
    }
    
    // 触摸事件优化
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // 防止双击缩放
      var lastTouchEnd = 0;
      document.addEventListener('touchend', function (event) {
        var now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
          event.preventDefault();
        }
        lastTouchEnd = now;
      }, false);
      
      // 防止滚动时触发其他事件
      document.addEventListener('touchmove', function (event) {
        if (event.scale !== 1) {
          event.preventDefault();
        }
      }, { passive: false });
      
      // 触摸反馈优化
      document.addEventListener('touchstart', function() {
        // 触摸开始时的反馈
      }, { passive: true });
    }
    
    // 全局错误处理
    window.addEventListener('error', function(e) {
      console.log('Standalone page error:', e.message);
    });
    
    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', function(e) {
      console.log('Standalone page promise rejection:', e.reason);
    });
    
    // Tone.js 音频上下文处理
    function initToneAudioContext() {
      if (typeof Tone !== 'undefined') {
        // 监听用户交互事件来启动音频上下文
        const startAudioContext = () => {
          if (Tone.context.state !== 'running') {
            Tone.context.resume().then(() => {
              console.log('Tone.js 音频上下文已启动');
            }).catch(error => {
              console.log('Tone.js 音频上下文启动失败:', error.message);
            });
          }
        };
        
        // 监听各种用户交互事件
        ['click', 'touchstart', 'keydown', 'mousedown', 'touchend'].forEach(event => {
          document.addEventListener(event, startAudioContext, { once: true, passive: true });
        });
      }
    }
    
    // Vue集成优化
    function initVue() {
      if (typeof Vue !== 'undefined') {
        window.GlobalVue = Vue;
        console.log('Vue loaded successfully, version:', Vue.version);
        
        // 检查VueKinesis
        if (typeof VueKinesis !== 'undefined') {
          try {
            Vue.use(VueKinesis);
            console.log('VueKinesis registered successfully');
          } catch (error) {
            console.log('VueKinesis registration failed:', error.message);
          }
        }
        
        return true;
      }
      return false;
    }
    
    // 等待外部脚本加载完成
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          // 初始化Tone.js音频上下文
          initToneAudioContext();
          
          // 初始化Vue
          if (!initVue()) {
            // 如果Vue还没加载，等待一下再试
            setTimeout(initVue, 100);
          }
          
          // 执行用户代码
          ${js}
          
          console.log('Standalone content page loaded successfully');
          
          // 通知父页面加载完成
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              type: 'STANDALONE_PAGE_LOADED',
              data: { success: true }
            }, '*');
          }
        } catch (error) {
          console.log('User script error:', error.message);
        }
      }, 100);
    });
  </script>
</body>
</html>`;
}

/**
 * 下载独立HTML页面
 */
export function downloadStandalonePage(data: ContentPageData, filename: string = 'standalone-content.html') {
  const html = generateStandaloneContentPage(data);
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

/**
 * 生成独立页面的URL（用于部署）
 */
export function generateStandalonePageURL(data: ContentPageData): string {
  const html = generateStandaloneContentPage(data);
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
} 