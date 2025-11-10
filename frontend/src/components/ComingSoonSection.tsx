'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';

export default function ComingSoonSection() {
  const { t } = useTranslation(['home', 'common']);
  const [mounted, setMounted] = React.useState(false);
  
  React.useEffect(() => { setMounted(true); }, []);
  
  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-200 text-center">
      <div className="text-5xl mb-4">🎨</div>
      <h3 className="text-2xl font-bold text-gray-800 mb-2">
        {mounted ? t('moreContentComingSoon', { ns: 'home', defaultValue: '更多精彩内容正在制作中' }) : '更多精彩内容正在制作中'}
      </h3>
      <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
        {mounted ? t('weAreCreatingMoreHighQualityContent', { ns: 'home', defaultValue: '我们正在精心制作更多高质量的互动教学内容，每一个内容都经过精心设计和验证，确保学习效果。' }) : '我们正在精心制作更多高质量的互动教学内容，每一个内容都经过精心设计和验证，确保学习效果。'}
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
          {mounted ? t('subscribeForUpdates', { ns: 'home', defaultValue: '订阅更新通知' }) : '订阅更新通知'}
        </button>
        <button className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
          {mounted ? t('suggestContent', { ns: 'home', defaultValue: '提交内容建议' }) : '提交内容建议'}
        </button>
      </div>
    </div>
  );
}

