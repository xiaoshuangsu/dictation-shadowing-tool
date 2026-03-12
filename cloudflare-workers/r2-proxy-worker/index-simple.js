// 简化测试 Worker
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith("/")) {
      path = path.substring(1);
    }

    const rangeHeader = request.headers.get("Range");

    // OPTIONS 预检
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        }
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      if (env.R2) {
        let requestOptions = undefined;

        if (rangeHeader) {
          const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
          if (match) {
            const start = parseInt(match[1]);
            const endStr = match[2];

            if (endStr === '') {
              requestOptions = { range: { offset: start } };
            } else {
              const end = parseInt(endStr);
              const length = end - start + 1;
              requestOptions = { range: { offset: start, length: length } };
            }
          }
        }

        const object = await env.R2.get(path, requestOptions);

        if (!object) {
          return new Response("Not found", { status: 404 });
        }

        const headers = new Headers();

        // Content-Type
        if (object.httpMetadata?.contentType) {
          headers.set("Content-Type", object.httpMetadata.contentType);
        } else {
          headers.set("Content-Type", "video/mp4");
        }

        // Content-Length
        if (object.range) {
          headers.set("Content-Length", object.range.length.toString());
        } else {
          headers.set("Content-Length", object.size.toString());
        }

        // Content-Range
        if (rangeHeader && object.range) {
          const start = object.range.offset;
          const end = object.range.offset + object.range.length - 1;
          const total = object.size;
          const contentRange = `bytes ${start}-${end}/${total}`;
          headers.set("Content-Range", contentRange);
        }

        // Accept-Ranges
        headers.set("Accept-Ranges", "bytes");

        // CORS
        headers.set("Access-Control-Allow-Origin", "*");

        // 状态码
        const status = (rangeHeader && object.range) ? 206 : 200;

        return new Response(object.body, {
          status: status,
          headers: headers
        });
      }

      return new Response("R2 not configured", { status: 500 });
    } catch (error) {
      return new Response("Error: " + error.message, { status: 500 });
    }
  }
};
