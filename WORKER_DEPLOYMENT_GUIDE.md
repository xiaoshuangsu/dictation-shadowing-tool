# Worker 部署和修复指南

## 第一步：检查当前 Worker 状态

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 切换到 **B 账号**
3. 点击左侧菜单 **Workers & Pages**
4. 查看是否有名为以下内容的 Worker：
   - `media-proxy`
   - `media-shadowhub-app`
   - 或任何与 `media.shadowhub.app` 相关的 Worker

### 如果看到 Worker：
- 点击进入，查看 **Settings** > **Triggers** > **Custom Domains**
- 确认是否有 `media.shadowhub.app` 绑定

### 如果没有看到 Worker：
- 需要创建新的 Worker

## 第二步：部署/更新 Worker 代码

### 方法 A：通过 Cloudflare Dashboard（推荐）

1. **Workers & Pages** > **Create application** > **Create Worker**
2. 命名为：`media-proxy`
3. 点击 **Deploy**
4. 点击 **Quick Edit** 或 **Edit code**
5. **删除所有默认代码**，粘贴以下内容：

```javascript
/**
 * ShadowHub Media Proxy Worker
 * 用于代理 R2 资源并添加 CORS 头
 */

// A 账号 R2 桶的公共域名
const R2_PUBLIC_DOMAIN = 'https://pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev';

export default {
  async fetch(request, env, ctx) {
    // 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 只允许 GET 和 HEAD 请求
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Allow': 'GET, HEAD, OPTIONS',
        },
      });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // 构造 R2 公共 URL
      const r2Url = `${R2_PUBLIC_DOMAIN}${path}`;

      console.log(`Proxying: ${request.url} -> ${r2Url}`);

      // 转发请求到 R2
      const r2Request = new Request(r2Url, {
        method: request.method,
        headers: request.headers,
      });

      const response = await fetch(r2Request);

      // 创建新响应并添加 CORS 头
      const newResponse = new Response(response.body, response);

      // 添加 CORS 头
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      newResponse.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      newResponse.headers.set('Access-Control-Allow-Headers', '*');

      // 缓存控制
      newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');

      return newResponse;

    } catch (error) {
      console.error('Proxy error:', error);

      return new Response(`Proxy error: ${error.message}`, {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
```

6. 点击 **Save and Deploy**
7. 等待部署完成（约 30 秒）

### 方法 B：使用 wrangler CLI

如果你已经安装了 wrangler：

```bash
# 复制 Worker 代码到 worker-media-proxy.js
# 然后运行：
wrangler deploy worker-media-proxy.js --name media-proxy
```

## 第三步：绑定自定义域名

1. 进入你的 Worker 页面
2. 点击 **Settings** > **Triggers** > **Custom Domains**
3. 点击 **Add custom domain**
4. 输入：`media.shadowhub.app`
5. 点击 **Activate domain**
6. 等待 DNS 生效（可能需要几分钟）

## 第四步：验证部署

部署完成后，访问以下链接测试：

```bash
curl -I "https://media.shadowhub.app/thumbnails/corruption.jpg"
```

应该看到：
```
HTTP/2 200
access-control-allow-origin: *
access-control-allow-methods: GET, HEAD, OPTIONS
content-type: image/jpeg
```

## 常见问题

### Q: 绑定域名时提示 "Domain already in use"
A: 说明域名已经被其他 Worker 使用，需要先删除旧绑定

### Q: Worker 返回 404 或 5xx 错误
A: 检查 Worker 代码是否正确粘贴，查看 Worker 的 Logs

### Q: 图片加载还是失败
A: 清除浏览器缓存，或者使用隐私模式重新测试

## 测试页面

部署完成后，访问：
- https://shadowhub.app/test-cors
- https://shadowhub.app/test-mobile
