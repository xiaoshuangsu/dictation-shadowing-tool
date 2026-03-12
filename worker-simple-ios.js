/**
 * ShadowHub Media Proxy Worker - HTTP 访问 A 账号 R2 版
 *
 * 关键修复：
 * 1. 通过 HTTP 访问 A 账号的 R2 公开 URL（跨账号访问）
 * 2. 支持 Range 请求（移动端视频播放必需）
 * 3. 正确的 CORS 头
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
};

// A 账号 Worker URL（直接访问 R2，Range 请求快 7.5 倍）
const A_ACCOUNT_WORKER_URL = 'https://r2-proxy.suxiaoshuang2020.workers.dev';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    try {
      const url = new URL(request.url);
      let path = url.pathname;

      if (path.startsWith('/')) {
        path = path.substring(1);
      }

      // 记录 Range 请求
      const rangeHeader = request.headers.get('Range');
      if (rangeHeader) {
        console.log(`[Proxy] Range request: ${path}, Range: ${rangeHeader}`);
      } else {
        console.log(`[Proxy] Request: ${path}`);
      }

      // 构建 A 账号 Worker URL
      const r2Url = `${A_ACCOUNT_WORKER_URL}/${path}`;

      // 转发请求到 A 账号 R2
      const r2Request = new Request(r2Url, {
        method: request.method,
        headers: request.headers,
      });

      const response = await fetch(r2Request);

      if (!response.ok) {
        console.error(`[Proxy] R2 returned ${response.status}: ${path}`);
        return new Response('Not found', {
          status: response.status,
          headers: CORS_HEADERS,
        });
      }

      // 构建响应头
      const headers = new Headers();

      // 复制 R2 的响应头
      response.headers.forEach((value, key) => {
        headers.set(key, value);
      });

      // 覆盖 CORS 头
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Access-Control-Allow-Headers', '*');
      headers.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

      // 🔴 关键修复：确保 Connection: keep-alive，避免 AbortError
      headers.set('Connection', 'keep-alive');

      // 确保正确的 Content-Type
      if (path.indexOf('thumbnails/') === 0) {
        headers.set('Content-Type', 'image/webp');
      }

      console.log(`[Proxy] Serving: ${path}, status: ${response.status}, type: ${headers.get('Content-Type')}`);

      return new Response(response.body, {
        status: response.status,
        headers,
      });

    } catch (error) {
      console.error('[Proxy] Error:', error);
      return new Response('Error', { status: 500, headers: CORS_HEADERS });
    }
  },
};
