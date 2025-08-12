'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Heart, Plus, Settings, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const menuItems = [
    { href: '/content', label: '我的创作', icon: BookOpen },
    { href: '/collections', label: '我的收藏', icon: Heart },
    { href: '/content/create', label: '创建内容', icon: Plus },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      // 登出后重定向到首页
      window.location.href = '/';
    } catch (error) {
      // 登出失败处理
    }
  };

  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 flex-1">
        <h1 className="text-xl font-bold text-gray-900 mb-8">AI 教育平台</h1>
        
        {/* 用户信息 */}
        {user && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center mb-3">
              <User className="w-5 h-5 text-gray-600 mr-2" />
              <span className="text-sm font-medium text-gray-900">用户信息</span>
            </div>
            <div className="text-sm text-gray-600">
              <div className="mb-1">
                <span className="font-medium">姓名:</span> {user.name}
              </div>
              <div className="mb-1">
                <span className="font-medium">邮箱:</span> {user.email}
              </div>
              <div>
                <span className="font-medium">角色:</span> {user.email.includes('admin') ? '管理员' : '用户'}
              </div>
            </div>
          </div>
        )}
        
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      
      {/* 登出按钮 */}
      {user && (
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            退出登录
          </button>
        </div>
      )}
    </div>
  );
} 