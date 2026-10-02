import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://radar.edunest.app'),
  title: 'AI Education Innovation Radar · BeLEARN Booster',
  description: 'From global innovation signals to local educational practice. A scientific observatory monitoring educational AI experiments and translating them into exploratory Swiss application hypotheses.',
  applicationName: 'AI Education Innovation Radar',
  authors: [{ name: 'BeLEARN Booster · PHBern Cognate Lab' }],
  keywords: ['AI Education', 'Innovation Radar', 'BeLEARN', 'PHBern', 'Lehrplan 21', 'EdTech Intelligence', 'Educational Policy'],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' }
    ],
    apple: [
      { url: '/icon.svg', type: 'image/svg+xml' }
    ]
  },
  openGraph: {
    type: 'website',
    url: 'https://radar.edunest.app',
    title: 'AI Education Innovation Radar',
    description: 'From global innovation signals to local educational practice. Scientific intelligence instrument for BeLEARN and PHBern.',
    siteName: 'AI Education Innovation Radar',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'AI Education Innovation Radar · BeLEARN Booster Demonstrator'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Education Innovation Radar',
    description: 'From global innovation signals to local educational practice. Scientific intelligence instrument for BeLEARN and PHBern.',
    images: ['/og-image.jpg']
  }
};

export const viewport: Viewport = {
  themeColor: '#050c0a',
  colorScheme: 'dark'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
