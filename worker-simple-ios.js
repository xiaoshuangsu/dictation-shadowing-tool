/**
 * ShadowHub Media Proxy Worker - 修复版
 *
 * 关键修复：thumbnails 目录统一返回 image/webp
 * 因为实际上所有封面图都是 WebP 格式
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
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

      console.log(`Request: ${path}`);

      if (env.R2) {
        const object = await env.R2.get(path);

        if (!object) {
          console.error(`Not found: ${path}`);
          return new Response('Not found', { status: 404 });
        }

        const headers = new Headers();

        // 🔴 关键修复：根据路径设置正确的内容类型
        if (path.startsWith('thumbnails/')) {
          // 所有封面图实际上都是 WebP 格式
          headers.set('Content-Type', 'image/webp');
        } else if (path.match(/\.(jpg|jpeg)$/i)) {
          headers.set('Content-Type', 'image/jpeg');
        } else if (path.match(/\.png$/i)) {
          headers.set('Content-Type', 'image/png');
        } else if (path.match(/\.webp$/i)) {
          headers.set('Content-Type', 'image/webp');
        } else if (path.match(/\.(mp4|webm)$/i)) {
          headers.set('Content-Type', 'video/mp4');
        } else if (path.match(/\.(mp3|m4a)$/i)) {
          headers.set('Content-Type', 'audio/mpeg');
        }

        headers.set('Content-Length', String(object.size));
        headers.set('Access-Control-Allow-Origin', '*');

        console.log(`Serving: ${path}, type: ${headers.get('Content-Type')}, size: ${object.size}`);

        return new Response(object.body, {
          status: 200,
          headers,
        });
      }

      return new Response('R2 not configured', { status: 500 });

    } catch (error) {
      console.error('Error:', error);
      return new Response('Error', { status: 500 });
    }
  },
};
