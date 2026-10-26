import './globals.css'
import 'katex/dist/katex.min.css';
import AppClientProviders from '../components/AppClientProviders';
import ErrorBoundary from '../components/ErrorBoundary';
import type { Metadata } from 'next';

// Canonical URLs for public routes are set by their own route layouts.
export const metadata: Metadata = {
  metadataBase: new URL('https://www.edunest.app'),
  title: 'AI Education Platform',
  description: 'Explore interactive AI-generated educational content and make learning more engaging.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US">
      <body>
        <ErrorBoundary>
          <AppClientProviders>
            {children}
          </AppClientProviders>
        </ErrorBoundary>
      </body>
    </html>
  );
}
