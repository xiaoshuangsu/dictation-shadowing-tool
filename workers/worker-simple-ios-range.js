// worker-simple-ios-range.js (Range 优化版)
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length"
};

var worker_simple_ios_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
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

      // 记录 Range 请求
      const rangeHeader = request.headers.get("Range");
      console.log("[R2 Proxy] Range header: " + (rangeHeader || "null"));
      if (rangeHeader) {
        console.log("[R2 Proxy] Range request: " + path + ", Range: " + rangeHeader);
      } else {
        console.log("[R2 Proxy] Request: " + path);
      }

      if (env.R2) {
        // 🔴 关键修复：R2 range 参数格式
        // 根据 Cloudflare 文档，range 应该是对象格式
        let requestOptions = {};

        if (rangeHeader) {
          // 解析 Range 头：bytes=0-1048575
          const match = rangeHeader.match(/bytes=(\d+)-(\d+)/);
          if (match) {
            const start = parseInt(match[1]);
            const end = parseInt(match[2]);
            // 使用对象格式传递 range
            requestOptions = { range: { offset: start, length: end - start + 1 } };
            console.log("[R2 Proxy] Range: offset=" + start + ", length=" + (end - start + 1));
          }
        }

        const object = await env.R2.get(path, requestOptions);

        if (!object) {
          console.error("Not found: " + path);
          return new Response("Not found", { status: 404 });
        }

        const headers = new Headers();

        // Content-Type 设置
        if (path.indexOf("thumbnails/") === 0) {
          headers.set("Content-Type", "image/webp");
        } else if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
          headers.set("Content-Type", "image/jpeg");
        } else if (path.endsWith(".png")) {
          headers.set("Content-Type", "image/png");
        } else if (path.endsWith(".webp")) {
          headers.set("Content-Type", "image/webp");
        } else if (path.endsWith(".mp4") || path.endsWith(".webm")) {
          headers.set("Content-Type", "video/mp4");
        } else if (path.endsWith(".mp3") || path.endsWith(".m4a")) {
          headers.set("Content-Type", "audio/mpeg");
        }

        headers.set("Access-Control-Allow-Origin", "*");

        // 🔴 关键修复：手动计算 Range 响应头
        if (rangeHeader) {
          const match = rangeHeader.match(/bytes=(\d+)-(\d+)/);
          console.log("[R2 Proxy] Range match result: " + JSON.stringify(match));
          if (match) {
            const rangeStart = parseInt(match[1]);
            const rangeEnd = Math.min(parseInt(match[2]), object.size - 1);
            const rangeSize = rangeEnd - rangeStart + 1;

            console.log("[R2 Proxy] Calculated: start=" + rangeStart + ", end=" + rangeEnd + ", size=" + rangeSize);

            headers.set("Content-Length", String(rangeSize));
            headers.set("Content-Range", "bytes " + rangeStart + "-" + rangeEnd + "/" + object.size);
            headers.set("Accept-Ranges", "bytes");
            console.log("[R2 Proxy] Range response: " + rangeStart + "-" + rangeEnd + "/" + object.size + ", size: " + rangeSize);

            return new Response(object.body, {
              status: 206,
              headers
            });
          }
        }

        // 完整请求：Content-Length 是完整文件大小
        headers.set("Content-Length", String(object.size));
        headers.set("Accept-Ranges", "bytes");

        console.log("Serving: " + path + ", type: " + headers.get("Content-Type") + ", size: " + object.size);

        // 返回正确的状态码（Range 请求返回 206）
        return new Response(object.body, {
          status: object.range ? 206 : 200,
          headers
        });
      }
      return new Response("R2 not configured", { status: 500 });
    } catch (error) {
      console.error("Error:", error);
      return new Response("Error", { status: 500 });
    }
  }
};

export {
  worker_simple_ios_default as default
};
