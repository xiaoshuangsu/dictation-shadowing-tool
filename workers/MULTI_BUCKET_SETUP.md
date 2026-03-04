# R2 Worker 多存储桶配置指南

## 问题诊断

当前 R2 Worker 返回 404，原因：
1. Worker 可能只绑定了一个存储桶
2. 需要根据路径路由到不同的存储桶

## 解决方案

### 步骤 1：登录 Cloudflare Dashboard

访问：https://dash.cloudflare.com/

### 步骤 2：编辑 r2-proxy Worker

1. 进入 **Workers & Pages**
2. 找到 `r2-proxy` Worker
3. 点击 **Edit code**

### 步骤 3：配置两个存储桶绑定

在 Worker 编辑页面：

1. 点击 **Settings** → **Variables**
2. 添加第一个 R2 存储桶绑定：
   - **Variable name**: `R2`
   - **Bucket name**: 你的 R2 bucket 名称（存储 audio 和 thumbnails）
   - 点击 **Encrypt**（推荐）

3. 添加第二个 R2 存储桶绑定：
   - **Variable name**: `VIDEOS`
   - **Bucket name**: 你的视频 bucket 名称（存储 videos）
   - 点击 **Encrypt**（推荐）

### 步骤 4：更新 Worker 代码

1. 复制 `workers/r2-proxy-multi-bucket.js` 的内容
2. 粘贴到 Worker 编辑器
3. 替换现有代码
4. 点击 **Save** → **Deploy**

### 步骤 5：验证存储桶名称

你需要确认两个 bucket 的名称：

```bash
# 使用 wrangler CLI 列出所有 buckets
npx wrangler r2 bucket list

# 或查看 Cloudflare Dashboard → R2
```

### 步骤 6：测试部署

部署完成后，测试以下 URL：

```bash
# 测试 audio（应该使用 R2 bucket）
curl -I "https://r2-proxy.suxiaoshuang2020.workers.dev/audio/Canada_Provinces_and_Territories.mp3"

# 测试 thumbnails（应该使用 R2 bucket）
curl -I "https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/Canada_Provinces_and_Territories.jpg"

# 测试 videos（应该使用 VIDEOS bucket）
curl -I "https://r2-proxy.suxiaoshuang2020.workers.dev/videos/empty-your-mind.mp4"
```

**成功的响应头应该包含：**
- `X-Bucket: R2` 或 `X-Bucket: VIDEOS`
- `X-Source: R2-Multi-Bucket`
- `X-Key: audio/xxx.mp3`（显示实际查询的 key）

### 步骤 7：调试 404 错误

如果仍然返回 404，检查响应头：

```bash
curl -v "https://r2-proxy.suxiaoshuang2020.workers.dev/audio/Canada_Provinces_and_Territories.mp3" 2>&1 | grep -E "X-Bucket|X-Key|error"
```

**如果看到：**
- `Bucket not configured` → 存储桶未绑定
- `File not found` → 存储桶绑定正确，但文件不存在
  - 需要上传文件到 R2

## 检查文件是否在 R2 中

### 方法 1：使用 wrangler CLI

```bash
# 列出 R2 bucket 中的文件
npx wrangler r2 object list <BUCKET_NAME>

# 搜索特定文件
npx wrangler r2 object list <BUCKET_NAME> | grep -i "canada"
```

### 方法 2：使用 Python 脚本

```python
import boto3

s3 = boto3.client('s3',
    endpoint_url='https://<ACCOUNT_ID>.r2.cloudflarestorage.com',
    aws_access_key_id='<ACCESS_KEY>',
    aws_secret_access_key='<SECRET_KEY>'
)

# 列出文件
response = s3.list_objects_v2(Bucket='<BUCKET_NAME>', Prefix='audio/')
for obj in response.get('Contents', []):
    print(obj['Key'])
```

## 常见问题

### Q: 如何确认我的 bucket 名称？

A: 访问 Cloudflare Dashboard → R2，查看 bucket 列表

### Q: 文件在 Supabase Storage，不在 R2？

A: 需要上传到 R2。参考 `scripts/upload-local-audios-to-r2.py`

### Q: 需要更新数据库中的路径吗？

A: 如果路径已经是 R2 URL，不需要更新。如果是相对路径，前端代码会自动拼接 R2 Worker URL。

## 前端代码修复

前端需要正确处理相对路径：

```typescript
// 相对路径拼接 R2 Worker URL
const getFullUrl = (path: string | null) => {
  if (!path) return null

  // 如果已经是完整 URL，直接使用
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  // 相对路径，拼接 R2 Worker URL
  return `https://r2-proxy.suxiaoshuang2020.workers.dev/${path}`
}
```

这样 `thumbnails/xxx.jpg` 会变成 `https://r2-proxy.../thumbnails/xxx.jpg`
