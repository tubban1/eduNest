'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { api, Content } from '@/lib/api';
import FullHTMLRenderer from './FullHTMLRenderer';
import MathText from './MathText';
import { useTranslation } from 'react-i18next';

interface LargeContentCardProps {
  content: Content & {
    likes_count?: number;
    collections_count?: number;
    quality_score?: number;
  };
  onPreview?: (content: Content) => void;
}

export default function LargeContentCard({ content, onPreview }: LargeContentCardProps) {
  const { t } = useTranslation(['common']);
  const [mounted, setMounted] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const generateThumbnail = async () => {
      if (!content.full_html) {
        setThumbnail(null);
        return;
      }

      setThumbnailLoading(true);
      try {
        // 首先尝试快速提取 SVG（不需要渲染）
        const { extractThumbnailFromHTML, generateThumbnailFromHTML } = await import('@/utils/thumbnailGenerator');
        const extracted = extractThumbnailFromHTML(content.full_html);
        if (extracted.type === 'svg' && extracted.data) {
          setThumbnail(extracted.data);
          setThumbnailLoading(false);
          return;
        }

        // 如果有 Canvas，需要渲染 HTML 来生成缩略图
        if (extracted.type === 'canvas') {
          const thumbnailData = await generateThumbnailFromHTML(content.full_html, {
            width: 800,
            height: 500,
            quality: 0.7,
            timeout: 5000
          });
          setThumbnail(thumbnailData);
        } else {
          // 尝试从 HTML 中提取第一张图片作为预览图
          const match = content.full_html.match(/<img[^>]+src=["']([^"']+)["']/i);
          setThumbnail(match ? match[1] : null);
        }
      } catch (error) {
        console.error('Failed to generate thumbnail:', error);
        setThumbnail(null);
      } finally {
        setThumbnailLoading(false);
      }
    };

    if (content.full_html) {
      generateThumbnail();
    }
  }, [content.full_html, content.id]);
  
  // 从 HTML 中提取第一张图片作为预览图（作为备用）
  const getPreviewImage = () => {
    if (!content.full_html) return null;
    const match = content.full_html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return match ? match[1] : null;
  };
  
  // 根据标签获取 emoji
  const getEmojiByTags = (tags?: string[]) => {
    if (!tags || !Array.isArray(tags)) return '📚';
    const tagString = tags.join(' ').toLowerCase();
    if (tagString.includes('数学') || tagString.includes('math')) return '🔢';
    if (tagString.includes('物理') || tagString.includes('physics')) return '⚡';
    if (tagString.includes('化学') || tagString.includes('chemistry')) return '🧪';
    if (tagString.includes('生物') || tagString.includes('biology')) return '🧬';
    if (tagString.includes('几何') || tagString.includes('geometry')) return '📐';
    return '📚';
  };
  
  const previewImage = getPreviewImage();
  const emoji = getEmojiByTags(content.tags);
  const finalThumbnail = thumbnail || previewImage;
  
  return (
    <>
      <div className="bg-card rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all border border-border">
        {/* 预览图区域 */}
        <div className="relative h-64 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 overflow-hidden">
          {thumbnailLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : finalThumbnail ? (
            <div className="relative w-full h-full">
              {/* 使用 img 标签而不是 Next.js Image，因为可能是外部图片或 data URL */}
              <img
                src={finalThumbnail}
                alt={content.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // 如果图片加载失败，显示 emoji
                  (e.target as HTMLImageElement).style.display = 'none';
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    parent.innerHTML = `<div class="flex items-center justify-center h-full"><span class="text-8xl">${emoji}</span></div>`;
                  }
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-8xl">{emoji}</span>
            </div>
          )}
          {/* 质量标签 */}
          {content.quality_score && content.quality_score > 10 && (
            <div className="absolute top-4 right-4 px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm font-semibold shadow-lg">
              {mounted ? t('featured', { ns: 'common', defaultValue: '⭐ 精选' }) : '⭐ 精选'}
            </div>
          )}
        </div>
        
        {/* 内容区域 */}
        <div className="p-6">
          {/* 标签和分类 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {content.tags && content.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
              >
                {tag}
              </span>
            ))}
            {content.language_code && (
              <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-sm">
                {content.language_code}
              </span>
            )}
          </div>
          
          {/* 标题 - 支持数学表达式渲染 */}
          <MathText
            as="h3"
            text={content.title}
            className="text-2xl font-bold text-foreground mb-3 line-clamp-2"
          />
          
          {/* 描述 */}
          {content.description && (
            <p className="text-muted-foreground mb-4 line-clamp-3">
              {content.description}
            </p>
          )}
          
          {/* 统计数据 */}
          <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
            {content.likes_count && content.likes_count > 0 && (
              <span className="flex items-center gap-1">
                <span>❤️</span>
                <span>{content.likes_count}</span>
              </span>
            )}
            {content.collections_count && content.collections_count > 0 && (
              <span className="flex items-center gap-1">
                <span>⭐</span>
                <span>{content.collections_count}</span>
              </span>
            )}
            <span>{new Date(content.created_at).toLocaleDateString()}</span>
          </div>
          
          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Link
              href={`/c/${content.short_id}`}
              className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors text-center font-medium"
            >
              开始学习
            </Link>
            <button
              onClick={() => setShowPreview(true)}
              className="px-6 py-3 border border-input rounded-lg hover:bg-muted transition-colors font-medium"
            >
              快速预览
            </button>
          </div>
        </div>
      </div>
      
      {/* 预览模态框 */}
      {showPreview && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border border-slate-200 dark:border-slate-600"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 模态框头部 */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{content.title}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            {/* 预览内容 */}
            <div className="flex-1 overflow-auto">
              {content.full_html ? (
                <FullHTMLRenderer
                  fullHTML={content.full_html}
                  externalUrl={`/full-html/${content.short_id}`}
                  autoHeight={false}
                  fixedHeight={false}
                  enableHeightListener={true}
                  className="w-full h-full"
                />
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  暂无预览内容
                </div>
              )}
            </div>
            
            {/* 模态框底部 */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-600 flex justify-end gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-600"
              >
                关闭
              </button>
              <Link
                href={`/c/${content.short_id}`}
                className="ai-gradient-btn px-6 py-2 rounded-lg inline-block text-center"
              >
                查看完整内容
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

