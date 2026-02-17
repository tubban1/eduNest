'use client';
import { LanguageProvider } from '../contexts/LanguageContext';
import { AuthProvider } from '@/hooks/useAuth';
import SessionConflictAlert from './SessionConflictAlert';
import { ToastContainer } from './ui/Toast';
import RoleGuard from './RoleGuard';

export default function AppClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <SessionConflictAlert />
        <ToastContainer />
        <RoleGuard />
        {children}
      </LanguageProvider>
    </AuthProvider>
  );
}