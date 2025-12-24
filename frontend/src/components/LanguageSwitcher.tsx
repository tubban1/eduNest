import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher: React.FC = () => {
  const { currentLanguage, setLanguage, supportedLanguages } = useLanguage();

  return (
    <div className="relative inline-block text-left">
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-600">语言:</span>
        <select
          value={currentLanguage}
          onChange={(e) => setLanguage(e.target.value)}
          className="block w-full px-3 py-2 text-sm border border-border rounded-md bg-card shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
        >
          {supportedLanguages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default LanguageSwitcher;
