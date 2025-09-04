'use client';

import Link from 'next/link';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Logo({ className = '', size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  return (
    <Link href="/" className={`inline-flex items-center ${className}`}>
      <Image
        src="/favicon.png"
        alt="EduNest AI"
        width={32}
        height={32}
        className={`${sizeClasses[size]} object-contain`}
      />
      <span className="ml-2 font-bold text-gray-900">EduNest AI</span>
    </Link>
  );
} 