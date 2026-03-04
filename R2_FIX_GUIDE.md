# R2 Worker 修复指南 - 快速版

## 问题：R2 Worker 返回 404

## 解决方案 3 步走

### 第 1 步：确认 R2 存储桶中是否有文件

运行检查脚本：

```bash
cd /Users/a/dictation
python3 scripts/check_r2_files.py
```

这会显示：
- R2 bucket 中有哪些文件
- 示例文件是否存在

**如果文件不存在** → 需要上传到 R2（见第 2 步）
**如果文件存在** → 跳到第 3 步配置 Worker

---

### 第 2 步：上传文件到 R2（如果需要）

#### 确认你的 bucket 名称

```bash
# 安装 wrangler
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 列出所有 buckets
wrangler r2 bucket list
```

记下你的 bucket 名称（例如 `engnovate-audio`）

#### 上传文件

使用现有脚本上传：

```bash
# 上传音频文件
python3 scripts/upload-local-audios-to-r2.py

# 或上传单个文件
python3 scripts/upload_to_r2.py /path/to/file.mp3
```

---

### 第 3 步：配置 Cloudflare Worker

#### 3.1 登录 Cloudflare Dashboard

访问：https://dash.cloudflare.com/

#### 3.2 编辑 r2-proxy Worker

1. **Workers & Pages** → 找到 `r2-proxy`
2. 点击 **Edit code**

#### 3.3 配置存储桶绑定

1. 点击 **Settings** → **Variables** → **Bindings**
2. 点击 **Add binding** → **R2 Bucket**

**第一个绑定**（audio 和 thumbnails）：
- Variable name: `R2`
- Bucket name: `engnovate-audio`（你的 bucket 名称）
- 勾选 **Encrypt**

**第二个绑定**（videos，如果有）：
- Variable name: `VIDEOS`
- Bucket name: `engnovate-videos`（你的视频 bucket）
- 勾选 **Encrypt**

#### 3.4 更新 Worker 代码

复制以下代码到 Worker 编辑器：

```javascript
// 点击 "Quick edit" 复制 workers/r2-proxy-multi-bucket.js
// 或手动复制下面的代码

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.slice(1);

      // 路由到正确的 bucket
      let bucket = env.R2; // 默认
      let key = path;

      if (path.startsWith('audio/')) {
        bucket = env.R2;
      } else if (path.startsWith('thumbnails/')) {
        bucket = env.R2;
      } else if (path.startsWith('videos/')) {
        bucket = env.VIDEOS;
      }

      if (!bucket) {
        return new Response('Bucket not configured', { status: 500 });
      }

      const object = await bucket.get(key);

      if (!object) {
        return new Response(JSON.stringify({
          error: 'File not found',
          path: path,
          bucket: path.startsWith('videos/') ? 'VIDEOS' : 'R2',
          key: key
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'X-Bucket': path.startsWith('videos/') ? 'VIDEOS' : 'R2',
            'X-Key': key
          }
        });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('Access-Control-Allow-Origin', '*');

      return new Response(object.body, {
        status: 200,
        headers,
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
```

#### 3.5 部署

点击 **Save** → **Deploy**

---

### 第 4 步：测试

```bash
# 测试音频
curl -I "https://r2-proxy.suxiaoshuang2020.workers.dev/audio/Canada_Provinces_and_Territories.mp3"

# 测试缩略图
curl -I "https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/Canada_Provinces_and_Territories.jpg"
```

**成功的响应：**
- `HTTP/2 200`
- `X-Bucket: R2`
- `Content-Type: audio/mpeg` 或 `image/jpeg`

---

## 快速诊断

| 症状 | 原因 | 解决方案 |
|------|------|----------|
| `Bucket not configured` | Worker 未绑定存储桶 | 配置 R2 bucket 绑定 |
| `File not found` | 文件不在 R2 中 | 上传文件到 R2 |
| `404` 无响应头 | Worker 代码错误 | 检查 Worker 日志 |

---

## 当前代码状态

前端代码已正确配置：
- ✅ 相对路径会自动拼接 R2 Worker URL
- ✅ `thumbnails/xxx.jpg` → `https://r2-proxy.../thumbnails/xxx.jpg`
- ✅ 完整 R2 URL 会直接使用

只需要确保 Worker 正确配置即可！
