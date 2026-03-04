/**
 * Cloudflare Worker - R2 智能路由调度员
 *
 * 路由规则：
 * - videos/* → VIDEOS 桶
 * - audio/* → R2 桶
 * - thumbnails/* → R2 桶
 *
 * @requires VIDEOS binding: VIDEOS bucket (videos/)
 * @requires R2 binding: R2 bucket (audio/, thumbnails/)
 */

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.slice(1); // 移除开头的 /

      // 处理 CORS preflight
      if (request.method === 'OPTIONS') {
        return handleCORS();
      }

      // 智能路由：根据路径前缀选择存储桶
      let bucket = null;
      let key = path;
      let bucketName = 'unknown';

      if (path.startsWith('videos/')) {
        // 视频文件 → VIDEOS 桶
        bucket = env.VIDEOS;
        bucketName = 'VIDEOS';
        key = path; // videos/xxx.mp4
      } else if (path.startsWith('audio/')) {
        // 音频文件 → R2 桶
        bucket = env.R2;
        bucketName = 'R2';
        key = path; // audio/xxx.mp3
      } else if (path.startsWith('thumbnails/')) {
        // 缩略图 → R2 桶
        bucket = env.R2;
        bucketName = 'R2';
        key = path; // thumbnails/xxx.jpg
      } else {
        // 默认使用 R2 桶（兼容旧路径）
        bucket = env.R2;
        bucketName = 'R2';
        key = path;
      }

      // 检查存储桶是否绑定
      if (!bucket) {
        console.error(`[R2 Router] Bucket not bound: ${bucketName} for path: ${path}`);
        return new Response(JSON.stringify({
          error: 'Bucket not configured',
          path: path,
          expectedBucket: bucketName,
          message: `请检查 Worker 是否绑定了 ${bucketName} 存储桶`
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
        console.error(`[R2 Router] Object not found: ${key} in ${bucketName}`);
        return new Response(JSON.stringify({
          error: 'File not found',
          path: path,
          bucket: bucketName,
          key: key,
          hint: '请检查文件是否已上传到正确的存储桶'
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'X-Bucket': bucketName,
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
      headers.set('X-Bucket', bucketName);
      headers.set('X-Key', key);
      headers.set('X-Source', 'R2-Router');

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
