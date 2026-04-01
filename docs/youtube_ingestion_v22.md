# YouTube 素材自动录入工具 - v2.2 优化版

**更新日期**：2026-04-01
**脚本路径**：`scripts/ingest_youtube_ytdlp.py`
**版本**：v2.2（基于 v2.0 优化）

---

## 🎯 核心改进

### v2.1 → v2.2 主要改进

1. **LLM 标点恢复（Punctuation Restoration）**
   - 使用 GLM-4-Flash API 为自动生成的字幕添加标点符号
   - 自动识别句子边界，添加逗号、句号
   - 首字母大写规范化

2. **优化的断句逻辑（v6.3）**
   - 基于 LLM 恢复的标点符号进行断句
   - 末尾滞后容差（300ms）：防止单词被错误分割
   - 准确的时间戳对齐

3. **修复的问题**
   - ✅ "one" 等末尾单词不再被错误分割到下一句
   - ✅ 句子之间有合理的标点符号（逗号、句号、分号）
   - ✅ 首字母大写正确

---

## 📋 完整流程

### 1. 输入与配置
```
输入：YouTube URL
可选参数：
  --category <分类>    默认：Science and Facts
  --difficulty <难度>  默认：B2
```

### 2. 获取元数据（yt-dlp）
- 使用 `yt-dlp` 获取视频信息（标题、时长、缩略图）
- 自动检测字幕类型（手动字幕 > 自动生成字幕）
- 提取字幕 JSON 数据

### 3. 智能断句（v6.3 逻辑）

**步骤 1：LLM 标点恢复**
```python
# 合并所有原始片段
full_text = ' '.join([s['text'] for s in raw_segments])

# 使用 LLM 恢复标点
restored_text = restore_punctuation_with_llm(full_text)
```

**LLM Prompt**：
```
Please add punctuation to the following text. Follow these rules:
1. Add commas where there are natural pauses in speech
2. Add periods at the end of complete sentences
3. Capitalize the first letter of each sentence
4. IMPORTANT: Do NOT merge separate sentences. If there's a clear topic change or new subject, start a new sentence.

Text: {full_text}

Return only the text with punctuation added, nothing else.
```

**步骤 2：基于标点分割句子**
```python
sentences = re.split(r'(?<=[.!?])\s+', restored_text)
```

**步骤 3：时间戳对齐**
- 按单词数比例分配时间戳
- 末尾滞后容差：如果下一词距离 < 300ms 且首字母小写，合并到当前句

### 4. 时间轴优化
- **核心缩进**：每句结尾减少 0.5s
- **最小时长**：确保每句至少 0.2s
- **强制真空带**：句间至少 200ms 静音期

### 5. 智能挖空（v6.2 逻辑）
- 权重系统：W10（长单词、副词）> W9（月份、ing/ed）> W6（基础）
- 黑名单过滤：代词、介词、连词、助动词
- 事实词保护：数字、价格、地址
- 专有名词保护：大写开头的词
- 每句挖 1 个重点词（权重最高）
- 全局去重：每个单词只挖 1 次

### 6. 19 国语言翻译
**原有语言**（3 种）：zh, zh_hant, vi
**Group A**（8 种）：ar, de, es, ja, ms, ru, tr, el
**Group B**（8 种）：id, ko, pt, th, uk, bn, mn, hi

**翻译顺序**：
1. 先翻译原有语言（zh, zh_hant, vi）
2. 冷却 5 秒
3. 翻译 Group A（8 种）
4. 如果 Group A 全部成功，翻译 Group B
5. 否则标记 Group B 为 `[TODO_RETRY]`

**错误处理**：
- 最多重试 3 次
- 指数退避延迟：1s, 2s, 4s
- 失败后标记 `[TODO_RETRY]`，可后续重试

### 7. 入库 Supabase
- 字段：
  - `source_type`: "youtube"
  - `youtube_id`: 视频 ID
  - `category`: 分类
  - `difficulty`: 难度
  - `title`: 标题
  - `slug`: URL slug
  - `audio_path`: `youtube:{video_id}`
  - `thumbnail_path`: 缩略图 URL
  - `duration`: 时长（秒）
  - `transcript`: 完整字幕数据
  - `play_count`: 播放次数

---

## 🔧 关键函数

### `restore_punctuation_with_llm(full_text: str) -> str`
使用 LLM 恢复标点符号，返回带标点的文本。

### `merge_segments_improved(raw_segments: List[Dict]) -> List[Dict]`
改进的智能断句，返回带时间戳的句子列表。

### `normalize_transcript(raw_segments: List[Dict]) -> List[Dict]`
格式化字幕，应用时间轴优化。

### `generate_blanks_for_transcript(transcript: List[Dict]) -> Tuple[int, Dict]`
生成挖空数据，返回成功数量和权重统计。

### `translate_with_retry(text: str, lang_code: str) -> Tuple[str, bool, int]`
单句翻译，带重试机制。

### `generate_translations_for_transcript(transcript: List[Dict]) -> Tuple[int, int, List[str]]`
为整个 transcript 生成 19 国语言翻译。

---

## 📊 执行时间

**每个视频预计时间**：35-40 分钟
- 字幕提取：~5 秒
- LLM 标点恢复：~10-15 秒
- 智能断句：~1 秒
- 挖空：~1 分钟（取决于句子数）
- 翻译：~25-35 分钟（每句约 1 分钟）

---

## ⚠️ 注意事项

1. **LLM API 限流**：翻译阶段有 5 秒冷却时间
2. **字幕要求**：必须要有英文字幕（手动或自动生成）
3. **网络要求**：需要访问 YouTube 和 GLM API
4. **失败重试**：失败的翻译会标记为 `[TODO_RETRY]`，可运行 `retry_failed_translations.py` 重试

---

## 🔧 使用方法

### 基本用法
```bash
python3 scripts/ingest_youtube_ytdlp.py "https://youtu.be/xxxxx"
```

### 指定分类和难度
```bash
python3 scripts/ingest_youtube_ytdlp.py "https://youtu.be/xxxxx" --category "BBC Earth" --difficulty "C2"
```

### 查看帮助
```bash
python3 scripts/ingest_youtube_ytdlp.py --help
```

---

## 📝 示例输出

```
======================================================================
🎯 YouTube 素材自动录入工具 - v2.0 完整版
======================================================================
🔗 URL: https://youtu.be/q3uXXh1sHcI
📚 分类: BBC Earth
📊 难度: C2
======================================================================
[13:10:15] 🔗 连接 Supabase...
[13:10:15] ✅ 连接成功

[13:10:15] 🎬 使用 yt-dlp 获取视频信息...
[13:10:15]    📡 正在获取视频信息...
[13:10:18]    ✅ 标题: Baby Penguin Tries To Make Friends | Snow Chick: A Penguin's Tale | BBC Earth
[13:10:18]    ✅ 时长: 4分22秒
[13:10:18]    📝 正在获取字幕...
[13:10:18]    📌 字幕类型: 自动生成字幕
[13:10:18]    🔧 正在智能断句（原始片段: 60）...
[13:10:18]    🤖 使用 LLM 恢复标点符号...
[13:10:31]    ✅ 标点恢复完成
[13:10:31]    ✅ 断句完成: 17 条句子
[13:10:31]    ✅ 字幕提取成功: 17 条
[13:10:31]    🔧 正在格式化字幕...
[13:10:31]    🔧 正在应用强制真空带...
[13:10:31]    ✅ 格式化完成: 17 条句子
[13:10:31]       - 核心缩进: -0.5s, 最小时长: 0.2s, 强制真空带: 0.2s
       - 调整次数: 15 次
    🔧 正在生成挖空数据...
[13:10:32]       进度: 5/17
    ...
    ✅ 挖空完成: 成功 17, 跳过 0
    🔧 正在生成翻译（19国语言）...
    ...
    ✅ 翻译成功: 323, 失败: 0

======================================================================
✅ 素材录入成功！
======================================================================
```

---

## 🚀 后续优化方向

1. **性能优化**
   - 批量 LLM 请求：一次处理多个视频的标点恢复
   - 缓存机制：避免重复的 LLM 调用

2. **断句准确性**
   - 结合音频分析：使用 pydub 检测静音点
   - 语义分析：确保句子边界符合语法

3. **错误恢复**
   - 自动重试失败的翻译
   - 部分失败回退到原逻辑

---

**维护者**：Claude Sonnet 4.5
**最后更新**：2026-04-01
