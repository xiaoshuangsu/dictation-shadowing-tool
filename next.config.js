/** @type {import('next').NextConfig} */
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static export to enable dynamic rendering for Supabase
  // Cloudflare Pages supports full Next.js features
  output: undefined,

  // Image optimization
  images: {
    unoptimized: true,
  },

  // Experimental features for better compatibility
  experimental: {
    serverComponentsExternalPackages: [],
  },
}

module.exports = nextConfig
