'use client';

/**
 * SandboxRenderer - 增强的沙盒渲染器
 * 
 * 支持更多库的示例用法：
 * 
 * // 基础用法
 * <SandboxRenderer
 *   html={code_html}
 *   css={code_css}
 *   js={code_js}
 *   externalLinks={external_links}
 * />
 * 
 * // 增强库支持
 * <SandboxRenderer
 *   html={code_html}
 *   css={code_css}
 *   js={code_js}
 *   externalLinks={external_links}
 *   enableLibrarySupport={true}
 *   enablePerformance={true}
 *   enableErrorBoundary={true}
 *   customLibraries={[
 *     {
 *       name: 'three',
 *       urls: ['https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.min.js'],
 *       type: 'js',
 *       priority: 1
 *     },
 *     {
 *       name: 'gsap',
 *       urls: ['https://cdn.jsdelivr.net/npm/gsap@3.11.4/dist/gsap.min.js'],
 *       type: 'js',
 *       priority: 2
 *     }
 *   ]}
 * />
 * 
 * // CDN免编译库示例
 * const cdnLibraries = [
 *   // Vue.js 系列
 *   'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js',
 *   'https://cdn.jsdelivr.net/npm/vue-router@4/dist/vue-router.global.js',
 *   'https://cdn.jsdelivr.net/npm/vuex@4/dist/vuex.global.js',
 *   
 *   // React 系列
 *   'https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js',
 *   'https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js',
 *   
 *   // 音频库
 *   'https://cdn.jsdelivr.net/npm/tone@14/build/Tone.js',
 *   'https://cdn.jsdelivr.net/npm/howler@2/dist/howler.min.js',
 *   
 *   // 动画库
 *   'https://cdn.jsdelivr.net/npm/animejs@3/lib/anime.min.js',
 *   'https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js',
 *   'https://cdn.jsdelivr.net/npm/lottie-web@5/dist/lottie.min.js',
 *   
 *   // 3D库
 *   'https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.min.js',
 *   'https://cdn.jsdelivr.net/npm/@babylonjs/core@5/babylon.min.js',
 *   
 *   // 图表库
 *   'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.min.js',
 *   'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js',
 *   
 *   // 工具库
 *   'https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js',
 *   'https://cdn.jsdelivr.net/npm/moment@2/moment.min.js',
 *   'https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js'
 * ];
 * 
 * <SandboxRenderer
 *   html={code_html}
 *   css={code_css}
 *   js={code_js}
 *   externalLinks={cdnLibraries}
 *   enableLibrarySupport={true}
 * />
 * 
 * 支持的库类型：
 * - Vue.js 系列: Vue, VueRouter, Vuex, VueKinesis
 * - React 系列: React, ReactDOM, Redux, Zustand
 * - 音频库: Tone.js, Howler.js
 * - 动画库: Anime.js, GSAP, Lottie
 * - 3D库: Three.js, Babylon.js
 * - 图表库: Chart.js, ECharts
 * - 工具库: Lodash, Moment.js, Day.js
 * - 表单处理: Formik, React Hook Form
 * 
 * 注意：所有上述库都支持CDN免编译直接引用！
 */

import React, { useState, useRef, useCallback } from 'react';

interface SandboxRendererProps {
  html: string;
  css: string;
  js: string;
  externalLinks: string | string[];
  onError?: (error: string) => void;
  onLoad?: () => void;
  className?: string;
  style?: React.CSSProperties;
  enablePerformance?: boolean; // 性能优化开关
  enableErrorBoundary?: boolean; // 错误边界开关
  enableLibrarySupport?: boolean; // 增强库支持开关
  customLibraries?: Array<{
    name: string;
    urls: string[];
    type: 'css' | 'js' | 'module';
    priority: number;
    fallback?: string[];
  }>; // 自定义库配置
}

interface ExternalResource {
  url: string;
  type: 'css' | 'js';
  loaded: boolean;
  error: boolean;
}

export default function SandboxRenderer({
  html,
  css,
  js,
  externalLinks,
  onError,
  onLoad,
  className,
  style,
  enablePerformance = true,
  enableErrorBoundary = true,
  enableLibrarySupport = true,
  customLibraries = []
}: SandboxRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [performanceMetrics, setPerformanceMetrics] = useState({
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0
  });
  const [libraryStatus, setLibraryStatus] = useState<Record<string, {
    loaded: boolean;
    error: boolean;
    version?: string;
  }>>({});
  const [loadTimeout, setLoadTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isWeChat, setIsWeChat] = useState(false);

  // 基本的HTTPS检查
  const validateUrl = useCallback((url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }, []);

  // 检测微信环境
  React.useEffect(() => {
    const checkWeChat = () => {
      const userAgent = navigator.userAgent;
      const isWeChatBrowser = /MicroMessenger/i.test(userAgent) || /X5Browser/i.test(userAgent);
      setIsWeChat(isWeChatBrowser);
      
      if (isWeChatBrowser) {
        console.log('WeChat browser detected, setting up compatibility mode');
        // 微信浏览器设置更长的超时时间
        const timeout = setTimeout(() => {
          if (isLoading) {
            console.log('WeChat browser timeout, forcing load complete');
            setIsLoading(false);
            onError?.('微信浏览器加载超时，请刷新重试');
          }
        }, 15000); // 微信浏览器15秒超时
        
        setLoadTimeout(timeout);
      } else {
        // 普通浏览器5秒超时
        const timeout = setTimeout(() => {
          if (isLoading) {
            console.log('Browser timeout, forcing load complete');
            setIsLoading(false);
            onError?.('加载超时，请检查网络连接');
          }
        }, 5000);
        
        setLoadTimeout(timeout);
      }
    };
    
    checkWeChat();
    
    return () => {
      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }
    };
  }, [isLoading, onError, loadTimeout]);

  // 渲染外部依赖链接（带基本验证）
  const renderExternalLinks = useCallback((links: string | string[]) => {
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
    const validLinks = arr.filter(link => validateUrl(link));
    
    // 确保Vue.js在插件之前加载
    const cssFiles = validLinks.filter(link => link.endsWith('.css'));
    const jsFiles = validLinks.filter(link => !link.endsWith('.css'));
    const vueFiles = jsFiles.filter(link => link.includes('vue'));
    const otherFiles = jsFiles.filter(link => !link.includes('vue'));
    const sortedJsFiles = [...vueFiles, ...otherFiles];
    
    const cssLinks = cssFiles.map(link => `<link rel="stylesheet" href="${link}" crossorigin="anonymous">`).join('\n');
    const jsScripts = sortedJsFiles.map(link => `<script src="${link}" crossorigin="anonymous"></script>`).join('\n');
    
    return `${cssLinks}\n${jsScripts}`;
  }, [validateUrl]);

  // 生成预览文档 - 增强版
  const generateSrcDoc = useCallback((html: string, css: string, js: string, externalLinks: string | string[]) => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no, maximum-scale=1, minimum-scale=1">
  <meta name="format-detection" content="telephone=no, email=no, address=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="msapplication-tap-highlight" content="no">
  
  <!-- 微信环境优化 -->
  <meta name="x5-orientation" content="portrait">
  <meta name="x5-fullscreen" content="true">
  <meta name="x5-page-mode" content="app">
  <meta name="x5-browser-ua" content="true">
  
  <!-- 兼容性处理 -->
  <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
  
  ${renderExternalLinks(externalLinks)}
  
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
    
    /* 确保iframe内容完整显示 */
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
  ${html}
  
  <script>
    // 触摸事件优化
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    var isWeChat = /MicroMessenger/i.test(navigator.userAgent);
    var isWeChatBrowser = isWeChat || /X5Browser/i.test(navigator.userAgent);
    
    // 微信浏览器特殊处理
    if (isWeChatBrowser) {
      // 微信浏览器兼容性优化
      console.log('WeChat browser detected, applying compatibility fixes');
      
      // 强制设置视口
      var viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }
      
      // 微信浏览器触摸事件优化
      document.addEventListener('WeixinJSBridgeReady', function() {
        console.log('WeixinJSBridge ready');
        // 微信JS桥接准备就绪
        
        // 通知父窗口微信环境已就绪
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'WECHAT_READY',
            data: { ready: true }
          }, '*');
        }
      });
      
      // 微信浏览器页面显示事件
      document.addEventListener('WeixinJSBridgeReady', function() {
        WeixinJSBridge.on('menu:share:appmessage', function() {
          // 分享到朋友圈
        });
        WeixinJSBridge.on('menu:share:timeline', function() {
          // 分享到朋友圈
        });
      });
      
      // 微信浏览器页面可见性检测
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
          console.log('WeChat page became visible');
          // 页面重新可见时，重新初始化
          setTimeout(function() {
            if (window.LibraryManager) {
              window.LibraryManager.initCommonLibraries();
            }
          }, 100);
        }
      });
    }
    
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
      // 静默处理错误
    });
    
    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', function(e) {
      // 静默处理Promise拒绝
    });
    
    // Tone.js 音频上下文处理
    function initToneAudioContext() {
      if (typeof Tone !== 'undefined') {
        // 移动端音频上下文优化
        var audioContext = null;
        var isAudioContextInitialized = false;
        
        // 创建音频上下文的函数
        function createAudioContext() {
          try {
            // 尝试创建新的AudioContext
            if (typeof AudioContext !== 'undefined') {
              audioContext = new AudioContext();
            } else if (typeof webkitAudioContext !== 'undefined') {
              audioContext = new webkitAudioContext();
            }
            
            if (audioContext) {
              // 设置移动端优化参数
              if (audioContext.sampleRate) {
                // 降低采样率以节省移动端资源
                if (audioContext.sampleRate > 44100) {
                  audioContext.sampleRate = 44100;
                }
              }
              
              // 设置延迟时间
              if (audioContext.destination && audioContext.destination.maxChannelCount) {
                // 限制声道数
                audioContext.destination.maxChannelCount = Math.min(audioContext.destination.maxChannelCount, 2);
              }
            }
          } catch (error) {
            // 静默处理创建失败
          }
        }
        
        // 启动音频上下文的函数
        const startAudioContext = () => {
          if (!isAudioContextInitialized) {
            try {
              // 先尝试启动Tone.js的音频上下文
              if (Tone.context.state !== 'running') {
                Tone.context.resume().then(() => {
                  isAudioContextInitialized = true;
                  // 音频上下文启动成功
                }).catch(error => {
                  // 如果Tone.js失败，尝试使用原生AudioContext
                  if (audioContext && audioContext.state !== 'running') {
                    audioContext.resume().then(() => {
                      isAudioContextInitialized = true;
                    }).catch(() => {
                      // 音频上下文启动失败
                    });
                  }
                });
              } else {
                isAudioContextInitialized = true;
              }
            } catch (error) {
              // 静默处理启动失败
            }
          }
        };
        
        // 创建音频上下文
        createAudioContext();
        
        // 监听各种用户交互事件来启动音频上下文
        ['click', 'touchstart', 'keydown', 'mousedown', 'touchend'].forEach(event => {
          document.addEventListener(event, startAudioContext, { once: true, passive: true });
        });
        
        // 移动端特殊处理：触摸事件优化
        if (isMobile) {
          // 防止触摸事件冲突
          document.addEventListener('touchstart', startAudioContext, { once: true, passive: true });
          document.addEventListener('touchend', startAudioContext, { once: true, passive: true });
        }
      }
    }
    
    // Web Speech API 移动端优化
    function initSpeechAPI() {
      // 检查Web Speech API支持
      if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
        var synth = window.speechSynthesis;
        var isSpeechSupported = true;
        
        // 移动端语音优化
        if (isMobile) {
          // 设置移动端友好的语音参数
          var defaultVoice = null;
          
          // 尝试找到中文语音
          function findChineseVoice() {
            var voices = synth.getVoices();
            if (voices.length > 0) {
              // 优先选择中文语音
              var chineseVoice = voices.find(voice => 
                voice.lang.includes('zh') || voice.lang.includes('cmn')
              );
              if (chineseVoice) {
                defaultVoice = chineseVoice;
                return;
              }
              
              // 如果没有中文语音，选择第一个可用的
              defaultVoice = voices[0];
            }
          }
          
          // 监听语音列表加载
          if (synth.onvoiceschanged !== undefined) {
            synth.onvoiceschanged = findChineseVoice;
          }
          
          // 立即尝试获取语音列表
          findChineseVoice();
        }
        
        // 暴露语音功能到全局
        window.speechAPI = {
          speak: function(text, options = {}) {
            if (!isSpeechSupported || !synth) return;
            
            try {
              // 停止当前播放
              synth.cancel();
              
              var utterance = new SpeechSynthesisUtterance(text);
              
              // 设置移动端优化的参数
              utterance.lang = options.lang || 'zh-CN';
              utterance.rate = options.rate || 0.9; // 稍微慢一点，移动端友好
              utterance.pitch = options.pitch || 1.0;
              utterance.volume = options.volume || 0.8; // 降低音量，避免突然的大声
              
              // 设置语音
              if (defaultVoice) {
                utterance.voice = defaultVoice;
              }
              
              // 移动端错误处理
              utterance.onerror = function(event) {
                // 静默处理语音错误
              };
              
              utterance.onend = function() {
                // 语音播放结束
              };
              
              // 播放语音
              synth.speak(utterance);
              
            } catch (error) {
              // 静默处理语音错误
            }
          },
          
          stop: function() {
            if (synth) {
              synth.cancel();
            }
          },
          
          isSupported: isSpeechSupported
        };
      } else {
        // 不支持Web Speech API，提供降级方案
        window.speechAPI = {
          speak: function(text, options = {}) {
            // 降级方案：可以显示提示或使用其他方式
          },
          stop: function() {},
          isSupported: false
        };
      }
    }
    
    // Vue集成优化
    function initVue() {
      if (typeof Vue !== 'undefined') {
        window.GlobalVue = Vue;
        
        // 检查VueKinesis
        if (typeof VueKinesis !== 'undefined') {
          try {
            Vue.use(VueKinesis);
          } catch (error) {
            // VueKinesis注册失败
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
          // 初始化Web Speech API
          initSpeechAPI();
          
          // 初始化Vue
          if (!initVue()) {
            // 如果Vue还没加载，等待一下再试
            setTimeout(initVue, 100);
          }
          
          // 移动端音频和语音测试
          if (isMobile) {
            // 创建测试按钮（仅在移动端显示）
            var testContainer = document.createElement('div');
            testContainer.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;background:rgba(0,0,0,0.8);color:white;padding:10px;border-radius:5px;font-size:12px;';
            testContainer.innerHTML = 
              '<div style="margin-bottom:5px;">Mobile Test</div>' +
              '<button id="testAudio" style="margin:2px;padding:2px 5px;font-size:10px;background:#007AFF;color:white;border:none;border-radius:3px;">Test Audio</button>' +
              '<button id="testSpeech" style="margin:2px;padding:2px 5px;font-size:10px;background:#34C759;color:white;border:none;border-radius:3px;">Test Speech</button>' +
              '<button id="closeTest" style="margin:2px;padding:2px 5px;font-size:10px;background:#FF3B30;color:white;border:none;border-radius:3px;">Close</button>';
            document.body.appendChild(testContainer);
            
            // 测试音频功能
            document.getElementById('testAudio').addEventListener('click', function() {
              try {
                if (typeof Tone !== 'undefined') {
                  // 测试Tone.js
                  var osc = new Tone.Oscillator(440, "sine").toDestination();
                  osc.start().stop("+0.2");
                  this.style.background = '#34C759';
                  this.textContent = 'Audio OK';
                } else if (audioContext) {
                  // 测试原生AudioContext
                  var oscillator = audioContext.createOscillator();
                  var gainNode = audioContext.createGain();
                  oscillator.connect(gainNode);
                  gainNode.connect(audioContext.destination);
                  oscillator.frequency.value = 440;
                  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                  oscillator.start(audioContext.currentTime);
                  oscillator.stop(audioContext.currentTime + 0.2);
                  this.style.background = '#34C759';
                  this.textContent = 'Audio OK';
                } else {
                  this.style.background = '#FF9500';
                  this.textContent = 'Audio N/A';
                }
              } catch (error) {
                this.style.background = '#FF3B30';
                this.textContent = 'Audio Error';
              }
            });
            
            // 测试语音功能
            document.getElementById('testSpeech').addEventListener('click', function() {
              try {
                if (window.speechAPI && window.speechAPI.isSupported) {
                  window.speechAPI.speak('Mobile speech test successful', { lang: 'zh-CN' });
                  this.style.background = '#34C759';
                  this.textContent = 'Speech OK';
                } else {
                  this.style.background = '#FF9500';
                  this.textContent = 'Speech N/A';
                }
              } catch (error) {
                this.style.background = '#FF3B30';
                this.textContent = 'Speech Error';
              }
            });
            
            // 关闭测试面板
            document.getElementById('closeTest').addEventListener('click', function() {
              testContainer.remove();
            });
            
            // 5秒后自动隐藏测试面板
            setTimeout(function() {
              if (testContainer.parentNode) {
                testContainer.remove();
              }
            }, 5000);
          }
          
          // 执行用户代码
          ${js}
        } catch (error) {
          // 用户脚本执行错误
        }
      }, 100);
    });
    
    ${detectAndInitializeLibraries()}
  </script>
</body>
</html>`;
  }, [renderExternalLinks]);

  // 增强的库检测和初始化系统
  const detectAndInitializeLibraries = useCallback(() => {
    if (!enableLibrarySupport) return '';
    
    return `
      // 库检测和初始化系统
      window.LibraryManager = {
        libraries: {},
        versions: {},
        status: {},
        
        // 检测库是否可用
        detect: function(libraryName) {
          var lib = window[libraryName] || window[libraryName.toLowerCase()];
          if (lib) {
            this.libraries[libraryName] = lib;
            this.status[libraryName] = 'loaded';
            
            // 获取版本信息
            if (lib.version) {
              this.versions[libraryName] = lib.version;
            } else if (lib.VERSION) {
              this.versions[libraryName] = lib.VERSION;
            }
            
            return true;
          }
          return false;
        },
        
        // 初始化常用库
        initCommonLibraries: function() {
          // Vue.js 系列
          if (this.detect('Vue')) {
            console.log('Vue.js detected:', this.versions['Vue']);
            
            // Vue插件自动注册
            if (window.VueKinesis && !Vue._installedPlugins.includes('VueKinesis')) {
              try {
                Vue.use(window.VueKinesis);
                console.log('VueKinesis registered');
              } catch (e) {
                console.log('VueKinesis registration failed');
              }
            }
            
            if (window.VueRouter && !Vue._installedPlugins.includes('VueRouter')) {
              try {
                Vue.use(window.VueRouter);
                console.log('VueRouter registered');
              } catch (e) {
                console.log('VueRouter registration failed');
              }
            }
            
            if (window.Vuex && !Vue._installedPlugins.includes('Vuex')) {
              try {
                Vue.use(window.Vuex);
                console.log('Vuex registered');
              } catch (e) {
                console.log('Vuex registration failed');
              }
            }
          }
          
          // React 系列
          if (this.detect('React')) {
            console.log('React detected:', this.versions['React']);
          }
          
          if (this.detect('ReactDOM')) {
            console.log('ReactDOM detected');
          }
          
          // 音频库
          if (this.detect('Tone')) {
            console.log('Tone.js detected:', this.versions['Tone']);
          }
          
          if (this.detect('Howl')) {
            console.log('Howler.js detected');
          }
          
          // 动画库
          if (this.detect('anime')) {
            console.log('Anime.js detected');
          }
          
          if (this.detect('gsap')) {
            console.log('GSAP detected');
          }
          
          if (this.detect('lottie')) {
            console.log('Lottie detected');
          }
          
          // 3D库
          if (this.detect('THREE')) {
            console.log('Three.js detected:', this.versions['THREE']);
          }
          
          if (this.detect('Babylon')) {
            console.log('Babylon.js detected');
          }
          
          // 图表库
          if (this.detect('Chart')) {
            console.log('Chart.js detected');
          }
          
          if (this.detect('ECharts')) {
            console.log('ECharts detected');
          }
          
          // 工具库
          if (this.detect('lodash')) {
            console.log('Lodash detected');
          }
          
          if (this.detect('moment')) {
            console.log('Moment.js detected');
          }
          
          if (this.detect('dayjs')) {
            console.log('Day.js detected');
          }
          
          // 状态管理
          if (this.detect('Redux')) {
            console.log('Redux detected');
          }
          
          if (this.detect('Zustand')) {
            console.log('Zustand detected');
          }
          
          // 路由
          if (this.detect('Router')) {
            console.log('Router detected');
          }
          
          // 表单处理
          if (this.detect('Formik')) {
            console.log('Formik detected');
          }
          
          if (this.detect('ReactHookForm')) {
            console.log('React Hook Form detected');
          }
        },
        
        // 检查库依赖关系
        checkDependencies: function() {
          var missing = [];
          
          // 检查Vue相关依赖
          if (this.libraries['Vue'] && !this.libraries['VueRouter']) {
            missing.push('VueRouter (for Vue routing)');
          }
          
          if (this.libraries['Vue'] && !this.libraries['Vuex']) {
            missing.push('Vuex (for Vue state management)');
          }
          
          // 检查React相关依赖
          if (this.libraries['React'] && !this.libraries['ReactDOM']) {
            missing.push('ReactDOM (for React rendering)');
          }
          
          if (this.libraries['React'] && !this.libraries['Redux']) {
            missing.push('Redux (for React state management)');
          }
          
          return missing;
        },
        
        // 获取库状态报告
        getStatusReport: function() {
          var report = {
            loaded: Object.keys(this.libraries),
            versions: this.versions,
            missing: this.checkDependencies()
          };
          
          // 发送状态到父窗口
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              type: 'LIBRARY_STATUS',
              data: report
            }, '*');
          }
          
          return report;
        }
      };
      
      // ES6+ 模块支持
      window.ModuleLoader = {
        // 动态导入模块
        import: function(moduleName) {
          return new Promise(function(resolve, reject) {
            try {
              // 检查是否已经加载
              if (window[moduleName]) {
                resolve(window[moduleName]);
                return;
              }
              
              // 尝试动态加载
              var script = document.createElement('script');
              script.type = 'module';
              script.textContent = \`
                import \${moduleName} from '\${moduleName}';
                window[\${moduleName}] = \${moduleName};
              \`;
              
              script.onload = function() {
                resolve(window[moduleName]);
              };
              
              script.onerror = function() {
                reject(new Error('Failed to load module: ' + moduleName));
              };
              
              document.head.appendChild(script);
            } catch (error) {
              reject(error);
            }
          });
        },
        
        // 加载ES6模块
        loadES6Module: function(url) {
          return new Promise(function(resolve, reject) {
            var script = document.createElement('script');
            script.type = 'module';
            script.src = url;
            
            script.onload = function() {
              resolve();
            };
            
            script.onerror = function() {
              reject(new Error('Failed to load ES6 module: ' + url));
            };
            
            document.head.appendChild(script);
          });
        }
      };
      
      // CDN资源管理器
      window.CDNManager = {
        cdnProviders: {
          jsdelivr: 'https://cdn.jsdelivr.net/npm/',
          unpkg: 'https://unpkg.com/',
          cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs/',
          jsdelivr_esm: 'https://cdn.jsdelivr.net/npm/'
        },
        
        // 预定义的库配置
        predefinedLibraries: {
          // Vue.js 系列
          'vue': {
            urls: [
              'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js',
              'https://unpkg.com/vue@3/dist/vue.global.js'
            ],
            type: 'js',
            dependencies: []
          },
          'vue-router': {
            urls: [
              'https://cdn.jsdelivr.net/npm/vue-router@4/dist/vue-router.global.js',
              'https://unpkg.com/vue-router@4/dist/vue-router.global.js'
            ],
            type: 'js',
            dependencies: ['vue']
          },
          'vuex': {
            urls: [
              'https://cdn.jsdelivr.net/npm/vuex@4/dist/vuex.global.js',
              'https://unpkg.com/vuex@4/dist/vuex.global.js'
            ],
            type: 'js',
            dependencies: ['vue']
          },
          'vue-kinesis': {
            urls: [
              'https://cdn.jsdelivr.net/npm/vue-kinesis@1/dist/vue-kinesis.umd.js',
              'https://unpkg.com/vue-kinesis@1/dist/vue-kinesis.umd.js'
            ],
            type: 'js',
            dependencies: ['vue']
          },
          
          // React 系列
          'react': {
            urls: [
              'https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js',
              'https://unpkg.com/react@18/umd/react.production.min.js'
            ],
            type: 'js',
            dependencies: []
          },
          'react-dom': {
            urls: [
              'https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js',
              'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js'
            ],
            type: 'js',
            dependencies: ['react']
          },
          'redux': {
            urls: [
              'https://cdn.jsdelivr.net/npm/redux@4/dist/redux.min.js',
              'https://unpkg.com/redux@4/dist/redux.min.js'
            ],
            type: 'js',
            dependencies: []
          },
          'zustand': {
            urls: [
              'https://cdn.jsdelivr.net/npm/zustand@4/umd/index.production.min.js',
              'https://unpkg.com/zustand@4/umd/index.production.min.js'
            ],
            type: 'js',
            dependencies: []
          },
          
          // 音频库
          'tone': {
            urls: [
              'https://cdn.jsdelivr.net/npm/tone@14/build/Tone.js',
              'https://unpkg.com/tone@14/build/Tone.js'
            ],
            type: 'js',
            dependencies: []
          },
          'howler': {
            urls: [
              'https://cdn.jsdelivr.net/npm/howler@2/dist/howler.min.js',
              'https://unpkg.com/howler@2/dist/howler.min.js'
            ],
            type: 'js',
            dependencies: []
          },
          
          // 动画库
          'anime': {
            urls: [
              'https://cdn.jsdelivr.net/npm/animejs@3/lib/anime.min.js',
              'https://unpkg.com/animejs@3/lib/anime.min.js'
            ],
            type: 'js',
            dependencies: []
          },
          'gsap': {
            urls: [
              'https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js',
              'https://unpkg.com/gsap@3/dist/gsap.min.js'
            ],
            type: 'js',
            dependencies: []
          },
          'lottie': {
            urls: [
              'https://cdn.jsdelivr.net/npm/lottie-web@5/dist/lottie.min.js',
              'https://unpkg.com/lottie-web@5/dist/lottie.min.js'
            ],
            type: 'js',
            dependencies: []
          },
          
          // 3D库
          'three': {
            urls: [
              'https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.min.js',
              'https://unpkg.com/three@0.150.0/build/three.min.js'
            ],
            type: 'js',
            dependencies: []
          },
          'babylon': {
            urls: [
              'https://cdn.jsdelivr.net/npm/@babylonjs/core@5/babylon.min.js',
              'https://unpkg.com/@babylonjs/core@5/babylon.min.js'
            ],
            type: 'js',
            dependencies: []
          },
          
          // 图表库
          'chart': {
            urls: [
              'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.min.js',
              'https://unpkg.com/chart.js@4/dist/chart.min.js'
            ],
            type: 'js',
            dependencies: []
          },
          'echarts': {
            urls: [
              'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js',
              'https://unpkg.com/echarts@5/dist/echarts.min.js'
            ],
            type: 'js',
            dependencies: []
          },
          
          // 工具库
          'lodash': {
            urls: [
              'https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js',
              'https://unpkg.com/lodash@4/lodash.min.js'
            ],
            type: 'js',
            dependencies: []
          },
          'moment': {
            urls: [
              'https://cdn.jsdelivr.net/npm/moment@2/moment.min.js',
              'https://unpkg.com/moment@2/moment.min.js'
            ],
            type: 'js',
            dependencies: []
          },
          'dayjs': {
            urls: [
              'https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js',
              'https://unpkg.com/dayjs@1/dayjs.min.js'
            ],
            type: 'js',
            dependencies: []
          },
          
          // 表单处理
          'formik': {
            urls: [
              'https://cdn.jsdelivr.net/npm/formik@2/dist/formik.umd.min.js',
              'https://unpkg.com/formik@2/dist/formik.umd.min.js'
            ],
            type: 'js',
            dependencies: ['react']
          },
          'react-hook-form': {
            urls: [
              'https://cdn.jsdelivr.net/npm/react-hook-form@7/dist/index.umd.js',
              'https://unpkg.com/react-hook-form@7/dist/index.umd.js'
            ],
            type: 'js',
            dependencies: ['react']
          }
        },
        
        // 智能加载库
        loadLibrary: function(libraryName, version) {
          var lib = this.predefinedLibraries[libraryName.toLowerCase()];
          if (!lib) {
            return Promise.reject(new Error('Library not found: ' + libraryName));
          }
          
          // 检查依赖
          if (lib.dependencies.length > 0) {
            for (var i = 0; i < lib.dependencies.length; i++) {
              var dep = lib.dependencies[i];
              if (!window[dep] && !window[dep.toLowerCase()]) {
                return Promise.reject(new Error('Dependency not loaded: ' + dep));
              }
            }
          }
          
          // 尝试加载
          return this.loadFromUrls(lib.urls, version);
        },
        
        // 从多个URL尝试加载
        loadFromUrls: function(urls, version) {
          var self = this;
          var currentIndex = 0;
          
          function tryNext() {
            if (currentIndex >= urls.length) {
              return Promise.reject(new Error('All CDN URLs failed'));
            }
            
            var url = urls[currentIndex];
            if (version) {
              url = url.replace(/@[^\/]+/, '@' + version);
            }
            
            return self.loadScript(url).catch(function() {
              currentIndex++;
              return tryNext();
            });
          }
          
          return tryNext();
        },
        
        // 加载脚本
        loadScript: function(url) {
          return new Promise(function(resolve, reject) {
            var script = document.createElement('script');
            script.src = url;
            
            script.onload = function() {
              resolve();
            };
            
            script.onerror = function() {
              reject(new Error('Failed to load: ' + url));
            };
            
            document.head.appendChild(script);
          });
        },
        
        // 批量加载库
        loadLibraries: function(libraryNames) {
          var promises = [];
          var loaded = [];
          
          for (var i = 0; i < libraryNames.length; i++) {
            var libName = libraryNames[i];
            promises.push(
              this.loadLibrary(libName).then(function() {
                loaded.push(libName);
              }).catch(function(error) {
                console.log('Failed to load library:', libName, error.message);
              })
            );
          }
          
          return Promise.allSettled(promises).then(function() {
            return loaded;
          });
        }
      };
      
      // 自动初始化库
      window.addEventListener('load', function() {
        setTimeout(function() {
          window.LibraryManager.initCommonLibraries();
          window.LibraryManager.getStatusReport();
        }, 200);
      });
    `;
  }, [enableLibrarySupport]);

  // 性能监控
  const startPerformanceMonitoring = useCallback(() => {
    if (!enablePerformance) return;
    
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    return () => {
      const endTime = performance.now();
      const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      setPerformanceMetrics({
        loadTime: endTime - startTime,
        renderTime: endTime - startTime,
        memoryUsage: endMemory - startMemory
      });
    };
  }, [enablePerformance]);

  // 错误边界处理
  const handleError = useCallback((error: string) => {
    if (enableErrorBoundary) {
      setHasError(true);
      setErrorMessage(error);
      setIsLoading(false);
    }
    onError?.(error);
  }, [enableErrorBoundary, onError]);

  // 监听iframe消息
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PERFORMANCE_METRICS') {
        const { loadTime, memoryUsed } = event.data.data;
        setPerformanceMetrics(prev => ({
          ...prev,
          loadTime: loadTime,
          memoryUsage: memoryUsed
        }));
      }
      
      // 监听库状态消息
      if (event.data && event.data.type === 'LIBRARY_STATUS') {
        const { loaded, versions, missing } = event.data.data;
        setLibraryStatus(prev => {
          const newStatus = { ...prev };
          loaded.forEach((lib: string) => {
            newStatus[lib] = {
              loaded: true,
              error: false,
              version: versions[lib]
            };
          });
          return newStatus;
        });
      }
      
      // 监听微信就绪消息
      if (event.data && event.data.type === 'WECHAT_READY') {
        console.log('WeChat environment ready');
        // 微信环境就绪，可以开始加载内容
        if (isLoading) {
          setTimeout(() => {
            setIsLoading(false);
            onLoad?.();
          }, 1000); // 延迟1秒确保微信环境完全就绪
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // 重新渲染
  const refresh = useCallback(() => {
    setPreviewKey(prev => prev + 1);
    setIsLoading(true);
  }, []);

  return (
    <div className={`relative ${className || ''}`} style={style}>
      {/* 加载状态指示 */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">
              {isWeChat ? '微信加载中...' : '加载中...'}
            </p>
            {isWeChat && (
              <p className="text-xs text-gray-500 mt-1">
                微信浏览器可能需要更长时间
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* 性能监控显示 */}
      {enablePerformance && performanceMetrics.loadTime > 0 && (
        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs p-2 rounded z-30">
          <div>加载: {performanceMetrics.loadTime.toFixed(0)}ms</div>
          <div>内存: {(performanceMetrics.memoryUsage / 1024 / 1024).toFixed(2)}MB</div>
        </div>
      )}
      
      {/* 库状态显示 */}
      {enableLibrarySupport && Object.keys(libraryStatus).length > 0 && (
        <div className="absolute top-2 left-2 bg-blue-600/80 text-white text-xs p-2 rounded z-30 max-w-xs">
          <div className="font-semibold mb-1">已加载库:</div>
          {Object.entries(libraryStatus).slice(0, 5).map(([lib, status]) => (
            <div key={lib} className="flex items-center justify-between">
              <span>{lib}</span>
              <span className="text-green-300">{status.version || 'v?'}</span>
            </div>
          ))}
          {Object.keys(libraryStatus).length > 5 && (
            <div className="text-blue-200 text-xs mt-1">
              +{Object.keys(libraryStatus).length - 5} 更多...
            </div>
          )}
        </div>
      )}
      
      <iframe
        key={previewKey}
        ref={iframeRef}
        srcDoc={generateSrcDoc(html, css, js, externalLinks)}
        title="沙盒预览"
        sandbox="allow-scripts allow-forms allow-same-origin allow-modals allow-popups allow-presentation"
        className="w-full h-full border-0 bg-white"
        style={{
          border: 'none',
          outline: 'none',
          minHeight: '100%',
          height: '100%',
          width: '100%',
          overflow: 'auto'
        }}
        onLoad={() => {
          setIsLoading(false);
          // 启动性能监控
          const stopMonitoring = startPerformanceMonitoring();
          if (stopMonitoring) {
            setTimeout(stopMonitoring, 100);
          }
          onLoad?.();
        }}
        onError={() => {
          const errorMsg = 'Iframe加载失败';
          handleError(errorMsg);
        }}
      />
    </div>
  );
} 