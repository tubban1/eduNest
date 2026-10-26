import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help & Learning Resources | eduNest',
  description: 'Explore eduNest help, AI learning tutorials, and product guidance.',
  alternates: { canonical: '/help' },
};

export default function HelpLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
