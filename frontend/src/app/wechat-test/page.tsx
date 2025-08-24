'use client';

import React, { useState } from 'react';
import WeChatRedirect from '@/components/WeChatRedirect';
import WeChatCompatibleRenderer from '@/components/WeChatCompatibleRenderer';
import WeChatUltraSimpleRenderer from '@/components/WeChatUltraSimpleRenderer';
import CodePenStyleRenderer from '@/components/CodePenStyleRenderer';

export default function WeChatTestPage() {
  const [rendererType, setRendererType] = useState<'original' | 'ultra-simple' | 'codepen-style'>('original');
  const [testContent] = useState({
    html: `
      <div id="app">
        <header style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 28px; color: #2c3e50; margin-bottom: 5px;">微信兼容性测试</h1>
          <p style="color: #7f8c8d; font-size: 16px;">这是一个专门用于测试微信浏览器的页面</p>
        </header>
        
        <main style="max-width: 900px; margin: 0 auto; padding: 20px;">
          <div class="test-section" style="margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 10px;">
            <h2 style="color: #2c3e50; margin-bottom: 15px;">基础功能测试</h2>
            <button id="test-btn" onclick="testClick()" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">
              点击测试
            </button>
            <div id="test-result" style="margin-top: 15px; padding: 10px; border-left: 4px solid #e74c3c; background: #f8f9fa;">
              等待测试...
            </div>
          </div>
          
          <div class="test-section" style="margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 10px;">
            <h2 style="color: #2c3e50; margin-bottom: 15px;">样式测试</h2>
            <div class="style-test" style="display: flex; gap: 15px; flex-wrap: wrap;">
              <div class="color-box red" style="width: 100px; height: 100px; background: #e74c3c; color: white; display: flex; align-items: center; justify-content: center; border-radius: 10px;">
                红色方块
              </div>
              <div class="color-box blue" style="width: 100px; height: 100px; background: #3498db; color: white; display: flex: align-items: center; justify-content: center; border-radius: 10px;">
                蓝色方块
              </div>
              <div class="color-box green" style="width: 100px; height: 100px; background: #2ecc71; color: white; display: flex; align-items: center; justify-content: center; border-radius: 10px;">
                绿色方块
              </div>
            </div>
          </div>
        </main>
      </div>
    `,
    css: `
      body {
        font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", Helvetica, Arial, sans-serif;
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        min-height: 100vh;
        color: #333;
        margin: 0;
        padding: 0;
      }
      
      #app {
        max-width: 900px;
        margin: 0 auto;
        padding: 20px;
      }
      
      .test-section {
        background: white;
        border-radius: 15px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        transition: transform 0.3s;
      }
      
      .test-section:hover {
        transform: translateY(-2px);
      }
      
      button {
        transition: all 0.3s;
      }
      
      button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      }
      
      @media (max-width: 768px) {
        #app {
          padding: 10px;
        }
        
        .style-test {
          justify-content: center;
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
        console.log('Click test successful');
      }
      
      // 页面加载完成后的初始化
      document.addEventListener('DOMContentLoaded', function() {
        console.log('微信测试页面加载完成');
        
        // 添加按钮悬停效果
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
        
        // 添加微信特殊样式
        const style = document.createElement('style');
        style.textContent = \`
          .wechat-browser .test-section {
            border: 2px solid #00b894;
          }
        \`;
        document.head.appendChild(style);
      }
      
      // 触摸设备检测
      if ('ontouchstart' in window) {
        console.log('触摸设备检测成功');
        document.body.classList.add('touch-device');
      }
      
      // 全局错误处理
      window.addEventListener('error', function(e) {
        console.error('Global error:', e.message);
        const result = document.getElementById('test-result');
        if (result) {
          result.innerHTML += \`<br>❌ 全局错误: \${e.message}\`;
        }
      });
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
          <p className="text-gray-600 mb-4">
            这个页面专门用于测试微信浏览器的兼容性，包含基础功能、Vue.js和样式测试
          </p>
          
          {/* 渲染器选择 */}
          <div className="flex justify-center gap-4 mb-6 flex-wrap">
            <button
              onClick={() => setRendererType('original')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                rendererType === 'original'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🔧 原始微信兼容渲染器
            </button>
            <button
              onClick={() => setRendererType('ultra-simple')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                rendererType === 'ultra-simple'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🚀 超简化微信渲染器
            </button>
            <button
              onClick={() => setRendererType('codepen-style')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                rendererType === 'codepen-style'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🎨 CodePen风格渲染器
            </button>
          </div>
          
          <div className="text-sm text-gray-500">
            当前使用: <span className="font-semibold">
              {rendererType === 'original' ? '原始微信兼容渲染器' : 
               rendererType === 'ultra-simple' ? '超简化微信渲染器' : 'CodePen风格渲染器'}
            </span>
          </div>
        </div>
        
        <WeChatRedirect
          className="bg-white rounded-lg shadow-lg overflow-hidden"
          fallback={
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">测试内容预览</h3>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded">
                  <h4 className="font-medium mb-2">基础功能测试</h4>
                  <p className="text-sm text-gray-600">包含点击测试、样式测试等功能</p>
                </div>
                <div className="p-4 bg-gray-50 rounded">
                  <h4 className="font-medium mb-2">三种渲染器</h4>
                  <p className="text-sm text-gray-600">原始版本、超简化版本、CodePen风格版本</p>
                </div>
              </div>
            </div>
          }
        >
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {rendererType === 'original' ? (
              <WeChatCompatibleRenderer
                html={testContent.html}
                css={testContent.css}
                js={testContent.js}
                externalLinks={testContent.externalLinks}
                title="微信兼容性测试 - 原始版本"
                className="w-full"
                style={{ height: '80vh' }}
              />
            ) : rendererType === 'ultra-simple' ? (
              <WeChatUltraSimpleRenderer
                html={testContent.html}
                css={testContent.css}
                js={testContent.js}
                externalLinks={testContent.externalLinks}
                title="微信兼容性测试 - 超简化版本"
                className="w-full"
                style={{ height: '80vh' }}
              />
            ) : (
              <CodePenStyleRenderer
                html={testContent.html}
                css={testContent.css}
                js={testContent.js}
                externalLinks={testContent.externalLinks}
                title="微信兼容性测试 - CodePen风格版本"
                className="w-full"
                style={{ height: '80vh' }}
              />
            )}
          </div>
        </WeChatRedirect>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p className="mb-2">如果页面无法正常显示，请尝试：</p>
          <ul className="space-y-1">
            <li>• 点击"重新加载"按钮</li>
            <li>• 下载HTML文件在浏览器中打开</li>
            <li>• 检查微信版本是否最新</li>
            <li>• 尝试切换不同的渲染器</li>
          </ul>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">测试说明：</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>基础功能测试</strong>: 点击按钮测试JavaScript是否正常工作</li>
            <li>• <strong>样式测试</strong>: 查看CSS样式是否正确渲染</li>
            <li>• <strong>三种渲染器</strong>: 测试不同的内容渲染方式</li>
            <li>• <strong>微信优化</strong>: 在微信中会引导用户打开浏览器</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 