import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/auth/', '/onboard/', '/collections/', '/test-'],
    },
    sitemap: 'https://www.edunest.app/sitemap.xml',
    host: 'https://www.edunest.app',
  };
}
