/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image optimization (disabled for Cloudflare Pages compatibility)
  images: {
    unoptimized: true,
  },

  // Ensure trailing slash for proper routing
  trailingSlash: true,

  // Disable webpack cache generation to prevent large cache files
  webpack: (config, { isServer }) => {
    // Disable filesystem cache to prevent cache/webpack/ directory generation
    if (!isServer) {
      config.cache = false;
    }
    return config;
  },
}

module.exports = nextConfig
