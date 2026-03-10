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

  // 🔴 代理重写：开发环境下将媒体请求代理到 HTTPS Worker，避免混合内容警告
  // 注意：rewrites 在静态导出模式下不生效，但开发模式下可用
  async rewrites() {
    // 仅在开发模式下应用
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/proxy-media/:path*',
          destination: 'https://media.shadowhub.app/:path*',
        },
      ]
    }
    return []
  },

  // 🔴 关键修复：配置异步 headers 用于 CORS（仅开发环境）
  // 注意：静态导出模式下，headers 配置不会生效
  // 实际的 CORS 由 R2 Worker 代理处理
  async headers() {
    // 仅在开发模式下应用
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/:path*',
          headers: [
            { key: 'Access-Control-Allow-Origin', value: '*' },
            { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
            { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
          ],
        },
      ]
    }
    return []
  },

  // Disable webpack cache generation to prevent large cache files
  webpack: (config, { isServer }) => {
    // Disable filesystem cache to prevent cache/webpack/ directory generation
    if (!isServer) {
      config.cache = false;
    }
    // Disable TypeScript type checking during build (skip for faster builds)
    config.infrastructureLogging = {
      level: 'error',
    };
    return config;
  },

  // Disable type checking during build
  typescript: {
    ignoreBuildErrors: true,
  },

  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
