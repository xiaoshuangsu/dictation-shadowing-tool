# R2 Proxy Worker - 图片优化部署指南

## 📋 概述

这个 Cloudflare Worker 为 R2 存储的图片提供自动优化服务：
- ✅ **WebP 转换**：自动检测浏览器支持，优先返回 WebP 格式
- ✅ **动态缩放**：支持 `?width=400` 参数调整图片宽度
- ✅ **质量压缩**：默认压缩质量 75%，目标缩略图约 20KB
- ✅ **边缘缓存**：1 年 CDN 缓存，7 天浏览器缓存
- ✅ **自动降级**：不支持 WebP 时返回原格式

---

## 🚀 部署步骤

### 方案 1：使用 Cloudflare Images API（推荐）

这是最简单且性能最好的方案。

#### 前置条件
1. 已有 Cloudflare 账户
2. 已有 R2 存储桶
3. Cloudflare Images 已启用（免费版支持每月 1000 次优化）

#### 步骤 1：启用 Cloudflare Images

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Images** 页面
3. 如果首次使用，点击 **"Enable Images"**
4. 添加图片源（Source）：
   - 选择您的 R2 存储桶
   - 或使用公开 URL 源

#### 步骤 2：更新 Worker 脚本

1. 登录 Cloudflare Dashboard
2. 进入 **Workers & Pages**
3. 找到您的 `r2-proxy` Worker
4. 点击 **"Edit code"**
5. 复制 `workers/r2-proxy-simple.js` 的内容
6. 粘贴到编辑器中
7. 点击 **"Save"** → **"Deploy"**

#### 步骤 3：配置 R2 绑定

1. 在 Worker 编辑页面
2. 点击 **"Settings"** → **"Variables"**
3. 添加 **R2 存储桶绑定**：
   - Variable name: `R2`
   - Bucket name: 选择您的 R2 bucket（如 `engnovate-audio`）
   - 点击 **"Encrypt"**（推荐）

#### 步骤 4：配置 Images 绑定（可选）

如果您启用了 Cloudflare Images：

1. 在 **Settings** → **"Bindings"**
2. 点击 **"Add binding"**
3. 选择 **Images Service**
4. Variable name: `IMAGES`
5. 选择您的 Images 源

#### 步骤 5：测试部署

部署完成后，测试优化功能：

```bash
# 测试原图片
curl -I "https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/your-image.jpg"

# 测试 WebP 格式（浏览器会自动添加 Accept: image/webp）
curl -I -H "Accept: image/webp" "https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/your-image.jpg"

# 测试缩放
curl -I "https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/your-image.jpg?width=400"

# 测试质量调整
curl -I "https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/your-image.jpg?quality=75"
```

---

## 📱 使用方法

### 在代码中使用

图片 URL 格式保持不变，Worker 会自动处理优化：

```typescript
// 原始 URL（保持不变）
const imageUrl = "https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/your-image.jpg";

// 添加缩放参数
const resizedUrl = "https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/your-image.jpg?width=400";

// 添加质量参数
const compressedUrl = "https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/your-image.jpg?quality=75";

// 组合使用
const optimizedUrl = "https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/your-image.jpg?width=400&quality=75";
```

### HTML 中使用

```html
<!-- 自动优化 -->
<img src="https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/your-image.jpg" alt="Thumbnail">

<!-- 指定宽度 -->
<img src="https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/your-image.jpg?width=400" alt="Thumbnail">

<!-- 响应式图片 -->
<img
  src="https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/your-image.jpg?width=400"
  srcset="https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/your-image.jpg?width=800 2x"
  alt="Responsive Thumbnail"
>
```

---

## 🎛️ 配置选项

### URL 参数

| 参数 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `width` | 图片宽度（像素） | 原始宽度 | `?width=400` |
| `quality` | 压缩质量（1-100） | 75 | `?quality=80` |

### 响应头

- `Cache-Control: public, max-age=31536000, immutable` - 1 年 CDN 缓存
- `Vary: Accept` - 根据 Accept 头缓存 WebP 版本

---

## 📊 性能优化效果

### 文件大小对比

| 格式 | 典型大小 | 节省 |
|------|----------|------|
| 原始 JPG | ~80KB | - |
| WebP (质量75) | ~20KB | **75% ↓** |
| WebP (质量80) | ~25KB | **69% ↓** |

### 加载速度对比

- **优化前**：80KB JPG，约 2-3 秒（3G网络）
- **优化后**：20KB WebP，约 0.5-1 秒（3G网络）
- **提升**：约 60-70%

---

## 🔍 监控和调试

### 查看 Worker 日志

1. Cloudflare Dashboard → Workers & Pages
2. 选择您的 Worker
3. 点击 **"Logs"** → **"Real-time logs"**
4. 查看请求和错误信息

### 使用浏览器开发者工具

1. 打开任意包含图片的页面
2. F12 → **Network** 标签
3. 刷新页面
4. 查看图片请求：
   - **Type** 应显示为 `webp`（如果浏览器支持）
   - **Size** 应显著小于原始大小
   - **Time** 应显示 `(from disk cache)` 表示缓存生效

---

## ❓ 常见问题

### Q: WebP 在所有浏览器中都支持吗？

**A**: 现代浏览器（Chrome、Firefox、Edge、Safari）都支持 WebP。Worker 会检测 `Accept` 头，不支持时自动返回 JPG/PNG。

### Q: 缓存时间太长怎么办？

**A**: 如果图片内容更新，可以：
1. 修改文件名（添加版本号）
2. 或使用 `?v=2` 参数破坏缓存
3. 或在 Cloudflare Dashboard 手动清除缓存

### Q: Cloudflare Images 免费额度够用吗？

**A**: 免费版每月 1000 次优化。如果不够：
1. 付费版：$5/月，100,000 次优化
2. 或使用本地优化方案（需要额外的 Worker 代码）

### Q: 图片优化失败会怎样？

**A**: Worker 会自动降级，返回原始图片，确保不影响用户体验。

---

## 🔧 高级配置

### 本地图片优化（无需 Cloudflare Images）

如果不想使用 Cloudflare Images API，可以使用 WASM 版本的 Sharp 库：

```javascript
// 需要额外的设置和依赖
// 详情请查看: workers/r2-proxy-image-optimization.js
```

### 自定义缓存策略

```javascript
// 在 Worker 中修改缓存时间
const CACHE_TTL = 604800; // 7 days
const BROWSER_CACHE = 86400; // 1 day
```

### 添加图片水印

```javascript
// 使用 Cloudflare Images 的 transforms 功能
const optimizedUrl = imagesService.createUrl(imageUrl, {
  width,
  quality,
  format,
  fit: 'scale-down',
  // 添加水印
  draw: {
    watermark: {
      url: 'https://example.com/watermark.png',
      opacity: 0.5,
      position: 'bottom-right',
    }
  }
});
```

---

## 📚 相关链接

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Cloudflare Images 文档](https://developers.cloudflare.com/images/)
- [Cloudflare R2 文档](https://developers.cloudflare.com/r2/)
- [WebP 支持情况](https://caniuse.com/webp)

---

## 💡 最佳实践

1. **缩略图设置**：`?width=400&quality=75`
2. **中等图片**：`?width=800&quality=80`
3. **大图**：`?width=1200&quality=85`
4. **始终使用 WebP**：浏览器不支持时自动降级
5. **利用缓存**：1 年缓存不会影响更新（使用文件名版本控制）

---

## 🆘 获取帮助

如有问题，请检查：
1. Cloudflare Worker 日志
2. 浏览器控制台错误
3. R2 存储桶绑定是否正确
4. Cloudflare Images 是否已启用

或联系技术支持：support@example.com
