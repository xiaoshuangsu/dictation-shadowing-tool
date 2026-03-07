/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Cloudflare Pages
  output: 'export',

  // Image optimization (disabled for Cloudflare Pages compatibility)
  images: {
    unoptimized: true,
  },

  // Ensure trailing slash for proper routing
  trailingSlash: true,

  // Explicitly embed environment variables into the client bundle
  // This is required for static export to work with public env vars
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },

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
