import './globals.css'
import AppClientProviders from '../components/AppClientProviders';

// 如需多语言SEO，建议采用 next-intl 或 next-i18next 路由方案实现动态meta
export const metadata = {
  title: 'AI Education Platform',
  description: 'Explore interactive AI-generated educational content and make learning more engaging.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppClientProviders>
          {children}
        </AppClientProviders>
      </body>
    </html>
  );
}
