/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

const nextConfig = {
  // Only use basePath in production for GitHub Pages
  basePath: isProd ? '/dictation-shadowing-tool' : '',
  assetPrefix: isProd ? '/dictation-shadowing-tool' : '',
  output: 'export',
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
