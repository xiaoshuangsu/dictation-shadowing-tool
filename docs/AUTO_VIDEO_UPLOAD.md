# 自动视频上传系统使用指南

## 🎯 系统架构

```
YouTube (源) → Claude Code / GitHub Actions (搬运工) → Cloudflare R2 (仓库) → shadowhub (播放器)
```

---

## 📋 方法 1：本地手动上传（推荐用于测试）

### 步骤 1：上传已有视频到 R2

```bash
# 基础用法
python3 scripts/upload_to_r2.py /path/to/video.mp4 --slug "my-video"

# 提取音频和缩略图
python3 scripts/upload_to_r2.py /path/to/video.mp4 --slug "my-video" --extract-audio --extract-thumbnail

# 指定分类
python3 scripts/upload_to_r2.py /path/to/video.mp4 --slug "lesson-1" --category lessons --extract-audio --extract-thumbnail
```

### 步骤 2：更新 `data/videos.json`

将返回的 R2 URL 添加到 `data/videos.json`：

```json
{
  "videos": [
    {
      "id": "my-video",
      "title": "My Video Title",
      "slug": "my-video",
      "category": "videos",
      "r2Urls": {
        "video": "https://r2-proxy.suxiaoshuang2020.workers.dev/videos/my-video.mp4",
        "audio": "https://r2-proxy.suxiaoshuang2020.workers.dev/audio/my-video.mp3",
        "thumbnail": "https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/my-video.jpg"
      },
      "createdAt": "2025-02-27T00:00:00.000Z",
      "updatedAt": "2025-02-27T00:00:00.000Z"
    }
  ]
}
```

---

## 🤖 方法 2：GitHub Actions 自动化（推荐用于生产）

### 方式 A：手动触发 Workflow

1. 访问 GitHub Actions 页面
2. 选择 "YouTube to R2 Sync" workflow
3. 点击 "Run workflow"
4. 输入 YouTube URL 和分类
5. 等待完成，自动更新 `data/videos.json`

### 方式 B：修改 JSON 文件自动触发

1. 编辑 `data/videos.json`，添加新条目：

```json
{
  "videos": [
    {
      "id": "new-video",
      "title": "New Video",
      "youtubeUrl": "https://youtu.be/VIDEO_ID",
      "category": "videos"
    }
  ]
}
```

2. 提交并推送到 main 分支：

```bash
git add data/videos.json
git commit -m "feat: add new video"
git push
```

3. GitHub Actions 自动执行：
   - ✅ 下载 YouTube 视频
   - ✅ 提取音频和缩略图
   - ✅ 上传到 R2
   - ✅ 回填 R2 URL 到 JSON
   - ✅ 自动提交更新

---

## 📺 在前端使用 R2 视频

### 示例 1：VideoPlayer 组件

```tsx
import VideoPlayer from '@/components/VideoPlayer'
import { getR2PublicUrl, buildR2Key, R2ResourceType } from '@/lib/r2/client'

export default function VideoPage() {
  const videoUrl = getR2PublicUrl(buildR2Key(R2ResourceType.VIDEO, 'my-video.mp4'))
  const thumbnailUrl = getR2PublicUrl(buildR2Key(R2ResourceType.THUMBNAIL, 'my-video.jpg'))

  const currentSentence = {
    id: 1,
    text: "Hello world",
    startTime: 0,
    endTime: 5
  }

  return (
    <VideoPlayer
      videoSrc={videoUrl}
      currentSentence={currentSentence}
    />
  )
}
```

### 示例 2：从 videos.json 读取

```tsx
import videos from '@/data/videos.json'

export default function VideoGallery() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {videos.videos.map((video) => (
        <div key={video.id} className="border rounded-lg p-4">
          <video
            src={video.r2Urls.video}
            poster={video.r2Urls.thumbnail}
            controls
            className="w-full rounded"
          />
          <h3 className="mt-2 font-semibold">{video.title}</h3>
        </div>
      ))}
    </div>
  )
}
```

### 示例 3：动态加载

```tsx
import { useEffect, useState } from 'react'
import { getR2PublicUrl, buildR2Key, R2ResourceType } from '@/lib/r2/client'

interface Video {
  id: string
  title: string
  slug: string
  r2Urls: {
    video: string
    audio?: string
    thumbnail?: string
  }
}

export default function DynamicVideoPlayer({ slug }: { slug: string }) {
  const [video, setVideo] = useState<Video | null>(null)

  useEffect(() => {
    // 从 videos.json 或 API 加载
    fetch('/data/videos.json')
      .then(res => res.json())
      .then(data => {
        const found = data.videos.find((v: Video) => v.slug === slug)
        setVideo(found)
      })
  }, [slug])

  if (!video) return <div>Loading...</div>

  return (
    <video
      src={video.r2Urls.video}
      poster={video.r2Urls.thumbnail}
      controls
      className="w-full"
    />
  )
}
```

---

## 🔑 GitHub Secrets 配置

在 GitHub Repository → Settings → Secrets and variables → Actions 添加以下 secrets：

| Secret 名称 | 值 |
|------------|---|
| `R2_ACCOUNT_ID` | `56f5f35ef68837e643bf13af9871c584` |
| `R2_ACCESS_KEY_ID` | `c6bf7a378f8786823b897975d895601d` |
| `R2_SECRET_ACCESS_KEY` | `8b75bb30c56e360a37070ca415871e5983c50e758119c18df201377651fbde21` |

---

## 📂 文件结构

```
/Users/a/dictation/
├── .github/
│   └── workflows/
│       └── sync_video.yml          # GitHub Actions 配置
├── data/
│   └── videos.json                 # 视频元数据
├── scripts/
│   ├── upload_to_r2.py            # 本地上传脚本
│   ├── youtube_to_r2.sh           # Shell 包装脚本
│   └── youtube_to_r2_action.py    # GitHub Actions 脚本
├── src/
│   ├── components/
│   │   └── VideoPlayer.tsx        # 视频播放器组件（已支持 R2）
│   └── lib/
│       └── r2/
│           └── client.ts          # R2 客户端工具
└── docs/
    └── AUTO_VIDEO_UPLOAD.md       # 本文档
```

---

## 🚀 快速开始

### 测试本地上传

```bash
# 1. 上传测试视频
python3 scripts/upload_to_r2.py /path/to/test.mp4 --slug "test-video" --extract-audio --extract-thumbnail

# 2. 复制返回的 URL
# 输出示例：
# 📹 视频: https://r2-proxy.suxiaoshuang2020.workers.dev/videos/test-video.mp4
# 🎵 音频: https://r2-proxy.suxiaoshuang2020.workers.dev/audio/test-video.mp3
# 🖼️  缩略图: https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/test-video.jpg

# 3. 测试播放
# 在浏览器中打开视频 URL 验证可访问性
```

### 配置 GitHub Actions

```bash
# 1. 添加 GitHub Secrets（在 GitHub Dashboard 操作）

# 2. 测试手动触发
# 访问：https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/sync_video.yml
# 点击 "Run workflow"

# 3. 等待完成，检查 data/videos.json 是否更新
```

---

## ⚙️ 配置选项

### 支持的视频格式

- `.mp4`（推荐）
- `.mov`
- `.avi`
- `.mkv`
- `.webm`

### 分类选项

- `videos` - 普通视频
- `audiobooks` - 有声书
- `lessons` - 课程视频

### R2 目录结构

```
shadowhub/
├── videos/          # 视频文件
├── audio/           # 音频文件
└── thumbnails/      # 缩略图
```

---

## 🔧 故障排除

### 问题 1：GitHub Actions 失败

**检查**：
- GitHub Secrets 是否正确配置
- YouTube URL 是否有效
- 网络连接是否正常

### 问题 2：视频无法播放

**检查**：
- Worker URL 是否可访问
- R2 bucket 是否正确绑定
- Content-Type 是否正确

### 问题 3：音频提取失败

**解决**：
- 确保 ffmpeg 已安装
- 检查视频文件是否损坏

---

## 📊 性能考虑

| 项目 | 说明 |
|------|------|
| 上传速度 | ~10MB/s（取决于网络） |
| 视频压缩 | MP4 (H.264) |
| 音频质量 | 192 kbps MP3 |
| 缩略图大小 | ~50KB |
| 存储成本 | R2 免费层：10GB |
| 流量成本 | R2 免费层：无限流量 |

---

## ✅ 下一步

- [ ] 配置 GitHub Secrets
- [ ] 测试本地上传
- [ ] 测试 GitHub Actions
- [ ] 创建视频页面展示 R2 视频
- [ ] 集成到现有练习系统

---

## 📞 支持

如有问题，请检查：
1. Cloudflare Dashboard：https://dash.cloudflare.com/
2. GitHub Actions 运行日志
3. R2 Worker 日志
