// worker-simple-ios-range.js (Range 边界修复版)
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
        // 🔴 关键修复 1：精确处理 Range 请求
        let requestOptions = undefined;

        if (rangeHeader) {
          // 有 Range 头：传递给 R2
          requestOptions = { range: rangeHeader };
        }

        const object = await env.R2.get(path, requestOptions);

        if (!object) {
          return new Response("Not found", { status: 404 });
        }

        // 🔴 关键修复 2：完全使用 R2 的 httpMetadata
        const headers = new Headers(object.httpMetadata);

        // 🔴 关键修复 3：强制 Accept-Ranges 告诉 Safari 支持断点续传
        if (!headers.has("Accept-Ranges")) {
          headers.set("Accept-Ranges", "bytes");
        }

        // 添加 CORS 头
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "*");
        headers.set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length");

        // 移除可能干扰的头
        headers.delete("Alt-Svc");

        // 🔴 关键修复 4：精确的状态码
        // 有 Range 请求且 R2 返回了 range 属性 → 206
        // 无 Range 请求 → 200
        const status = (rangeHeader && object.range) ? 206 : 200;

        console.log("[R2] Serving: " + path + ", status: " + status +
                   (object.range ? ", range: " + JSON.stringify(object.range) : ""));

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
