/**
 * Cloudflare Worker - R2 简化版路由
 *
 * 所有请求统一路由到 R2 bucket
 * 支持: audio/, thumbnails/, videos/, shadowhub/videos/
 *
 * 删除了 VIDEOS bucket 绑定，简化架构
 */

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.slice(1); // 移除开头的 /

      console.log(`[R2 Router] Request: ${path}`);

      // 处理 CORS preflight
      if (request.method === 'OPTIONS') {
        return handleCORS();
      }

      // 统一使用 R2 bucket（删除了 VIDEOS bucket 绑定）
      const bucket = env.R2;
      const key = path;

      if (!bucket) {
        console.error(`[R2 Router] R2 bucket not bound`);
        return new Response(JSON.stringify({
          error: 'R2 bucket not configured',
          message: '请检查 Worker 是否绑定了 R2 存储桶 (engnovate-audio)'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }

      // 从 R2 bucket 获取对象
      const object = await bucket.get(key);

      if (!object) {
        console.error(`[R2 Router] Object not found: ${key}`);
        return new Response(JSON.stringify({
          error: 'File not found',
          path: path,
          key: key,
          hint: '请检查文件是否已上传到 R2 bucket'
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'X-Key': key
          }
        });
      }

      // 构建响应头
      const headers = new Headers();
      object.writeHttpMetadata(headers);

      // 添加缓存头（1年缓存，适合静态资源）
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');

      // 添加 CORS 头（移动端必需）
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

      // 添加调试头（方便排查问题）
      headers.set('X-Bucket', 'R2');
      headers.set('X-Key', key);
      headers.set('X-Source', 'R2-Simplified');

      // 返回文件内容
      return new Response(object.body, {
        status: 200,
        headers,
      });

    } catch (error) {
      console.error('[R2 Router] Error:', error);
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
