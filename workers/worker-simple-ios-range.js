// worker-simple-ios-range.js (完全简化版 - 让 R2 处理一切)
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
        // R2 会自动解析并返回正确的 httpMetadata
        const object = await env.R2.get(path, rangeHeader ? { range: rangeHeader } : undefined);

        if (!object) {
          return new Response("Not found", { status: 404 });
        }

        // 🔴 关键：完全使用 R2 的 httpMetadata，不做任何修改
        // R2 已经设置了正确的 Content-Type, Content-Range, Content-Length, Accept-Ranges
        const headers = new Headers(object.httpMetadata);

        // 只添加 CORS 头，其他全部由 R2 控制
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "*");
        headers.set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length");

        // 移除可能干扰的头
        headers.delete("Alt-Svc");

        // 🔴 关键：状态码也由 R2 range 属性决定
        const status = object.range ? 206 : 200;

        console.log("[R2] Serving: " + path + ", status: " + status);

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
