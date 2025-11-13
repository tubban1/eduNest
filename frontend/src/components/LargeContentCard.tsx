'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, Content } from '@/lib/api';
import FullHTMLRenderer from './FullHTMLRenderer';

interface LargeContentCardProps {
  content: Content & {
    likes_count?: number;
    collections_count?: number;
    quality_score?: number;
  };
  onPreview?: (content: Content) => void;
}

export default function LargeContentCard({ content, onPreview }: LargeContentCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);

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
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all border border-gray-200">
        {/* 预览图区域 */}
        <div className="relative h-64 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 overflow-hidden">
          {thumbnailLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
            <div className="absolute top-4 right-4 px-3 py-1 bg-green-500 text-white rounded-full text-sm font-semibold shadow-lg">
              ⭐ 精选
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
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
              >
                {tag}
              </span>
            ))}
            {content.language_code && (
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                {content.language_code}
              </span>
            )}
          </div>
          
          {/* 标题 */}
          <h3 className="text-2xl font-bold text-gray-900 mb-3 line-clamp-2">
            {content.title}
          </h3>
          
          {/* 描述 */}
          {content.description && (
            <p className="text-gray-600 mb-4 line-clamp-3">
              {content.description}
            </p>
          )}
          
          {/* 统计数据 */}
          <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
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
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center font-medium"
            >
              开始学习
            </Link>
            <button
              onClick={() => setShowPreview(true)}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              快速预览
            </button>
          </div>
        </div>
      </div>
      
      {/* 预览模态框 */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 模态框头部 */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">{content.title}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
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
                <div className="p-8 text-center text-gray-500">
                  暂无预览内容
                </div>
              )}
            </div>
            
            {/* 模态框底部 */}
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                关闭
              </button>
              <Link
                href={`/c/${content.short_id}`}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                查看完整内容
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

