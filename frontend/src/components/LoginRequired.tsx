import Link from 'next/link';
import { LogIn } from 'lucide-react';

interface LoginRequiredProps {
  title?: string;
  description?: string;
  showSidebar?: boolean;
}

export default function LoginRequired({ 
  title = "请先登录", 
  description = "登录后查看此页面内容",
  showSidebar = false 
}: LoginRequiredProps) {
  const content = (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="mb-6">
          <LogIn className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
          <p className="text-gray-600">{description}</p>
        </div>
        <div className="space-y-3">
          <Link
            href="/login"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium w-full"
          >
            立即登录
          </Link>
          <Link
            href="/"
            className="inline-block bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium w-full"
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );

  if (showSidebar) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <div className="w-64 bg-white shadow-sm border-r border-gray-200">
          {/* 空的侧边栏 */}
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      {content}
    </div>
  );
} 