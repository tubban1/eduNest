'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useTranslation } from 'react-i18next';

interface Content {
  id: string;
  short_id: string;
  title: string;
  thumbnail_url?: string;
  thumbnail_status?: 'pending' | 'generating' | 'ready' | 'failed';
  thumbnail_updated_at?: string;
  created_at: string;
}

const TestThumbnailPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation(['content', 'common']);
  const [mounted, setMounted] = useState(false);
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    setMounted(true);
  }, []);

  // 加载内容列表
  const loadContents = async () => {
    try {
      setLoading(true);
      const data = await api.content.getAll();
      setContents(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('加载内容失败:', error);
      const errorMsg = error.message || t('thumbnail.loadFailedUnknown', { ns: 'content', defaultValue: '加载失败: {{error}}', error: '未知错误' });
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadContents();
    }
  }, [authLoading]);

  // 手动生成单个缩略图
  const handleGenerateThumbnail = async (contentId: string) => {
    try {
      setGenerating(prev => new Set(prev).add(contentId));
      setMessage(null);

      const result = await api.content.generateThumbnail(contentId);
      
      if (result.success) {
        setMessage({ type: 'success', text: t('thumbnail.generateStarted', { ns: 'content', defaultValue: '缩略图生成任务已启动' }) });
        // 更新该内容的状态
        setContents(prev => prev.map(c => 
          c.id === contentId 
            ? { ...c, thumbnail_status: 'generating' as const }
            : c
        ));
        // 3秒后刷新列表
        setTimeout(() => {
          loadContents();
        }, 3000);
      } else {
        setMessage({ type: 'error', text: result.error || t('thumbnail.generateFailed', { ns: 'content', defaultValue: '生成失败' }) });
      }
    } catch (error: any) {
      console.error('生成缩略图失败:', error);
      const errorMsg = error.message 
        ? t('thumbnail.generateFailedUnknown', { ns: 'content', defaultValue: '生成失败: {{error}}', error: error.message })
        : t('thumbnail.generateFailed', { ns: 'content', defaultValue: '生成失败' });
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setGenerating(prev => {
        const next = new Set(prev);
        next.delete(contentId);
        return next;
      });
    }
  };

  // 批量重新生成
  const handleBatchRegenerate = async () => {
    if (!isAdmin) {
      setMessage({ type: 'error', text: t('thumbnail.adminRequired', { ns: 'content', defaultValue: '需要管理员权限' }) });
      return;
    }

    if (!confirm(t('thumbnail.batchConfirm', { ns: 'content', defaultValue: '确定要批量重新生成所有 pending/failed 状态的缩略图吗？' }))) {
      return;
    }

    try {
      setBatchGenerating(true);
      setMessage(null);

      const result = await api.content.regenerateAllThumbnails();
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: t('thumbnail.batchGenerateStarted', { ns: 'content', defaultValue: '已启动 {{count}} 个缩略图生成任务', count: result.count || 0 })
        });
        // 3秒后刷新列表
        setTimeout(() => {
          loadContents();
        }, 3000);
      } else {
        setMessage({ type: 'error', text: result.error || t('thumbnail.batchGenerateFailed', { ns: 'content', defaultValue: '批量生成失败' }) });
      }
    } catch (error: any) {
      console.error('批量生成失败:', error);
      const errorMsg = error.message 
        ? t('thumbnail.batchGenerateFailedUnknown', { ns: 'content', defaultValue: '批量生成失败: {{error}}', error: error.message })
        : t('thumbnail.batchGenerateFailed', { ns: 'content', defaultValue: '批量生成失败' });
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setBatchGenerating(false);
    }
  };

  // 获取状态标签样式
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ready':
        return <span className="px-2 py-1 text-xs rounded bg-secondary/10 text-secondary">{mounted ? t('thumbnail.status.ready', { ns: 'content', defaultValue: '✅ Ready' }) : '✅ Ready'}</span>;
      case 'generating':
        return <span className="px-2 py-1 text-xs rounded bg-primary/10 text-primary">{mounted ? t('thumbnail.status.generating', { ns: 'content', defaultValue: '⏳ Generating' }) : '⏳ Generating'}</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs rounded bg-destructive/10 text-destructive">{mounted ? t('thumbnail.status.failed', { ns: 'content', defaultValue: '❌ Failed' }) : '❌ Failed'}</span>;
      case 'pending':
      default:
        return <span className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground">{mounted ? t('thumbnail.status.pending', { ns: 'content', defaultValue: '⏸️ Pending' }) : '⏸️ Pending'}</span>;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            {mounted ? t('thumbnail.title', { ns: 'content', defaultValue: '缩略图生成测试页面' }) : '缩略图生成测试页面'}
          </h1>
          <p className="text-muted-foreground">
            {mounted ? t('thumbnail.description', { ns: 'content', defaultValue: '测试缩略图生成功能，查看生成状态和预览' }) : '测试缩略图生成功能，查看生成状态和预览'}
          </p>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-secondary/10 text-secondary border border-secondary/20' 
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}>
            {message.text}
          </div>
        )}

        {/* 批量操作（仅管理员） */}
        {isAdmin && (
          <div className="mb-6 bg-card p-4 rounded-lg border border-border shadow">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {mounted ? t('thumbnail.batchOperation', { ns: 'content', defaultValue: '批量操作（管理员）' }) : '批量操作（管理员）'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {mounted ? t('thumbnail.batchDescription', { ns: 'content', defaultValue: '重新生成所有 pending/failed 状态的缩略图' }) : '重新生成所有 pending/failed 状态的缩略图'}
                </p>
              </div>
              <button
                onClick={handleBatchRegenerate}
                disabled={batchGenerating}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {batchGenerating ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⏳</span>
                    {mounted ? t('thumbnail.generating', { ns: 'content', defaultValue: '生成中...' }) : '生成中...'}
                  </>
                ) : (
                  mounted ? t('thumbnail.batchRegenerate', { ns: 'content', defaultValue: '批量重新生成' }) : '批量重新生成'
                )}
              </button>
            </div>
          </div>
        )}

        {/* 刷新按钮 */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={loadContents}
            disabled={loading}
            className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition disabled:opacity-50"
          >
            {loading 
              ? (mounted ? t('thumbnail.refreshing', { ns: 'content', defaultValue: '刷新中...' }) : '刷新中...')
              : (mounted ? t('thumbnail.refreshList', { ns: 'content', defaultValue: '🔄 刷新列表' }) : '🔄 刷新列表')
            }
          </button>
        </div>

        {/* 内容列表 */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {contents.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {mounted ? t('thumbnail.noContent', { ns: 'content', defaultValue: '暂无内容' }) : '暂无内容'}
            </div>
          ) : (
            contents.map((content) => (
              <div
                key={content.id}
                className="bg-card border border-border rounded-lg shadow overflow-hidden"
              >
                {/* 缩略图预览区域 */}
                <div className="relative w-full aspect-video bg-muted overflow-hidden">
                  {content.thumbnail_status === 'generating' ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <span className="text-xs text-muted-foreground">
                          {mounted ? t('thumbnail.generatingStatus', { ns: 'content', defaultValue: '生成中...' }) : '生成中...'}
                        </span>
                      </div>
                    </div>
                  ) : content.thumbnail_url ? (
                    <img
                      src={content.thumbnail_url}
                      alt={content.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                      <span className="text-4xl">📄</span>
                    </div>
                  )}
                  {/* 占位符（图片加载失败时显示） */}
                  <div className="hidden w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                    <span className="text-4xl">📄</span>
                  </div>
                </div>

                {/* 内容信息 */}
                <div className="p-4">
                  <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
                    {content.title}
                  </h3>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex flex-col gap-1">
                      {getStatusBadge(content.thumbnail_status)}
                      {content.thumbnail_updated_at && (
                        <span className="text-xs text-muted-foreground">
                          {mounted 
                            ? t('thumbnail.updatedAt', { 
                                ns: 'content', 
                                defaultValue: '更新: {{date}}', 
                                date: new Date(content.thumbnail_updated_at).toLocaleString() 
                              })
                            : `更新: ${new Date(content.thumbnail_updated_at).toLocaleString()}`
                          }
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      ID: {content.short_id}
                    </span>
                  </div>

                  {/* 操作按钮 */}
                  <button
                    onClick={() => handleGenerateThumbnail(content.id)}
                    disabled={generating.has(content.id)}
                    className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {generating.has(content.id) ? (
                      <>
                        <span className="inline-block animate-spin mr-2">⏳</span>
                        {mounted ? t('thumbnail.generating', { ns: 'content', defaultValue: '生成中...' }) : '生成中...'}
                      </>
                    ) : (
                      mounted ? t('thumbnail.generateThumbnail', { ns: 'content', defaultValue: '🎨 生成缩略图' }) : '🎨 生成缩略图'
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 统计信息 */}
        {contents.length > 0 && (
          <div className="mt-8 bg-card p-4 rounded-lg border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {mounted ? t('thumbnail.stats.title', { ns: 'content', defaultValue: '统计信息' }) : '统计信息'}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold text-foreground">{contents.length}</div>
                <div className="text-sm text-muted-foreground">
                  {mounted ? t('thumbnail.stats.total', { ns: 'content', defaultValue: '总内容数' }) : '总内容数'}
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-secondary">
                  {contents.filter(c => c.thumbnail_status === 'ready').length}
                </div>
                <div className="text-sm text-muted-foreground">
                  {mounted ? t('thumbnail.stats.ready', { ns: 'content', defaultValue: '已生成' }) : '已生成'}
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {contents.filter(c => c.thumbnail_status === 'generating').length}
                </div>
                <div className="text-sm text-muted-foreground">
                  {mounted ? t('thumbnail.stats.generating', { ns: 'content', defaultValue: '生成中' }) : '生成中'}
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-destructive">
                  {contents.filter(c => c.thumbnail_status === 'failed' || c.thumbnail_status === 'pending').length}
                </div>
                <div className="text-sm text-muted-foreground">
                  {mounted ? t('thumbnail.stats.pendingFailed', { ns: 'content', defaultValue: '待处理/失败' }) : '待处理/失败'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className="mt-8 bg-card p-6 rounded-lg border border-border">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {mounted ? t('thumbnail.instructions.title', { ns: 'content', defaultValue: '使用说明' }) : '使用说明'}
          </h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• {mounted ? t('thumbnail.instructions.point1', { ns: 'content', defaultValue: '点击"生成缩略图"按钮可以手动触发单个内容的缩略图生成' }) : '点击"生成缩略图"按钮可以手动触发单个内容的缩略图生成'}</p>
            <p>• {mounted ? t('thumbnail.instructions.point2', { ns: 'content', defaultValue: '管理员可以使用"批量重新生成"功能处理所有待处理/失败的任务' }) : '管理员可以使用"批量重新生成"功能处理所有待处理/失败的任务'}</p>
            <p>• {mounted ? t('thumbnail.instructions.point3', { ns: 'content', defaultValue: '缩略图生成是异步的，生成完成后会自动更新状态' }) : '缩略图生成是异步的，生成完成后会自动更新状态'}</p>
            <p>• {mounted ? t('thumbnail.instructions.point4', { ns: 'content', defaultValue: '生成状态：Pending（待处理）→ Generating（生成中）→ Ready（完成）/ Failed（失败）' }) : '生成状态：Pending（待处理）→ Generating（生成中）→ Ready（完成）/ Failed（失败）'}</p>
            <p>• {mounted ? t('thumbnail.instructions.point5', { ns: 'content', defaultValue: '如果生成失败，可以点击"生成缩略图"按钮重试' }) : '如果生成失败，可以点击"生成缩略图"按钮重试'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestThumbnailPage;

