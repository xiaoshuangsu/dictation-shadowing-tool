# YouTube 视频自动入库指南

**版本**：v2.2
**更新日期**：2026-04-06
**适用场景**：YouTube 视频素材自动抓取、翻译、入库

---

## 📋 脚本概览

| 脚本名称 | 版本 | 路径 | 功能描述 |
|---------|------|------|----------|
| **YouTube 单个上传** | v2.2 | `scripts/ingest_youtube_ytdlp.py` | 单个视频自动化完整流程 |
| **YouTube 批量上传** | v2.2 | `scripts/ingest_youtube_batch.py` | 批量处理，断点恢复 |

---

## 🚀 快速开始

### 单个视频入库

```bash
# 默认分类：Science and Facts，难度：B2
python3 scripts/ingest_youtube_ytdlp.py "https://youtu.be/xxxxx"

# 指定分类和难度
python3 scripts/ingest_youtube_ytdlp.py "https://youtu.be/xxxxx" --category "Science and Facts" --difficulty "B2"

# 查看帮助
python3 scripts/ingest_youtube_ytdlp.py --help
```

### 批量视频入库（推荐）

```bash
# 批量处理多个视频，每完成一个立即入库
python3 scripts/ingest_youtube_batch.py \
  "https://youtu.be/xxxxx" \
  "https://youtu.be/yyyyy" \
  "https://youtu.be/zzzzz" \
  --category "BBC Earth" \
  --difficulty "C2"

# 强制重新处理（即使已入库）
python3 scripts/ingest_youtube_batch.py "https://youtu.be/xxxxx" --force
```

**预期时间**：每个视频约 35-40 分钟（取决于句子数量，约 1 分钟/句）

---

## 🔄 v2.2 自动化流程

```
1. yt-dlp 获取字幕（Chrome cookies 绕过 bot 检测）
   ↓
2. LLM 标点恢复（v2.2 新增）
   自动修复字幕缺失的标点符号
   ↓
3. 智能断句（v6.3）
   简化时间戳对齐逻辑，末尾滞后容差
   示例：82 句 → 38 句
   ↓
4. 时间轴优化
   简化对齐逻辑 + 末尾滞后容差
   ↓
5. 智能挖空（v6.2 逻辑）
   语言习得导向，权重系统，索引转换，自动修正
   W10=13, W9=2, W6=2
   ↓
6. 19 国语言翻译
   原有 3 种 + Group A 8 种 + Group B 8 种
   ↓
7. 入库 Supabase
   source_type: "youtube"
   youtube_id: "xxxxx"
```

---

## 🌍 翻译语言列表（19 种）

**原有 (3种)**：zh, zh_hant, vi

**Group A (8种)**：ar, de, es, ja, ms, ru, tr, el

**Group B (8种)**：id, ko, pt, th, uk, bn, mn, hi

**翻译顺序**：原有语言 → Group A → Group B（确保稳定性）

---

## 📊 数据格式

### Transcript 数据结构

```json
{
  "id": 1,
  "text": "One day around 850 CE, a goatherd named Kaldi observed that...",
  "startTime": 6.79,
  "endTime": 16.43,
  "blanks": [
    {
      "word": "goatherd",
      "index": 6,
      "weight": 10
    }
  ],
  "translation": {
    "zh": "公元850年左右的一天，一个名叫卡迪的牧羊人...",
    "zh_hant": "公元850年左右的一天，一個名叫卡迪的牧羊人...",
    "vi": "Vào khoảng năm 850 SCN...",
    "ar": "في حوالي عام 850...",
    "de": "Eines Tages um 850...",
    "es": "Un día alrededor del año 850...",
    "ja": "850年頃のある日...",
    "ms": "Suatu hari sekitar tahun 850...",
    "ru": "Однажды около 850 года...",
    "tr": "MS 850 civarında bir gün...",
    "el": "Μια μέρα γύρω στο 850...",
    "id": "Suatu hari sekitar tahun 850...",
    "ko": "서기 850년경 어느 날...",
    "pt": "Um dia por volta de 850...",
    "th": "วันหนึ่งราวปี 850...",
    "uk": "Одного дня приблизительно в 850 році...",
    "bn": "খ্রিস্টাব্দ ৮৫০ সালের কোনো একদিন...",
    "mn": "МЭ 850 оны үндсэн нэг өдөр...",
    "hi": "ईस्वी 850 के आसपास एक दिन..."
  }
}
```

### Material 元数据

```json
{
  "id": "uuid",
  "title": "视频标题",
  "category": "Science and Facts",
  "difficulty": "B2",
  "source_type": "youtube",
  "youtube_id": "xxxxx",
  "thumbnail": "https://media.shadowhub.app/thumbnails/xxxxx.jpg",
  "transcript": [...]
}
```

---

## 🔧 批量处理脚本特点

### 核心优势

- ✅ **每完成一个立即入库**：避免中途中断导致数据丢失
- ✅ **断点恢复**：自动跳过已入库的视频
- ✅ **进度保存**：`/tmp/youtube_batch_progress.json` 记录处理进度
- ✅ **统计报告**：显示成功/失败/跳过的数量

### 进度文件格式

```json
{
  "last_update": "2026-04-06T12:34:56",
  "processed": [
    {
      "url": "https://youtu.be/xxxxx",
      "status": "success",
      "timestamp": "2026-04-06T12:30:00"
    }
  ],
  "failed": [
    {
      "url": "https://youtu.be/yyyyy",
      "status": "failed",
      "error": "字幕获取失败",
      "timestamp": "2026-04-06T12:35:00"
    }
  ]
}
```

---

## ⚠️ 常见问题

### 1. 字幕获取失败

**问题**：yt-dlp 无法获取字幕

**解决方案**：
- 检查视频是否包含字幕
- 尝试使用 Chrome cookies：
  ```bash
  # 导出 cookies
  # 使用 chrome-extension+cookie 格式
  ```

### 2. 翻译失败

**问题**：部分翻译标记为 `[TODO_RETRY]`

**解决方案**：
- 运行重试脚本：
  ```bash
  python3 scripts/retry_failed_translations.py
  ```

### 3. 进度丢失

**问题**：批量处理中断后进度丢失

**解决方案**：
- 检查 `/tmp/youtube_batch_progress.json` 是否存在
- 重新运行批量脚本（会自动跳过已入库的视频）

### 4. 分类不存在

**问题**：指定的分类在数据库中不存在

**解决方案**：
- 查看现有分类：
  ```bash
  # 访问 Supabase Table Editor → categories 表
  ```
- 或使用默认分类："Science and Facts"

---

## 📖 相关文档

- **挖空逻辑详解**：`docs/blank_logic_guide.md`
- **翻译引擎配置**：`docs/dictionary_prepopulation.md`
- **主指南**：`claude-code-guide.md`

---

## 🔄 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v2.2 | 2026-04-01 | 新增 LLM 标点恢复，智能断句 v6.3 |
| v2.1 | 2026-03-28 | 优化时间轴对齐逻辑 |
| v2.0 | 2026-03-26 | 支持 19 国语言翻译 |
