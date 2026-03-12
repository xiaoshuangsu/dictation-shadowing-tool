export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 返回测试响应
    const headers = new Headers();
    headers.set("Content-Type", "text/plain");
    headers.set("X-Test-Header", "test-value");
    headers.set("X-Test-Path", path);
    headers.set("X-Test-Timestamp", Date.now().toString());

    return new Response("Test response", {
      status: 200,
      headers: headers
    });
  }
};
