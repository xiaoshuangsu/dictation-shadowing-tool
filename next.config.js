/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/dictation-shadowing-tool',
  assetPrefix: 'https://xiaoshuangsu.github.io/dictation-shadowing-tool/',
  output: 'export',
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
