'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, BookOpen, Edit3, Copy, Trash2, ThumbsUp, X, Eye, Bookmark } from 'lucide-react';
import CollectionListDialog from './CollectionListDialog';
import { api } from '@/lib/api';

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
}

export default function CollectionCard({ content, collectionInfo, onAction }: CollectionCardProps) {
  const [isLiked, setIsLiked] = useState(collectionInfo.is_liked || false);
  const [showActions, setShowActions] = useState(false);
  const [showCollectionDialog, setShowCollectionDialog] = useState(false);
  const [collectionLists, setCollectionLists] = useState<any[]>([]);

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
      const response = await api.request('/collection_lists');
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

  // 生成封面颜色
  const getCoverColor = () => {
    const colors = [
      'bg-gradient-to-br from-blue-400 to-blue-600',
      'bg-gradient-to-br from-green-400 to-green-600',
      'bg-gradient-to-br from-purple-400 to-purple-600',
      'bg-gradient-to-br from-orange-400 to-orange-600',
      'bg-gradient-to-br from-pink-400 to-pink-600',
      'bg-gradient-to-br from-indigo-400 to-indigo-600',
    ];
    const index = content.id.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow group">
        {/* 封面 */}
        <div className={`h-32 ${getCoverColor()} relative overflow-hidden`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-white opacity-80" />
          </div>
          {/* 操作按钮悬浮层 */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex space-x-1">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* 展开的操作菜单 */}
          {showActions && (
            <div className="absolute top-10 right-2 bg-white rounded-lg shadow-lg p-2 space-y-1 min-w-32">
              <Link
                href={`/content/${content.short_id || content.id}`}
                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                <Eye className="w-4 h-4 mr-2" />
                查看
              </Link>
              <Link
                href={`/content/edit/${content.id}`}
                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                编辑
              </Link>
              <button
                onClick={() => copyToClipboard(content.title)}
                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                <Copy className="w-4 h-4 mr-2" />
                复制
              </button>
              <button
                onClick={() => handleAction('collect')}
                className="flex items-center w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                <Bookmark className="w-4 h-4 mr-2" />
                收藏
              </button>
            </div>
          )}
        </div>

        {/* 内容信息 */}
        <div className="p-4">
          {/* 标题 */}
          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
            {content.title}
          </h3>

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
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <Link
              href={`/content/${content.short_id || content.id}`}
              className="flex items-center text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Eye className="w-4 h-4 mr-1" />
              查看
            </Link>
            <div className="flex items-center space-x-3">
              <button
                onClick={async () => {
                  const newAction = isLiked ? 'unlike' : 'like';
                  await handleAction(newAction);
                }}
                className={`flex items-center text-sm transition-colors ${
                  isLiked 
                    ? 'text-red-600 hover:text-red-700' 
                    : 'text-gray-600 hover:text-gray-700'
                }`}
              >
                <Heart className={`w-4 h-4 mr-1 ${isLiked ? 'fill-current' : ''}`} />
                {isLiked ? '已喜欢' : '喜欢'}
              </button>
              <button
                onClick={() => handleAction('collect')}
                className="flex items-center text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Bookmark className="w-4 h-4 mr-1" />
                收藏
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 收藏对话框 */}
      <CollectionListDialog
        open={showCollectionDialog}
        onClose={() => setShowCollectionDialog(false)}
        lists={collectionLists}
        onSave={() => {}}
        onCreateList={createNewList}
        refreshLists={handleRefreshLists}
        contentId={content.id}
      />
    </>
  );
} 