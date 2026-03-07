/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image optimization (disabled for Cloudflare Pages compatibility)
  images: {
    unoptimized: true,
  },

  // Disable webpack cache to prevent large files
  webpack: (config, { dev, isServer }) => {
    config.cache = false;
    return config;
  },
}

module.exports = nextConfig
