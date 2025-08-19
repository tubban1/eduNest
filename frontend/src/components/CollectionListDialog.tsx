import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { MoreVertical, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';

interface CollectionList {
  id?: string;
  name: string;
  visibility: string;
  order_index?: number;
}

function MenuButton({ onMoveUp, onMoveDown, onDelete, canMoveUp, canMoveDown }: any) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-1.5 rounded-md hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
          <MoreVertical className="h-4 w-4 text-gray-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onMoveUp} disabled={!canMoveUp} className="cursor-pointer">
          <ChevronUp className="mr-2 h-4 w-4" />
          上移
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMoveDown} disabled={!canMoveDown} className="cursor-pointer">
          <ChevronDown className="mr-2 h-4 w-4" />
          下移
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive cursor-pointer">
          <Trash2 className="mr-2 h-4 w-4" />
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NewListDialog({ open, onClose, onCreate, refreshLists }: { open: boolean; onClose: () => void; onCreate: (list: CollectionList) => Promise<void>; refreshLists: () => void }) {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onCreate({ name: title.trim(), visibility: 'private' });
      setTitle('');
      onClose();
    } catch (error: any) {
      setError(error.message || '创建列表失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div 
        className="bg-white rounded-xl shadow-xl w-80 flex flex-col p-6"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="font-semibold text-lg mb-4">新建列表</div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onFocus={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          placeholder="输入列表名称"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
        />
        {error && (
          <div className="text-red-600 text-sm mt-2">{error}</div>
        )}
        <div className="flex gap-2 mt-4">
          <button 
            className="flex-1 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
          >
            取消
          </button>
          <button
            className={`flex-1 py-2 rounded-lg text-white ${title.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCreate();
            }}
            disabled={!title.trim() || loading}
          >
            {loading ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 渲染收藏checkbox
function renderCollectionCheckbox(isCollected: boolean, onToggle: () => void) {
  return (
    <input
      type="checkbox"
      checked={isCollected}
      onChange={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
    />
  );
}

export default function CollectionListDialog({
  open, onClose, lists: propLists = [], onSave, onCreateList, refreshLists, contentId
}: {
  open: boolean;
  onClose: () => void;
  lists: CollectionList[];
  onSave: (lists: CollectionList[]) => void;
  onCreateList: (list: CollectionList) => Promise<void>;
  refreshLists: () => void;
  contentId?: string;
}) {
  const { user } = useAuth();
  const [showNewList, setShowNewList] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean, item: CollectionList | null }>({ open: false, item: null });
  const [collectedLists, setCollectedLists] = useState<Set<string>>(new Set());
  // 优先用props.lists作为初始userLists，提升初始渲染速度
  const [userLists, setUserLists] = useState<CollectionList[]>(propLists);
  const [loading, setLoading] = useState(false);

  // 弹窗打开时并行请求用户lists和content被收藏到的lists
  useEffect(() => {
    if (open && contentId) {
      // 弹窗每次打开时，先用props.lists渲染，后异步刷新
      setUserLists(propLists || []);
      setLoading(true);
      Promise.all([
        api.request('/collection_lists'), // 当前用户的lists
        api.getCollectionsByContent(contentId)
      ]).then(([userListsRes, collections]) => {
        setUserLists((userListsRes && 'data' in userListsRes) ? (userListsRes.data as CollectionList[]) : []); // 接口返回后刷新
        const listIds = (collections && 'data' in collections ? collections.data : []).map((col: any) => col.list_id);
        setCollectedLists(new Set(listIds));
      }).finally(() => setLoading(false));
    }
  }, [open, contentId, propLists]);

  // 处理收藏切换
  const handleCollectionToggle = async (listId: string) => {
    try {
      const isCollected = collectedLists.has(listId);
      if (!contentId) return;
      if (isCollected) {
        // 取消收藏
        await api.removeContentFromList(contentId, listId);
        setCollectedLists(prev => {
          const newSet = new Set(prev);
          newSet.delete(listId);
          return newSet;
        });
      } else {
        // 添加到收藏
        await api.addContentToList(contentId, listId);
        setCollectedLists(prev => new Set(prev).add(listId));
      }
    } catch (error) {
      // 可以显示错误提示
    }
  };

  // 上移/下移/删除
  const handleMoveUp = async (item: CollectionList) => {
    if (!item.id) return;
    
    const sortedLists = userLists.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const idx = sortedLists.findIndex(l => l.id === item.id);
    if (idx <= 0) return;
    
    const prev = sortedLists[idx - 1];
    if (!prev.id) return;
    
    // 交换order_index
    await api.request('/collection_lists/order', {
      method: 'PUT',
      body: JSON.stringify({ orders: [
        { id: item.id, order_index: prev.order_index },
        { id: prev.id, order_index: item.order_index }
      ] }),
      headers: { 'Content-Type': 'application/json' }
    });
    await refreshLists();
  };

  const handleMoveDown = async (item: CollectionList) => {
    if (!item.id) return;
    
    const sortedLists = userLists.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const idx = sortedLists.findIndex(l => l.id === item.id);
    if (idx === -1 || idx === sortedLists.length - 1) return;
    
    const next = sortedLists[idx + 1];
    if (!next.id) return;
    
    await api.request('/collection_lists/order', {
      method: 'PUT',
      body: JSON.stringify({ orders: [
        { id: item.id, order_index: next.order_index },
        { id: next.id, order_index: item.order_index }
      ] }),
      headers: { 'Content-Type': 'application/json' }
    });
    await refreshLists();
  };

  const handleDelete = async (item: CollectionList) => {
    setConfirmDelete({ open: true, item });
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete.item || !confirmDelete.item.id) return;
    try {
      await api.deleteCollection(confirmDelete.item.id);
      setConfirmDelete({ open: false, item: null });
      await refreshLists();
    } catch (error) {
      // 静默处理错误
    }
  };

  // 渲染时只用userLists
  function renderLists(): JSX.Element[] {
    const sortedLists = userLists.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    
    return sortedLists.map((item, idx) => {
      const canMoveUp = idx > 0;
      const canMoveDown = idx < sortedLists.length - 1;
      
      return (
        <li key={item.id} className="relative">
          <div 
            className="flex items-center gap-2 py-2 px-3 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors group"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {/* 列表名称 */}
            <div className="flex items-center flex-1 min-w-0">
              <span className="flex-1 truncate text-sm font-medium text-gray-900">
                {item.name}
              </span>
            </div>
            
            {/* 右侧操作区域 */}
            <div className="flex items-center gap-2">
              {renderCollectionCheckbox(
                collectedLists.has(item.id || ''), 
                () => item.id && handleCollectionToggle(item.id)
              )}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MenuButton
                  onMoveUp={() => handleMoveUp(item)}
                  onMoveDown={() => handleMoveDown(item)}
                  onDelete={() => handleDelete(item)}
                  canMoveUp={canMoveUp}
                  canMoveDown={canMoveDown}
                />
              </div>
            </div>
          </div>
        </li>
      );
    });
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div 
          className="bg-white rounded-xl shadow-xl w-96 max-h-[80vh] flex flex-col"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
            <span className="font-semibold text-lg text-gray-900">将内容保存至...</span>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }} 
              className="text-gray-400 hover:text-gray-600 text-xl transition-colors"
            >
              ×
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-3 flex-1">
            <ul className="space-y-0">
              {renderLists()}
            </ul>
          </div>
          <div className="p-5 border-t border-gray-200">
            <button 
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowNewList(true);
              }}
            >
              ＋新建列表
            </button>
          </div>
        </div>
      </div>
      
      <NewListDialog
        open={showNewList}
        onClose={() => setShowNewList(false)}
        onCreate={onCreateList}
        refreshLists={typeof refreshLists === 'function' ? refreshLists : () => {}}
      />
      
      {/* 删除确认弹窗 */}
      {confirmDelete.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div 
            className="bg-white rounded-xl shadow-xl w-80 flex flex-col p-6"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="font-semibold text-lg mb-4 text-gray-900">确认删除？</div>
            <div className="mb-6 text-gray-700 text-sm">将删除该列表，操作不可恢复。</div>
            <div className="flex gap-3">
              <button 
                className="flex-1 py-2 px-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmDelete({ open: false, item: null });
                }}
              >
                取消
              </button>
              <button 
                className="flex-1 py-2 px-4 rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteConfirm();
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 