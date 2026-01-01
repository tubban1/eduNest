'use client';
import { LanguageProvider } from '../contexts/LanguageContext';
import { AuthProvider } from '@/hooks/useAuth';
import SessionConflictAlert from './SessionConflictAlert';
import { ToastContainer } from './ui/Toast';

export default function AppClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <SessionConflictAlert />
        <ToastContainer />
        {children}
      </LanguageProvider>
    </AuthProvider>
  );
}