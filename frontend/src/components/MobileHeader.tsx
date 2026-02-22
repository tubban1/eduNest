'use client';

import { MobileMenuButton } from './Sidebar';

interface MobileHeaderProps {
  onMenuClick: () => void;
  className?: string;
}

export default function MobileHeader({ onMenuClick, className = '' }: MobileHeaderProps) {
  return (
    <div className={`lg:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 border-b border-border ${className}`}>
      <MobileMenuButton onClick={onMenuClick} />
      <div className="w-16" aria-hidden />
    </div>
  );
}
