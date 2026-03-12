// A 账号 Worker (r2-proxy) - R2 原生流式传输方案
// 🔴 关键修复：废除手动分片，直接透传 Range，回归 R2 原生流
var worker_simple_ios_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        }
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const url = new URL(request.url);
      let path = url.pathname;
      if (path.startsWith("/")) {
        path = path.substring(1);
      }

      const rangeHeader = request.headers.get("Range");
      console.log("[A Worker] Request: " + path + (rangeHeader ? ", Range: " + rangeHeader : ""));

      if (env.R2) {
        // 🔴 关键修复：直接透传 Range 头，让 R2 原生处理分片
        // 废除手动计算 MIN_CHUNK_SIZE，回归 R2 标准流式传输
        let requestOptions = undefined;

        if (rangeHeader) {
          // 🔴 核心补丁：直接透传原始 Range 头
          // R2 会自动计算 Content-Range 和返回正确的分片
          requestOptions = { range: rangeHeader };
          console.log("[A Worker] Passthrough Range: " + rangeHeader);
        }

        const object = await env.R2.get(path, requestOptions);

        if (!object) {
          return new Response("Not found", { status: 404 });
        }

        // 🔴 关键：只保留 5 个核心响应头，删除所有 Cloudflare 自动生成的头
        const headers = new Headers();

        // 1. Content-Type (必需)
        if (object.httpMetadata?.contentType) {
          headers.set("Content-Type", object.httpMetadata.contentType);
        } else {
          // 根据文件扩展名设置默认值
          if (path.match(/\.(mp4|webm|ogg)$/i)) {
            headers.set("Content-Type", "video/mp4");
          } else if (path.match(/\.(mp3|m4a|wav)$/i)) {
            headers.set("Content-Type", "audio/mpeg");
          } else if (path.match(/\.(jpg|jpeg)$/i)) {
            headers.set("Content-Type", "image/jpeg");
          } else if (path.match(/\.webp$/i)) {
            headers.set("Content-Type", "image/webp");
          }
        }

        // 2. Content-Length (必需，Safari 依赖)
        headers.set("Content-Length", object.size.toString());

        // 3. Content-Range (Range 请求时必需，格式必须严格)
        // 🔴 核心补丁：确保 Safari 能正确解析 Range 响应
        if (object.range && rangeHeader) {
          const contentRange = `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`;
          headers.set("Content-Range", contentRange);
          console.log("[A Worker] Content-Range: " + contentRange);
        }

        // 4. Accept-Ranges (🔴 最关键：Safari 拒绝后续 Range 探测如果没有这个头)
        headers.set("Accept-Ranges", "bytes");

        // 5. ETag (可选，用于缓存验证)
        if (object.httpMetadata?.etag) {
          headers.set("ETag", object.httpMetadata.etag);
        }

        // 🔴 CORS 透传：确保 Safari 能读取 Content-Range 和 ETag
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "*");
        headers.set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length, ETag");

        // 🔴 删除所有其他 Cloudflare 自动生成的头（防止"污染"）
        // 不设置：cf-cache-status, alt-svc, server, x-* 等头

        // 精确的状态码：Range 请求返回 206，否则 200
        const status = (rangeHeader && object.range) ? 206 : 200;

        console.log("[A Worker] Response: status=" + status + ", size=" + object.size +
                   (object.range ? ", range=" + JSON.stringify(object.range) : ""));

        // 🔴 流式转发，不做任何缓冲
        return new Response(object.body, {
          status: status,
          headers: headers
        });
      }

      return new Response("R2 not configured", { status: 500 });
    } catch (error) {
      console.error("[A Worker] Error:", error);
      return new Response("Error: " + error.message, { status: 500 });
    }
  }
};

export {
  worker_simple_ios_default as default
};
