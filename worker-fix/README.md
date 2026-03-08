# R2 Proxy Worker 修复指南

## 问题说明

iOS Safari 报错 `MEDIA_ERR_SRC_NOT_SUPPORTED (Code 4)`，原因：
1. Worker 没有返回正确的 MIME 类型
2. Worker 没有正确处理 Range 请求

## 修复内容

### 1. 显式 MIME 类型
根据文件扩展名返回正确的 Content-Type：
- `.mp4` → `video/mp4`
- `.mp3` → `audio/mpeg`
- `.jpg/.png` → `image/jpeg/image/png`

### 2. 完善的 Range 请求支持
- 接收浏览器的 Range 头
- 透传给 R2
- 返回 206 状态码和 Content-Range 响应头

## 部署步骤

### 1. 登录 A 账号 Cloudflare
访问：https://dash.cloudflare.com/（使用 A 账号登录）

### 2. 找到 r2-proxy Worker
- 进入 Workers & Pages
- 找到 `r2-proxy.suxiaoshuang2020.workers.dev`

### 3. 编辑 Worker 代码
- 点击 "Quick Edit" 或 "Edit code"
- 将 `r2-proxy-worker-fixed.js` 的内容复制粘贴进去
- **重要**：确保绑定名称是 `R2_BUCKET`

### 4. 绑定 R2 Bucket（如果还没有）
在 Worker 设置中添加：
```
Binding name（变量名）：R2
类型：R2 Bucket
Bucket 名称：[你的 R2 bucket 名称]
```

**注意**：Worker 代码中使用的 binding name 是 `env.R2`，所以这里的 Variable name 必须设置为 `R2`

### 5. 部署
点击 "Deploy" 或 "Save and Deploy"

### 6. 验证
部署后访问以下 URL 测试：
- 图片：`https://media.shadowhub.app/thumbnails/xxx.jpg`
- 视频：`https://media.shadowhub.app/videos/xxx.mp4`
- 音频：`https://media.shadowhub.app/audios/xxx.mp3`

检查响应头是否包含：
- `Content-Type: video/mp4`（或对应的 MIME 类型）
- `Accept-Ranges: bytes`
- `Access-Control-Allow-Origin: *`

## 测试清单

- [ ] PC 端浏览器能加载图片
- [ ] PC 端浏览器能播放视频/音频
- [ ] iOS Safari 能加载图片
- [ ] iOS Safari 能播放视频（无 MEDIA_ERR_SRC_NOT_SUPPORTED 错误）
- [ ] Android Chrome 能播放视频

## 调试工具

使用 curl 测试 Range 请求：

```bash
# 测试普通请求
curl -I https://media.shadowhub.app/videos/test.mp4

# 测试 Range 请求
curl -I -H "Range: bytes=0-1023" https://media.shadowhub.app/videos/test.mp4
```

预期响应：
- 普通请求：`HTTP/2 200` + `Accept-Ranges: bytes`
- Range 请求：`HTTP/2 206` + `Content-Range: bytes 0-1023/...`
