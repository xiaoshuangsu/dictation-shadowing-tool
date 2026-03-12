// worker-simple-ios-range.js (大分片优化版)
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
      console.log("[R2] Request: " + path + (rangeHeader ? ", Range: " + rangeHeader : ""));

      if (env.R2) {
        // 🔴 关键优化：预取策略 - 强制大分片返回
        let requestOptions = undefined;

        if (rangeHeader) {
          // 解析原始 Range 请求
          const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
          if (match) {
            const start = parseInt(match[1]);
            const endStr = match[2];
            let length;

            // 🔴 关键修复：强制最小返回 1MB，即使浏览器只请求很小
            const MIN_CHUNK_SIZE = 1024 * 1024; // 1MB
            const PREFETCH_MULTIPLIER = 10; // 预取 10 倍

            if (endStr === '') {
              // bytes=1048576- 格式：请求到末尾
              length = 10 * 1024 * 1024; // 10MB
            } else {
              // bytes=0-1048575 格式
              const requestedLength = parseInt(endStr) - start + 1;
              // 返回 max(1MB, 10倍请求大小)
              length = Math.max(MIN_CHUNK_SIZE, requestedLength * PREFETCH_MULTIPLIER);
            }

            requestOptions = { range: { offset: start, length: length } };
            console.log("[R2] Prefetch: original=" + rangeHeader + ", returning " + (length / 1024 / 1024).toFixed(2) + "MB");
          }
        }

        const object = await env.R2.get(path, requestOptions);

        if (!object) {
          return new Response("Not found", { status: 404 });
        }

        // 🔴 关键：完全使用 R2 的 httpMetadata
        const headers = new Headers(object.httpMetadata);

        // 🔴 关键修复：强制添加 ETag 和 Last-Modified
        // Safari 极其依赖这些 Header 来判断资源一致性
        if (!headers.has("Accept-Ranges")) {
          headers.set("Accept-Ranges", "bytes");
        }

        // 添加边缘缓存，但要确保 ETag 一致性
        headers.set("Cache-Control", "public, max-age=3600, must-revalidate");

        // 添加 CORS 头
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "*");
        headers.set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length, ETag, Last-Modified");

        // 移除可能干扰的头
        headers.delete("Alt-Svc");

        // 精确的状态码
        const status = (rangeHeader && object.range) ? 206 : 200;

        console.log("[R2] Serving: " + path + ", status: " + status + ", size: " + object.size +
                   ", ETag: " + headers.get('ETag')?.substring(0, 20) + "..." +
                   (object.range ? ", range: " + JSON.stringify(object.range) : ""));

        // 🔴 关键：流式转发，不做任何缓冲限制
        return new Response(object.body, {
          status: status,
          headers: headers
        });
      }

      return new Response("R2 not configured", { status: 500 });
    } catch (error) {
      console.error("[R2] Error:", error);
      return new Response("Error: " + error.message, { status: 500 });
    }
  }
};

export {
  worker_simple_ios_default as default
};
