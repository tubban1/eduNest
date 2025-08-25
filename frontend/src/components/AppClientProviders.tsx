'use client';
import { LanguageProvider } from '../contexts/LanguageContext';
import { AuthProvider } from '@/hooks/useAuth';
import SessionConflictAlert from './SessionConflictAlert';

export default function AppClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <SessionConflictAlert />
        {children}
      </LanguageProvider>
    </AuthProvider>
  );
}