# 🎬 YouTube 视频自动添加系统 - 完整指南

## ✅ 系统已完成

您现在只需要给我 YouTube 链接，剩下的工作我会**全自动完成**！

---

## 🚀 快速开始（3 步完成）

### 步骤 1：给我 YouTube 链接

告诉我：
- YouTube 视频链接
- 视频标题
- 分类（日常生活/历史演讲/文化历史/艺术文化）

**示例**：
```
请添加这个视频：
链接：https://youtu.be/m-pmf5zQ5uA
标题：My First Day at School
分类：日常生活
```

### 步骤 2：我自动完成所有工作

我会自动：
1. ✅ 下载 YouTube 视频
2. ✅ 提取英文字幕（自动分句）
3. ✅ 上传视频/音频/缩略图到 R2
4. ✅ 添加到 Supabase 数据库
5. ✅ 生成句子时间戳
6. ✅ 返回访问链接

### 步骤 3：您在工具页面使用

访问 `/topics/shadowing/{slug}` 开始练习：
- 📹 观看视频
- 🎧 听写练习
- 🗣️ 影子跟读
- 📝 查看分句

---

## 📋 完整工作流程

```
YouTube 视频
    ↓
[1] 下载视频 (yt-dlp)
    ↓
[2] 提取字幕 (自动分句)
    ↓
[3] 提取音频 (ffmpeg)
    ↓
[4] 提取缩略图 (ffmpeg)
    ↓
[5] 上传到 R2 (boto3)
    ↓
[6] 添加到 Supabase
    ↓
[7] 在您的工具页面可见 ✅
```

---

## 🎯 您可以做什么

### 在工具页面

1. **浏览所有视频**
   - 访问 `/topics` 查看所有素材
   - 按分类筛选

2. **开始练习**
   - 点击任意视频
   - 选择练习模式：
     - 📝 听写模式（Dictation）
     - 🗣️ 影子跟读（Shadowing）

3. **查看分句**
   - 每个句子自动分句
   - 带有时间戳
   - 支持逐句播放

4. **查看翻译**
   - 英文原文
   - 中文翻译（可在 Supabase 中编辑）

---

## 📁 相关文件

### 脚本文件

| 文件 | 用途 |
|------|------|
| `scripts/add_youtube_video.sh` | 一键添加视频（推荐使用） |
| `scripts/youtube_to_supabase.py` | 核心自动化脚本 |

### 数据文件

| 文件 | 说明 |
|------|------|
| `data/videos.json` | 视频 URL 索引 |
| Supabase `materials` 表 | 素材数据库 |

---

## 🔧 技术细节

### 自动分句原理

1. **下载字幕**
   - 使用 `yt-dlp --write-sub --sub-lang en`
   - 下载 YouTube 自动生成的英文字幕

2. **解析 VTT 格式**
   - 解析时间戳（startTime, endTime）
   - 提取文本内容

3. **生成句子数组**
   ```json
   [
     {
       "id": 1,
       "text": "Hello world",
       "startTime": 0.0,
       "endTime": 2.5,
       "translation": "你好世界"
     }
   ]
   ```

4. **存储到 Supabase**
   - 添加到 `materials` 表
   - `transcript` 字段存储句子数组

### R2 存储结构

```
shadowhub/
├── videos/
│   └── {slug}.mp4        # 视频文件
├── audio/
│   └── {slug}.mp3        # 音频文件
└── thumbnails/
    └── {slug}.jpg        # 缩略图
```

### 访问 URL

- **练习页面**: `/topics/shadowing/{slug}`
- **视频页面**: `/videos`
- **素材列表**: `/topics`

---

## 🎨 前端展示

### Topics 页面

显示所有素材，包括：
- 视频标题
- 分类标签
- 难度等级
- 缩略图预览

### 练习页面

功能：
- **VideoPlayer** 播放 R2 视频
- **AudioPlayer** 播放 R2 音频
- **DictationBox** 听写练习
- **ShadowingPanel** 影子跟读
- 逐句播放控制
- 显示中英文对照

---

## 📝 命令示例

### 基础用法

```bash
./scripts/add_youtube_video.sh "https://youtu.be/VIDEO_ID" "视频标题" "分类"
```

### 实际示例

```bash
# 添加日常生活视频
./scripts/add_youtube_video.sh \
  "https://youtu.be/m-pmf5zQ5uA" \
  "First Snowfall" \
  "日常生活"

# 添加历史演讲
./scripts/add_youtube_video.sh \
  "https://youtu.be/XYZ123" \
  "Gettysburg Address" \
  "历史演讲"
```

---

## ✅ 完成标准

系统完成后，您可以：

- [x] 给我 YouTube 链接
- [x] 我自动下载、处理、上传
- [x] 在 `/topics` 页面看到新视频
- [x] 点击进入练习页面
- [x] 观看视频、听写、跟读
- [x] 查看分句和翻译

---

## 🎉 总结

**现在的工作流程**：

1. 您给我：YouTube 链接 + 标题 + 分类
2. 我做：所有自动化处理
3. 您在工具页面：看到视频、开始练习

**就这么简单！** 🚀

---

## 📞 需要帮助？

如果有问题：
1. 检查 Cookie 文件是否存在
2. 检查 YouTube 视频是否有英文字幕
3. 查看控制台错误信息

---

**系统状态**: ✅ 完成并可用

**最后更新**: 2025-02-27
