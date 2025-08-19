'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import i18n, { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../i18n/config';

interface LanguageContextProps {
  currentLanguage: string;
  setLanguage: (lang: string) => void;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [currentLanguage, setCurrentLanguage] = useState<string>(i18n.language || DEFAULT_LANGUAGE);

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setCurrentLanguage(lng);
      console.log('Language changed to:', lng);
    };
    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  const setLanguage = (lang: string) => {
    if (lang !== currentLanguage) {
      i18n.changeLanguage(lang).then(() => {
        console.log('i18n.changeLanguage finished:', lang);
        window.location.reload(); // 强制刷新，确保所有组件响应
      });
    }
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, setLanguage, supportedLanguages: SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}; 