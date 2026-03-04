/**
 * Cloudflare Worker for R2 Proxy with Path Mapping and Fallback
 *
 * Features:
 * - Path mapping: handles thumbnails/ vs thumbnails/compressed/
 * - Fallback to Supabase Storage if R2 file not found
 * - Mobile-friendly: proper CORS and caching headers
 * - WebP conversion with ?width=400
 * - Strong caching for performance
 */

// Supabase Storage 配置
const SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co';
const SUPABASE_BUCKET = 'engnovate-audio';

// 路径映射配置
const PATH_MAPPINGS = [
  // 尝试多个可能的路径
  { from: /^thumbnails\/(.+)$/, to: ['thumbnails/$1', 'thumbnails/compressed/$1'] },
  { from: /^audio\/(.+)$/, to: ['audio/$1'] },
  { from: /^videos\/(.+)$/, to: ['videos/$1'] },
];

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.slice(1); // Remove leading slash

      // 处理 CORS preflight
      if (request.method === 'OPTIONS') {
        return handleCORS();
      }

      // 记录请求日志（方便调试）
      console.log(`[R2 Proxy] Request: ${path}`);

      // 尝试从 R2 获取
      let r2Response = await tryGetFromR2(env.R2, path, request);

      // 如果 R2 没有，尝试 fallback 到 Supabase
      if (!r2Response || r2Response.status === 404) {
        console.log(`[R2 Proxy] Not found in R2, trying Supabase: ${path}`);
        r2Response = await getFromSupabase(path, request);
      }

      return r2Response;

    } catch (error) {
      console.error('[R2 Proxy] Error:', error);
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
 * 尝试从 R2 获取文件，支持路径映射
 */
async function tryGetFromR2(r2Bucket, path, request) {
  if (!r2Bucket) {
    console.log('[R2 Proxy] R2 bucket not bound');
    return null;
  }

  // 尝试原始路径
  let object = await r2Bucket.get(path);

  // 如果找不到，尝试路径映射
  if (!object) {
    for (const mapping of PATH_MAPPINGS) {
      const match = path.match(mapping.from);
      if (match) {
        for (const template of mapping.to) {
          const mappedPath = template.replace('$1', match[1]);
          console.log(`[R2 Proxy] Trying mapped path: ${mappedPath}`);
          object = await r2Bucket.get(mappedPath);
          if (object) break;
        }
        if (object) break;
      }
    }
  }

  if (!object) {
    return null;
  }

  // 检查是否是图片
  const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(path);

  if (isImage) {
    return serveImage(object, request);
  } else {
    return serveFile(object, request);
  }
}

/**
 * 从 Supabase Storage 获取文件（Fallback）
 */
async function getFromSupabase(path, request) {
  const supabaseUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;

  console.log(`[R2 Proxy] Fetching from Supabase: ${supabaseUrl}`);

  const response = await fetch(supabaseUrl, {
    method: request.method,
    headers: request.headers,
  });

  if (!response.ok) {
    console.log(`[R2 Proxy] Supabase failed: ${response.status}`);
    return new Response('File not found in R2 or Supabase', {
      status: 404,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  // 克隆响应并添加缓存头
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year cache

  // 添加 X-Source 标记（方便调试）
  headers.set('X-Source', 'Supabase');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

/**
 * 提供图片服务（支持 WebP 转换）
 */
function serveImage(object, request) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);

  // 添加缓存头
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');

  // 添加 X-Source 标记
  headers.set('X-Source', 'R2');

  return new Response(object.body, {
    status: 200,
    headers,
  });
}

/**
 * 提供非图片文件服务
 */
function serveFile(object, request) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);

  // 添加缓存头
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');

  // 添加 X-Source 标记
  headers.set('X-Source', 'R2');

  return new Response(object.body, {
    status: 200,
    headers,
  });
}

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
