/**
 * ShadowHub Media Proxy Worker - 管道流优化版
 *
 * 核心优化：
 * 1. 流式转发，不等待全部下载
 * 2. 移除二次加工的 Header
 * 3. 添加分片大小调试日志
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
          'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, ETag, Last-Modified',
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

      const rangeHeader = request.headers.get('Range');
      console.log('[Proxy] Request: ' + path + (rangeHeader ? ', Range: ' + rangeHeader : ''));

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

      // 🔴 关键：复制所有响应头，移除导致二次加工的头
      const headers = new Headers();
      response.headers.forEach((value, key) => {
        const keyLower = key.toLowerCase();

        // 跳过 Cloudflare 内部头和可能导致二次加工的头
        if (keyLower.startsWith('x-') ||
            keyLower === 'cf-ray' ||
            keyLower === 'cf-cache-status' ||
            keyLower === 'cf-request-id' ||
            keyLower === 'server' && value === 'cloudflare') {
          return;
        }

        headers.set(key, value);
      });

      // 确保缓存策略正确
      if (!headers.has('Cache-Control')) {
        headers.set('Cache-Control', 'public, max-age=3600');
      }

      // 添加 CORS 头
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Access-Control-Allow-Headers', '*');
      headers.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, ETag, Last-Modified');

      // 🔴 关键调试日志：记录分片信息
      const contentLength = headers.get('Content-Length');
      if (contentLength) {
        const sizeMB = parseInt(contentLength) / (1024 * 1024);
        console.log('[Proxy] Serving: ' + path + ' -> ' + response.status +
                   ', Content-Length: ' + sizeMB.toFixed(2) + 'MB' +
                   ', ETag: ' + (headers.get('ETag')?.substring(0, 20) || 'N/A'));
      }

      // 🔴 关键：流式转发，使用 ReadableStream pip
      // 不等待全部下载，立即开始传输
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
