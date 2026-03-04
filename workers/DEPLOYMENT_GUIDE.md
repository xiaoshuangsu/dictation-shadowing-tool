# R2 Proxy Worker 部署指南

## 问题诊断

当前 R2 Worker 返回 404，可能原因：
1. R2 bucket 没有正确绑定
2. R2 bucket 中没有文件
3. 路径映射问题

## 解决方案

### 步骤 1：登录 Cloudflare Dashboard

访问：https://dash.cloudflare.com/

### 步骤 2：找到并编辑 Worker

1. 进入 **Workers & Pages**
2. 找到 `r2-proxy` Worker（或创建新的）
3. 点击 **Edit code**

### 步骤 3：配置 R2 Bucket 绑定

1. 在 Worker 编辑页面，点击 **Settings** → **Variables**
2. 添加 **R2 存储桶绑定**：
   - **Variable name**: `R2`
   - **Bucket name**: 您的 R2 bucket 名称（需要确认）
3. 保存

### 步骤 4：更新 Worker 代码

1. 复制 `r2-proxy-improved.js` 的内容
2. 粘贴到 Worker 编辑器
3. 点击 **Save** → **Deploy**

### 步骤 5：确认 R2 Bucket 名称

您需要确认您的 R2 bucket 名称。可以通过以下方式：

#### 方法 1：查看 Cloudflare R2 页面

1. Cloudflare Dashboard → **R2**
2. 查看 bucket 列表
3. 记录 bucket 名称

#### 方法 2：使用 wrangler CLI

```bash
# 列出所有 R2 buckets
wrangler r2 bucket list

# 或查看当前配置
cat ~/.wrangler/config/default.toml
```

### 步骤 6：测试部署

部署完成后，测试以下 URL：

```bash
# 测试 Supabase fallback（应该立即工作）
curl -I "https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/Canada_Provinces_and_Territories.jpg"

# 检查响应头中的 X-Source
curl -I "https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/Canada_Provinces_and_Territories.jpg" | grep -i "x-source"

# X-Source: Supabase = 从 Supabase 加载（R2 中没有）
# X-Source: R2 = 从 R2 加载（正常）
```

## 临时解决方案（立即可用）

如果 R2 配置需要时间，可以：

### 方案 A：直接使用 Supabase Storage（推荐，立即可用）

修改 `src/app/topics/page.tsx`:

```typescript
const getThumbnailUrl = (path: string | null) => {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  // 直接使用 Supabase Storage
  return `https://cuxotlijjnxbsirpdkgr.supabase.co/storage/v1/object/public/engnovate-audio/${path}`
}
```

### 方案 B：等待 R2 Worker 部署完成

Worker 的 fallback 机制会自动从 Supabase 加载，无需修改代码。

## 移动端兼容性

改进后的 Worker 包含：
- ✅ 正确的 CORS 头（移动端必需）
- ✅ 长时间缓存（1年，减少移动流量）
- ✅ 自动 fallback（确保资源始终可访问）
- ✅ 路径映射（处理 compressed 子目录）

## 检查清单

- [ ] 确认 R2 bucket 名称
- [ ] Worker 绑定了正确的 R2 bucket
- [ ] Worker 代码已更新为 `r2-proxy-improved.js`
- [ ] 测试 URL 返回 200（可能 X-Source: Supabase）
- [ ] 移动端测试通过

## 长期计划

1. **上传文件到 R2**: 将所有 thumbnails、audio、video 上传到 R2
2. **验证 R2 访问**: 确保 X-Source 显示为 R2
3. **移除 Supabase 依赖**: 纯粹使用 R2（节省成本）
