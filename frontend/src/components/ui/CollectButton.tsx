'use client';

import { useState, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import CollectionListDialog from '../CollectionListDialog';

interface CollectButtonProps {
  contentId: string;
  initialCollected?: boolean;
  initialCollectionCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  showText?: boolean;
  className?: string;
  onCollectChange?: (collected: boolean, count: number) => void;
}

export default function CollectButton({
  contentId,
  initialCollected = false,
  initialCollectionCount = 0,
  size = 'md',
  showCount = true,
  showText = true,
  className = '',
  onCollectChange
}: CollectButtonProps) {
  const { t } = useTranslation(['content', 'common']);
  const [mounted, setMounted] = useState(false);
  const [isCollected, setIsCollected] = useState(initialCollected);
  const [collectionCount, setCollectionCount] = useState(initialCollectionCount);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCollectionDialog, setShowCollectionDialog] = useState(false);
  const [collectionLists, setCollectionLists] = useState<any[]>([]);

  useEffect(() => { setMounted(true); }, []);
  
  // 监听初始状态变化
  useEffect(() => {
    setIsCollected(initialCollected);
    setCollectionCount(initialCollectionCount);
  }, [initialCollected, initialCollectionCount]);

  // 加载收藏列表
  const loadCollectionLists = async () => {
    try {
      const response = await api.get('/collection_lists');
      if (response && typeof response === 'object' && 'success' in response && response.success) {
        setCollectionLists((response as any).data);
      }
    } catch (error) {
      console.error('Failed to load collection lists:', error);
    }
  };

  useEffect(() => {
    if (showCollectionDialog) {
      loadCollectionLists();
    }
  }, [showCollectionDialog]);

  const handleCollect = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isProcessing) return;
    
    if (isCollected) {
      // 取消收藏（默认操作：从第一个列表移除）
      setIsProcessing(true);
      try {
        const collections = await api.getCollectionsByContent(contentId);
        if (collections.length > 0) {
          const result = await api.removeContentFromList(contentId, collections[0].list_id);
          if (result.success) {
            setIsCollected(false);
            setCollectionCount(prev => Math.max(0, prev - 1));
            onCollectChange?.(false, collectionCount - 1);
          }
        } else {
          // 没有任何列表，则直接更新状态
          setIsCollected(false);
          onCollectChange?.(false, Math.max(0, collectionCount - 1));
        }
      } catch (error) {
        console.error('Failed to remove from collection:', error);
      } finally {
        setIsProcessing(false);
      }
    } else {
      // 显示收藏对话框，由对话框内部完成添加/移除
      setShowCollectionDialog(true);
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
    <>
      <button
        onClick={handleCollect}
        disabled={isProcessing}
        className={`flex items-center transition-colors ${
          isCollected 
            ? 'text-blue-600 hover:text-blue-700' 
            : 'text-gray-600 hover:text-gray-700'
        } ${sizeClasses[size]} ${className} ${
          isProcessing ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        title={isCollected ? 
          (mounted ? t('collected', { ns: 'content', defaultValue: 'Collected' }) : 'Collected') : 
          (mounted ? t('collect', { ns: 'content', defaultValue: 'Collect' }) : 'Collect')
        }
      >
        <Bookmark className={`${iconSizes[size]} mr-1 ${isCollected ? 'fill-current' : ''}`} />
        {showText && (
          isCollected ? 
            (mounted ? t('collected', { ns: 'content', defaultValue: 'Collected' }) : 'Collected') : 
            (mounted ? t('collect', { ns: 'content', defaultValue: 'Collect' }) : 'Collect')
        )}
        {showCount && collectionCount > 0 && (
          <span className="ml-1">({collectionCount})</span>
        )}
      </button>

      {/* 收藏对话框 */}
      <CollectionListDialog
        open={showCollectionDialog}
        onClose={() => setShowCollectionDialog(false)}
        lists={collectionLists}
        onSave={() => { /* 由对话框内部直接处理保存 */ }}
        onCreateList={async (list) => {
          try {
            const result = await api.createCollectionList(list.name, list.visibility);
            if (result.success) {
              await loadCollectionLists();
            }
          } catch (error) {
            console.error('Failed to create collection list:', error);
          }
        }}
        refreshLists={() => { void loadCollectionLists(); }}
        contentId={contentId}
      />
    </>
  );
} 