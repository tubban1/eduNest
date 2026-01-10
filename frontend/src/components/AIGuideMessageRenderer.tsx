import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Copy, Check } from 'lucide-react';

interface AIGuideMessageRendererProps {
  content: string;
  messageId: string;
  isLatest?: boolean;
}

interface CalloutProps {
  type: 'warning' | 'success' | 'error' | 'conclusion';
  children: React.ReactNode;
}

const Callout: React.FC<CalloutProps> = ({ type, children }) => {
  const styles = {
    warning: {
      icon: '⚠️',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800'
    },
    success: {
      icon: '✅',
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800'
    },
    error: {
      icon: '❌',
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800'
    },
    conclusion: {
      icon: '👉',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800'
    }
  };

  const style = styles[type];

  return (
    <div className={`${style.bg} ${style.border} border-l-4 p-4 my-4 rounded-r-lg`}>
      <div className="flex items-start">
        <span className="text-lg mr-2">{style.icon}</span>
        <div className={`${style.text} text-sm leading-relaxed`}>
          {children}
        </div>
      </div>
    </div>
  );
};

const CodeBlock: React.FC<{ language?: string; value: string }> = ({ language, value }) => {
  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="relative my-4">
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={tomorrow}
        customStyle={{
          margin: 0,
          borderRadius: '0.5rem',
          fontSize: '0.875rem'
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

const AIGuideMessageRenderer: React.FC<AIGuideMessageRendererProps> = ({
  content,
  messageId,
  isLatest = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const preprocessContent = (text: string): string => {
    const normalized = text
      .replace(/\\\[/g, '$$')
      .replace(/\\\]/g, '$$')
      .replace(/\\\(/g, '$')
      .replace(/\\\)/g, '$');

    return normalized
      .replace(/^>\s*\[!warning\]\s*$(.*?)(?=^[^>]|\n\n|\n$)/gms, (_match, content) => {
        return `<callout type="warning">\n${content.replace(/^>\s?/gm, '')}\n</callout>`;
      })
      .replace(/^>\s*\[!success\]\s*$(.*?)(?=^[^>]|\n\n|\n$)/gms, (_match, content) => {
        return `<callout type="success">\n${content.replace(/^>\s?/gm, '')}\n</callout>`;
      })
      .replace(/^>\s*\[!error\]\s*$(.*?)(?=^[^>]|\n\n|\n$)/gms, (_match, content) => {
        return `<callout type="error">\n${content.replace(/^>\s?/gm, '')}\n</callout>`;
      })
      .replace(/^>\s*\[!conclusion\]\s*$(.*?)(?=^[^>]|\n\n|\n$)/gms, (_match, content) => {
        return `<callout type="conclusion">\n${content.replace(/^>\s?/gm, '')}\n</callout>`;
      });
  };

  const components = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const code = String(children).replace(/\n$/, '');
      
      if (inline) {
        return (
          <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono" {...props}>
            {children}
          </code>
        );
      }

      return <CodeBlock language={match?.[1]} value={code} />;
    },
    
    table({ children }: any) {
      return (
        <div className="overflow-x-auto my-4">
          <table className="min-w-full border-collapse border border-gray-300">
            {children}
          </table>
        </div>
      );
    },
    
    th({ children }: any) {
      return (
        <th className="border border-gray-300 px-4 py-2 bg-gray-50 font-semibold text-left">
          {children}
        </th>
      );
    },
    
    td({ children }: any) {
      return (
        <td className="border border-gray-300 px-4 py-2">
          {children}
        </td>
      );
    },
    
    blockquote({ children }: any) {
      // 处理自定义callout
      const childText = String(children);
      
      if (childText.includes('<callout')) {
        const typeMatch = childText.match(/type="(\w+)"/);
        const contentMatch = childText.match(/>([\s\S]*)<\/callout>/);
        
        if (typeMatch && contentMatch) {
          const type = typeMatch[1] as CalloutProps['type'];
          const content = contentMatch[1].trim();
          
          return (
            <Callout type={type}>
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
                components={components}
              >
                {content}
              </ReactMarkdown>
            </Callout>
          );
        }
      }
      
      return (
        <blockquote className="border-l-4 border-gray-300 pl-4 my-4 italic text-gray-700">
          {children}
        </blockquote>
      );
    },
    
    h1: ({ children }: any) => <h1 className="text-2xl font-bold my-4">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-xl font-bold my-3">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-lg font-bold my-2">{children}</h3>,
    h4: ({ children }: any) => <h4 className="text-base font-bold my-2">{children}</h4>,
    
    p: ({ children }: any) => <p className="my-3 leading-relaxed">{children}</p>,
    
    ul: ({ children }: any) => (
      <ul className="list-disc list-inside my-3 space-y-1">
        {children}
      </ul>
    ),
    
    ol: ({ children }: any) => (
      <ol className="list-decimal list-inside my-3 space-y-1">
        {children}
      </ol>
    ),
    
    li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
    
    strong: ({ children }: any) => <strong className="font-bold">{children}</strong>,
    
    em: ({ children }: any) => <em className="italic">{children}</em>,
    
    a: ({ href, children }: any) => (
      <a
        href={href}
        className="text-blue-600 hover:text-blue-800 underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    
    img: ({ src, alt }: any) => (
      <img
        src={src}
        alt={alt}
        className="max-w-full h-auto rounded-lg my-4"
      />
    )
  };

  return (
    <div
      ref={containerRef}
      className={`ai-guide-message ${isLatest ? 'latest-message' : ''} prose prose-sm max-w-none`}
      data-message-id={messageId}
    >
      {(() => {
        const processedContent = preprocessContent(content);

        console.log('[AIGuideMessageRenderer] processed length:', processedContent.length);
        console.log('[AIGuideMessageRenderer] processed preview:', processedContent.slice(0, 200));

        const debugRemarkPlugin = () => {
          return (tree: any) => {
            const mathNodes: Array<{ type: string; value?: string }> = [];
            const visit = (node: any) => {
              if (!node) return;
              if (node.type === 'math' || node.type === 'inlineMath') {
                mathNodes.push({ type: node.type, value: node.value });
              }
              if (Array.isArray(node.children)) {
                node.children.forEach(visit);
              }
            };

            visit(tree);
            console.log('[AIGuideMessageRenderer] remark math nodes:', mathNodes.length);
            console.log('[AIGuideMessageRenderer] remark math sample:', mathNodes.slice(0, 3));
            return tree;
          };
        };

        const debugRehypePlugin = () => {
          return (tree: any) => {
            const hits: Array<{ tagName?: string; className?: any }> = [];
            const visit = (node: any) => {
              if (!node) return;
              if (node.type === 'element') {
                const className = node.properties?.className;
                const classStr = Array.isArray(className) ? className.join(' ') : String(className || '');
                if (classStr.includes('katex') || classStr.includes('math-')) {
                  hits.push({ tagName: node.tagName, className });
                }
              }
              if (Array.isArray(node.children)) {
                node.children.forEach(visit);
              }
            };

            visit(tree);
            console.log('[AIGuideMessageRenderer] rehype katex/math nodes:', hits.length);
            console.log('[AIGuideMessageRenderer] rehype sample:', hits.slice(0, 6));
            return tree;
          };
        };
        
        return (
          <ReactMarkdown
            remarkPlugins={[remarkMath, debugRemarkPlugin, remarkGfm]}
            rehypePlugins={[
              rehypeKatex,
              debugRehypePlugin
            ]}
            components={components}
          >
            {processedContent}
          </ReactMarkdown>
        );
      })()}
    </div>
  );
};

export default AIGuideMessageRenderer;
