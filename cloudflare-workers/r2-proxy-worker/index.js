/**
 * Cloudflare Worker: R2 代理访问（简化版）
 *
 * 功能：通过 Worker 公开访问 R2 bucket 中的文件
 * 架构：统一使用 R2 bucket，删除了 VIDEOS 绑定
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    // 只处理 GET 和 HEAD 请求
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    // 移除开头的 /
    const objectKey = path.startsWith('/') ? path.slice(1) : path;

    if (!objectKey) {
      return new Response('Please provide a file path', { status: 400 });
    }

    try {
      // 从 R2 bucket 获取对象
      const object = await env.R2.get(objectKey);

      if (!object) {
        return new Response('File not found', { status: 404 });
      }

      // 确定内容类型
      let contentType = 'application/octet-stream';

      if (objectKey.endsWith('.mp4')) {
        contentType = 'video/mp4';
      } else if (objectKey.endsWith('.mp3')) {
        contentType = 'audio/mpeg';
      } else if (objectKey.endsWith('.jpg') || objectKey.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (objectKey.endsWith('.png')) {
        contentType = 'image/png';
      } else if (objectKey.endsWith('.webm')) {
        contentType = 'video/webm';
      }

      const headers = new Headers();
      headers.set('Content-Type', contentType);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Content-Length', object.size.toString());
      headers.set('X-Bucket', 'R2');
      headers.set('X-Source', 'R2-Simplified');

      // 设置缓存策略：视频/音频文件缓存 1 年（静态资源）
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');

      // HEAD 请求：只返回头信息
      if (request.method === 'HEAD') {
        return new Response(null, { headers, status: 200 });
      }

      // 检查是否有 Range 请求
      const rangeHeader = request.headers.get('Range');

      if (rangeHeader) {
        // 解析 Range 头
        const match = rangeHeader.match(/bytes=(\d+)?-(\d+)?/);
        if (match) {
          const start = match[1] ? parseInt(match[1]) : 0;
          const end = match[2] ? parseInt(match[2]) : object.size - 1;

          headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
          headers.set('Content-Length', (end - start + 1).toString());

          // 使用正确的 R2 range 格式
          const rangedObject = await env.R2.get(objectKey, {
            range: { offset: start, length: end - start + 1 }
          });

          if (rangedObject) {
            return new Response(rangedObject.body, {
              status: 206,
              headers
            });
          }
        }
      }

      // 返回完整文件
      return new Response(object.body, { headers });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Error: ' + error.message, { status: 500 });
    }
  },
};
