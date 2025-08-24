/**
 * 微信超简化HTML生成器 - 真实环境优化版
 * 专门用于解决真实微信浏览器的渲染问题
 */

export interface WeChatContent {
  html: string;
  css: string;
  js: string;
  externalLinks: string | string[];
  title?: string;
}

export function generateWeChatHTML(content: WeChatContent): string {
  const { html, css, js, externalLinks, title = 'WeChat Sandbox' } = content;
  
  // 处理外部链接 - 极简版本
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
    
    // 只保留Vue.js，其他库暂时移除
    const vueLink = arr.find(link => link.includes('vue'));
    return vueLink ? `<script src="${vueLink}" crossorigin="anonymous"></script>` : '';
  };

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no, maximum-scale=1, minimum-scale=1">
  <meta name="format-detection" content="telephone=no, email=no, address=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  
  <!-- 微信环境优化 -->
  <meta name="x5-orientation" content="portrait">
  <meta name="x5-fullscreen" content="true">
  <meta name="x5-page-mode" content="app">
  
  <title>${title}</title>
  
  ${renderExternalLinks(externalLinks)}
  
  <style>
    /* 极简基础样式 */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
      font-size: 16px;
      line-height: 1.5;
      color: #333;
      background: #fff;
    }
    
    /* 确保内容可见 */
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
  <!-- 微信兼容性检测 -->
  <div id="wechat-debug" style="position: fixed; top: 0; left: 0; background: rgba(0,0,0,0.8); color: white; padding: 10px; font-size: 12px; z-index: 9999; display: none;">
    <div>微信浏览器检测: <span id="wechat-status">检测中...</span></div>
    <div>Vue状态: <span id="vue-status">检测中...</span></div>
    <div>脚本执行: <span id="script-status">等待中...</span></div>
    <div>内容长度: <span id="content-length">计算中...</span></div>
  </div>

  ${html}
  
  <script>
    // 微信浏览器检测
    var isWeChat = /MicroMessenger/i.test(navigator.userAgent);
    var isWeChatBrowser = isWeChat || /X5Browser/i.test(navigator.userAgent);
    
    // 显示调试信息
    var debugDiv = document.getElementById('wechat-debug');
    var wechatStatus = document.getElementById('wechat-status');
    var vueStatus = document.getElementById('vue-status');
    var scriptStatus = document.getElementById('script-status');
    var contentLength = document.getElementById('content-length');
    
    if (isWeChatBrowser) {
      console.log('WeChat browser detected in external HTML');
      wechatStatus.textContent = '✅ 已检测到';
      debugDiv.style.display = 'block';
    } else {
      wechatStatus.textContent = '❌ 非微信';
    }
    
    // 计算内容长度
    contentLength.textContent = document.body.innerHTML.length + ' 字符';
    
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
    }
    
    // 全局错误处理
    window.addEventListener('error', function(e) {
      console.log('External HTML error:', e.message);
      scriptStatus.textContent = '❌ 错误: ' + e.message;
    });
    
    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', function(e) {
      console.log('External HTML promise rejection:', e.reason);
      scriptStatus.textContent = '❌ Promise错误: ' + e.reason;
    });
    
    // Vue集成优化
    function initVue() {
      if (typeof Vue !== 'undefined') {
        window.GlobalVue = Vue;
        console.log('Vue loaded successfully, version:', Vue.version);
        vueStatus.textContent = '✅ 已加载 v' + Vue.version;
        return true;
      } else {
        vueStatus.textContent = '❌ 未加载';
        return false;
      }
    }
    
    // 等待外部脚本加载完成
    window.addEventListener('load', function() {
      console.log('Window load event fired');
      
      // 延迟执行，确保所有资源加载完成
      setTimeout(function() {
        try {
          // 初始化Vue
          initVue();
          
          console.log('External HTML loaded successfully');
          scriptStatus.textContent = '✅ 执行成功';
          
          // 隐藏调试信息
          setTimeout(function() {
            if (debugDiv) {
              debugDiv.style.display = 'none';
            }
          }, 5000);
          
        } catch (error) {
          console.log('Initialization error:', error.message);
          scriptStatus.textContent = '❌ 初始化错误: ' + error.message;
        }
      }, 500);
    });
    
    // --- User's JavaScript is injected here ---
    ${js}
    // -----------------------------------------
    
    // 微信特殊处理
    if (isWeChatBrowser) {
      // 微信环境下的特殊处理
      document.addEventListener('WeixinJSBridgeReady', function() {
        console.log('WeixinJSBridge ready');
      });
      
      // 强制触发重绘
      setTimeout(function() {
        document.body.style.display = 'none';
        document.body.offsetHeight; // 触发重排
        document.body.style.display = '';
      }, 100);
      
      // 额外的微信兼容性处理
      setTimeout(function() {
        // 检查内容是否可见
        var appElement = document.getElementById('app') || document.querySelector('[data-v-app]');
        if (appElement && appElement.offsetHeight === 0) {
          console.log('Content not visible, forcing reflow');
          appElement.style.display = 'none';
          appElement.offsetHeight;
          appElement.style.display = 'block';
        }
      }, 200);
    }
  </script>
</body>
</html>`;
}

/**
 * 生成微信兼容的Data URL
 */
export function generateWeChatDataURL(content: WeChatContent): string {
  const html = generateWeChatHTML(content);
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

/**
 * 下载微信兼容的HTML文件
 */
export function downloadWeChatHTML(content: WeChatContent, filename: string = 'wechat-sandbox.html') {
  const html = generateWeChatHTML(content);
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