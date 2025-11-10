'use client';

import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import LanguageSelector from '@/components/LanguageSelector';
import { api } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Logo from '../components/Logo';
import Link from 'next/link';
import { config } from '@/lib/config';
import LargeContentCard from '@/components/LargeContentCard';
import ComingSoonSection from '@/components/ComingSoonSection';

// 定义内容类型
interface Content {
  id: string;
  short_id: string;
  title: string;
  description?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  full_html?: string;
  language?: string;
  content_type?: string;
  created_by?: string;
}

export default function HomePage() {
  const { t, i18n } = useTranslation(['home', 'common', 'content', 'navigation']);
  const [mounted, setMounted] = useState(false);
  const { user, signOut } = useAuth();
  const [contents, setContents] = useState<Content[]>([]);
  const [totalContentCount, setTotalContentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSignOut, setIsLoadingSignOut] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // 不再需要加载分类，因为我们只显示高考压轴题

  // 从"高考压轴题"收藏列表获取内容
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // 高考压轴题收藏列表ID
        const GAOKAO_LIST_ID = '16c34498-578c-455f-80f4-c7d28cdd0b62';
        
        // 从指定收藏列表获取内容
        const collectionContents = await api.content.getCollectionListContent(GAOKAO_LIST_ID, {
          limit: 18
        });

        if (Array.isArray(collectionContents) && collectionContents.length > 0) {
          setContents(collectionContents);
          setTotalContentCount(collectionContents.length);
        } else {
          setContents([]);
          setTotalContentCount(0);
        }
      } catch (error) {
        console.error('Failed to fetch collection content:', error);
        setContents([]);
        setTotalContentCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSignOut = async () => {
    try {
      setIsLoadingSignOut(true);
      await signOut();
      window.location.reload();
    } catch (error) {
      // 登出失败处理
    } finally {
      setIsLoadingSignOut(false);
    }
  };

  // 根据标签获取对应的emoji
  const getEmojiByTags = (tags?: string[]) => {
    if (!tags || !Array.isArray(tags)) return '📚';
    
    const tagString = tags.join(' ').toLowerCase();
    // 支持中英文标签匹配
    if (tagString.includes('数学') || tagString.includes('分数') || tagString.includes('几何') || 
        tagString.includes('math') || tagString.includes('fraction') || tagString.includes('geometry')) return '🔢';
    if (tagString.includes('生物') || tagString.includes('细胞') || tagString.includes('基因') || 
        tagString.includes('biology') || tagString.includes('cell') || tagString.includes('gene')) return '🧬';
    if (tagString.includes('物理') || tagString.includes('力学') || tagString.includes('电学') || 
        tagString.includes('physics') || tagString.includes('mechanics') || tagString.includes('electricity')) return '⚡';
    if (tagString.includes('化学') || tagString.includes('反应') || tagString.includes('分子') || 
        tagString.includes('chemistry') || tagString.includes('reaction') || tagString.includes('molecule')) return '🧪';
    if (tagString.includes('地理') || tagString.includes('气候') || tagString.includes('地形') || 
        tagString.includes('geography') || tagString.includes('climate') || tagString.includes('terrain')) return '🌍';
    if (tagString.includes('编程') || tagString.includes('代码') || tagString.includes('算法') || 
        tagString.includes('programming') || tagString.includes('code') || tagString.includes('algorithm')) return '💻';
    if (tagString.includes('历史') || tagString.includes('古代') || tagString.includes('文明') || 
        tagString.includes('history') || tagString.includes('ancient') || tagString.includes('civilization')) return '📜';
    if (tagString.includes('语言') || tagString.includes('语法') || tagString.includes('词汇') || 
        tagString.includes('language') || tagString.includes('grammar') || tagString.includes('vocabulary')) return '📝';
    if (tagString.includes('艺术') || tagString.includes('音乐') || tagString.includes('绘画') || 
        tagString.includes('art') || tagString.includes('music') || tagString.includes('painting')) return '🎨';
    if (tagString.includes('心理') || tagString.includes('认知') || tagString.includes('思维') || 
        tagString.includes('psychology') || tagString.includes('cognition') || tagString.includes('thinking')) return '🧠';
    
    return '📚';
  };

  // 为避免 SSR 与客户端语言检测不一致导致的水合错误，使用 loading 状态
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* 导航栏 */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Logo size="md" />
            </div>
            
            <div className="flex items-center space-x-4">
              {/* 桌面端语言切换 */}
              <div className="hidden sm:block w-48">
                <LanguageSelector />
              </div>
              
              {/* 移动端语言切换按钮 */}
              <div className="sm:hidden">
                <LanguageSelector />
              </div>
              {user ? (
                <div className="flex items-center space-x-4">
                  <div className="hidden md:block text-right">
                    <p className="text-sm font-medium text-gray-700">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <Link
                    href="/c"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    {t('enter_platform', { ns: 'navigation', defaultValue: 'Enter Platform' })}
                  </Link>
                  <button
                    onClick={handleSignOut}
                    disabled={isLoadingSignOut}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50"
                  >
                    {isLoadingSignOut ? t('signing_out', { ns: 'common', defaultValue: 'Signing out...' }) : t('sign_out', { ns: 'common', defaultValue: 'Sign out' })}
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Link
                    href="/signup"
                    className="bg-white text-blue-600 border border-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors text-sm"
                  >
                    {t('signup', { ns: 'navigation', defaultValue: 'Sign up' })}
                  </Link>
                  <Link
                    href="/login"
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {t('login', { ns: 'navigation', defaultValue: 'Login' })}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* 主要内容 */}
      <div className="container mx-auto px-4 py-8">
        {/* 英雄区域 - 内容少时更紧凑 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4 leading-tight">
            {t('make_learning', { ns: 'home', defaultValue: 'Make Learning' })}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              {' '}
              {t('dynamic_and_interesting', { ns: 'home', defaultValue: 'Dynamic and Interesting' })}
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto mb-6 leading-relaxed">
            {t('based_on_ai_generated_interactive_content_makes_each_knowledge_point_visualizable_interactive_and_experiential', { ns: 'home', defaultValue: 'Based on AI-generated interactive content, makes each knowledge point visualizable, interactive and experiential' })}
          </p>
          
          {!user && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/login"
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 text-lg font-semibold shadow-lg"
              >
                {t('start_learning_now', { ns: 'home', defaultValue: 'Start Learning Now' })}
              </Link>
              <Link
                href="/signup"
                className="bg-white text-blue-600 border-2 border-blue-600 px-8 py-4 rounded-xl hover:bg-blue-50 transition-all text-lg font-semibold"
              >
                {t('create_account', { ns: 'navigation', defaultValue: 'Create Account' })}
              </Link>
              <Link
                href="/c"
                className="bg-white text-gray-700 px-8 py-4 rounded-xl hover:bg-gray-50 transition-all border-2 border-gray-200 text-lg font-semibold"
              >
                {t('browse_content', { ns: 'home', defaultValue: 'Browse Content' })}
              </Link>
            </div>
          )}
        </div>

        {/* 网站简介 - 内容少时简化或隐藏 */}
        {contents.length > 5 && (
          <div className="mb-12">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-all">
                <div className="text-4xl mb-3">🎯</div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  {t('personalized_learning', { ns: 'home', defaultValue: 'Personalized Learning' })}
                </h3>
                <p className="text-gray-600 text-sm">
                  {t('ai_automatically_generates_the_most_suitable_interactive_content_based_on_learning_stage_and_knowledge_points_making_learning_more_efficient', { ns: 'home', defaultValue: 'AI automatically generates the most suitable interactive content based on learning stage and knowledge points, making learning more efficient' })}
                </p>
              </div>
              
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-all">
                <div className="text-4xl mb-3">🎮</div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  {t('interactive_experience', { ns: 'home', defaultValue: 'Interactive Experience' })}
                </h3>
                <p className="text-gray-600 text-sm">
                  {t('through_animation_games_and_simulated_experiments_etc_abstract_concepts_become_concrete_and_tangible', { ns: 'home', defaultValue: 'Through animation, games and simulated experiments, etc., abstract concepts become concrete and tangible' })}
                </p>
              </div>
              
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-all">
                <div className="text-4xl mb-3">📚</div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  {t('multi_disciplinary_coverage', { ns: 'home', defaultValue: 'Multi-disciplinary Coverage' })}
                </h3>
                <p className="text-gray-600 text-sm">
                  {t('covers_mathematics_physics_chemistry_biology_and_geography_etc_meeting_different_learning_needs', { ns: 'home', defaultValue: 'Covers mathematics, physics, chemistry, biology and geography, etc., meeting different learning needs' })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 高考压轴题内容展示区域 */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              高考压轴题
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              用启发引导和逐步推导的方式，配图像动画帮助学生理解压轴题拿高分
            </p>
            <p className="text-sm text-gray-500 mt-2">
              所有内容均由官方精选，保证品质
            </p>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner />
            </div>
          ) : contents.length > 0 ? (
            <>
              {/* 根据内容数量动态选择布局 */}
              {contents.length <= 5 ? (
                // 内容少时：大卡片展示
                <div className="space-y-8 max-w-4xl mx-auto">
                  {contents.map((content) => (
                    <LargeContentCard
                      key={content.id}
                      content={content as any}
                    />
                  ))}
                  {/* 显示"即将推出"区域 */}
                  <ComingSoonSection />
                </div>
              ) : contents.length <= 15 ? (
                // 内容中等时：中等卡片，2列
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
                  {contents.map((content) => (
                    <div
                      key={content.id}
                      className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 hover:shadow-xl transition-all transform hover:-translate-y-1 cursor-pointer group"
                      onClick={() => {
                        const path = `/c/${content.short_id}`;
                        window.open(path, '_blank');
                      }}
                    >
                      <div className="mb-4">
                        <div className="w-full h-40 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl mb-4 flex items-center justify-center">
                          <span className="text-5xl">
                            {getEmojiByTags(content.tags)}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                          {content.title}
                        </h3>
                        <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                          {content.description || ''}
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
                        <div className="flex items-center gap-3">
                          {(content as any).likes_count > 0 && (
                            <span className="flex items-center gap-1">
                              <span>❤️</span>
                              <span>{(content as any).likes_count}</span>
                            </span>
                          )}
                          {(content as any).collections_count > 0 && (
                            <span className="flex items-center gap-1">
                              <span>⭐</span>
                              <span>{(content as any).collections_count}</span>
                            </span>
                          )}
                        </div>
                        <span>{new Date(content.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // 内容多时：小卡片，3列
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {contents.map((content) => (
                    <div
                      key={content.id}
                      className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 hover:shadow-xl transition-all transform hover:-translate-y-1 cursor-pointer group"
                      onClick={() => {
                        const path = `/c/${content.short_id}`;
                        window.open(path, '_blank');
                      }}
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
                          {content.description || ''}
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
                        <div className="flex items-center gap-3">
                          {(content as any).likes_count > 0 && (
                            <span className="flex items-center gap-1">
                              <span>❤️</span>
                              <span>{(content as any).likes_count}</span>
                            </span>
                          )}
                          {(content as any).collections_count > 0 && (
                            <span className="flex items-center gap-1">
                              <span>⭐</span>
                              <span>{(content as any).collections_count}</span>
                            </span>
                          )}
                        </div>
                        <span>{new Date(content.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 只在内容 > 5 个时显示"查看更多"按钮 */}
              {contents.length > 5 && (
                <div className="text-center mt-8">
                  <Link
                    href="/c"
                    className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 font-semibold"
                  >
                    {t('view_more_content', { ns: 'home', defaultValue: 'View More Content' })}
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-gray-600 text-lg mb-4">
                暂无高考压轴题内容
              </p>
              {/* 显示"敬请期待"区域 */}
              <div className="mt-8">
                <ComingSoonSection />
              </div>
            </div>
          )}
        </div>

        {/* 其他类型内容 - 敬请期待 */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              其他精彩内容
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              更多类型的内容正在制作中，敬请期待
            </p>
          </div>
          <ComingSoonSection />
        </div>

        {/* 统计数据 - 内容少时简化 */}
        {contents.length > 0 && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-200 mb-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-blue-600 mb-1">{totalContentCount}+</div>
                <div className="text-sm md:text-base text-gray-600">
                  {t('interactive_content', { ns: 'home', defaultValue: 'Interactive Content' })}
                </div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-bold text-purple-600 mb-1">1+</div>
                <div className="text-sm md:text-base text-gray-600">
                  {t('subject_areas', { ns: 'home', defaultValue: 'Subject Areas' })}
                </div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-bold text-green-600 mb-1">24/7</div>
                <div className="text-sm md:text-base text-gray-600">
                  {t('ai_generation', { ns: 'home', defaultValue: 'AI Generation' })}
                </div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-bold text-orange-600 mb-1">∞</div>
                <div className="text-sm md:text-base text-gray-600">
                  {t('learning_possibilities', { ns: 'home', defaultValue: 'Learning Possibilities' })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 页脚 */}
        <footer className="text-center text-gray-500 py-8">
          <p className="mb-2">
            {mounted ? t('copyright', { ns: 'common', defaultValue: 'Copyright' }) : 'Copyright'} 2024 EduNest AI. {mounted ? t('makes_learning_more_dynamic_and_interesting', { ns: 'home', defaultValue: 'Make learning more dynamic and interesting' }) : 'Make learning more dynamic and interesting'}
          </p>
          <p className="text-sm">
            {mounted ? t('based_on_ai_technology_empowers_education', { ns: 'home', defaultValue: 'Based on AI technology, empowers education' }) : 'Based on AI technology, empowers education'}
          </p>
        </footer>
      </div>
    </div>
  );
}
