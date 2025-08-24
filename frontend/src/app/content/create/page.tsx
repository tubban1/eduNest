'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ContentForm from '@/components/ContentForm';
import { useTranslation } from 'react-i18next';

export default function CreateContentPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [isWeChat, setIsWeChat] = useState(false);

  useEffect(() => {
    // 检测微信浏览器
    const userAgent = navigator.userAgent.toLowerCase();
    const isWeChatBrowser = /micromessenger/i.test(userAgent);
    setIsWeChat(isWeChatBrowser);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 微信兼容性提示 */}
      {isWeChat && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mx-4 mt-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                {t('wechat.compatibilityNotice', '微信浏览器兼容性提示')}
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p className="mb-2">
                  {t('wechat.createPageNotice', '在微信中创建内容时，预览可能无法正常显示。建议：')}
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t('wechat.saveFirst', '先保存内容')}</li>
                  <li>{t('wechat.openInBrowser', '保存后使用浏览器打开')}</li>
                  <li>{t('wechat.useStandalone', '或使用独立页面模式')}</li>
                </ul>
                <p className="mt-2 font-medium">
                  {t('wechat.afterSave', '保存后，你可以：')}
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t('wechat.openInNewTab', '在新标签页中打开内容')}</li>
                  <li>{t('wechat.downloadHTML', '下载独立HTML文件')}</li>
                  <li>{t('wechat.shareLink', '分享独立页面链接')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 内容表单 */}
      <div className="w-full h-screen">
        <ContentForm
          mode="create"
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
  );
} 