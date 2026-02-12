/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: '/dictation-shadowing-tool',
  assetPrefix: '/dictation-shadowing-tool',
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
