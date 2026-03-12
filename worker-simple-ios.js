/**
 * ShadowHub Media Proxy Worker - 吞吐量优化版
 *
 * 核心优化：
 * 1. 透传所有响应头，特别是 Content-Length
 * 2. 添加边缘缓存，加速分片读取
 * 3. 零缓冲流式转发，最大化吞吐量
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
          'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
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

      // 🔴 关键：透传所有原始请求头
      const response = await fetch(aWorkerUrl, {
        method: request.method,
        headers: request.headers,
      });

      if (response.status === 404) {
        return new Response('Not found', { status: 404 });
      }

      // 🔴 关键：复制所有响应头，包括 Content-Length
      const headers = new Headers();
      response.headers.forEach((value, key) => {
        const keyLower = key.toLowerCase();
        // 只跳过 Cloudflare 内部头
        if (keyLower.startsWith('x-') ||
            keyLower === 'cf-ray' ||
            keyLower === 'server' && value === 'cloudflare') {
          return;
        }
        headers.set(key, value);
      });

      // 🔴 关键：确保边缘缓存存在
      if (!headers.has('Cache-Control')) {
        headers.set('Cache-Control', 'public, max-age=3600');
      }

      // 添加 CORS 头
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Access-Control-Allow-Headers', '*');
      headers.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

      console.log(`[Proxy] ${path} -> ${response.status}, Content-Length: ${headers.get('Content-Length')}`);

      // 🔴 关键：零缓冲流式转发，最大化吞吐量
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
