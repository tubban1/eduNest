import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Learning Workspace | eduNest',
  description:
    'Explore eduNest AI-guided learning, create interactive learning materials, and learn with an AI assistant.',
  alternates: {
    canonical: '/learn',
  },
  openGraph: {
    title: 'AI Learning Workspace | eduNest',
    description: 'Interactive AI-guided learning and educational content on eduNest.',
    url: '/learn',
    type: 'website',
  },
};

export default function LearnLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
