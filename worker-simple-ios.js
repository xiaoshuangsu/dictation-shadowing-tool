/**
 * ShadowHub Media Proxy Worker - 最简化版
 *
 * 只做两件事：
 * 1. 透传请求（包括 Range header）给 A 账号 Worker
 * 2. 在响应上添加 CORS 头
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

      if (!response.ok) {
        return new Response('Not found', { status: response.status });
      }

      // 🔴 关键：复制 A Worker 的所有响应头，只添加 CORS
      const headers = new Headers();
      response.headers.forEach((value, key) => {
        headers.set(key, value);
      });

      // 添加 CORS 头
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Access-Control-Allow-Headers', '*');
      headers.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

      console.log(`[Proxy] ${path} -> ${response.status}`);

      // 流式转发
      return new Response(response.body, {
        status: response.status,
        headers,
      });

    } catch (error) {
      console.error('[Proxy] Error:', error);
      return new Response('Error: ' + error.message, { status: 500 });
    }
  },
};
