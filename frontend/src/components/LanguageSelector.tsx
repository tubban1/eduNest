'use client';
import React, { useEffect, useRef, useState } from 'react';
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
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 监听窗口尺寸，判定移动端（与 Tailwind sm 断点一致）
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      // 兼容旧浏览器：既支持 addEventListener 也支持 addListener
      const matches = 'matches' in e ? e.matches : (e as MediaQueryList).matches;
      setIsMobile(matches);
    };
    handler(mq);
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', handler as any);
    else if (typeof mq.addListener === 'function') mq.addListener(handler as any);
    return () => {
      if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', handler as any);
      else if (typeof mq.removeListener === 'function') mq.removeListener(handler as any);
    };
  }, []);

  // 点击外部关闭（桌面下拉与移动端蒙层均生效）
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (ev: MouseEvent | TouchEvent) => {
      const target = ev.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown as any);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

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
    <div ref={containerRef} className="relative inline-block">
      <button
        className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Change language"
        type="button"
      >
        <span aria-hidden>🌐</span>
      </button>
      {isOpen && !isMobile && (
        <ul
          className="absolute left-0 z-50 mt-2 min-w-[10rem] bg-white border border-gray-200 rounded-lg shadow-lg py-1"
          role="listbox"
        >
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

      {isOpen && isMobile && (
        <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
          {/* 蒙层 */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          {/* 底部弹出框 */}
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl pb-safe">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-2" />
            <div className="max-h-[60vh] overflow-auto py-2">
              {supportedLanguages.map(lang => (
                <button
                  key={lang.code}
                  className={`w-full text-left px-5 py-3 flex items-center ${lang.code === currentLanguage ? 'bg-gray-50 font-semibold' : 'hover:bg-gray-50'}`}
                  onClick={() => handleSelect(lang.code)}
                  role="option"
                  aria-selected={lang.code === currentLanguage}
                >
                  <span className="mr-3 text-xl">{languageFlags[lang.code]}</span>
                  <span className="text-base">{lang.label}</span>
                </button>
              ))}
            </div>
            <div className="p-3">
              <button
                className="w-full py-3 border border-gray-300 rounded-xl text-gray-700"
                onClick={() => setIsOpen(false)}
              >
                {t('common:close', { defaultValue: '关闭' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;