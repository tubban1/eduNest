'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Logo from '../components/Logo';
import Link from 'next/link';

// 定义内容类型
interface Content {
  id: string;
  short_id: string;
  title: string;
  description?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  code_html?: string;
  code_css?: string;
  code_js?: string;
  external_links?: string[];
  language?: string;
  content_type?: string;
  created_by?: string;
}

export default function HomePage() {
  const { user, signOut } = useAuth();
  const [contents, setContents] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSignOut, setIsLoadingSignOut] = useState(false);

  // 从数据库获取内容数据
  useEffect(() => {
    const fetchContents = async () => {
      try {
        setIsLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 
          (process.env.NODE_ENV === 'production' ? 'https://eduNest.app/api' : 'http://localhost:3001/api');
        const response = await fetch(`${apiUrl}/content/public?limit=6`);
        const data = await response.json();
        
        if (data.success && data.data && Array.isArray(data.data)) {
          // 随机打乱内容顺序
          const shuffled = data.data.sort(() => Math.random() - 0.5);
          setContents(shuffled);
        }
      } catch (error) {
        console.error('获取内容失败:', error);
        // 如果获取失败，使用空数组
        setContents([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContents();
  }, []);

  const handleSignOut = async () => {
    try {
      setIsLoadingSignOut(true);
      await signOut();
      window.location.reload();
    } catch (error) {
      console.error('登出失败:', error);
    } finally {
      setIsLoadingSignOut(false);
    }
  };

  // 根据标签获取对应的emoji
  const getEmojiByTags = (tags?: string[]) => {
    if (!tags || !Array.isArray(tags)) return '📚';
    
    const tagString = tags.join(' ').toLowerCase();
    if (tagString.includes('数学') || tagString.includes('分数') || tagString.includes('几何')) return '🔢';
    if (tagString.includes('生物') || tagString.includes('细胞') || tagString.includes('基因')) return '🧬';
    if (tagString.includes('物理') || tagString.includes('力学') || tagString.includes('电学')) return '⚡';
    if (tagString.includes('化学') || tagString.includes('反应') || tagString.includes('分子')) return '🧪';
    if (tagString.includes('地理') || tagString.includes('气候') || tagString.includes('地形')) return '🌍';
    if (tagString.includes('编程') || tagString.includes('代码') || tagString.includes('算法')) return '💻';
    if (tagString.includes('历史') || tagString.includes('古代') || tagString.includes('文明')) return '📜';
    if (tagString.includes('语言') || tagString.includes('语法') || tagString.includes('词汇')) return '📝';
    if (tagString.includes('艺术') || tagString.includes('音乐') || tagString.includes('绘画')) return '🎨';
    if (tagString.includes('心理') || tagString.includes('认知') || tagString.includes('思维')) return '🧠';
    
    return '📚';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* 导航栏 */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Logo size="md" />
              <span className="text-xl font-bold text-gray-800">AI互动教育</span>
            </div>
            
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  <div className="hidden md:block text-right">
                    <p className="text-sm font-medium text-gray-700">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <Link
                    href="/content"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    进入平台
                  </Link>
                  <button
                    onClick={handleSignOut}
                    disabled={isLoadingSignOut}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50"
                  >
                    {isLoadingSignOut ? '退出中...' : '退出'}
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  登录
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* 主要内容 */}
      <div className="container mx-auto px-4 py-8">
        {/* 英雄区域 */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-800 mb-6 leading-tight">
            让学习
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              {' '}生动有趣
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto mb-8 leading-relaxed">
            基于AI生成的互动教学内容，让每个知识点都变得可视化、可交互、可体验
          </p>
          
          {!user && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/login"
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 text-lg font-semibold shadow-lg"
              >
                立即开始学习
              </Link>
              <Link
                href="/content"
                className="bg-white text-gray-700 px-8 py-4 rounded-xl hover:bg-gray-50 transition-all border-2 border-gray-200 text-lg font-semibold"
              >
                浏览内容
              </Link>
            </div>
          )}
        </div>

        {/* 网站简介 */}
        <div className="mb-16">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 hover:shadow-lg transition-all">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">个性化学习</h3>
              <p className="text-gray-600">
                AI根据学习阶段和知识点自动生成最适合的互动内容，让学习更高效
              </p>
            </div>
            
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 hover:shadow-lg transition-all">
              <div className="text-4xl mb-4">🎮</div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">互动体验</h3>
              <p className="text-gray-600">
                通过动画、游戏、模拟实验等丰富形式，让抽象概念变得具体可感
              </p>
            </div>
            
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 hover:shadow-lg transition-all">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">多学科覆盖</h3>
              <p className="text-gray-600">
                涵盖数学、物理、化学、生物、地理等多个学科，满足不同学习需求
              </p>
            </div>
          </div>
        </div>

        {/* 随机内容展示区域 */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              精选互动内容
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              体验AI生成的优质教学内容，每个内容都经过精心设计
            </p>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner />
            </div>
          ) : contents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {contents.map((content) => (
                <div
                  key={content.id}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 hover:shadow-xl transition-all transform hover:-translate-y-1 cursor-pointer group"
                  onClick={() => window.open(`/content/${content.short_id}`, '_blank')}
                >
                  <div className="mb-4">
                    <div className="w-full h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl mb-4 flex items-center justify-center">
                      <span className="text-4xl">
                        {getEmojiByTags(content.tags)}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                      {content.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {content.description || '暂无描述'}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {(content.tags || []).slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>点击查看</span>
                    <span>{new Date(content.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-gray-600 text-lg">暂无内容</p>
              <p className="text-gray-500 text-sm mt-2">请先创建一些互动内容</p>
            </div>
          )}
          
          <div className="text-center mt-8">
            <Link
              href="/content"
              className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 font-semibold"
            >
              查看更多内容
            </Link>
          </div>
        </div>

        {/* 统计数据 */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 mb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600 mb-2">{contents.length}+</div>
              <div className="text-gray-600">互动内容</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600 mb-2">6+</div>
              <div className="text-gray-600">学科领域</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600 mb-2">24/7</div>
              <div className="text-gray-600">AI生成</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-600 mb-2">∞</div>
              <div className="text-gray-600">学习可能</div>
            </div>
          </div>
        </div>

        {/* 页脚 */}
        <footer className="text-center text-gray-500 py-8">
          <p className="mb-2">© 2024 AI互动教育平台. 让学习更生动有趣.</p>
          <p className="text-sm">基于AI技术，为教育赋能</p>
        </footer>
      </div>
    </div>
  );
}
