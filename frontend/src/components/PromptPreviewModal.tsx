'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';

interface PromptPreviewModalProps {
  open: boolean;
  onClose: () => void;
  userQuery?: string;
  imageUrl?: string;
}

export default function PromptPreviewModal({
  open,
  onClose,
  userQuery,
  imageUrl
}: PromptPreviewModalProps) {
  const { t } = useTranslation(['content', 'common']);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      
      {/* Modal 内容 */}
      <div 
        className="relative bg-white w-11/12 max-w-2xl max-h-[80vh] rounded-xl shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('generation.promptDetails', { ns: 'content', defaultValue: '生成提示详情' })}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* 图片预览 */}
          {imageUrl && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                {t('generation.uploadedImage', { ns: 'content', defaultValue: '上传的图片' })}
              </h3>
              <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                <img
                  src={imageUrl}
                  alt="Uploaded"
                  className="w-full h-auto max-h-96 object-contain"
                />
              </div>
            </div>
          )}

          {/* 提示文本 */}
          {userQuery && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                {t('generation.userQuery', { ns: 'content', defaultValue: '用户提示' })}
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-gray-800 whitespace-pre-wrap break-words">
                  {userQuery}
                </p>
              </div>
            </div>
          )}

          {/* 空状态 */}
          {!userQuery && !imageUrl && (
            <div className="text-center py-8 text-gray-500">
              {t('generation.noPromptData', { ns: 'content', defaultValue: '暂无提示数据' })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors font-medium"
          >
            {t('close', { ns: 'common', defaultValue: '关闭' })}
          </button>
        </div>
      </div>
    </div>
  );
}

