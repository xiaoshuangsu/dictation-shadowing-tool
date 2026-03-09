/**
 * ShadowHub Media Proxy Worker
 *
 * B 账号 Worker - 用于代理 A 账号 R2 桶中的媒体资源
 * 确保移动端和跨域请求正常工作
 *
 * 部署说明：
 * 1. 在 B 账号 Cloudflare Dashboard 创建 Worker
 * 2. 绑定域名：media.shadowhub.app
 * 3. 绑定 R2 桶：变量名 R2_BUCKET
 * 4. 部署此代码
 */

// 允许的来源
const ALLOWED_ORIGINS = [
  'https://shadowhub.app',
  'http://localhost:3000',  // 开发环境
];

// CORS 响应头
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400', // 24 小时
};

export default {
  async fetch(request, env, ctx) {
    // 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // 只允许 GET 和 HEAD 请求
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: {
          ...CORS_HEADERS,
          'Allow': 'GET, HEAD, OPTIONS',
        },
      });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      console.log(`Media proxy: ${path}`);

      // 🔴 使用 R2 bucket 直接访问
      if (env.R2_BUCKET) {
        console.log(`Accessing R2 bucket directly: ${path}`);

        // 🔴 处理 Range 请求（视频流式播放必需）
        const range = request.headers.get('Range');
        let object;

        if (range) {
          // 解析 Range 头（格式：bytes=start-end）
          const rangeMatch = range.match(/bytes=(\d+)?-(\d+)?/);
          if (rangeMatch) {
            const start = rangeMatch[1] ? parseInt(rangeMatch[1]) : 0;
            const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : undefined;

            console.log(`Range request: ${range}, start=${start}, end=${end || 'undefined'}`);

            // 使用 R2 的 range 参数获取部分内容
            object = await env.R2_BUCKET.get(path, {
                range: { offset: start, length: end ? (end - start + 1) : undefined }
            });

            if (!object) {
              console.error(`Object not found: ${path}`);
              return new Response('Not found', {
                status: 404,
                headers: CORS_HEADERS,
              });
            }

            const headers = new Headers();
            Object.entries(CORS_HEADERS).forEach(([key, value]) => {
              headers.set(key, value);
            });

            // 设置内容类型
            headers.set('Content-Type', 'video/mp4');
            headers.set('Accept-Ranges', 'bytes');

            // 🔴 返回 206 Partial Content 响应
            const contentRange = `bytes ${start}-${start + object.size - 1}/${object.size + start}`;
            headers.set('Content-Range', contentRange);
            headers.set('Content-Length', String(object.size));

            console.log(`Returning 206 Partial Content: ${contentRange}`);

            return new Response(object.body, {
              status: 206,
              headers,
            });
          }
        }

        // 非 Range 请求，返回完整文件
        object = await env.R2_BUCKET.get(path);

        if (!object) {
          console.error(`Object not found: ${path}`);
          return new Response('Not found', {
            status: 404,
            headers: CORS_HEADERS,
          });
        }

        const headers = new Headers();
        Object.entries(CORS_HEADERS).forEach(([key, value]) => {
          headers.set(key, value);
        });

        // 设置内容类型
        if (path.match(/\.(mp4|webm|ogg)$/i)) {
          headers.set('Content-Type', 'video/mp4');
        } else if (path.match(/\.(mp3|wav|m4a)$/i)) {
          headers.set('Content-Type', 'audio/mpeg');
        } else if (path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          const ext = path.split('.').pop()?.toLowerCase();
          const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
          };
          if (ext && mimeTypes[ext]) {
            headers.set('Content-Type', mimeTypes[ext]);
          }
        }

        headers.set('Accept-Ranges', 'bytes');

        // 缓存控制
        headers.set('Cache-Control', 'public, max-age=3600'); // 1 小时缓存，便于更新

        console.log(`Successfully served: ${path}, size: ${object.size}`);

        return new Response(object.body, {
          status: 200,
          headers,
        });
      }

      // 如果没有绑定 R2 bucket
      console.error('R2_BUCKET not bound to worker');
      return new Response('R2 bucket not configured', {
        status: 500,
        headers: CORS_HEADERS,
      });

    } catch (error) {
      console.error('Proxy error:', error);

      return new Response(`Proxy error: ${error.message}`, {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  },
};
