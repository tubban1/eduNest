// 'use client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 导入语言资源
import enUSCommon from './locales/en-US/common.json';
import enUSContent from './locales/en-US/content.json';
import enUSWeChat from './locales/en-US/wechat.json';

import zhCNCommon from './locales/zh-CN/common.json';
import zhCNContent from './locales/zh-CN/content.json';
import zhCNWeChat from './locales/zh-CN/wechat.json';

import deDECommon from './locales/de-DE/common.json';
import deDEContent from './locales/de-DE/content.json';

import frFRCommon from './locales/fr-FR/common.json';
import frFRContent from './locales/fr-FR/content.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', label: '中文' },
  { code: 'en-US', label: 'English' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'fr-FR', label: 'Français' },
];
export const DEFAULT_LANGUAGE = 'zh-CN'; // 改为中文作为默认语言，避免水合错误

const resources = {
  'en-US': {
    common: enUSCommon,
    content: enUSContent,
    wechat: enUSWeChat,
  },
  'zh-CN': {
    common: zhCNCommon,
    content: zhCNContent,
    wechat: zhCNWeChat,
  },
  'de-DE': {
    common: deDECommon,
    content: deDEContent,
  },
  'fr-FR': {
    common: frFRCommon,
    content: frFRContent,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    // 关键修复：不再强制设定 lng，交给 LanguageDetector + localStorage 持久化
    // lng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code).concat(['zh', 'en', 'de', 'fr']), // 包含别名
    ns: ['common', 'navigation', 'auth', 'content', 'home'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    returnObjects: true,
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      // 添加语言映射
      lookupLocalStorage: 'i18nextLng',
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',
      lookupSessionStorage: 'i18nextLng',
      lookupFromPathIndex: 0,
      lookupFromSubdomainIndex: 0,
      // 语言标准化
      convertDetectedLanguage: (lng: string) => {
        // 将zh映射到zh-CN，en映射到en-US等
        if (lng === 'zh') return 'zh-CN';
        if (lng === 'en') return 'en-US';
        if (lng === 'de') return 'de-DE';
        if (lng === 'fr') return 'fr-FR';
        return lng;
      }
    },
    react: { useSuspense: false },
    debug: false,
  });

export default i18n;