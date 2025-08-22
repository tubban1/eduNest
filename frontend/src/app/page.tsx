'use client';

import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Logo from '../components/Logo';
import Link from 'next/link';
import { config } from '@/lib/config';

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
  const { t } = useTranslation(['home', 'common', 'content', 'navigation']);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { user, signOut } = useAuth();
  const [contents, setContents] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSignOut, setIsLoadingSignOut] = useState(false);

  // 从数据库获取内容数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // 使用config中的API_BASE_URL
        const apiBaseUrl = config.API_BASE_URL;
        
        const [contentRes, userRes] = await Promise.all([
          fetch(`${apiBaseUrl}/content/public?limit=6`),
          fetch(`${apiBaseUrl}/auth/me`, {
            credentials: 'include'
          })
        ]);

        const contentData = await contentRes.json();
        const userData = await userRes.json();

        if (contentData.success && contentData.data && Array.isArray(contentData.data)) {
          // 随机打乱内容顺序
          const shuffled = contentData.data.sort(() => Math.random() - 0.5);
          setContents(shuffled);
        }
      } catch (error) {
        // 如果获取失败，使用空数组
        setContents([]);
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
                    {t('navigation.enter_platform')}
                  </Link>
                  <button
                    onClick={handleSignOut}
                    disabled={isLoadingSignOut}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50"
                  >
                    {isLoadingSignOut ? t('common.signing_out') : t('common.sign_out')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Link
                    href="/signup"
                    className="bg-white text-blue-600 border border-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors text-sm"
                  >
                    注册
                  </Link>
                  <Link
                    href="/login"
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {t('navigation.login')}
                  </Link>
                </div>
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
            {t('home.make_learning')}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              {' '}
              {t('home.dynamic_and_interesting')}
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto mb-8 leading-relaxed">
            {t('home.based_on_ai_generated_interactive_content_makes_each_knowledge_point_visualizable_interactive_and_experiential')}
          </p>
          
          {!user && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/login"
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 text-lg font-semibold shadow-lg"
              >
                {t('home.start_learning_now')}
              </Link>
              <Link
                href="/signup"
                className="bg-white text-blue-600 border-2 border-blue-600 px-8 py-4 rounded-xl hover:bg-blue-50 transition-all text-lg font-semibold"
              >
                注册账号
              </Link>
              <Link
                href="/content"
                className="bg-white text-gray-700 px-8 py-4 rounded-xl hover:bg-gray-50 transition-all border-2 border-gray-200 text-lg font-semibold"
              >
                {t('home.browse_content')}
              </Link>
            </div>
          )}
        </div>

        {/* 网站简介 */}
        <div className="mb-16">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 hover:shadow-lg transition-all">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                {t('home.personalized_learning')}
              </h3>
              <p className="text-gray-600">
                {t('home.ai_automatically_generates_the_most_suitable_interactive_content_based_on_learning_stage_and_knowledge_points_making_learning_more_efficient')}
              </p>
            </div>
            
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 hover:shadow-lg transition-all">
              <div className="text-4xl mb-4">🎮</div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                {t('home.interactive_experience')}
              </h3>
              <p className="text-gray-600">
                {t('home.through_animation_games_and_simulated_experiments_etc_abstract_concepts_become_concrete_and_tangible')}
              </p>
            </div>
            
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 hover:shadow-lg transition-all">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                {t('home.multi_disciplinary_coverage')}
              </h3>
              <p className="text-gray-600">
                {t('home.covers_mathematics_physics_chemistry_biology_and_geography_etc_meeting_different_learning_needs')}
              </p>
            </div>
          </div>
        </div>

        {/* 随机内容展示区域 */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              {t('home.selected_interactive_content')}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {t('home.experience_ai_generated_high_quality_teaching_content_each_content_is_carefully_designed')}
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
                    <span>{t('home.click_to_view')}</span>
                    <span>{new Date(content.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-gray-600 text-lg">
                {t('home.no_content')}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                {t('home.please_create_some_interactive_content')}
              </p>
            </div>
          )}
          
          <div className="text-center mt-8">
            <Link
              href="/content"
              className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 font-semibold"
            >
              {t('home.view_more_content')}
            </Link>
          </div>
        </div>

        {/* 统计数据 */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 mb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600 mb-2">{contents.length}+</div>
              <div className="text-gray-600">
                {t('home.interactive_content')}
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600 mb-2">6+</div>
              <div className="text-gray-600">
                {t('home.subject_areas')}
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600 mb-2">24/7</div>
              <div className="text-gray-600">
                {t('home.ai_generation')}
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-600 mb-2">∞</div>
              <div className="text-gray-600">
                {t('home.learning_possibilities')}
              </div>
            </div>
          </div>
        </div>

        {/* 页脚 */}
        <footer className="text-center text-gray-500 py-8">
          <p className="mb-2">
            {t('common.copyright')} 2024 AI互动教育平台. {t('home.makes_learning_more_dynamic_and_interesting')}
          </p>
          <p className="text-sm">
            {t('home.based_on_ai_technology_empowers_education')}
          </p>
        </footer>
      </div>
    </div>
  );
}
