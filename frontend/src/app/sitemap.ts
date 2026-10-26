import type { MetadataRoute } from 'next';

// Only public, stable, canonical routes. Do not enumerate private learner content.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.edunest.app';
  return ['/', '/learn', '/help'].map((path) => ({
    url: new URL(path, base).toString(),
  }));
}
