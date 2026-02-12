/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/dictation-shadowing-tool',
  assetPrefix: '/dictation-shadowing-tool',
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
