/** @type {import('next').NextConfig} */
const nextConfig = {
  // 🔴 Vercel 部署：禁用静态导出，启用 API Routes 支持
  // 注意：Vercel 原生支持 Next.js，不需要静态导出
  // output: process.env.NODE_ENV === 'production' ? 'export' : undefined,

  // Image optimization
  // 🔥 v30.4.2: 启用图片优化，支持 priority 和 blur placeholder
  images: {
    unoptimized: false,  // 🔥 启用图片优化
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.shadowhub.app',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',  // 🔥 YouTube 缩略图
        port: '',
        pathname: '/**',
      },
    ],
  },

  // 🔴 修复：禁用 trailingSlash，避免 API 路由末尾斜杠导致的 500 错误
  // Next.js App Router 自动处理路由匹配，不需要强制末尾斜杠
  trailingSlash: false,

  // Explicitly embed environment variables into the client bundle
  // This is required for static export to work with public env vars
  // Note: These are already hardcoded in src/lib/supabase/client.ts for static export
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cuxotlijjnxbsirpdkgr.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1eG90bGlqam54YnNpcnBka2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDg1MzQsImV4cCI6MjA4NjY4NDUzNH0.J_Ix3NnKEFDGlINAWQBCLZyW1lmep-5BKqnIAfpgQwk',
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
