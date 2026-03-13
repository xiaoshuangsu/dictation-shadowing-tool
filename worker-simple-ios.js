/**
 * ShadowHub B 账号 Worker (morning-sound-a67b) - 纯透传版本
 *
 * 🔴 断舍离：纯粹的代理，不做任何干预
 * - 流式转发 response.body
 * - 只保留必要的响应头
 * - 不读取、不缓冲、不修改数据
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
          'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, ETag',
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

      // 🔴 透传请求到 A Worker
      const response = await fetch(aWorkerUrl, {
        method: request.method,
        headers: request.headers,
      });

      if (response.status === 404) {
        return new Response('Not found', { status: 404 });
      }

      // 🔴 只保留核心响应头
      const headers = new Headers();

      // 必需的响应头
      const contentType = response.headers.get('Content-Type');
      if (contentType) headers.set('Content-Type', contentType);

      const contentLength = response.headers.get('Content-Length');
      if (contentLength) headers.set('Content-Length', contentLength);

      const contentRange = response.headers.get('Content-Range');
      if (contentRange) headers.set('Content-Range', contentRange);

      const acceptRanges = response.headers.get('Accept-Ranges');
      if (acceptRanges) headers.set('Accept-Ranges', acceptRanges);

      const etag = response.headers.get('ETag');
      if (etag) headers.set('ETag', etag);

      // 🔴 关键修复：强制协议降压与加固缓存
      // 移除 Alt-Svc，强制使用 TCP 而非 QUIC（弱网环境 QUIC 不稳定）
      headers.delete('alt-svc');

      // 加固缓存：1 年 immutable 缓存
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');

      // CORS 头
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Access-Control-Allow-Headers', '*');
      headers.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, ETag');

      // 🔴 纯流式转发，不读取、不缓冲 body
      return new Response(response.body, {
        status: response.status,
        headers,
      });

    } catch (error) {
      return new Response('Error: ' + error.message, { status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, ETag'
        }
      });
    }
  },
};
