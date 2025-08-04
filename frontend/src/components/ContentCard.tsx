'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CollectionListDialog from './CollectionListDialog';
import { api } from '@/lib/api';

interface ContentCardProps {
  content: {
    id: string;
    short_id?: string;
    title: string;
    language: string;
    tags?: string[];
    knowledge_point?: string[];
    created_at: string;
  };
  isAuthenticated: boolean;
  editMode: boolean;
  lists: { id: string; name: string; visibility: string }[];
  refreshLists: () => Promise<void>;
}

export default function ContentCard({ content, isAuthenticated, editMode, lists, refreshLists }: ContentCardProps) {
  const [showDialog, setShowDialog] = useState(false);
  const router = useRouter();

  // 新增：实现handleCreateList并传递给CollectionListDialog
  const handleCreateList = async ({ name, visibility }: { name: string; visibility: string }) => {
    try {
      await api.createCollection({ name, visibility });
      if (refreshLists) await refreshLists(); // 新建后刷新
    } catch (error: any) {
      console.error('创建收藏列表失败:', error);
      throw error; // 重新抛出错误，让 NewListDialog 处理
    }
  };

  // 处理收藏按钮点击，阻止事件冒泡
  const handleCollectionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDialog(true);
  };

  // 处理编辑按钮点击
  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/content/edit/${content.id}`);
  };

  // 使用short_id，如果没有则回退到id
  const contentUrl = content.short_id ? `/content/${content.short_id}` : `/content/${content.id}`;

  return (
    <Link href={contentUrl} className="block">
      <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow w-64 min-w-56 max-w-xs mx-auto cursor-pointer">
        <div className="p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2">
            {content.title}
          </h3>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
              {content.language === 'zh-CN' ? '中文' : 'English'}
            </span>
          </div>
          {/* 标签块状显示，优先显示tags，没有则回退knowledge_point */}
          <div className="flex flex-wrap gap-1 mb-2">
            {(content.tags && content.tags.length > 0 ? content.tags : content.knowledge_point)?.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-500">
              {new Date(content.created_at).toLocaleDateString()}
            </span>
            {isAuthenticated && (
              <button
                onClick={handleCollectionClick}
                className="px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-blue-100 hover:text-blue-700 text-xs transition"
              >收藏</button>
            )}
          </div>
          {editMode && (
            <div className="mt-2">
              <button
                onClick={handleEditClick}
                className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700 transition-colors text-sm"
              >
                编辑
              </button>
            </div>
          )}
        </div>
        <CollectionListDialog 
          open={showDialog} 
          onClose={() => setShowDialog(false)} 
          onCreateList={handleCreateList} 
          lists={lists || []} 
          refreshLists={refreshLists}
          contentId={content.id}
          onSave={async (lists) => {
            // 这里可以处理保存逻辑
          }}
        />
      </div>
    </Link>
  );
} 