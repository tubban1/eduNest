// 'use client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 导入语言资源
import enUSCommon from './locales/en-US/common.json';
import enUSNavigation from './locales/en-US/navigation.json';
import enUSContent from './locales/en-US/content.json';
import enUSHome from './locales/en-US/home.json';
import enUSWeChat from './locales/en-US/wechat.json';
import enUSReferral from './locales/en-US/referral.json';
import enUSCredits from './locales/en-US/credits.json';

import zhCNCommon from './locales/zh-CN/common.json';
import zhCNNavigation from './locales/zh-CN/navigation.json';
import zhCNContent from './locales/zh-CN/content.json';
import zhCNHome from './locales/zh-CN/home.json';
import zhCNWeChat from './locales/zh-CN/wechat.json';
import zhCNReferral from './locales/zh-CN/referral.json';
import zhCNCredits from './locales/zh-CN/credits.json';

import deDECommon from './locales/de-DE/common.json';
import deDENavigation from './locales/de-DE/navigation.json';
import deDEContent from './locales/de-DE/content.json';
import deDEHome from './locales/de-DE/home.json';
import deDEReferral from './locales/de-DE/referral.json';
import deDECredits from './locales/de-DE/credits.json';

import frFRCommon from './locales/fr-FR/common.json';
import frFRNavigation from './locales/fr-FR/navigation.json';
import frFRContent from './locales/fr-FR/content.json';
import frFRHome from './locales/fr-FR/home.json';
import frFRReferral from './locales/fr-FR/referral.json';
import frFRCredits from './locales/fr-FR/credits.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', label: '中文' },
  { code: 'en-US', label: 'English' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'fr-FR', label: 'Français' },
];
export const DEFAULT_LANGUAGE = 'en-US'; // 默认语言设为英文，确保SSR/CSR一致

const resources = {
  'en-US': {
    common: enUSCommon,
    navigation: enUSNavigation,
    content: enUSContent,
    home: enUSHome,
    wechat: enUSWeChat,
    referral: enUSReferral,
    credits: enUSCredits,
  },
  'zh-CN': {
    common: zhCNCommon,
    navigation: zhCNNavigation,
    content: zhCNContent,
    home: zhCNHome,
    wechat: zhCNWeChat,
    referral: zhCNReferral,
    credits: zhCNCredits,
  },
  'de-DE': {
    common: deDECommon,
    navigation: deDENavigation,
    content: deDEContent,
    home: deDEHome,
    referral: deDEReferral,
    credits: deDECredits,
  },
  'fr-FR': {
    common: frFRCommon,
    navigation: frFRNavigation,
    content: frFRContent,
    home: frFRHome,
    referral: frFRReferral,
    credits: frFRCredits,
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
    ns: ['common', 'navigation', 'auth', 'content', 'home', 'referral', 'credits'],
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