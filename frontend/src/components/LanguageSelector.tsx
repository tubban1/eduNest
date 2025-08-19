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
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (code: string) => {
    setLanguage(code);
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
    <div className="relative inline-block text-left">
      <button
        className="flex items-center px-2 py-1 border rounded hover:bg-gray-100"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        type="button"
      >
        <span className="mr-1">🌐</span>
        <span>{supportedLanguages.find(l => l.code === currentLanguage)?.label || currentLanguage}</span>
        <svg className="ml-1 w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z" /></svg>
      </button>
      {isOpen && (
        <ul className="absolute z-10 mt-1 w-full bg-white border rounded shadow-lg" role="listbox">
          {supportedLanguages.map(lang => (
            <li
              key={lang.code}
              className={`flex items-center px-2 py-1 cursor-pointer hover:bg-gray-200 ${lang.code === currentLanguage ? 'font-bold' : ''}`}
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