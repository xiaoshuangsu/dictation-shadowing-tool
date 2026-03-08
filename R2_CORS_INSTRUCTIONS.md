# R2 桶 CORS 配置指南

## 方法 1：通过 Cloudflare Dashboard 配置

1. 登录 Cloudflare Dashboard
2. 进入 R2 > 你的桶名称
3. 点击 "Settings" 标签
4. 找到 "CORS Policy" 部分
5. 点击 "Add CORS policy" 或 "Edit"
6. 粘贴以下 JSON：

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

7. 保存

## 方法 2：使用 wrangler CLI 配置

创建文件 `r2-cors.json`：
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

然后运行：
```bash
wrangler r2 bucket cors put 你的桶名称 --config r2-cors.json
```

## 验证配置

配置后运行：
```bash
curl -I https://pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev/thumbnails/corruption.jpg
```

应该看到：
```
access-control-allow-origin: *
```

## 配置完成后的操作

1. 更新数据库，将所有 Worker URL 替换为 R2 公共域名 URL
2. 删除 Worker 依赖
3. 重新部署
