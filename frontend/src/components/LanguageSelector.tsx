'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const mobileModalRef = useRef<HTMLDivElement | null>(null);

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
      if (isMobile) {
        // 移动端：检查是否点击在弹窗外部
        if (mobileModalRef.current && target && !mobileModalRef.current.contains(target)) {
          setIsOpen(false);
        }
      } else {
        // 桌面端：检查是否点击在按钮容器外部
        if (containerRef.current && target && !containerRef.current.contains(target)) {
          setIsOpen(false);
        }
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
  }, [isOpen, isMobile]);

  const handleSelect = (code: string) => {
    // 只调用 setLanguage，它会处理所有同步和页面刷新
    setLanguage(code);
    // 不需要手动关闭弹窗，因为页面会刷新
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
          className="absolute left-0 z-50 mt-2 min-w-[10rem] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg py-1"
          role="listbox"
        >
          {supportedLanguages.map(lang => (
            <li
              key={lang.code}
              className={`flex items-center px-3 py-2 cursor-pointer text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-600 ${lang.code === currentLanguage ? 'font-semibold bg-gray-50 dark:bg-slate-700' : ''}`}
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

      {isOpen && isMobile && createPortal(
        <div 
          ref={mobileModalRef}
          className="fixed inset-0 z-[9999]" 
          aria-modal="true" 
          role="dialog"
          style={{ zIndex: 9999 }}
        >
          {/* 蒙层 */}
          <div 
            className="absolute inset-0 bg-black/40" 
            onClick={() => setIsOpen(false)}
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)'
            }} 
          />
          {/* 底部弹出框 */}
          <div 
            className="bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              borderTopLeftRadius: '1rem',
              borderTopRightRadius: '1rem',
              boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.1), 0 -10px 10px -5px rgba(0, 0, 0, 0.04)',
              paddingBottom: 'env(safe-area-inset-bottom)'
            }}
          >
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mt-3 mb-2" />
            <div className="max-h-[60vh] overflow-auto py-2">
              {supportedLanguages.map(lang => (
                <button
                  key={lang.code}
                  className={`w-full text-left px-5 py-3 flex items-center text-gray-900 dark:text-white ${lang.code === currentLanguage ? 'bg-gray-100 dark:bg-slate-700 font-semibold' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}`}
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
                className="ai-gradient-btn w-full py-3 rounded-xl"
                onClick={() => setIsOpen(false)}
              >
                {t('common:close', { defaultValue: '关闭' })}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default LanguageSelector;