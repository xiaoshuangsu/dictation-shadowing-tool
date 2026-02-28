# Bilibili 视频素材添加指南

## 📋 功能说明

现在可以自动添加 Bilibili 视频到"故事"分类中，提供视频+音频的沉浸式学习体验。

## 🚀 快速开始

### 1. 准备工作

#### 1.1 数据库迁移（首次使用）

在 Supabase SQL Editor 中执行：

```sql
-- 添加 video_path 字段
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS video_path TEXT;

COMMENT ON COLUMN public.materials.video_path IS '视频文件路径（相对于 Supabase Storage bucket）';
```

#### 1.2 安装依赖（首次使用）

```bash
# macOS (已安装)
brew install yt-dlp ffmpeg

# 验证安装
yt-dlp --version
ffmpeg -version
```

#### 1.3 设置环境变量

```bash
export SUPABASE_SERVICE_KEY="your_service_key_here"
```

### 2. 添加视频素材

运行自动化脚本：

```bash
cd /Users/a/dictation/scripts
python3 add_bilibili_video.py
```

按提示输入：
1. **Bilibili 视频 URL**：粘贴视频链接
2. **自定义标题**（可选）：留空使用原标题
3. **难度级别**：beginner / intermediate / advanced

### 3. 脚本自动完成

脚本会自动：
- ✅ 下载视频和缩略图
- ✅ 提取音频用于转录
- ✅ 使用 Whisper 转录（智能分句）
- ✅ 翻译所有句子
- ✅ 上传视频、音频、缩略图到 Supabase Storage
- ✅ 保存到数据库

### 4. 更新路由配置

脚本会输出一个 slug，添加到 `src/lib/data/materialSlugs.ts`：

```typescript
export const MATERIAL_SLUGS = [
  // ...
  { slug: "your-video-slug-here" },  // 添加这一行
]
```

## 📂 文件结构

添加视频素材后，文件存储结构：

```
Supabase Storage (engnovate-audio bucket)
├── videos/           # 视频文件 (.mp4)
│   └── Video Title.mp4
├── audio/            # 音频文件 (.mp3)
│   └── Video Title.mp3
└── thumbnails/       # 缩略图 (.jpg)
    └── Video Title.jpg
```

## 🎬 前端显示

- **有视频的素材**：显示视频播放器 + 播放按钮
- **纯音频素材**：显示音频播放器（保持原有功能）

视频播放器支持：
- ⏯️ 按句子播放（自动跳转）
- 🎚️ 播放速度调节（0.75x - 2x）
- 📱 移动端自适应

## 🔧 故障排除

### 问题1：yt-dlp 下载失败

```bash
# 更新 yt-dlp
pip install --upgrade yt-dlp

# 或使用 Homebrew
brew upgrade yt-dlp
```

### 问题2：Supabase 上传失败

检查环境变量：
```bash
echo $SUPABASE_SERVICE_KEY
```

确保有 Storage 权限：
- Supabase Dashboard → Storage → engnovate-audio → Policies
- 确保 Service Key 有上传权限

### 问题3：视频无法播放

检查视频文件：
1. 确认视频已上传到 Storage
2. 检查 video_path 格式正确
3. 确认 URL 编码正确（空格 → %20）

### 问题4：Whisper 转录错误

确保 ffmpeg 在 PATH 中：
```bash
which ffmpeg
# 应该输出：/opt/homebrew/bin/ffmpeg
```

## 📊 示例工作流

```bash
# 1. 运行脚本
python3 scripts/add_bilibili_video.py

# 2. 输入信息
Bilibili 视频 URL: https://www.bilibili.com/video/BV1xx411c7mD/
自定义标题: （留空）
难度级别: intermediate

# 3. 等待处理（约 5-10 分钟）
# - 下载视频: ~2 分钟
# - 转录: ~3 分钟
# - 翻译: ~2 分钟
# - 上传: ~1 分钟

# 4. 输出结果
✅ 完成！
📌 标题: Cinderella - Fairy Tale Story
📝 总句数: 45
⏱️  时长: 245.3 秒
📂 Slug: cinderella-fairy-tale-story

# 5. 更新 materialSlugs.ts
# 添加: { slug: "cinderella-fairy-tale-story" }

# 6. 测试
# 访问: https://xiaoshuangsu.github.io/dictation-shadowing-tool/practice?id=<material-id>
```

## 🎯 推荐素材类型

适合添加为视频素材的内容：
- ✅ 英语童话故事（如 Little Fox 系列）
- ✅ 教育动画短片
- ✅ 英文电影片段
- ✅ TED-Ed 动画
- ✅ 英语教学视频

不适合：
- ❌ 长电影（>30 分钟）
- ❌ 无版权内容
- ❌ 低质量视频

## 📝 技术细节

### 智能分句算法

使用三层规则：
1. **长停顿**（>1.5秒）→ 必须断句
2. **句号+短停顿**（>0.6秒）→ 断句
3. **句子太长**（>30秒或>50词）→ 遇句号强制断句

### 视频格式

- **容器**: MP4 (H.264 + AAC)
- **分辨率**: 原始分辨率（建议 720p+）
- **音频**: 从视频中提取为 MP3 (192kbps)

### 数据库字段

```typescript
{
  title: string,
  category: "故事",
  difficulty: "beginner" | "intermediate" | "advanced",
  audio_path: string,    // 必需
  video_path: string,    // 可选（视频素材有此字段）
  thumbnail_path: string,
  duration: number,      // 秒
  transcript: Array<{
    id: number,
    text: string,
    startTime: string,   // "0.00"
    endTime: string,     // "12.34"
    translation: string
  }>
}
```

## 🔄 后续优化

TODO：
- [ ] Shadowing 模式视频支持
- [ ] 字幕显示功能
- [ ] 视频倍速控制
- [ ] 批量添加视频工具
- [ ] 视频缩略图自动生成
