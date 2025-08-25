'use client';

import { useState, useEffect } from 'react';
import LikeButton from './LikeButton';
import CollectButton from './CollectButton';
import ShareButton from './ShareButton';

interface ContentActionButtonsProps {
  contentId: string;
  shortId?: string;
  title?: string;
  initialLiked?: boolean;
  initialCollected?: boolean;
  initialLikeCount?: number;
  initialCollectionCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  showText?: boolean;
  className?: string;
  onLikeChange?: (liked: boolean, count: number) => void;
  onCollectChange?: (collected: boolean, count: number) => void;
  onShare?: () => void;
  layout?: 'horizontal' | 'vertical';
  spacing?: 'tight' | 'normal' | 'loose';
}

export default function ContentActionButtons({
  contentId,
  shortId,
  title,
  initialLiked = false,
  initialCollected = false,
  initialLikeCount = 0,
  initialCollectionCount = 0,
  size = 'md',
  showCount = true,
  showText = true,
  className = '',
  onLikeChange,
  onCollectChange,
  onShare,
  layout = 'horizontal',
  spacing = 'normal'
}: ContentActionButtonsProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => { setMounted(true); }, []);

  const spacingClasses = {
    tight: 'space-x-2',
    normal: 'space-x-3',
    loose: 'space-x-4'
  };

  const layoutClasses = {
    horizontal: 'flex items-center',
    vertical: 'flex flex-col items-start space-y-2'
  };

  return (
    <div className={`${layoutClasses[layout]} ${layout === 'horizontal' ? spacingClasses[spacing] : ''} ${className}`}>
      <LikeButton
        contentId={contentId}
        initialLiked={initialLiked}
        initialLikeCount={initialLikeCount}
        size={size}
        showCount={showCount}
        showText={showText}
        onLikeChange={onLikeChange}
      />
      
      <CollectButton
        contentId={contentId}
        initialCollected={initialCollected}
        initialCollectionCount={initialCollectionCount}
        size={size}
        showCount={showCount}
        showText={showText}
        onCollectChange={onCollectChange}
      />
      
      <ShareButton
        contentId={contentId}
        shortId={shortId}
        title={title}
        size={size}
        showText={showText}
        onShare={onShare}
      />
    </div>
  );
} 