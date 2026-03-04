/**
 * Cloudflare Worker for R2 Multi-Bucket Proxy
 *
 * 支持两个存储桶：
 * - R2: 存储 audio/ 和 thumbnails/
 * - VIDEOS: 存储 videos/
 *
 * 路由规则：
 * - audio/* → R2 bucket
 * - thumbnails/* → R2 bucket
 * - videos/* → VIDEOS bucket
 */

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.slice(1); // 移除开头的 /

      console.log(`[R2 Multi-Bucket] Request: ${path}`);

      // 处理 CORS preflight
      if (request.method === 'OPTIONS') {
        return handleCORS();
      }

      // 根据路径路由到正确的存储桶
      let bucket = null;
      let key = path;

      if (path.startsWith('audio/')) {
        bucket = env.R2;
        key = path; // audio/xxx.mp3
      } else if (path.startsWith('thumbnails/')) {
        bucket = env.R2;
        key = path; // thumbnails/xxx.jpg
      } else if (path.startsWith('videos/')) {
        bucket = env.VIDEOS;
        key = path; // videos/xxx.mp4
      } else {
        // 默认使用 R2
        bucket = env.R2;
        key = path;
      }

      if (!bucket) {
        console.error(`[R2 Multi-Bucket] Bucket not bound for: ${path}`);
        return new Response(JSON.stringify({
          error: 'Bucket not configured',
          path: path,
          message: 'Please check Worker bindings'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }

      // 从存储桶获取对象
      const object = await bucket.get(key);

      if (!object) {
        console.error(`[R2 Multi-Bucket] Object not found: ${key} in bucket`);
        return new Response(JSON.stringify({
          error: 'File not found',
          path: path,
          bucket: path.startsWith('videos/') ? 'VIDEOS' : 'R2',
          key: key
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'X-Bucket': path.startsWith('videos/') ? 'VIDEOS' : 'R2',
            'X-Key': key
          }
        });
      }

      // 获取文件类型
      const headers = new Headers();
      object.writeHttpMetadata(headers);

      // 添加缓存头（1年缓存）
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

      // 添加调试头
      headers.set('X-Bucket', path.startsWith('videos/') ? 'VIDEOS' : 'R2');
      headers.set('X-Key', key);
      headers.set('X-Source', 'R2-Multi-Bucket');

      return new Response(object.body, {
        status: 200,
        headers,
      });

    } catch (error) {
      console.error('[R2 Multi-Bucket] Error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        path: new URL(request.url).pathname
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  }
};

/**
 * 处理 CORS preflight 请求
 */
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    }
  });
}
