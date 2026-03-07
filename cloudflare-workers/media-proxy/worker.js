/**
 * Cloudflare Worker - R2 媒体代理
 *
 * 功能：将 media.shadowhub.app 的请求透明代理到 R2 公网地址
 * 部署位置：账号 A (Suxiaoshuang2020@gmail.com)
 *
 * 使用说明：
 * 1. 在 Cloudflare Workers 控制台创建新 Worker
 * 2. 复制此脚本内容
 * 3. 部署 Worker
 * 4. 添加路由：media.shadowhub.app/* -> 此 Worker
 */

// ==================== 配置 ====================
const CONFIG = {
  // R2 公网地址（账号 A）
  R2_PUBLIC_URL: 'https://pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev',

  // 自定义域名（账号 B）
  CUSTOM_DOMAIN: 'media.shadowhub.app',

  // CORS 配置
  CORS: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  },

  // 缓存配置（秒）
  CACHE_TTL: {
    // 图片缓存 7 天
    image: 604800,
    // 音频缓存 30 天
    audio: 2592000,
    // 视频缓存 30 天
    video: 2592000,
    // 默认缓存 1 天
    default: 86400,
  },
};

// ==================== 工具函数 ====================

/**
 * 根据文件扩展名获取缓存时间
 */
function getCacheTTL(url) {
  const ext = url.split('.').pop().toLowerCase();

  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'ico'].includes(ext)) {
    return CONFIG.CACHE_TTL.image;
  }
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
    return CONFIG.CACHE_TTL.audio;
  }
  if (['mp4', 'webm', 'mov'].includes(ext)) {
    return CONFIG.CACHE_TTL.video;
  }

  return CONFIG.CACHE_TTL.default;
}

/**
 * 处理 OPTIONS 预检请求
 */
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: CONFIG.CORS,
  });
}

/**
 * 添加 CORS 头
 */
function addCORS(headers, corsHeaders = CONFIG.CORS) {
  const newHeaders = new Headers(headers);

  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return newHeaders;
}

/**
 * 添加缓存头
 */
function addCacheHeaders(headers, url) {
  const ttl = getCacheTTL(url);

  headers.set('Cache-Control', `public, max-age=${ttl}`);
  headers.set('CDN-Cache-Control', `public, max-age=${ttl}`);

  return headers;
}

/**
 * 移除可能导致问题的响应头
 */
function sanitizeHeaders(headers) {
  // 移除可能冲突的 CORS 头
  headers.delete('access-control-allow-origin');
  headers.delete('access-control-allow-methods');
  headers.delete('access-control-allow-headers');

  // 移除可能导致问题的 CSP 头
  headers.delete('content-security-policy');
  headers.delete('x-content-type-options');

  return headers;
}

// ==================== 核心代理逻辑 ====================

/**
 * 处理请求
 */
async function handleRequest(request) {
  try {
    // 1. 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // 2. 只允许 GET 和 HEAD 请求
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: {
          ...CONFIG.CORS,
          'Allow': 'GET, HEAD, OPTIONS',
        },
      });
    }

    // 3. 构建目标 URL
    const url = new URL(request.url);
    const path = url.pathname + url.search;

    // 移除自定义域名，替换为 R2 公网地址
    const targetUrl = CONFIG.R2_PUBLIC_URL + path;

    console.log(`[Proxy] ${url.pathname} -> ${targetUrl}`);

    // 4. 转发请求到 R2
    const targetRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      redirect: 'follow',
    });

    // 添加 User-Agent 标识
    targetRequest.headers.set('User-Agent', 'Cloudflare-Worker-Media-Proxy/1.0');

    // 5. 获取 R2 响应
    let response = await fetch(targetRequest);

    // 6. 如果 R2 返回 404，尝试添加索引
    if (response.status === 404 && !path.includes('.')) {
      const indexUrl = targetUrl + (targetUrl.endsWith('/') ? '' : '/') + 'index.html';
      response = await fetch(new Request(indexUrl, targetRequest));
    }

    // 7. 处理响应头
    const responseHeaders = new Headers(response.headers);

    // 清理可能冲突的头
    sanitizeHeaders(responseHeaders);

    // 添加 CORS 头
    addCORS(responseHeaders, CONFIG.CORS);

    // 添加缓存头
    addCacheHeaders(responseHeaders, targetUrl);

    // 8. 返回代理响应
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('[Error]', error);

    // 返回错误响应
    return new Response(JSON.stringify({
      error: 'Proxy Error',
      message: error.message,
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...CONFIG.CORS,
      },
    });
  }
}

// ==================== Worker 入口 ====================

export default {
  fetch: handleRequest,
};
