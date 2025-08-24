'use client';

import React, { useState } from 'react';
import WeChatCompatibleRenderer from '@/components/WeChatCompatibleRenderer';

export default function WeChatTestPage() {
  const [testContent] = useState({
    html: `
      <div id="app">
        <header>
          <h1>微信兼容性测试</h1>
          <p>这是一个专门用于测试微信浏览器的页面</p>
        </header>
        
        <main>
          <div class="test-section">
            <h2>基础功能测试</h2>
            <button id="test-btn" onclick="testClick()">点击测试</button>
            <div id="test-result">等待测试...</div>
          </div>
          
          <div class="test-section">
            <h2>Vue.js 测试</h2>
            <div id="vue-test">
              <p>Vue状态: <span id="vue-status">检测中...</span></p>
              <button id="vue-btn" onclick="testVue()">测试Vue</button>
              <div id="vue-result">等待Vue测试...</div>
            </div>
          </div>
          
          <div class="test-section">
            <h2>样式测试</h2>
            <div class="style-test">
              <div class="color-box red">红色方块</div>
              <div class="color-box blue">蓝色方块</div>
              <div class="color-box green">绿色方块</div>
            </div>
          </div>
        </main>
      </div>
    `,
    css: `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
        margin: 0;
        padding: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        color: white;
      }
      
      #app {
        max-width: 800px;
        margin: 0 auto;
      }
      
      header {
        text-align: center;
        margin-bottom: 40px;
      }
      
      header h1 {
        font-size: 2.5rem;
        margin-bottom: 10px;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
      }
      
      header p {
        font-size: 1.2rem;
        opacity: 0.9;
      }
      
      .test-section {
        background: rgba(255,255,255,0.1);
        border-radius: 15px;
        padding: 25px;
        margin-bottom: 30px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.2);
      }
      
      .test-section h2 {
        margin-top: 0;
        margin-bottom: 20px;
        color: #ffd700;
        font-size: 1.5rem;
      }
      
      button {
        background: linear-gradient(45deg, #ff6b6b, #ee5a24);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 25px;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      }
      
      button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.3);
      }
      
      button:active {
        transform: translateY(0);
      }
      
      #test-result, #vue-result {
        margin-top: 15px;
        padding: 15px;
        background: rgba(255,255,255,0.1);
        border-radius: 10px;
        border-left: 4px solid #00b894;
        font-family: monospace;
        font-size: 0.9rem;
      }
      
      .style-test {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
        justify-content: center;
      }
      
      .color-box {
        width: 120px;
        height: 120px;
        border-radius: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        text-align: center;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        transition: transform 0.3s ease;
      }
      
      .color-box:hover {
        transform: scale(1.05);
      }
      
      .color-box.red {
        background: linear-gradient(45deg, #ff6b6b, #ee5a24);
      }
      
      .color-box.blue {
        background: linear-gradient(45deg, #74b9ff, #0984e3);
      }
      
      .color-box.green {
        background: linear-gradient(45deg, #00b894, #00a085);
      }
      
      @media (max-width: 768px) {
        body {
          padding: 15px;
        }
        
        header h1 {
          font-size: 2rem;
        }
        
        .test-section {
          padding: 20px;
        }
        
        .style-test {
          gap: 15px;
        }
        
        .color-box {
          width: 100px;
          height: 100px;
          font-size: 0.9rem;
        }
      }
    `,
    js: `
      // 基础功能测试
      function testClick() {
        const result = document.getElementById('test-result');
        const timestamp = new Date().toLocaleTimeString();
        result.innerHTML = \`✅ 点击测试成功 - \${timestamp}<br>✅ 基础JavaScript功能正常\`;
        result.style.borderLeftColor = '#00b894';
      }
      
      // Vue.js 测试
      function testVue() {
        const result = document.getElementById('vue-result');
        const status = document.getElementById('vue-status');
        
        if (typeof Vue !== 'undefined') {
          status.textContent = '✅ 已加载 v' + Vue.version;
          result.innerHTML = \`✅ Vue.js 加载成功<br>✅ 版本: \${Vue.version}<br>✅ Vue功能正常\`;
          result.style.borderLeftColor = '#00b894';
          
          // 测试Vue响应式
          try {
            const testApp = Vue.createApp({
              data() {
                return {
                  message: 'Vue响应式测试成功!'
                }
              },
              template: '<div>{{ message }}</div>'
            });
            
            const testDiv = document.createElement('div');
            testDiv.id = 'vue-test-app';
            document.body.appendChild(testDiv);
            
            testApp.mount('#vue-test-app');
            
            setTimeout(() => {
              document.body.removeChild(testDiv);
            }, 2000);
            
          } catch (error) {
            result.innerHTML += \`<br>⚠️ Vue响应式测试失败: \${error.message}\`;
          }
          
        } else {
          status.textContent = '❌ 未加载';
          result.innerHTML = '❌ Vue.js 未加载<br>❌ 请检查网络连接和CDN链接';
          result.style.borderLeftColor = '#e74c3c';
        }
      }
      
      // 页面加载完成后的初始化
      document.addEventListener('DOMContentLoaded', function() {
        console.log('微信测试页面加载完成');
        
        // 自动测试Vue
        setTimeout(testVue, 1000);
        
        // 添加一些交互效果
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
          btn.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px) scale(1.05)';
          });
          
          btn.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
          });
        });
      });
      
      // 微信环境检测
      if (/MicroMessenger/i.test(navigator.userAgent)) {
        console.log('微信浏览器环境检测成功');
        document.body.classList.add('wechat-browser');
      }
      
      // 触摸事件优化
      if ('ontouchstart' in window) {
        console.log('触摸设备检测成功');
        document.body.classList.add('touch-device');
      }
    `,
    externalLinks: [
      'https://unpkg.com/vue@3/dist/vue.global.prod.js'
    ]
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">微信兼容性测试页面</h1>
          <p className="text-gray-600">
            这个页面专门用于测试微信浏览器的兼容性，包含基础功能、Vue.js和样式测试
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <WeChatCompatibleRenderer
            html={testContent.html}
            css={testContent.css}
            js={testContent.js}
            externalLinks={testContent.externalLinks}
            title="微信兼容性测试"
            className="w-full"
            style={{ height: '80vh' }}
          />
        </div>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>如果页面无法正常显示，请尝试：</p>
          <ul className="mt-2 space-y-1">
            <li>• 点击"重新加载"按钮</li>
            <li>• 下载HTML文件在浏览器中打开</li>
            <li>• 检查微信版本是否最新</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 