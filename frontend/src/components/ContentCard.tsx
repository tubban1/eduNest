'use client';

import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import CollectionListDialog from './CollectionListDialog';
import ContentActionButtons from './ui/ContentActionButtons';
import EditButton from './ui/EditButton';
import { api } from '@/lib/api';

interface ContentCardProps {
  content: {
    id: string;
    short_id?: string;
    title: string;
    language_code: string;
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
  const { t } = useTranslation(['content', 'common']);
  const [showDialog, setShowDialog] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // 新增：语言标签映射（仅按主语言，使用当前系统语言翻译）
  const getLanguageLabel = (codeRaw: string): string => {
    const primary = (codeRaw || '').trim().toLowerCase().split('-')[0];

    // 使用 i18n key，按主语言码映射到通用名称，由当前 UI 语言决定显示
    const keyMap: Record<string, { key: string; fallback: string }> = {
      zh: { key: 'languageNames.zh', fallback: 'Chinese' },
      en: { key: 'languageNames.en', fallback: 'English' },
      ja: { key: 'languageNames.ja', fallback: 'Japanese' },
      ko: { key: 'languageNames.ko', fallback: 'Korean' },
      es: { key: 'languageNames.es', fallback: 'Spanish' },
      fr: { key: 'languageNames.fr', fallback: 'French' },
      de: { key: 'languageNames.de', fallback: 'German' },
      pt: { key: 'languageNames.pt', fallback: 'Portuguese' },
      it: { key: 'languageNames.it', fallback: 'Italian' },
      ru: { key: 'languageNames.ru', fallback: 'Russian' },
      ar: { key: 'languageNames.ar', fallback: 'Arabic' },
      hi: { key: 'languageNames.hi', fallback: 'Hindi' },
      nl: { key: 'languageNames.nl', fallback: 'Dutch' },
      sv: { key: 'languageNames.sv', fallback: 'Swedish' },
    };

    if (keyMap[primary]) {
      const { key, fallback } = keyMap[primary];
      return mounted ? t(key, { ns: 'content', defaultValue: fallback }) : fallback;
    }

    // 兜底：显示原始 code
    return codeRaw || 'N/A';
  };

  // 新增：实现handleCreateList并传递给CollectionListDialog
  const handleCreateList = async ({ name, visibility }: { name: string; visibility: string }) => {
    try {
      await api.createCollection({ name, visibility });
      if (refreshLists) await refreshLists(); // 新建后刷新
    } catch (error) {
      // 创建收藏列表失败处理
      throw error; // 重新抛出错误，让 NewListDialog 处理
    }
  };



  // 使用short_id，如果没有则回退到id
  const contentUrl = content.short_id ? `/content/${content.short_id}` : `/content/${content.id}`;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow w-64 min-w-56 max-w-xs mx-auto">
      <div className="p-4">
        {/* 标题 - 可点击跳转 */}
        <Link href={contentUrl} prefetch={false} className="block">
          <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2 hover:text-blue-600 transition-colors cursor-pointer">
            {content.title}
          </h3>
        </Link>
        
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
            {getLanguageLabel(content.language_code)}
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
        </div>
        
        {/* 操作按钮区域 */}
        {isAuthenticated && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <ContentActionButtons
                contentId={content.id}
                shortId={content.short_id}
                title={content.title}
                initialLiked={false}
                initialCollected={false}
                initialLikeCount={0}
                initialCollectionCount={0}
                size="md"
                showCount={false}
                showText={false}
                onCollectChange={() => {
                  // 更新父组件的状态
                  if (refreshLists) {
                    refreshLists();
                  }
                }}
              />
              {editMode && (
                <EditButton contentId={content.id} size="md" />
              )}
            </div>
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
  );
} 