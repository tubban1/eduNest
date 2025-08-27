'use client';
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslation } from 'react-i18next';

const languageFlags: Record<string, string> = {
  'zh-CN': '🇨🇳',
  'en-US': '🇺🇸',
  'de-DE': '🇩🇪',
  'fr-FR': '🇫🇷',
};

interface LanguageSelectorProps {
  variant?: 'button' | 'inline';
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ variant = 'button' }) => {
  const { currentLanguage, setLanguage, supportedLanguages } = useLanguage();
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (code: string) => {
    setLanguage(code);
    try {
      // 写入 i18next 的本地存储键，供 LanguageDetector 使用
      localStorage.setItem('i18nextLng', code);
      // 同步 i18n
      i18n.changeLanguage(code);
      // 同步 html lang
      if (typeof document !== 'undefined') {
        document.documentElement.lang = code;
      }
    } catch {}
    setIsOpen(false);
  };

  if (variant === 'inline') {
    return (
      <span>
        {languageFlags[currentLanguage] || ''} {supportedLanguages.find(l => l.code === currentLanguage)?.label || currentLanguage}
      </span>
    );
  }

  return (
    <div className="relative block w-full mb-3">
      <button
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        type="button"
      >
        <span className="flex items-center">
          <span className="mr-2">🌐</span>
          <span>{supportedLanguages.find(l => l.code === currentLanguage)?.label || currentLanguage}</span>
        </span>
        <svg className="ml-2 w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z" /></svg>
      </button>
      {isOpen && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg" role="listbox">
          {supportedLanguages.map(lang => (
            <li
              key={lang.code}
              className={`flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100 ${lang.code === currentLanguage ? 'font-semibold bg-gray-50' : ''}`}
              onClick={() => handleSelect(lang.code)}
              role="option"
              aria-selected={lang.code === currentLanguage}
            >
              <span className="mr-2">{languageFlags[lang.code]}</span>
              <span>{lang.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LanguageSelector;