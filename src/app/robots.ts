import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/login',
          '/register',
          '/profile',
        ],
      },
    ],
    sitemap: 'https://shadowhub.app/sitemap.xml',
  }
}
