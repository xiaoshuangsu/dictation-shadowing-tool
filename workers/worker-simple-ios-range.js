// worker-simple-ios-range.js (吞吐量优化版)
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
        // 🔴 关键：直接传递 Range header 字符串给 R2
        let requestOptions = undefined;
        if (rangeHeader) {
          requestOptions = { range: rangeHeader };
        }

        const object = await env.R2.get(path, requestOptions);

        if (!object) {
          return new Response("Not found", { status: 404 });
        }

        // 🔴 关键：完全使用 R2 的 httpMetadata
        const headers = new Headers(object.httpMetadata);

        // 🔴 关键修复：强制 Accept-Ranges
        if (!headers.has("Accept-Ranges")) {
          headers.set("Accept-Ranges", "bytes");
        }

        // 🔴 关键修复：添加边缘缓存，加速分片读取
        headers.set("Cache-Control", "public, max-age=3600");

        // 添加 CORS 头
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "*");
        headers.set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length");

        // 移除可能干扰的头
        headers.delete("Alt-Svc");

        // 🔴 关键：精确的状态码
        const status = (rangeHeader && object.range) ? 206 : 200;

        console.log("[R2] Serving: " + path + ", status: " + status + ", size: " + object.size +
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
