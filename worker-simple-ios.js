/**
 * ShadowHub B 账号 Worker (morning-sound-a67b) - 精简 Headers 版本
 *
 * 🔴 关键修复：只保留 5 个核心响应头，删除所有 Cloudflare 自动生成的头
 * - Content-Type
 * - Content-Length
 * - Content-Range
 * - Accept-Ranges
 * - ETag
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

      const rangeHeader = request.headers.get('Range');
      console.log('[B Worker] Request: ' + path + (rangeHeader ? ', Range: ' + rangeHeader : ''));

      // 构建 A Worker URL
      const aWorkerUrl = `${A_ACCOUNT_WORKER_URL}/${path}`;

      // 🔴 透传所有原始请求头（包括 Range）
      const response = await fetch(aWorkerUrl, {
        method: request.method,
        headers: request.headers,
      });

      if (response.status === 404) {
        return new Response('Not found', { status: 404 });
      }

      // 🔴 关键修复：只保留 5 个核心响应头，删除所有其他头
      const headers = new Headers();

      // 1. Content-Type
      const contentType = response.headers.get('Content-Type');
      if (contentType) {
        headers.set('Content-Type', contentType);
      }

      // 2. Content-Length
      const contentLength = response.headers.get('Content-Length');
      if (contentLength) {
        headers.set('Content-Length', contentLength);
      }

      // 3. Content-Range (Range 请求时)
      const contentRange = response.headers.get('Content-Range');
      if (contentRange) {
        headers.set('Content-Range', contentRange);
        console.log('[B Worker] Content-Range: ' + contentRange);
      }

      // 4. Accept-Ranges (🔴 最关键：Safari 需要这个头来确认支持 Range)
      const acceptRanges = response.headers.get('Accept-Ranges');
      if (acceptRanges) {
        headers.set('Accept-Ranges', acceptRanges);
      }

      // 5. ETag
      const etag = response.headers.get('ETag');
      if (etag) {
        headers.set('ETag', etag);
      }

      // 🔴 CORS 透传：确保 Safari 能读取关键头
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Access-Control-Allow-Headers', '*');
      headers.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, ETag');

      // 🔴 删除所有其他头（包括 Cloudflare 自动生成的头）：
      // - cf-cache-status, cf-ray, cf-request-id
      // - server (cloudflare)
      // - x-* (所有 Cloudflare 内部头)
      // - alt-svc, report-to, nel
      // - cache-control (由 A Worker 设置)

      // 🔴 调试日志
      if (contentLength) {
        const sizeMB = parseInt(contentLength) / (1024 * 1024);
        console.log('[B Worker] Response: status=' + response.status +
                   ', size=' + sizeMB.toFixed(2) + 'MB' +
                   (contentRange ? ', Content-Range: ' + contentRange : '') +
                   (etag ? ', ETag: ' + etag.substring(0, 20) + '...' : ''));
      }

      // 🔴 流式转发，不做任何缓冲
      return new Response(response.body, {
        status: response.status,
        headers,
      });

    } catch (error) {
      console.error('[B Worker] Error:', error);
      return new Response('Error: ' + error.message, { status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, ETag'
        }
      });
    }
  },
};
