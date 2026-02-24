/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use basePath in production for GitHub Pages
  basePath: isProd ? '/dictation-shadowing-tool' : '',
  assetPrefix: isProd ? '/dictation-shadowing-tool' : '',
  // Always use static export when NODE_ENV is production
  ...(isProd ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
