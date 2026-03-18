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

---

**版本**：V19.9
**更新日期**：2026-03-18
