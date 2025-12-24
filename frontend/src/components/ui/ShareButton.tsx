'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Share2, Copy, Check, Mail, Facebook, Twitter, Linkedin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ShareButtonProps {
  contentId: string;
  shortId?: string;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
  onShare?: () => void;
}

export default function ShareButton({
  contentId,
  shortId,
  title,
  size = 'md',
  showText = true,
  className = '',
  onShare
}: ShareButtonProps) {
  const { t } = useTranslation(['content', 'common']);
  const [mounted, setMounted] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  useEffect(() => { setMounted(true); }, []);

  const url = typeof window !== 'undefined' ? `${window.location.origin}/c/${shortId || contentId}` : '';
  const shareText = title ? `${title} - EduNest AI` : 'Check out this content on EduNest AI';

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowShareMenu(prev => !prev);
    if (!showShareMenu && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ left: Math.round(rect.left), top: Math.round(rect.bottom + 8) });
    }
    if (!showShareMenu) onShare?.();
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const openShareUrl = (shareUrl: string) => {
    if (!url) return;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
    setShowShareMenu(false);
  };

  const handlePlatformShare = (platform: string) => {
    if (!url) return;
    const encUrl = encodeURIComponent(url);
    const encText = encodeURIComponent(shareText);
    switch (platform) {
      case 'whatsapp':
        openShareUrl(`https://api.whatsapp.com/send?text=${encText}%20${encUrl}`);
        break;
      case 'x':
        openShareUrl(`https://twitter.com/intent/tweet?text=${encText}&url=${encUrl}`);
        break;
      case 'weibo':
        openShareUrl(`https://service.weibo.com/share/share.php?url=${encUrl}&title=${encText}`);
        break;
      case 'facebook':
        openShareUrl(`https://www.facebook.com/sharer/sharer.php?u=${encUrl}`);
        break;
      case 'reddit':
        openShareUrl(`https://www.reddit.com/submit?url=${encUrl}&title=${encText}`);
        break;
      case 'email':
        window.location.href = `mailto:?subject=${encodeURIComponent(title || 'EduNest AI Content')}&body=${encText}%20${encUrl}`;
        setShowShareMenu(false);
        break;
      case 'linkedin':
        openShareUrl(`https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`);
        break;
      default:
        break;
    }
  };

  const sizeClasses = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };
  const iconSizes = { sm: 'w-3 h-3', md: 'w-4 h-4', lg: 'w-5 h-5' };
  const pillPadding = { sm: 'px-3 py-1', md: 'px-4 py-1.5', lg: 'px-5 py-2' };

  const GridItem = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-gray-50 transition-colors">
      {children}
    </div>
  );

  const Circle = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${className}`}>
      {children}
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleShare}
        className={`inline-flex items-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 ${pillPadding[size]} ${sizeClasses[size]} transition-colors ${className}`}
        title={mounted ? t('share', { ns: 'content', defaultValue: 'Share' }) : 'Share'}
      >
        <Share2 className={`${iconSizes[size]} mr-2`} />
        {showText && (mounted ? t('share', { ns: 'content', defaultValue: 'Share' }) : 'Share')}
      </button>
      {showShareMenu && mounted && typeof document !== 'undefined' && createPortal(
        <div
          className="z-[10000] w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
          style={{ position: 'fixed', left: menuPos.left, top: menuPos.top }}
        >
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-sm font-semibold text-gray-800">{mounted ? t('share', { ns: 'content', defaultValue: 'Share' }) : 'Share'}</div>
          </div>

          <div className="px-3 py-3 grid grid-cols-4 gap-3">
            <button onClick={() => copyToClipboard(url)} className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-gray-50 transition-colors">
              <Circle className={copySuccess ? 'bg-green-100' : 'bg-gray-100'}>
                {copySuccess ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-gray-700" />}
              </Circle>
              <span className="text-xs text-gray-700">{mounted ? t('copyLink', { ns: 'content', defaultValue: 'Copy Link' }) : 'Copy Link'}</span>
            </button>

            <button onClick={() => handlePlatformShare('whatsapp')}><GridItem><Circle className="bg-green-100"><span className="text-green-600 text-sm font-semibold">WA</span></Circle><span className="text-xs text-gray-700">WhatsApp</span></GridItem></button>
            <button onClick={() => handlePlatformShare('x')}><GridItem><Circle className="bg-black"><Twitter className="w-5 h-5 text-white" /></Circle><span className="text-xs text-gray-700">X</span></GridItem></button>
            <button onClick={() => handlePlatformShare('weibo')}><GridItem><Circle className="bg-red-100"><span className="text-red-600 text-sm font-semibold">WB</span></Circle><span className="text-xs text-gray-700">Weibo</span></GridItem></button>
            <button onClick={() => handlePlatformShare('facebook')}><GridItem><Circle className="bg-primary/10"><Facebook className="w-5 h-5 text-primary" /></Circle><span className="text-xs text-foreground">Facebook</span></GridItem></button>
            <button onClick={() => handlePlatformShare('reddit')}><GridItem><Circle className="bg-orange-100"><span className="text-orange-600 text-sm font-semibold">R</span></Circle><span className="text-xs text-gray-700">Reddit</span></GridItem></button>
            <button onClick={() => handlePlatformShare('email')}><GridItem><Circle className="bg-gray-100"><Mail className="w-5 h-5 text-gray-700" /></Circle><span className="text-xs text-gray-700">Email</span></GridItem></button>
            <button onClick={() => handlePlatformShare('linkedin')}><GridItem><Circle className="bg-primary/10"><Linkedin className="w-5 h-5 text-primary" /></Circle><span className="text-xs text-foreground">LinkedIn</span></GridItem></button>
          </div>

          <div className="px-3 pb-3">
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 text-xs text-gray-600 truncate select-all">{url}</div>
              <button
                onClick={() => copyToClipboard(url)}
                className="ml-auto px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                {copySuccess ? (mounted ? t('copied', { ns: 'common', defaultValue: 'Copied!' }) : 'Copied!') : (mounted ? t('copy', { ns: 'common', defaultValue: 'Copy' }) : 'Copy')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showShareMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowShareMenu(false)}
        />
      )}
    </div>
  );
} 