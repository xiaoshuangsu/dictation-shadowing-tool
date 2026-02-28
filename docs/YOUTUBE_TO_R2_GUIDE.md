# YouTube 视频存储到 R2 完整指南

## 🎯 功能概述

从 YouTube 下载视频，存储到 Cloudflare R2，并嵌入到练习工具中。

**优势**：
- ✅ 云端到云端（无需用户本地下载）
- ✅ 全球 CDN 加速
- ✅ 零出口流量费用
- ✅ 完全免费（10GB 存储 + 1000万次操作/月）

## 📋 前提条件

### 1. Cloudflare 账号
- 访问 https://dash.cloudflare.com/ 注册（免费）

### 2. 安装依赖

```bash
# Python 依赖
pip install boto3

# 本地工具
brew install yt-dlp ffmpeg
```

### 3. 配置环境变量

创建 `.env.local` 文件（添加到 .gitignore）：

```bash
# Cloudflare R2 配置
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=dictation-videos
```

获取这些信息的方法见：`docs/CLOUDFLARE_R2_SETUP.md`

## 🚀 使用步骤

### 步骤1：设置 Cloudflare R2（首次使用）

1. **创建 R2 Bucket**
   - 访问 Cloudflare Dashboard
   - R2 → Overview → Create bucket
   - 名称：`dictation-videos`

2. **创建 API Token**
   - R2 → Manage R2 API Tokens
   - 创建 token 并保存密钥

3. **配置公开访问**（选择一种）
   - **选项A**：使用 R2 提供的公开 URL
     - 格式：`https://pub-{ACCOUNT_ID}.r2.dev/{key}`
   - **选项B**：绑定自定义域名（推荐）
     - R2 Bucket → Settings → Public Access
     - 添加 Custom Domain

详细步骤见：`docs/CLOUDFLARE_R2_SETUP.md`

### 步骤2：下载并上传视频

```bash
# 设置环境变量
export R2_ACCOUNT_ID="your_account_id"
export R2_ACCESS_KEY_ID="your_access_key_id"
export R2_SECRET_ACCESS_KEY="your_secret_key"

# 下载 YouTube 视频并上传到 R2
python3 scripts/download_youtube_to_r2.py "https://www.youtube.com/watch?v=VIDEO_ID" "Video Title"

# 示例
python3 scripts/download_youtube_to_r2.py \
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ" \
  "Never Gonna Give You Up"
```

### 步骤3：添加到数据库

视频上传到 R2 后，使用返回的 URL 添加素材到数据库：

```python
from supabase import create_client

client = create_client(SUPABASE_URL, SUPABASE_KEY)

material_data = {
    'title': 'Never Gonna Give You Up',
    'category': '故事',
    'difficulty': 'B1',
    'audio_path': 'audio/never-gonna-give-you-up.mp3',
    'video_path': 'videos/never-gonna-give-you-up.mp4',  # 新增
    'thumbnail_path': 'thumbnails/never-gonna-give-you-up.jpg',
    'duration': 212,
    'transcript': [
        # ... 转录数据
    ]
}

client.table('materials').insert(material_data).execute()
```

或使用现有的转录脚本：
```bash
python3 scripts/transcribe_material.py
```

### 步骤4：更新路由

在 `src/lib/data/materialSlugs.ts` 添加：
```typescript
export const MATERIAL_SLUGS = [
  // ...
  { slug: "never-gonna-give-you-up" },
]
```

## 🎬 完整工作流

### 方案A：手动流程

```bash
# 1. 下载视频到 R2
python3 scripts/download_youtube_to_r2.py "YOUTUBE_URL" "Title"

# 2. 转录（使用现有的 transcribe_material.py）
# 修改 transcribe_material.py 添加 R2 URL 支持

# 3. 添加到数据库和路由
# 手动或使用脚本
```

### 方案B：自动化流程（推荐）

创建一键脚本 `scripts/add_youtube_video.py`：

```python
#!/usr/bin/env python3
"""
一键添加 YouTube 视频素材
1. 下载到 R2
2. 转录
3. 翻译
4. 保存到数据库
"""

import sys
import os
from download_youtube_to_r2 import process_youtube_video
from transcribe_material import main as transcribe

def main():
    youtube_url = sys.argv[1]
    title = sys.argv[2]

    # 1. 下载到 R2
    r2_result = process_youtube_video(youtube_url, title)

    # 2. 转录（从 R2 下载音频）
    # ... 实现转录逻辑

    # 3. 保存到数据库
    # ... 实现数据库保存

if __name__ == '__main__':
    main()
```

## 📊 费用估算

### Cloudflare R2 免费额度
- 存储：10 GB
- Class A 操作：1000万次/月（写入）
- Class B 操作：1000万次/月（读取）

### 典型使用场景

假设添加 100 个视频素材：
- 平均大小：20MB/视频
- 总存储：2 GB（在免费额度内）
- 每月访问：10万次（在免费额度内）

**成本**：完全免费！

## 🔧 故障排除

### 问题1：S3 连接失败
```
EndpointConnectionError: Could not connect to the endpoint URL
```

**解决**：检查 `R2_ENDPOINT` 配置：
```bash
echo "https://$(echo $R2_ACCOUNT_ID).r2.cloudflarestorage.com"
```

### 问题2：上传失败
```
An error occurred (NoSuchBucket) when calling the PutObject operation
```

**解决**：确认 bucket 名称正确：
```bash
aws --endpoint-url=https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com \
  s3 ls
```

### 问题3：视频404

**原因**：R2 默认是私有的

**解决**：配置公开访问
1. R2 Bucket → Settings → Public Access
2. 添加 Custom Domain 或使用默认公开URL

## 🎯 下一步

1. ✅ 设置 Cloudflare R2
2. ✅ 测试下载和上传
3. ➡️ 集成到自动转录流程
4. ➡️ 添加更多 YouTube 视频素材

## 📚 相关文档

- [Cloudflare R2 文档](https://developers.cloudflare.com/r2/)
- [boto3 文档](https://boto3.amazonaws.com/v1/documentation/api/index.html)
- [yt-dlp 文档](https://github.com/yt-dlp/yt-dlp)
