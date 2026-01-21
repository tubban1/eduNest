'use client';

import { useEffect, useLayoutEffect, useRef, useCallback, createElement } from 'react';

/**
 * MathText - 渲染包含数学表达式的文本
 * 
 * 支持格式：
 * - $...$ 行内公式
 * - $$...$$ 块级公式
 */
interface MathTextProps {
  text: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  [key: string]: any; // 允许传递其他 props
}

export default function MathText({ 
  text, 
  className = '', 
  as: Component = 'span',
  ...props 
}: MathTextProps) {
  const containerRef = useRef<HTMLElement | null>(null);

  // 使用 ref 回调来设置元素引用
  const setRef = useCallback((node: HTMLElement | null) => {
    containerRef.current = node;
    // 当元素挂载后，立即设置文本内容
    if (node) {
      node.textContent = text;
    }
  }, [text]);

  // 使用 useLayoutEffect 确保在浏览器绘制前执行
  useLayoutEffect(() => {
    // 检查是否包含数学表达式
    const hasMath = /\$[^$]+\$/.test(text) || /\$\$[^$]+\$\$/.test(text);
    if (!hasMath || typeof window === 'undefined' || !containerRef.current) return;

    // 动态加载 KaTeX auto-render（如果还没加载）
    const initKaTeX = async () => {
      // 检查是否已有 renderMathInElement
      if (typeof (window as any).renderMathInElement === 'function') {
        render();
        return;
      }

      // 检查是否已有 KaTeX
      if (typeof (window as any).katex === 'undefined') {
        // 动态加载 katex
        const katexScript = document.createElement('script');
        katexScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js';
        katexScript.onerror = () => {
          katexScript.src = 'https://tubban1.oss-cn-beijing.aliyuncs.com/static/lib/katex.min.js';
        };
        
        await new Promise<void>((resolve, reject) => {
          katexScript.onload = () => resolve();
          katexScript.onerror = () => reject(new Error('Failed to load KaTeX'));
          document.head.appendChild(katexScript);
        });
      }

      // 加载 auto-render
      if (typeof (window as any).renderMathInElement === 'undefined') {
        const autoRenderScript = document.createElement('script');
        autoRenderScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js';
        autoRenderScript.onerror = () => {
          autoRenderScript.src = 'https://tubban1.oss-cn-beijing.aliyuncs.com/static/lib/auto-render.min.js';
        };
        
        await new Promise<void>((resolve, reject) => {
          autoRenderScript.onload = () => resolve();
          autoRenderScript.onerror = () => reject(new Error('Failed to load KaTeX auto-render'));
          document.head.appendChild(autoRenderScript);
        });
      }

      render();
    };

    const render = () => {
      if (!containerRef.current || typeof (window as any).renderMathInElement !== 'function') {
        return;
      }

      try {
        // 确保文本内容是最新的
        if (containerRef.current.textContent !== text) {
          containerRef.current.textContent = text;
        }
        
        (window as any).renderMathInElement(containerRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\[', right: '\\]', display: true },
            { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false
        });
      } catch (error) {
        console.warn('Math rendering failed:', error);
      }
    };

    // 使用 requestAnimationFrame 确保 DOM 已更新
    requestAnimationFrame(() => {
      initKaTeX();
    });
  }, [text]);

  // 使用 React.createElement 来动态创建元素（因为 Component 是动态的）
  return createElement(
    Component,
    {
      ref: setRef,
      className,
      ...props
    }
  );
}
