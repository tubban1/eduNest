'use client';

import { useState, useEffect } from 'react';
import { Search, User, CreditCard, Plus, Check, X } from 'lucide-react';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

interface UserWithCredits extends User {
  credits: number;
}

export default function AdminCreditsManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWithCredits | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [creditsToAdd, setCreditsToAdd] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 获取用户列表
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.getAdminUsers();
      if (response.success) {
        setUsers(response.data);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
      setMessage({ type: 'error', text: '获取用户列表失败' });
    } finally {
      setLoading(false);
    }
  };

  // 搜索用户
  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 选择用户并获取积分余额
  const handleUserSelect = async (user: User) => {
    try {
      setLoading(true);
      // 使用管理员权限查询指定用户的积分
      const response = await api.get(`/admin/credits/balance?userId=${user.id}`);
      if (response.success) {
        setSelectedUser({
          ...user,
          credits: response.data.balance
        });
        setCreditsToAdd('');
        setMessage(null);
      }
    } catch (error) {
      console.error('获取用户积分失败:', error);
      setMessage({ type: 'error', text: '获取用户积分失败' });
    } finally {
      setLoading(false);
    }
  };

  // 增加积分
  const handleAddCredits = async () => {
    if (!selectedUser || !creditsToAdd) return;
    
    const amount = parseInt(creditsToAdd);
    if (isNaN(amount) || amount <= 0) {
      setMessage({ type: 'error', text: '请输入有效的积分数量' });
      return;
    }

    try {
      setLoading(true);
      const response = await api.addCreditsToUser(
        selectedUser.id,
        amount,
        'admin_manual_add'
      );

      if (response.success) {
        setMessage({ type: 'success', text: `成功为用户 ${selectedUser.email} 增加 ${amount} 积分` });
        // 刷新用户积分
        await handleUserSelect(selectedUser);
        setCreditsToAdd('');
      }
    } catch (error) {
      console.error('增加积分失败:', error);
      setMessage({ type: 'error', text: '增加积分失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* 用户搜索 */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="搜索用户邮箱或姓名..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 用户列表 */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">选择用户</h3>
        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
          {loading ? (
            <div className="p-4 text-center text-gray-500">加载中...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-4 text-center text-gray-500">没有找到用户</div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => handleUserSelect(user)}
                className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedUser?.id === user.id ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">{user.email}</div>
                      {user.name && <div className="text-sm text-gray-500">{user.name}</div>}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {user.role || 'user'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 选中的用户信息 */}
      {selectedUser && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-lg font-medium text-gray-900 mb-3">用户信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-500">邮箱</div>
              <div className="text-gray-900">{selectedUser.email}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">姓名</div>
              <div className="text-gray-900">{selectedUser.name || '-'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">角色</div>
              <div className="text-gray-900">{selectedUser.role || 'user'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">当前积分</div>
              <div className="flex items-center text-gray-900">
                <CreditCard className="w-4 h-4 mr-1" />
                {selectedUser.credits}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 积分操作 */}
      {selectedUser && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">增加积分</h3>
          <div className="flex items-center space-x-4">
            <input
              type="number"
              placeholder="输入积分数量"
              value={creditsToAdd}
              onChange={(e) => setCreditsToAdd(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
            />
            <button
              onClick={handleAddCredits}
              disabled={loading || !creditsToAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>增加积分</span>
            </button>
          </div>
        </div>
      )}

      {/* 消息提示 */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {message.type === 'success' ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <X className="w-5 h-5 text-red-600" />
              )}
              <span>{message.text}</span>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 