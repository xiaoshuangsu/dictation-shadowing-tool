/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image optimization (disabled for Cloudflare Pages compatibility)
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
