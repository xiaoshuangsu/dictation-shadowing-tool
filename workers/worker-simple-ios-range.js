// A 账号 Worker (r2-proxy) - 协议级修复版
// 🔴 关键修复：禁用过激预取，确保 Content-Length 与 body 一致
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith("/")) {
      path = path.substring(1);
    }

    const rangeHeader = request.headers.get("Range");

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

            // 🔴 禁用过激预取：直接使用浏览器请求的原始长度
            // 只指定 offset，让 R2 自动计算剩余部分
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
        if (object.httpMetadata && object.httpMetadata.contentType) {
          headers.set("Content-Type", object.httpMetadata.contentType);
        } else {
          headers.set("Content-Type", "video/mp4");
        }

        // 🔴 关键修复：Content-Length 必须与返回的 body 字节数绝对一致
        // Safari 会验证这个一致性，不匹配会导致 Code 4
        if (object.range) {
          headers.set("Content-Length", object.range.length.toString());
        } else {
          headers.set("Content-Length", object.size.toString());
        }

        // Content-Range - 格式必须严格
        if (rangeHeader && object.range) {
          const start = object.range.offset;
          const end = object.range.offset + object.range.length - 1;
          const total = object.size;
          const contentRange = "bytes " + start + "-" + end + "/" + total;
          headers.set("Content-Range", contentRange);
        }

        // 🔴 强化标准响应：强制包含 accept-ranges 和稳定 ETag
        headers.set("Accept-Ranges", "bytes");

        // ETag - 使用文件大小和修改时间生成稳定标识
        const etag = '"' + object.size.toString(16) + '"';
        headers.set("ETag", etag);

        // CORS - 明确暴露 Content-Range 和 ETag
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "*");
        headers.set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length, ETag");

        // 禁用缓存，确保每次都获取最新数据
        headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

        // 精确的状态码
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
