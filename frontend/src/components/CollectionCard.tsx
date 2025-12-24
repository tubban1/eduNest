'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Copy, Trash2, ThumbsUp, X, Eye, Bookmark } from 'lucide-react';
import ContentActionButtons from './ui/ContentActionButtons';
// EditButton removed - edit functionality not needed for c pages
import CollectionListDialog from './CollectionListDialog';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';

interface CollectionContent {
  id: string;
  short_id?: string;
  title: string;
  language_code: string;
  tags?: string[];
  knowledge_point?: string[];
  created_at: string;
}

interface CollectionInfo {
  id: string;
  added_at: string;
  list_id?: string;
  list_name?: string;
  is_liked?: boolean;
}

interface CollectionCardProps {
  content: CollectionContent;
  collectionInfo: CollectionInfo;
  onAction: (action: string, contentId: string, listId?: string) => Promise<void>;
  refreshLists?: () => Promise<void>;
}

export default function CollectionCard({ content, collectionInfo, onAction, refreshLists }: CollectionCardProps) {
  const { t } = useTranslation(['content', 'common']);
  const [isLiked, setIsLiked] = useState(collectionInfo.is_liked || false);
  const [showActions, setShowActions] = useState(false);
  const [showCollectionDialog, setShowCollectionDialog] = useState(false);
  const [collectionLists, setCollectionLists] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // 监听 collectionInfo 的变化，更新喜欢状态
  useEffect(() => {
    setIsLiked(collectionInfo.is_liked || false);
  }, [collectionInfo.is_liked]);

  // 加载收藏列表
  useEffect(() => {
    if (showCollectionDialog) {
      loadCollectionLists();
    }
  }, [showCollectionDialog]);

  const loadCollectionLists = async () => {
    try {
      const response = await api.get('/collection_lists');
      if (response && typeof response === 'object' && 'success' in response && response.success) {
        setCollectionLists((response as any).data);
      }
    } catch (error) {
      // 加载收藏列表失败
    }
  };

  const handleAction = async (action: string) => {
    try {
      if (action === 'like') {
        // 乐观更新
        setIsLiked(true);
        
        const result = await api.likeContent(content.id);
        if (!result.success) {
          // 回滚状态
          setIsLiked(false);
        }
      } else if (action === 'unlike') {
        // 乐观更新
        setIsLiked(false);
        
        const result = await api.unlikeContent(content.id);
        if (!result.success) {
          // 回滚状态
          setIsLiked(true);
        }
      } else if (action === 'collect') {
        setShowCollectionDialog(true);
      }
      
      // 刷新收藏列表
      if (refreshLists) {
        await refreshLists();
      }
    } catch (error) {
      // 操作失败处理
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // 已复制到剪贴板
    } catch (error) {
      // 复制失败处理
    }
  };

  const createNewList = async (name: string, visibility: string) => {
    try {
      await api.createCollection({ name, visibility });
      if (refreshLists) await refreshLists(); // 新建后刷新
    } catch (error) {
      // 创建收藏列表失败处理
      throw error; // 重新抛出错误，让 NewListDialog 处理
    }
  };

  const handleRefreshLists = async () => {
    await loadCollectionLists();
  };


  return (
    <div className="overflow-visible hover:shadow-lg transition-shadow group">
      {/* 内容信息 */}
      <div className="p-4">
        {/* 标题 - 可点击跳转 */}
        <Link href={`/c/${content.short_id || content.id}`} prefetch={false} className="block">
          <h3 className="font-semibold text-foreground mb-2 line-clamp-2 hover:text-primary transition-colors cursor-pointer">
            {content.title}
          </h3>
        </Link>

        {/* 标签 */}
        {content.tags && content.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {content.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
            {content.tags.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                +{content.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* 快速操作按钮 */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            {/* 使用统一的按钮组件 */}
            <ContentActionButtons
              contentId={content.id}
              shortId={content.short_id}
              title={content.title}
              initialLiked={isLiked}
              initialCollected={false}
              initialLikeCount={0}
              initialCollectionCount={0}
              size="md"
              showCount={false}
              showText={false}
              onLikeChange={(liked) => {
                setIsLiked(liked);
                // 更新父组件的状态
                if (refreshLists) {
                  refreshLists();
                }
              }}
              onCollectChange={() => {
                // 更新父组件的状态
                if (refreshLists) {
                  refreshLists();
                }
              }}
            />
            {/* Edit button removed - edit functionality not available in c pages */}
          </div>
        </div>
      </div>

      {/* 收藏对话框 */}
      <CollectionListDialog
        open={showCollectionDialog}
        onClose={() => setShowCollectionDialog(false)}
        lists={collectionLists}
        onSave={() => {}}
        onCreateList={list => createNewList(list.name, list.visibility)}
        refreshLists={handleRefreshLists}
        contentId={content.id}
      />
    </div>
  );
} 