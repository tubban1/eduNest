'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, Content } from '@/lib/api';
import ContentForm from '@/components/ContentForm';
import { useTranslation } from 'react-i18next';
import { useSmartBack } from '@/utils/navigation';

export default function EditContentPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation('common');
  const { handleSmartBack } = useSmartBack();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        const id = params.id as string;
        const response = await api.content.getById(id);
        setContent(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchContent();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">加载失败</div>
          <p className="text-gray-600 mb-4">{error || '内容不存在'}</p>
          <button
            onClick={handleSmartBack}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {t('back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 内容区域 */}
      <div className="w-full">
        <div className="w-full h-screen">
          <ContentForm
            initialContent={content}
            mode="edit"
            contentId={content.id}
            className="w-full h-full"
            style={{ 
              width: '100%',
              height: '100vh',
              border: 'none',
              margin: '0',
              padding: '0'
            }}
          />
        </div>
      </div>
    </div>
  );
}

