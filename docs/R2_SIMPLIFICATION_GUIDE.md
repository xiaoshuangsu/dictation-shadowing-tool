# R2 存储简化方案 - 统一使用 R2 Bucket

## 目标

简化存储架构，删除 VIDEOS bucket 绑定，所有文件统一使用 R2 bucket。

## 存储结构（最终）

```
R2 Bucket (engnovate-audio)
├── audio/           # 音频文件
├── thumbnails/      # 封面图
├── videos/          # 主项目视频
└── shadowhub/
    └── videos/      # Shadowhub 视频统一在这里
```

## Worker 路由（简化后）

所有请求都路由到 R2 bucket，不再需要 VIDEOS bucket 绑定。

## 执行步骤

### 步骤 1：迁移 youtube_videos/ 到 shadowhub/videos/

使用 AWS CLI（需要先配置 R2 API Token）：

```bash
# 替换 YOUR_ACCOUNT_ID 为你的 R2 Account ID
# 从 .env.local 中获取: NEXT_PUBLIC_R2_ACCOUNT_ID

# 批量移动文件
aws s3 mv s3://engnovate-audio/shadowhub/youtube_videos/ s3://engnovate-audio/shadowhub/videos/ \
  --recursive \
  --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com \
  --profile r2
```

这条命令会：
1. 移动所有文件到 `shadowhub/videos/`
2. 自动跳过重复的文件
3. 清空 `youtube_videos/` 目录

### 步骤 2：删除 Cloudflare Worker 的 VIDEOS 绑定

1. Cloudflare Dashboard → **Workers & Pages**
2. 找到 **r2-proxy** Worker
3. **Settings** → **Bindings**
4. 删除 **VIDEOS** 存储桶绑定
5. 保存

### 步骤 3：更新 Worker 代码

复制以下代码到 Worker 编辑器，替换现有代码：

```javascript
/**
 * Cloudflare Worker - R2 简化版路由
 *
 * 所有请求统一路由到 R2 bucket
 * 支持: audio/, thumbnails/, videos/, shadowhub/videos/
 */

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.slice(1); // 移除开头的 /

      console.log(`[R2 Router] Request: ${path}`);

      // 处理 CORS preflight
      if (request.method === 'OPTIONS') {
        return handleCORS();
      }

      // 统一使用 R2 bucket
      const bucket = env.R2;
      const key = path;

      if (!bucket) {
        console.error(`[R2 Router] R2 bucket not bound`);
        return new Response(JSON.stringify({
          error: 'R2 bucket not configured',
          message: '请检查 Worker 是否绑定了 R2 存储桶'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }

      // 从 R2 bucket 获取对象
      const object = await bucket.get(key);

      if (!object) {
        console.error(`[R2 Router] Object not found: ${key}`);
        return new Response(JSON.stringify({
          error: 'File not found',
          path: path,
          key: key
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'X-Key': key
          }
        });
      }

      // 构建响应头
      const headers = new Headers();
      object.writeHttpMetadata(headers);

      // 添加缓存头（1年缓存）
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

      // 添加调试头
      headers.set('X-Bucket', 'R2');
      headers.set('X-Key', key);
      headers.set('X-Source', 'R2-Simplified');

      return new Response(object.body, {
        status: 200,
        headers,
      });

    } catch (error) {
      console.error('[R2 Router] Error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        path: new URL(request.url).pathname
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  }
};

/**
 * 处理 CORS preflight 请求
 */
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    }
  });
}
```

4. **Save** → **Deploy**

### 步骤 4：验证 Worker

```bash
# 测试音频
curl -I "https://r2-proxy.suxiaoshuang2020.workers.dev/audio/Canada_Provinces_and_Territories.mp3"

# 测试视频
curl -I "https://r2-proxy.suxiaoshuang2020.workers.dev/videos/empty-your-mind.mp4"

# 测试 shadowhub 视频
curl -I "https://r2-proxy.suxiaoshuang2020.workers.dev/shadowhub/videos/test-video.mp4"
```

应该都返回 `HTTP/2 200` 和 `X-Bucket: R2`

### 步骤 5：更新 Supabase 数据库路径

运行以下脚本，确保所有路径使用正确的格式：

```bash
python3 scripts/fix_supabase_r2_paths.py
```

这会确保：
- `videos/xxx.mp4` → `https://r2-proxy.../videos/xxx.mp4`
- `audio/xxx.mp3` → `https://r2-proxy.../audio/xxx.mp3`
- `thumbnails/xxx.jpg` → `https://r2-proxy.../thumbnails/xxx.jpg`
- `shadowhub/videos/xxx.mp4` → `https://r2-proxy.../shadowhub/videos/xxx.mp4`

## URL 格式规范

| 文件类型 | URL 格式 |
|---------|---------|
| 主项目视频 | `https://r2-proxy.suxiaoshuang2020.workers.dev/videos/xxx.mp4` |
| 音频 | `https://r2-proxy.suxiaoshuang2020.workers.dev/audio/xxx.mp3` |
| 封面 | `https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/xxx.jpg` |
| Shadowhub 视频 | `https://r2-proxy.suxiaoshuang2020.workers.dev/shadowhub/videos/xxx.mp4` |

## 完成检查

- [ ] youtube_videos/ 已迁移到 shadowhub/videos/
- [ ] youtube_videos/ 目录已删除
- [ ] Worker 已删除 VIDEOS 绑定
- [ ] Worker 代码已更新为简化版
- [ ] Worker 测试通过（返回 200）
- [ ] Supabase 路径已更新
- [ ] 前端页面测试通过
