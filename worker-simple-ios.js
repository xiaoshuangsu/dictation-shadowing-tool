/**
 * ShadowHub Media Proxy Worker - 透明转发版
 *
 * 核心原则：
 * 1. 透传所有请求（包括 Range header）给 A 账号 Worker
 * 2. 透传所有响应头，只添加 CORS
 * 3. 确保不丢失 Content-Range 和 Content-Type
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

      // 🔴 关键：透传所有原始请求头，包括 Range
      const response = await fetch(aWorkerUrl, {
        method: request.method,
        headers: request.headers,
      });

      if (response.status === 404) {
        return new Response('Not found', { status: 404 });
      }

      // 🔴 关键：复制 A Worker 的所有响应头
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

      // 🔴 关键：添加 CORS 头
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Access-Control-Allow-Headers', '*');
      headers.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

      console.log(`[Proxy] ${path} -> ${response.status}, Content-Type: ${headers.get('Content-Type')}`);

      // 🔴 关键：零缓冲流式转发
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
