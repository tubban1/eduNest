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
    <div className={`${style.bg} ${style.border} border-l-4 p-2.5 rounded-r-lg`} style={{ marginTop: '-0.2rem', marginBottom: '-0.2rem' }}>
      <div className="flex items-start gap-2">
        <span className="text-base">{style.icon}</span>
        <div className={`${style.text} text-sm leading-none`}>
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
    <div className="relative" style={{ marginTop: '-0.2rem', marginBottom: '-0.2rem' }}>
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
          borderRadius: '0.375rem',
          fontSize: '0.875rem',
          lineHeight: 1
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
          <code className="bg-white/15 px-1 py-0.5 rounded text-sm font-mono" {...props}>
            {children}
          </code>
        );
      }

      return <CodeBlock language={match?.[1]} value={code} />;
    },
    
    table({ children }: any) {
      return (
        <div className="overflow-x-auto" style={{ marginTop: '-0.2rem', marginBottom: '-0.2rem' }}>
          <table className="min-w-full border-collapse border border-gray-300">
            {children}
          </table>
        </div>
      );
    },
    
    th({ children }: any) {
      return (
        <th className="border border-gray-300 px-3 py-1.5 bg-gray-50 font-semibold text-left text-sm">
          {children}
        </th>
      );
    },
    
    td({ children }: any) {
      return (
        <td className="border border-gray-300 px-3 py-1.5 text-sm">
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
        <blockquote className="border-l-4 border-gray-400 pl-3 py-0 italic text-inherit opacity-90 text-sm leading-none" style={{ marginTop: '-0.3rem', marginBottom: '-0.3rem' }}>
          {children}
        </blockquote>
      );
    },
    
    h1: ({ children }: any) => <h1 className="text-sm font-bold" style={{ marginTop: '-0.2rem', marginBottom: '-0.2rem' }}>{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-sm font-bold" style={{ marginTop: '-0.2rem', marginBottom: '-0.2rem' }}>{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-sm font-bold" style={{ marginTop: '-0.2rem', marginBottom: '-0.2rem' }}>{children}</h3>,
    h4: ({ children }: any) => <h4 className="text-sm font-bold" style={{ marginTop: '-0.2rem', marginBottom: '-0.2rem' }}>{children}</h4>,
    
    p: ({ children }: any) => <p className="text-sm leading-relaxed" style={{ marginTop: '-0.4rem', marginBottom: '-0.4rem' }}>{children}</p>,
    
    ul: ({ children }: any) => (
      <ul className="list-disc list-inside space-y-0 pl-1" style={{ marginTop: '-0.4rem', marginBottom: '-0.4rem' }}>
        {children}
      </ul>
    ),
    
    ol: ({ children }: any) => (
      <ol className="list-decimal list-inside space-y-0 pl-1" style={{ marginTop: '-0.4rem', marginBottom: '-0.4rem' }}>
        {children}
      </ol>
    ),
    
    li: ({ children }: any) => <li className="text-sm leading-relaxed py-0" style={{ marginTop: '-0.2rem', marginBottom: '-0.3rem' }}>{children}</li>,
    
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
        className="max-w-full h-auto rounded-lg"
        style={{ marginTop: '-0.2rem', marginBottom: '-0.2rem' }}
      />
    )
  };

  return (
    <div
      ref={containerRef}
      className={`ai-guide-message text-sm ${isLatest ? 'latest-message' : ''}`}
      data-message-id={messageId}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .ai-guide-message p { margin-top: -0.4rem !important; margin-bottom: -0.4rem !important; }
        .ai-guide-message ol { margin-top: -0.4rem !important; margin-bottom: -0.4rem !important; }
        .ai-guide-message ul { margin-top: -0.4rem !important; margin-bottom: -0.4rem !important; }
        .ai-guide-message li { margin-top: -0.2rem !important; margin-bottom: -0.3rem !important; }
        .ai-guide-message p + ol, .ai-guide-message p + ul { margin-top: -0.5rem !important; }
        .ai-guide-message ol + p, .ai-guide-message ul + p { margin-top: -0.5rem !important; }
        .ai-guide-message p + p { margin-top: -0.4rem !important; }
        .ai-guide-message h3, .ai-guide-message h4 { margin-top: -0.2rem !important; }
      `}} />
      {(() => {
        const processedContent = preprocessContent(content);
        
        return (
          <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[
              rehypeKatex
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
