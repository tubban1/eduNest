'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Logo from '@/components/Logo';

interface ContentData {
  id: string;
  short_id: string;
  title: string;
  description?: string;
  code_html: string;
  code_css: string;
  code_js: string;
  external_links: string;
  tags: string[];
}

export default function ContentViewPage({ params }: { params: { short_id: string } }) {
  const router = useRouter();
  const [content, setContent] = useState<ContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        // 使用short_id查询内容
        const data = await api.content.getByShortId(params.short_id);
        if (data) {
          setContent(data);
        } else {
          setError('内容不存在');
        }
      } catch (error) {
        setError('加载内容失败');
        console.error('加载内容失败:', error);
      } finally {
        setLoading(false);
      }
    };

    if (params.short_id) {
      fetchContent();
    }
  }, [params.short_id]);

  // 智能返回逻辑
  const handleBack = () => {
    // 检查是否有历史记录
    if (window.history.length > 1) {
      // 有历史记录，尝试返回
      try {
        router.back();
      } catch (error) {
        // 返回失败，跳转到内容列表页
        router.push('/content');
      }
    } else {
      // 没有历史记录，直接跳转到内容列表页
      router.push('/content');
    }
  };

  // 添加键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 渲染外部依赖链接
  function renderExternalLinks(links: string | string[]) {
    let arr: string[] = [];
    if (Array.isArray(links)) {
      arr = links;
    } else if (typeof links === 'string') {
      arr = links
        .split(/\n|,|;/)
        .map(link => link.trim())
        .filter(Boolean);
    }
    
    // 确保Vue.js在插件之前加载
    const cssFiles = arr.filter(link => link.endsWith('.css'));
    const jsFiles = arr.filter(link => !link.endsWith('.css'));
    const vueFiles = jsFiles.filter(link => link.includes('vue'));
    const otherFiles = jsFiles.filter(link => !link.includes('vue'));
    const sortedJsFiles = [...vueFiles, ...otherFiles];
    
    const cssLinks = cssFiles.map(link => `<link rel="stylesheet" href="${link}">`).join('\n');
    const jsScripts = sortedJsFiles.map(link => `<script src="${link}"></script>`).join('\n');
    
    return `${cssLinks}\n${jsScripts}`;
  }

  // 生成预览文档
  const generateSrcDoc = (content: ContentData) => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  ${renderExternalLinks(content.external_links)}
  <style>
    /* 重置默认样式 */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      width: 100%;
      min-height: 100vh;
      border: none;
      outline: none;
      overflow-x: hidden;
    }
    
    /* 确保根元素也是全尺寸 */
    #root, #app, [data-v-app] {
      width: 100%;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    /* 游戏容器优化 */
    .game-container {
      max-width: 100%;
      overflow-x: auto;
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
    
    /* 响应式设计 */
    @media (max-width: 768px) {
      .game-container {
        transform: scale(0.9);
      }
      
      .game-content {
        flex-direction: column;
      }
      
      .game-board {
        width: 100%;
        max-width: 300px;
      }
      
      .side-panel {
        flex-direction: row;
        justify-content: center;
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
    ${content.code_css}
  </style>
</head>
<body>
  ${content.code_html}
  <script>
    // 全局错误处理
    window.addEventListener('error', function(e) {
      console.error('Script error:', e.error);
    });
    
    // Tone.js 音频上下文处理
    function initToneAudioContext() {
      if (typeof Tone !== 'undefined') {
        // 监听用户交互事件来启动音频上下文
        const startAudioContext = () => {
          if (Tone.context.state !== 'running') {
            Tone.context.resume();
            console.log('Tone.js 音频上下文已启动');
          }
        };
        
        // 监听各种用户交互事件
        ['click', 'touchstart', 'keydown', 'mousedown'].forEach(event => {
          document.addEventListener(event, startAudioContext, { once: true });
        });
      }
    }
    
    // 简化的Vue加载检查
    function waitForVue() {
      if (typeof Vue !== 'undefined') {
        window.GlobalVue = Vue;
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
          
          // 检查Vue是否加载
          if (typeof Vue !== 'undefined') {
            window.GlobalVue = Vue;
            
            // 检查VueKinesis
            if (typeof VueKinesis !== 'undefined') {
              try {
                Vue.use(VueKinesis);
                console.log('VueKinesis 注册成功');
              } catch (error) {
                console.error('VueKinesis 注册失败:', error);
              }
            }
          }
          
          // 执行用户代码
          ${content.code_js}
        } catch (error) {
          console.error('User script error:', error);
        }
      }, 100);
    });
  </script>
</body>
</html>`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">❌</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">内容不存在</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* 顶部导航栏 */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200 z-10 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 sm:gap-4">
            <Logo size="sm" />
            <button 
              onClick={handleBack}
              title="返回上一页或内容列表"
              className="text-gray-500 hover:text-black text-sm font-medium transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回
            </button>
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">{content.title}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <button
              onClick={() => setPreviewKey(prev => prev + 1)}
              className="px-3 py-1 text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              刷新
            </button>
          </div>
        </div>
      </div>

      {/* 信息区域 - 显示 description 和完整的 tags */}
      {(content.description || (content.tags && content.tags.length > 0)) && (
        <div className="bg-gray-50/80 backdrop-blur-sm border-b border-gray-200 flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              {/* Description */}
              {content.description && (
                <div className="flex-1">
                  <div className="text-sm text-gray-600 mb-1">描述</div>
                  <div className="text-sm text-gray-800 leading-relaxed">{content.description}</div>
                </div>
              )}
              
              {/* Tags */}
              {content.tags && content.tags.length > 0 && (
                <div className="flex-shrink-0">
                  <div className="text-sm text-gray-600 mb-1">标签</div>
                  <div className="flex flex-wrap gap-1">
                    {content.tags.map((tag, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 全尺寸内容渲染区域 */}
      <div className="flex-1 w-full h-0 relative">
        <iframe
          key={previewKey}
          srcDoc={generateSrcDoc(content)}
          title="内容预览"
          sandbox="allow-scripts allow-forms allow-same-origin"
          className="w-full h-full border-0 outline-none"
          style={{
            border: 'none',
            outline: 'none',
            minHeight: '100%',
            height: '100%',
            width: '100%',
            overflow: 'auto'
          }}
        />
      </div>
    </div>
  );
} 