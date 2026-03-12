/**
 * ShadowHub Media Proxy Worker - 零干扰流式转发版
 *
 * 核心原则：
 * 1. 透传请求（包括 Range header）给 A 账号 Worker
 * 2. 流式转发 response.body，零缓冲
 * 3. 只添加 CORS 头，删除所有 Cloudflare 内部头
 */

const A_ACCOUNT_WORKER_URL = 'https://r2-proxy.suxiaoshuang2020.workers.dev';

export default {
  async fetch(request, env, ctx) {
    // OPTIONS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const url = new URL(request.url);
      let path = url.pathname;
      if (path.startsWith('/')) {
        path = path.substring(1);
      }

      // 构建 A Worker URL
      const aWorkerUrl = `${A_ACCOUNT_WORKER_URL}/${path}`;

      // 🔴 关键：透传所有原始请求头，包括 Range
      const response = await fetch(aWorkerUrl, {
        method: request.method,
        headers: request.headers,
      });

      // 🔴 关键：即使是非 2xx 状态也继续，让 R2 的错误直接透传
      // 这样可以保留原始的 404 等状态码
      if (response.status === 404) {
        return new Response('Not found', { status: 404 });
      }

      // 🔴 关键：只保留 R2 的原始头，删除所有 Cloudflare 内部头
      const headers = new Headers();
      response.headers.forEach((value, key) => {
        const keyLower = key.toLowerCase();
        // 跳过所有 Cloudflare 内部头（x- 开头）和可能干扰的头
        if (keyLower.startsWith('x-') ||
            keyLower === 'cf-ray' ||
            keyLower === 'server' && value === 'cloudflare') {
          return; // 跳过这些头
        }
        headers.set(key, value);
      });

      // 🔴 关键：只添加 CORS 头，不修改任何 R2 的头
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Access-Control-Allow-Headers', '*');
      headers.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

      console.log(`[Proxy] ${path} -> ${response.status} (streaming)`);

      // 🔴 关键：零缓冲流式转发，response.body 直接传递给用户
      // 不经过任何内存缓冲，确保大视频流式传输不中断
      return new Response(response.body, {
        status: response.status,
        headers,
      });

    } catch (error) {
      console.error('[Proxy] Error:', error);
      return new Response('Error: ' + error.message, { status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
  },
};
