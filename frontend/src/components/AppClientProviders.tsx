'use client';
import { LanguageProvider } from '../contexts/LanguageContext';
import { AuthProvider } from '@/hooks/useAuth';
export default function AppClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        {children}
      </LanguageProvider>
    </AuthProvider>
  );
}