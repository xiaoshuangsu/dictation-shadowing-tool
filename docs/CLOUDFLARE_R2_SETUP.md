# Cloudflare R2 视频存储设置指南

## 📋 前提条件

1. Cloudflare 账号（免费即可）
2. Cloudflare Workers 免费计划
3. YouTube 视频 URL

## 🚀 设置步骤

### 1. 创建 R2 Bucket

1. 访问 Cloudflare Dashboard
   ```
   https://dash.cloudflare.com/
   ```

2. 进入 R2 Object Storage
   - 左侧菜单 → R2 → Overview
   - 点击 "Create bucket"

3. 创建 Bucket
   ```
   Bucket name: dictation-videos
   Region: Automatic (推荐) 或选择离用户最近的区域
   ```

4. 记录 Bucket 信息
   ```
   Account ID: <在右侧可见>
   Bucket Name: dictation-videos
   Access Key: <稍后创建>
   ```

### 2. 创建 R2 API Token

1. 进入 R2 → Manage R2 API Tokens
2. 点击 "Create API Token"
3. 配置权限：
   ```
   Name: dictation-videos-admin
   Permissions: Admin Read & Write
   TTL: Forever (或设置过期时间)
   ```
4. **重要**：复制并保存以下信息（只显示一次）
   ```
   Access Key ID: xxx
   Secret Access Key: xxx
   Endpoint URL: https://<account_id>.r2.cloudflarestorage.com
   ```

### 3. 配置 Worker 绑定 R2

1. 创建 Worker
   - 左侧菜单 → Workers & Pages → Overview
   - 点击 "Create Application"
   - 选择 "Create Worker"
   - Worker name: `dictation-video-uploader`
   - 点击 "Deploy"

2. 绑定 R2 Bucket
   - 点击 Worker → Settings → Bindings
   - Add binding → R2 Bucket
   - Variable name: `VIDEOS`
   - Bucket: `dictation-videos`
   - 点击 "Deploy"

### 4. 配置环境变量（可选）

在 Worker 的 Settings → Environment Variables 添加：
```
ALLOWED_ORIGINS = https://xiaoshuangsu.github.io
JWT_SECRET = <your-secret-key>
```

### 5. 测试连接

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 测试 R2 连接
wrangler r2 bucket list

# 上传测试文件
echo "test" > test.txt
wrangler r2 object put dictation-videos/test.txt --file=test.txt

# 列出文件
wrangler r2 object list dictation-videos
```

## 🔒 公开访问配置

### 方案A：Custom Domain（推荐）

1. 在 R2 Bucket 设置中
   - 进入 dictation-videos bucket
   - Settings → Public Access
   - 点击 "Add Custom Domain"
   - 输入域名：`videos.yourdomain.com` 或使用 Cloudflare 提供的子域名
   - 按照提示添加 DNS 记录

2. 获取公开访问 URL
   ```
   https://videos.yourdomain.com/video-name.mp4
   ```

### 方案B：Worker 代理（免费）

创建一个 Worker 用于代理访问：

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const objectKey = url.pathname.slice(1);

    // 从 R2 获取对象
    const object = await env.VIDEOS.get(objectKey);

    if (!object) {
      return new Response('Not Found', { status: 404 });
    }

    // 设置 CORS 头
    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata.contentType || 'video/mp4');
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(object.body, { headers });
  }
};
```

绑定 R2 Bucket 后部署，访问 URL：
```
https://dictation-video-proxy.your-subdomain.workers.dev/video-name.mp4
```

## 📝 本地开发配置

创建 `.dev.vars` 文件（不要提交到 Git）：

```bash
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=dictation-videos
R2_ACCOUNT_ID=your_account_id
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
```

## ✅ 验证设置

```bash
# 使用 AWS CLI（兼容 R2）
aws configure --profile cloudflare-r2
# AWS Access Key ID: <R2 Access Key ID>
# AWS Secret Access Key: <R2 Secret Access Key>
# Default region name: auto
# Default output format: json

# 测试列出文件
aws --endpoint-url=https://<account_id>.r2.cloudflarestorage.com \
  s3 ls dictation-videos

# 上传测试文件
aws --endpoint-url=https://<account_id>.r2.cloudflarestorage.com \
  s3 cp test.mp4 s3://dictation-videos/test.mp4
```

## 🎯 下一步

1. ✅ R2 Bucket 已创建
2. ✅ Worker 已绑定 R2
3. ➡️ 运行 `scripts/download_youtube_to_r2.py` 下载第一个视频
4. ➡️ 测试前端播放
