// 'use client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN_common from './locales/zh-CN/common.json';
import zhCN_navigation from './locales/zh-CN/navigation.json';
import zhCN_auth from './locales/zh-CN/auth.json';
import zhCN_content from './locales/zh-CN/content.json';
import zhCN_home from './locales/zh-CN/home.json';
import enUS_common from './locales/en-US/common.json';
import enUS_navigation from './locales/en-US/navigation.json';
import enUS_auth from './locales/en-US/auth.json';
import enUS_content from './locales/en-US/content.json';
import enUS_home from './locales/en-US/home.json';
import deDE_common from './locales/de-DE/common.json';
import deDE_navigation from './locales/de-DE/navigation.json';
import deDE_auth from './locales/de-DE/auth.json';
import deDE_content from './locales/de-DE/content.json';
import deDE_home from './locales/de-DE/home.json';
import frFR_common from './locales/fr-FR/common.json';
import frFR_navigation from './locales/fr-FR/navigation.json';
import frFR_auth from './locales/fr-FR/auth.json';
import frFR_content from './locales/fr-FR/content.json';
import frFR_home from './locales/fr-FR/home.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', label: '中文' },
  { code: 'en-US', label: 'English' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'fr-FR', label: 'Français' },
];
export const DEFAULT_LANGUAGE = 'en-US';

const resources = {
  'zh-CN': {
    common: zhCN_common,
    navigation: zhCN_navigation,
    auth: zhCN_auth,
    content: zhCN_content,
    home: zhCN_home,
  },
  'zh': {  // 添加zh别名，映射到zh-CN
    common: zhCN_common,
    navigation: zhCN_navigation,
    auth: zhCN_auth,
    content: zhCN_content,
    home: zhCN_home,
  },
  'en-US': {
    common: enUS_common,
    navigation: enUS_navigation,
    auth: enUS_auth,
    content: enUS_content,
    home: enUS_home,
  },
  'en': {  // 添加en别名，映射到en-US
    common: enUS_common,
    navigation: enUS_navigation,
    auth: enUS_auth,
    content: enUS_content,
    home: enUS_home,
  },
  'de-DE': {
    common: deDE_common,
    navigation: deDE_navigation,
    auth: deDE_auth,
    content: deDE_content,
    home: deDE_home,
  },
  'de': {  // 添加de别名，映射到de-DE
    common: deDE_common,
    navigation: deDE_navigation,
    auth: deDE_auth,
    content: deDE_content,
    home: deDE_home,
  },
  'fr-FR': {
    common: frFR_common,
    navigation: frFR_navigation,
    auth: frFR_auth,
    content: frFR_content,
    home: frFR_home,
  },
  'fr': {  // 添加fr别名，映射到fr-FR
    common: frFR_common,
    navigation: frFR_navigation,
    auth: frFR_auth,
    content: frFR_content,
    home: frFR_home,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code).concat(['zh', 'en', 'de', 'fr']), // 包含别名
    ns: ['common', 'navigation', 'auth', 'content', 'home'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
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
    debug: process.env.NODE_ENV === 'development', // 只在开发环境开启debug
  });

export default i18n;