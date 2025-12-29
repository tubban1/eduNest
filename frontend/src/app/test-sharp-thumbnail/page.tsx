'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function TestSharpThumbnail() {
  const { t } = useTranslation();
  const [svgContent, setSvgContent] = useState(`<svg width="640" height="360" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1">
        <animate attributeName="stop-color" values="#667eea;#764ba2;#667eea" dur="3s" repeatCount="indefinite"/>
      </stop>
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1">
        <animate attributeName="stop-color" values="#764ba2;#667eea;#764ba2" dur="3s" repeatCount="indefinite"/>
      </stop>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="640" height="360" fill="url(#grad)"/>
  <!-- Animated title -->
  <text x="320" y="155" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="bold" 
        fill="white" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)">
    <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite"/>
    <animateTransform attributeName="transform" type="scale" values="1;1.1;1" dur="2s" repeatCount="indefinite"/>
    测试标题
  </text>
  <!-- Animated watermark -->
  <text x="320" y="200" font-family="Arial, Helvetica, sans-serif" font-size="20" 
        fill="rgba(255,255,255,0.95)" text-anchor="middle" dominant-baseline="middle">
    <animate attributeName="opacity" values="0.7;1;0.7" dur="1.5s" repeatCount="indefinite"/>
    EduNest AI
  </text>
  <!-- Animated circles -->
  <circle cx="100" cy="100" r="20" fill="rgba(255,255,255,0.3)">
    <animate attributeName="cx" values="100;500;100" dur="4s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="100;200;100" dur="4s" repeatCount="indefinite"/>
    <animate attributeName="r" values="20;30;20" dur="2s" repeatCount="indefinite"/>
  </circle>
  <circle cx="540" cy="260" r="15" fill="rgba(255,255,255,0.2)">
    <animate attributeName="cx" values="540;140;540" dur="5s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="260;100;260" dur="5s" repeatCount="indefinite"/>
    <animate attributeName="r" values="15;25;15" dur="2.5s" repeatCount="indefinite"/>
  </circle>
  <!-- Rotating star -->
  <polygon points="320,50 325,65 340,65 328,75 333,90 320,80 307,90 312,75 300,65 315,65" 
           fill="rgba(255,255,255,0.4)">
    <animateTransform attributeName="transform" type="rotate" values="0 320 70;360 320 70" 
                      dur="3s" repeatCount="indefinite"/>
  </polygon>
</svg>`);
  
  const [step1Result, setStep1Result] = useState<string | null>(null);
  const [step2Result, setStep2Result] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<string | null>(null);
  const [step1Method, setStep1Method] = useState<string | null>(null);
  const [svgDataUrl, setSvgDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const testSvgDirectRender = () => {
    setError(null);
    setSvgDataUrl(null);
    setLogs([]);
    
    try {
      addLog('测试直接渲染 SVG...');
      
      // Convert SVG to data URL
      const svgBase64 = btoa(unescape(encodeURIComponent(svgContent)));
      const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
      setSvgDataUrl(dataUrl);
      
      addLog(`✅ SVG 转换为 data URL 成功`);
      addLog(`Data URL 长度: ${dataUrl.length} 字符`);
      addLog(`SVG 原始长度: ${svgContent.length} 字符`);
    } catch (err: any) {
      const errorMsg = err.message || '未知错误';
      setError(errorMsg);
      addLog(`❌ 错误：${errorMsg}`);
    }
  };

  const testSharpConversion = async () => {
    setLoading(true);
    setError(null);
    setStep1Result(null);
    setStep2Result(null);
    setFinalResult(null);
    setLogs([]);

    try {
      addLog('开始测试 Sharp SVG 转 PNG...');
      
      // 调用后端 API
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiBaseUrl}/test-sharp-thumbnail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ svgContent }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '转换失败');
      }

      addLog('✅ 转换成功！');
      
      if (data.step1) {
        setStep1Result(data.step1);
        const method = data.step1Method || 'unknown';
        addLog(`第一步：SVG 转 PNG（中间结果）- ${data.step1Size} bytes (方法: ${method})`);
        setStep1Method(method);
      }
      
      if (data.step2) {
        setStep2Result(data.step2);
        addLog(`第二步：Resize 到 640x360 - ${data.step2Size} bytes`);
      }
      
      if (data.final) {
        setFinalResult(data.final);
        addLog(`最终结果：${data.finalSize} bytes`);
      }

    } catch (err: any) {
      const errorMsg = err.message || '未知错误';
      setError(errorMsg);
      addLog(`❌ 错误：${errorMsg}`);
      console.error('Sharp conversion error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Sharp Thumbnail 测试</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">SVG 内容</h2>
          <textarea
            value={svgContent}
            onChange={(e) => setSvgContent(e.target.value)}
            className="w-full h-64 p-4 border border-gray-300 rounded font-mono text-sm"
            placeholder="输入 SVG 内容..."
          />
          <div className="mt-4 flex gap-4">
            <button
              onClick={testSharpConversion}
              disabled={loading || !svgContent.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? '转换中...' : '测试 Sharp 转换'}
            </button>
            <button
              onClick={testSvgDirectRender}
              disabled={!svgContent.trim()}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              直接渲染 SVG
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-red-800 font-semibold mb-2">错误</h3>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Direct SVG Render Test */}
        {svgDataUrl && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">直接渲染 SVG（Data URL）</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-2">使用 &lt;img&gt; 标签</h4>
                <img 
                  src={svgDataUrl} 
                  alt="SVG rendered via img tag"
                  className="w-full border border-gray-200 rounded"
                  style={{ maxHeight: '360px', objectFit: 'contain' }}
                />
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">使用内联 SVG</h4>
                <div 
                  className="w-full border border-gray-200 rounded overflow-hidden"
                  style={{ maxHeight: '360px' }}
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              </div>
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded text-xs font-mono break-all">
              <div className="font-semibold mb-1">Data URL (前 200 字符):</div>
              <div className="text-gray-600">{svgDataUrl.substring(0, 200)}...</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Step 1: SVG to PNG (intermediate) */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">第一步：SVG → PNG（中间结果）</h3>
            {step1Result ? (
              <div>
                <img 
                  src={`data:image/png;base64,${step1Result}`} 
                  alt="Step 1 result"
                  className="w-full border border-gray-200 rounded"
                />
                <p className="text-sm text-gray-600 mt-2">✅ 成功</p>
                {step1Method && (
                  <p className="text-xs text-gray-500 mt-1">使用方法: {step1Method}</p>
                )}
              </div>
            ) : (
              <div className="h-48 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                等待转换...
              </div>
            )}
          </div>

          {/* Step 2: Resize to 640x360 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">第二步：Resize 到 640x360</h3>
            {step2Result ? (
              <div>
                <img 
                  src={`data:image/png;base64,${step2Result}`} 
                  alt="Step 2 result"
                  className="w-full border border-gray-200 rounded"
                />
                <p className="text-sm text-gray-600 mt-2">✅ 成功</p>
              </div>
            ) : (
              <div className="h-48 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                等待转换...
              </div>
            )}
          </div>

          {/* Final Result */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">最终结果</h3>
            {finalResult ? (
              <div>
                <img 
                  src={`data:image/png;base64,${finalResult}`} 
                  alt="Final result"
                  className="w-full border border-gray-200 rounded"
                />
                <p className="text-sm text-gray-600 mt-2">✅ 完成</p>
              </div>
            ) : (
              <div className="h-48 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                等待转换...
              </div>
            )}
          </div>
        </div>

        {/* Logs */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">日志</h3>
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">暂无日志...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">{log}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

