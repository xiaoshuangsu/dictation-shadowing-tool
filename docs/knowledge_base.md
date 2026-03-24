# 经验库 (Bug 记录与解决方案)

> 本文档记录所有已解决的 Bug 及其解决方案。
> 使用场景：遇到类似问题时快速查阅。

---

## 📌 目录

1. [CORS 跨域问题](#1-cors-跨域问题)
2. [吞音问题解决方案](#2-吞音问题解决方案)
3. [移动端视频播放问题](#3-移动端视频播放问题)
4. [模式切换进度丢失](#4-模式切换进度丢失)
5. [深度链接跳转逻辑](#5-深度链接跳转逻辑)
6. [连字符词分词问题](#6-连字符词分词问题)

---

## 1. CORS 跨域问题

### 症状
- iPhone Safari 上素材页面封面图无法加载
- Network 面板显示状态为空（—）
- 桌面浏览器正常显示

### 根本原因

**原因 1：Content-Type 不匹配（主要问题）**
- Worker 根据文件扩展名 `.jpg` 返回 `Content-Type: image/jpeg`
- 但 R2 中实际存储的是 **WebP 格式**的图片
- iOS Safari 严格按照 Content-Type 解析，收到 `image/jpeg` 但数据是 WebP 时直接拒绝

**原因 2：DNS 配置错误（关键问题）**
- `media.shadowhub.app` 使用**灰色云朵**（DNS Only）
- 灰色云朵 = 不经过 Cloudflare 代理，直接穿透到源服务器
- 缺少 Cloudflare 的 HTTPS/SSL 处理、CDN 加速、跨域请求优化

**原因 3：前端缺少跨域属性**
- `<img>` 标签缺少 `crossOrigin="anonymous"` 属性
- 导致浏览器无法正确处理跨域资源

### 解决方案

**方案 1：修复 Worker Content-Type**
```javascript
// worker-simple-ios.js（B 账号 Worker）
// thumbnails 目录统一返回 image/webp
if (path.startsWith('thumbnails/')) {
  headers.set('Content-Type', 'image/webp');
}
```

**方案 2：修改 DNS 配置（必须！）**
- 把 `media.shadowhub.app` 从**灰色云朵**改成**橙色云朵**
- 位置：B 账号 Cloudflare Dashboard → DNS → 记录

**方案 3：前端添加跨域属性**
```tsx
<img
  src={coverUrl}
  crossOrigin="anonymous"
  alt={title}
/>
```

---

## 2. 吞音问题解决方案

### 症状
- 词尾辅音被截断（如 hills 的 /s/、visitors 的 /s/、working 的 /ing/）
- 句子结束太早，导致发音不完整
- 用户体验差，影响影子跟读

### 根本原因
1. **Whisper 词级时间戳不精确**：词的 `end` 时间可能不包含完整的词尾辅音
2. **零时长词标记错误**：某些词被标记为 `start == end`（如 "hills."）
3. **VAD 静音判定过严**：微弱摩擦音被误判为背景噪音

### 解决方案：动态冲突检测算法

**核心原则**：
- **动态后扩**：句子结束时间向后延长 `min(300ms, 间隙/2)`
- **静音裁剪**：使用 Whisper 已识别的停顿作为切割点
- **首部锁定**：起始时间最多向前 30ms（防止爆音）

**关键参数**：
```python
PAUSE_THRESHOLD = 0.8        # 停顿阈值（秒）
TAIL_BUFFER = 0.3            # 默认尾部缓冲 300ms
START_BUFFER = 0.03          # 起始时间最多前移 30ms
```

**VAD 优化参数**：
```python
model.transcribe(
    word_timestamps=True,
    fp16=False,
    no_speech_threshold=0.05,      # 降低静音阈值（默认0.6），保留微弱摩擦音
    logprob_threshold=-2.0,         # 降低概率阈值
    compression_ratio_threshold=3.0, # 提高压缩比容忍度
    condition_on_previous_text=False, # 减少对前文依赖
)
```

### 实现文件
- 脚本：`scripts/retranscribe_empty_your_mind.py`
- 断句函数：`split_words_to_sentences()`

---

## 3. 移动端视频播放问题

### 症状
- 移动端视频无法播放，Code 4 错误
- AbortError：组件卸载后操作
- src 错误赋值：video.src 是页面 URL

### 解决方案

**Code 4 错误**：
- Worker 返回准确的 Content-Length 和 Content-Range

**AbortError**：
- 添加 `isMountedRef` 标志位

**src 错误赋值**：
- 验证 `actualVideoSrc` 必须包含 `.mp4` 和 `media.shadowhub.app`

**CSS 无法加载**：
- 启动 dev server: `npx next dev -p 3000 -H 0.0.0.0`

**频繁显示加载中**：
- 添加 `onPlaying` 事件清除加载状态

---

## 4. 模式切换进度丢失

### 症状
- Dictation/Shadowing 切换时回到第 1 句
- 用户进度丢失

### 根本原因
- 重复的 `currentSentenceIndex` 状态
- 不同模式共享同一个索引状态

### 解决方案
- 删除重复的 `currentSentenceIndex` 状态
- 使用模式独立索引：`dictationIndex` 和 `shadowingIndex`

---

## 5. 深度链接跳转逻辑

### 症状
- 从个人中心点击某一句，跳转后模式不对
- URL 参数解析错误
- 进度条显示不正确

### 根本原因
- URL 参数解析逻辑错误
- 模式切换时状态未正确同步

### 解决方案

**修改 1：删除重复的状态定义**
- 移除重复的 `currentSentenceIndex` 状态
- 使用 URL 参数直接控制进度

**修改 2：修复 Transcript 点击事件**
```typescript
const handleClick = (index: number) => {
  const params = new URLSearchParams({
    mode: currentMode,
    sentence: (index + 1).toString()
  });
  router.push(`/practice?${params.toString()}`);
};
```

**添加 useEffect 监听参数变化**：
```typescript
useEffect(() => {
  const sentenceParam = searchParams.get('sentence');
  if (sentenceParam) {
    const targetIndex = parseInt(sentenceParam) - 1;
    if (!isNaN(targetIndex) && targetIndex >= 0) {
      setCurrentSentenceIndex(targetIndex);
    }
  }
}, [searchParams]);
```

---

## 6. 连字符词与缩写词分词问题

### 症状
- **连字符单词**（如 `self-esteem`、`well-known`、`mother-in-law`）被错误拆分
- **缩写词**（如 `what's`、`don't`、`can't`、`it's`）被错误拆分
- 前端单词块显示时，`self-esteem` 被拆成 `self` 和 `esteem`，`what's` 被拆成 `what` 和 `s`
- 后端分词脚本也可能出现类似问题

### 根本原因
1. **前端分词逻辑缺陷**
   - 使用 `sentence.text.split(" ")` 只按空格分割
   - 或使用 `split(/\s+/)` 按空白字符分割
   - 连字符 `-` 和撇号 `'` 被视为单词边界

2. **正则表达式不完整**
   - 原正则 `/[a-zA-Z]+/g` 不包含连字符和撇号
   - 导致这些特殊字符被排除在单词匹配之外

### 解决方案

**核心原则**：使用 `/[a-zA-Z0-9-']+/g` 正则匹配，将连字符和撇号视为单词的一部分

**前端修复**：

1. **DictationBox.tsx**（Sentence 模式单词块显示）
```typescript
// 修改前：
const words = sentence.text.match(/[a-zA-Z0-9-]+/g)  // V1: 支持连字符

// 修改后：
const words = sentence.text.match(/[a-zA-Z0-9-']+/g) // V2: 同时支持连字符和缩写
const sentenceWords = words || []
```

2. **WordMode.tsx**（Word 模式单词块显示）
```typescript
// 修改前：
const words = sentence.text.match(/[a-zA-Z0-9-]+/g)  // V1: 支持连字符

// 修改后：
const words = sentence.text.match(/[a-zA-Z0-9-']+/g) // V2: 同时支持连字符和缩写
const sentenceWords = words || []
```

**后端脚本修复**：

在素材导入脚本中，确保使用相同的正则表达式：

```python
import re

# 推荐的分词方式（V2: 支持连字符和缩写）
words = re.findall(r"[a-zA-Z0-9-']+", sentence_text)
```

**数据库说明**：
- 数据库中存储的是原始文本（包含连字符和撇号）
- 分词由前端实时进行，无需数据库更新
- 只要数据库存储的是原始文本（如 "What's your name?"），前端就能正确识别

### 测试用例

**连字符词**：
- `self-esteem` → 1 个单词块 ✓
- `well-known` → 1 个单词块 ✓
- `mother-in-law` → 1 个单词块 ✓
- `co-worker` → 1 个单词块 ✓
- `twenty-one` → 1 个单词块 ✓

**缩写词**：
- `what's` → 1 个单词块 ✓
- `don't` → 1 个单词块 ✓
- `can't` → 1 个单词块 ✓
- `it's` → 1 个单词块 ✓
- `I'm` → 1 个单词块 ✓
- `Jack's` → 1 个单词块 ✓（所有格）

**混合词**：
- `mother-in-law's` → 1 个单词块 ✓

### 相关文件
- 前端：`src/components/DictationBox.tsx`
- 前端：`src/components/WordMode.tsx`
- 后端脚本：按需在素材导入脚本中应用

---

## 🎯 快速排查清单

遇到问题时，按以下顺序排查：

1. **检查 CORS 配置**
   - [ ] Worker 是否返回正确的 CORS 头
   - [ ] 前端是否有 `crossOrigin="anonymous"` 属性
   - [ ] DNS 是否使用橙色云朵

2. **检查 Range 请求**
   - [ ] A 账号 Worker 是否正确处理 Range 请求
   - [ ] 是否返回 `Content-Length` 和 `Content-Range` 头

3. **检查前端状态**
   - [ ] 是否有重复的状态定义
   - [ ] URL 参数是否正确解析
   - [ ] useEffect 依赖是否正确

4. **检查数据库**
   - [ ] `video_path` 字段是否存在
   - [ ] 路径是否为相对路径
   - [ ] 是否通过 `getCdnUrl()` 处理

5. **检查分词逻辑**
   - [ ] 前端是否使用 `/[a-zA-Z0-9-]+/g` 正则匹配
   - [ ] 连字符词是否被正确识别为一个单词
   - [ ] 后端脚本是否使用相同的分词逻辑

---

## 7. Transcript 数据格式解析问题

### 症状
- 素材页面只显示默认的 2 句话（First snowfall. / Today is November 26th.）
- 数据库中 transcript 字段有数据，但前端未加载
- 影响单个素材，其他素材正常

### 根本原因
- 数据库中 `transcript` 字段是 **JSON 字符串** 格式（如 `'[{"id":1,"text":"..."}]'`）
- 前端代码检查 `Array.isArray(found.transcript)` 返回 `false`
- 导致 transcript 未被解析，`sampleSentences` 保持默认值

### 解决方案

**在 PracticePage.tsx 中添加 JSON 解析逻辑**：

```typescript
// 🔴 关键修复：transcript 可能是 JSON 字符串或数组
let transcriptData = found.transcript
if (typeof transcriptData === 'string') {
  try {
    transcriptData = JSON.parse(transcriptData)
    console.log('📦 Parsed transcript from JSON string')
  } catch (e) {
    console.error('❌ Failed to parse transcript JSON:', e)
    transcriptData = null
  }
}

// Set transcript
if (transcriptData && Array.isArray(transcriptData) && transcriptData.length > 0) {
  const transcript = transcriptData.map((s: any, index: number) => ({
    ...s,
    id: s.id ?? index,
    startTime: s.startTime,
    endTime: s.endTime,
    translation: s.translation  // 保留完整对象
  }))
  setSampleSentences(transcript)
}
```

**要点**：
- 先检查 `typeof transcriptData === 'string'`
- 使用 `JSON.parse()` 转换为数组
- 用 `try-catch` 捕获解析错误
- 兼容字符串和数组两种格式

### 相关文件
- `src/app/topics/[category]/[slug]/PracticePage.tsx`

---

## 8. 多语言翻译显示问题

### 症状
- 选择"繁体中文"或"越南语"时，仍显示简体中文翻译
- 语言切换无效果
- 只有简体中文翻译正常显示

### 根本原因
- 前端代码将 `translation` 对象转换为字符串，只保留 `zh` 或 `zh-CN`
- 代码逻辑：`translation: s.translation.zh || s.translation['zh-CN']`
- 导致其他语言（zh-TW、vi）的数据丢失

### 解决方案

**保留完整的 translation 对象**：

```typescript
// ❌ 错误做法：只保留简体中文
translation: typeof s.translation === 'object' && s.translation !== null
  ? (s.translation.zh || s.translation['zh-CN'] || JSON.stringify(s.translation))
  : s.translation

// ✅ 正确做法：保留完整对象，支持多语言切换
translation: typeof s.translation === 'object' && s.translation !== null
  ? s.translation  // 保留完整对象
  : s.translation
```

**各组件根据用户选择动态获取对应语言**：

```typescript
// DictationBox.tsx / WordMode.tsx / ShadowingPanel.tsx
const getCurrentTranslation = () => {
  // 兼容旧格式：translation 是字符串
  if (typeof sentence.translation === 'string') {
    return sentence.translation
  }

  // 新格式：translation 是对象，根据语言选择
  return sentence.translation[translationLanguage] || ''
}
```

### 支持的语言
- `zh` / `zh-CN`：简体中文
- `zh-TW`：繁体中文
- `vi`：越南语

### 相关文件
- `src/app/topics/[category]/[slug]/PracticePage.tsx`
- `src/components/DictationBox.tsx`
- `src/components/WordMode.tsx`
- `src/components/ShadowingPanel.tsx`

---

## 9. 练习记录保存与连胜统计不同步

### 症状
- 用户完成听写/跟读练习后
- `practice_records` 表有记录
- 但 `practice_stats` 表连胜数据没有更新
- Profile 页面看不到最新练习记录

### 根本原因
- 新练习页面 `/topics/[category]/[slug]/PracticePage.tsx` 调用了 `savePracticeRecord` 保存练习记录
- 但**缺少连胜统计更新函数**的调用
- 旧页面 `/practice/page.tsx` 有完整逻辑，新页面迁移时遗漏

### 解决方案

**添加连胜统计函数导入**：
```typescript
// src/app/topics/[category]/[slug]/PracticePage.tsx
import { onDictationComplete, onShadowingComplete } from '@/lib/supabase/streak'
```

**在保存练习记录后调用连胜更新**：
```typescript
// handleDictationComplete 函数中
await savePracticeRecord({
  userId: user.id,
  sentenceId: currentSentence.id,
  sentenceText: currentSentence.text,
  practiceMode: mode,
  dictationMode: mode === 'dictation' ? dictationMode : undefined,
  isCorrect,
  usedShowWords,
  audioTitle: material.title,
  materialId: material.id,
  durationSeconds: duration
})

// 更新连胜和统计数据
if (mode === 'dictation') {
  const seconds = duration || 0
  const minutes = seconds / 60
  await onDictationComplete(user.id, minutes)
} else if (mode === 'shadowing') {
  const seconds = duration || 0
  const minutes = seconds / 60
  await onShadowingComplete(user.id, minutes)
}
```

### 相关文件
- `src/app/topics/[category]/[slug]/PracticePage.tsx`（新练习页面）
- `src/app/practice/page.tsx`（旧练习页面，参考实现）
- `src/lib/supabase/streak.ts`（连胜统计函数）

### 快速排查
遇到练习记录不同步时：
1. 检查是否调用了 `savePracticeRecord`
2. 检查是否调用了 `onDictationComplete` 或 `onShadowingComplete`
3. 检查 `practice_records` 表是否有新记录
4. 检查 `practice_stats` 表是否有更新

---

**版本**：V27.8.0
**更新日期**：2026-03-23
