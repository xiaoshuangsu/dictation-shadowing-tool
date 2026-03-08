/**
 * ShadowHub Media Proxy Worker
 *
 * B 账号 Worker - 用于代理 A 账号 R2 桶中的媒体资源
 * 确保移动端和跨域请求正常工作
 *
 * 部署说明：
 * 1. 在 B 账号 Cloudflare Dashboard 创建 Worker
 * 2. 绑定域名：media.shadowhub.app
 * 3. 绑定 R2 桶：变量名 R2_BUCKET
 * 4. 部署此代码
 */

// A 账号 R2 桶的公共域名（直接访问，无需 Worker）
const R2_PUBLIC_DOMAIN = 'https://pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev';

// 允许的来源
const ALLOWED_ORIGINS = [
  'https://shadowhub.app',
  'http://localhost:3000',  // 开发环境
];

// CORS 响应头
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400', // 24 小时
};

export default {
  async fetch(request, env, ctx) {
    // 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // 只允许 GET 和 HEAD 请求
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: {
          ...CORS_HEADERS,
          'Allow': 'GET, HEAD, OPTIONS',
        },
      });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // 构造 R2 公共 URL
      const r2Url = `${R2_PUBLIC_DOMAIN}${path}`;

      console.log(`Proxying request to: ${r2Url}`);

      // 转发请求到 R2 公共域名
      const r2Request = new Request(r2Url, {
        method: request.method,
        headers: request.headers,
      });

      const response = await fetch(r2Request);

      // 复制响应并添加 CORS 头
      const newResponse = new Response(response.body, response);

      // 添加 CORS 头
      Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        newResponse.headers.set(key, value);
      });

      // 确保内容类型正确
      if (path.match(/\.(mp4|webm|ogg)$/i)) {
        newResponse.headers.set('Content-Type', 'video/mp4');
      } else if (path.match(/\.(mp3|wav|m4a)$/i)) {
        newResponse.headers.set('Content-Type', 'audio/mpeg');
      } else if (path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        const ext = path.split('.').pop()?.toLowerCase();
        const mimeTypes = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
        };
        if (ext && mimeTypes[ext]) {
          newResponse.headers.set('Content-Type', mimeTypes[ext]);
        }
      }

      // 缓存控制
      newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');

      return newResponse;

    } catch (error) {
      console.error('Proxy error:', error);

      return new Response(`Proxy error: ${error.message}`, {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  },
};
