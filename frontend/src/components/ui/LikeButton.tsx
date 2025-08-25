'use client';

import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';

interface LikeButtonProps {
  contentId: string;
  initialLiked?: boolean;
  initialLikeCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  showText?: boolean;
  className?: string;
  onLikeChange?: (liked: boolean, count: number) => void;
}

export default function LikeButton({
  contentId,
  initialLiked = false,
  initialLikeCount = 0,
  size = 'md',
  showCount = true,
  showText = true,
  className = '',
  onLikeChange
}: LikeButtonProps) {
  const { t } = useTranslation(['content', 'common']);
  const [mounted, setMounted] = useState(false);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  
  // 监听初始状态变化
  useEffect(() => {
    setIsLiked(initialLiked);
    setLikeCount(initialLikeCount);
  }, [initialLiked, initialLikeCount]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      if (isLiked) {
        // 取消点赞
        const result = await api.unlikeContent(contentId);
        if (result.success) {
          setIsLiked(false);
          setLikeCount(prev => Math.max(0, prev - 1));
          onLikeChange?.(false, likeCount - 1);
        }
      } else {
        // 点赞
        const result = await api.likeContent(contentId);
        if (result.success) {
          setIsLiked(true);
          setLikeCount(prev => prev + 1);
          onLikeChange?.(true, likeCount + 1);
        }
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <button
      onClick={handleLike}
      disabled={isProcessing}
      className={`flex items-center transition-colors ${
        isLiked 
          ? 'text-red-600 hover:text-red-700' 
          : 'text-gray-600 hover:text-gray-700'
      } ${sizeClasses[size]} ${className} ${
        isProcessing ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      title={isLiked ? 
        (mounted ? t('liked', { ns: 'content', defaultValue: 'Liked' }) : 'Liked') : 
        (mounted ? t('like', { ns: 'content', defaultValue: 'Like' }) : 'Like')
      }
    >
      <Heart className={`${iconSizes[size]} mr-1 ${isLiked ? 'fill-current' : ''}`} />
      {showText && (
        isLiked ? 
          (mounted ? t('liked', { ns: 'content', defaultValue: 'Liked' }) : 'Liked') : 
          (mounted ? t('like', { ns: 'content', defaultValue: 'Like' }) : 'Like')
      )}
      {showCount && likeCount > 0 && (
        <span className="ml-1">({likeCount})</span>
      )}
    </button>
  );
} 