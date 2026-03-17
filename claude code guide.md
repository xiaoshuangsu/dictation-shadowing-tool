
# ShadowHub 项目全流程开发与自动化规范 (Master Guidelines)

## 🚨 移动端视频播放问题修复记录

### 架构
```
用户 → media.shadowhub.app (B账号Worker)
     → r2-proxy.suxiaoshuang2020.workers.dev (A账号Worker)
     → R2 bucket (shadowhub)
```

### 关键文件
- `src/components/VideoPlayer.tsx` - 视频组件
- `src/app/practice/page.tsx` - getCdnUrl 函数
- `worker-simple-ios.js` - B 账号 Worker
- `workers/worker-simple-ios-range.js` - A 账号 Worker

### 问题速查表
| 问题 | 症状 | 解决方案 |
|------|------|----------|
| **Code 4 错误** | 移动端视频无法播放 | Worker 返回准确的 Content-Length 和 Content-Range |
| **AbortError** | 组件卸载后操作 | 添加 `isMountedRef` 标志位 |
| **src 错误赋值** | video.src 是页面 URL | 验证 `actualVideoSrc` 必须包含 `.mp4` 和 `media.shadowhub.app` |
| **CSS 无法加载** | 手机端页面格式错乱 | 启动 dev server: `npx next dev -p 3000 -H 0.0.0.0` |
| **频繁显示加载中** | 桌面端"缓冲中..."不断弹出 | 添加 `onPlaying` 事件清除加载状态 |
| **QUIC 协议错误** | 页面空白，`ERR_QUIC_PROTOCOL_ERROR` | 强制刷新（Cmd+Shift+R）或在 Cloudflare 禁用 HTTP/3 |
| **模式切换进度丢失** | Dictation/Shadowing 切换时回到第 1 句 | 删除重复的 `currentSentenceIndex` 状态，使用模式独立索引 |

### VideoPlayer 核心原则
1. **事件成对绑定**：`onWaiting` + `onPlaying` 必须同时存在
2. **零干预原则**：只修改 React 状态，绝不调用 `video.play()` 或 `video.pause()`
3. **预加载策略**：弱网用 `preload="metadata"`，桌面端可用 `preload="auto"`

---

# ⚠️ 重要交互准则 (Sarah's Identity & Interaction)
* **用户身份**：Sarah（非开发者，不具备代码编写能力）。
* **沟通语言**：必须全程使用 **中文**。
* **沟通风格**：
    - 禁止堆砌深奥的技术术语。
    - 在执行复杂操作前，必须用通俗易懂的语言解释“为什么要这么做”以及“会有什么影响”。
    - 所有的代码修改和脚本运行都由 Claude 独立完成，Sarah 只负责下达业务指令和确认结果。

* **日志与输出控制 (Output Efficiency)**：
    - **严禁过度打印**：在执行批量任务（如文件重命名、数据库更新、上传 R2）时，禁止打印每一个操作的冗长日志。
    - **静默执行模式**：请优先使用“静默模式”或“简略输出”。
    - **结果汇总**：执行完毕后，仅需提供一份简洁的“成功/失败列表”或“汇总报告”（例如：已成功修复 42 个文件，0 个失败）。
    - **避免卡死**：通过减少日志输出，确保任务能在单次上下文窗口（Context Window）内完成，防止由于日志过多导致的 API Error。

## 1. 素材命名与去重规范 (Naming & Deduplication)
* **唯一 Slug 标准**：全小写、连字符（如 `daily-vlog`），严禁空格和大写。
* **三位一体对齐**：视频、音频、缩略图的主文件名必须完全一致。
* **物理去重原则 (Strict Cleanup)**：
    - **禁止并存**：严禁同一个素材以不同命名（如 `Trip.mp4` 和 `trip.mp4`）同时存在。
    - **覆盖式更新**：修改命名时，必须先 `Delete` 旧文件，再 `Upload` 新文件。
    - **格式清理**：若 R2 中已存在同名 `.mp4`，必须立即删除残留的 `.webm`。
* **幂等性检查**：上传前对比 MD5 或文件大小，若文件内容一致但命名不同，则执行“重命名并删除旧项”的操作。

* **字符安全强制转换 (Sanitization)**：
    - **严禁**在文件名、Slug、或 R2 路径中使用特殊字符。
    - **自动替换规则**：遇到特殊单引号 `’` (U+2019)、标准单引号 `'`、空格、或任何非 ASCII 字符，必须统一转换为**标准连字符 `-`** 或直接**剔除**。
    - **示例**：`Sarah’s Story` 必须转换为 `sarahs-story`，严禁保留 `’`。

---

## 2. 转录核心算法逻辑 (Precision Transcription)

### 2.1 基础规则
* **毫秒级对齐**：Whisper `word_timestamps=True`。
* **物理断句**：
    - 标点 `?.!` 强制切分。
    - 逗号 `,` + 停顿 `> 0.8s` 强制切分。
    - 任何停顿 `> 0.8s` 强制切分。
* **翻译**：指定调用 **GLM API**，确保结合整篇内容根据上下文进行准确翻译，表达地道。

### 2.2 吞音问题解决方案 (Tail Sound Preservation)

#### 问题现象
- 词尾辅音被截断（如 hills 的 /s/、visitors 的 /s/、working 的 /ing/）
- 句子结束太早，导致发音不完整
- 用户体验差，影响影子跟读

#### 根本原因
1. **Whisper 词级时间戳不精确**：词的 `end` 时间可能不包含完整的词尾辅音
2. **零时长词标记错误**：某些词被标记为 `start == end`（如 "hills."）
3. **VAD 静音判定过严**：微弱摩擦音被误判为背景噪音

#### 解决方案：动态冲突检测算法

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

**断句逻辑**：
1. 遇到 `?!.` → 强制断句，应用动态后扩
2. 逗号 + 停顿 > 0.8s → 断句，应用动态后扩
3. 任何停顿 > 0.8s → 断句，在停顿中间位置结束

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

#### 实现文件
- 脚本：`scripts/retranscribe_empty_your_mind.py`
- 断句函数：`split_words_to_sentences()`

#### 注意事项
- ❌ 不要盲目加固定缓冲（如 500ms），会导致句子重叠
- ❌ 不要大幅前移起始时间（如 100ms），会听到上一句尾音
- ✅ 使用动态冲突检测，确保每句之间有微小间隙
- ✅ 保留所有字段（如 `translation`），避免数据丢失

---

## 3. 自动化监控流水线 (Watch Media Script)
监控目录 `/Users/a/dictation/public/：
1. **FFmpeg 压制**：480p (CRF 28-32)。
2. **AI 处理**：生成 Whisper 字幕 (JSON) + GLM 翻译。
3.获取视频标题并确定难度等级。
4.抓取封面图并压缩至 20kb 以下。
5. **R2 唯一化上传**：上传前检查桶内是否存在该 Slug 的旧文件，执行覆盖式同步。
6. **数据库对齐**：确保 Supabase 存储的是**相对路径**（如 `videos/b3l3-dialogue.mp4`），由前端 `getCdnUrl()` 自动拼接 Worker 代理。
7. **物理删除（安全锁）**：只有收到 R2 和 Supabase 的"成功双重确认"后，才允许删除本地原始文件。

---

## 3.1 批量素材导入 (Engnovate Bulk Import)

**脚本**：`scripts/ingest_bulk.py`
**输入**：`urls.txt`（每行一个 Engnovate URL）
**数据源**：https://engnovate.com/dictation-shadowing-exercises/

### 完整流程（10 步）

| 步骤 | 操作 | 数据来源 |
|------|------|----------|
| 0 | **查重优先** | Supabase `source_url` 字段 |
| 1 | 抓取页面 | Engnovate |
| 2 | 解析标题 | `<h1>` 标签 |
| 3 | 生成 slug | 标题转换（小写+连字符）|
| 4 | 解析音频 | `<audio>` 标签 |
| 5 | 解析时间戳 | `data-start`/`data-duration` ✅ |
| 6 | 下载音频 | 远程 URL |
| 7 | GLM 翻译 | GLM-4-Flash API |
| 8 | 上传 R2 | `audio/{category}/{slug}.mp3` |
| 9 | 存 Supabase | `materials` 表 |
| 10 | 容错记录 | `error.log` |

### 关键特性

**🔍 查重机制**
- 根据 `source_url` 查重，跳过已处理链接
- 优先执行，避免重复工作

**📁 R2 存储结构**
```
audio/
  ├─ daily-life/{slug}.mp3
  ├─ historical-speeches/{slug}.mp3
  └─ ...
```

**⚠️ 容错机制**
- 单个失败不中断整体
- 错误记录到 `error.log`
- 最终统计：成功/失败/总计

### 使用示例
```bash
# 1. 添加 URL
echo "https://engnovate.com/.../radio-stations/" >> urls.txt

# 2. 运行脚本
python scripts/ingest_bulk.py

# 3. 查看错误日志
cat error.log
```

### 数据库字段
- `source_url`：查重依据（Engnovate 原链接）
- `audio_path`：`audio/{category}/{slug}.mp3`
- `category`：固定为"日常生活"
- `difficulty`：固定为 A2

### ⚠️ 标点符号解析问题（已修复）

**问题现象**：挖空练习显示错误
```
❌ 修复前：The sky is blue and water is blue [     ]
✅ 修复后：The sky is [     ] and water is blue.
```

**根本原因**：
- Engnovate HTML 中每个 `<span>` 之间有空格
- 脚本用 `' '.join()` 连接，标点前产生空格：`"blue ."`
- 前端将 `"blue"` 和 `"."` 当作两个独立词

**修复方案**（提交 1c5ab89）：
- 更新 `parse_transcript` 函数
- 标点符号（`.`, `,`, `!`, `?`）直接拼接到前一个单词
- 移除标点前的空格：`"blue ."` → `"blue."`

**修复效果**：
| 修复前 | 修复后 |
|--------|--------|
| `"blue ."`（2 个 token） | `"blue."`（1 个 token） |
| 9 个词 | 8 个词 |
| 挖空位置错误 | 挖空位置正确 |

---

## 4. 路径处理与前端规范 (404 Prevention)
* **禁止拼接**：前端 `practice/page.tsx` 必须通过 `getCdnUrl()` 函数处理数据库中的相对路径。
* **Worker 代理强制要求**：所有素材（视频、音频、缩略图）必须通过 A 账号的 Worker 代理（`https://media.shadowhub.app`）获取。
  - ✅ **原因**：Worker 提供移动端必备的 CORS 头和 Range 请求支持
  - ❌ **禁止**：直接使用 R2 公共域名或 Supabase Storage URL
* **清理脏数据**：发现数据库中带有 R2 公共域名或 Supabase 直连 URL 的记录，一律修正为相对路径（由 `getCdnUrl` 自动拼接 Worker 代理）。

---

## 5 数据库与脚本健壮性规范 (Database & Script Robustness)

### 1. 核心字段强制校验 (Mandatory Fields)
* **原则**：在执行任何视频自动化处理脚本（如 `youtube_single.py` 或 `batch_process_ted.py`）时，必须确保存入 Supabase 的 `material_data` 对象包含完整的路径字段。
* **核心字段清单**：
    - `video_path`: 必须包含 R2 的视频访问链接。
    - `audio_path`: 必须包含音频链接。
    - `cover_path` (或 `thumbnail_path`): 必须包含封面图链接。
* **逻辑要求**：脚本在执行 `upsert` 操作前，必须先自检数据结构，严禁在缺少 `video_path` 的情况下提交记录，否则会导致练习页面无法播放。

### 2. 存量数据修复机制
* **操作要求**：如果发现页面无法显示视频，Claude 应首先检查数据库中对应 `slug` 的 `video_path` 字段是否为空。
* **自动化修复**：若字段缺失，应通过脚本自动提取已上传至 R2 的资源路径并完成补全，而非让用户手动修改数据库。

### 3. 脚本更新同步
* **同步义务**：一旦修复了脚本中的逻辑漏洞（如补上了缺失的 `video_path` 变量），必须确保该修复已同步到所有相关的批处理脚本中，保持逻辑一致性。

## 6. 版本、提交与部署
1. **代码自检**：检查逻辑，确保无 URL 拼接错误。
2. **版本记录**：更新 `package.json` 版本号，手动编写 `CHANGELOG.md`。
3. **Git 流程**：打 Tag -> Commit -> Push 至 GitHub 触发 Pages 更新。

## 7. 移动端与跨域资源开发规范 (Mobile & CORS Protocol)

### 1. 跨域资源强制要求 (CORS Requirements)
* **核心原则**：所有素材必须通过 A 账号 Worker 代理（`https://media.shadowhub.app`）加载。
  - ✅ **Worker 提供的关键能力**：
    - 正确的 CORS 头（`Access-Control-Allow-Origin: *`）
    - Range 请求支持（206 Partial Content）- 移动端播放器分段请求的必备能力
    - R2 直连在 Range 请求方面表现不稳定，Worker 代理完美中转
* **血泪史教训**：
  - R2 公共域名（`pub-*.r2.dev`）**缺少 CORS 头**，导致 iOS/移动端封面显示失败（黑屏）
  - 直接使用 R2 或 Supabase URL 会导致资源加载中断
* **强制动作**：凡是 `<img />`, `<audio />`, `<video />` 标签，**必须**显式添加 `crossOrigin="anonymous"` 属性。
  - ✅ `<video src={url} crossOrigin="anonymous" playsInline />`
* **iOS 特定坑点**：
  - ⚠️ **必须包含 `playsInline` 属性**，否则视频无法内联播放
  - ⚠️ **不能缺失 `crossOrigin="anonymous"` 属性**，即使有 Worker 代理，封面依然会黑屏
  - 这是实测中最耗时的发现
* **路由配置要求**：
  - ✅ **B 账号必须设置 `media.shadowhub.app/*` 路由**
  - 路由绑定到 B 账号 Worker（如 `morning-sound-a67b`）
  - 该 Worker 负责从 A 账号 R2 bucket 读取文件并返回
  - DNS 记录：`media` → `morning-sound-a67b.modongla.workers.dev`（**橙色云朵**）

### 2. 数据匹配优先级逻辑 (Data Retrieval Priority)
* **场景**：在动态路由 `[slug]` 页面根据路径查找数据库记录时。
* **匹配顺序**：必须遵循 `精确 ID 匹配` > `Slug 完全匹配` > `关键词模糊匹配`。
* **禁止行为**：严禁仅依靠“数组第一项”或“记录创建时间”进行盲目匹配，必须确保 UI 显示的标题与加载的素材 URL 绝对对应。

### 3. Next.js 结构与 Hydration 规范
* **禁止 HTML 嵌套错误**：严禁在 `layout.tsx` 的全局结构中随意嵌套自定义 `<head>` 标签，这会导致服务端与客户端渲染不一致（Hydration Error）。
* **脚本处理**：第三方调试工具或脚本必须使用 Next.js 原生的 `Script` 组件，并放置在 `<body>` 内部或使用 `strategy="afterInteractive"`。

### 4. 默认状态与防呆设计 (Default States)
* **路径有效性**：严禁在代码中硬编码任何已删除或不存在的测试资源路径（如旧的 `/learn-english-via-listening-1001.mp3`）。
* **错误回退**：当资源加载失败或 Slug 无法匹配时，必须显示明确的提示信息（如 Toast 或 Empty State 引导），严禁让页面处于无限 Loading 或白屏状态。

### 5. 移动端实机测试流程 (Testing Protocol)
* **内网穿透验证**：任何涉及 UI 布局或媒体播放的修改，不能仅依赖 PC 模拟器。必须通过 `localtunnel` 或局域网 IP 在实体 iPhone 上进行验证。
* **调试工具集成**：在排查移动端顽固 Bug 时，应在开发分支临时集成 `eruda` 或 `vConsole` 插件，通过手机端 Console 获取真实报错信息。

---

### 6. 移动端视频播放专项指南 🎬

#### 6.1 iOS 视频格式要求（moov atom 问题）

**问题**：iOS Safari 要求视频的 `moov atom`（元数据容器）必须位于文件开头才能流式播放。

**检查方法**：
```bash
ffprobe -v trace -show_format video.mp4 2>&1 | grep "moov.*parent"
```

**正确输出**（moov atom 在开头）：
```
type:'moov' parent:'root' sz: 343413 40 10530606
                                         ^^ 小数字（接近 0）= ✅ 正确
```

**错误输出**（moov atom 在末尾）：
```
type:'moov' parent:'root' sz: 343413 10187201 10530606
                                         ^^^^^^^^^^ 大数字= ❌ 需要修复
```

**修复方法**：
```bash
ffmpeg -i input.mp4 -c copy -movflags faststart output.mp4
```

**原理**：
- `-c copy`：不重新编码，只重新排列容器结构
- `-movflags faststart`：将 moov atom 移到文件开头
- 不损失质量，速度快

**批量修复脚本**（Python）：
```python
import subprocess
from pathlib import Path

# 配置
videos_dir = Path("/path/to/videos")
fixed_dir = Path("/path/to/fixed_videos")
fixed_dir.mkdir(exist_ok=True)

# 修复所有视频
for video_file in videos_dir.glob("*.mp4"):
    output_file = fixed_dir / video_file.name

    subprocess.run([
        'ffmpeg', '-i', str(video_file),
        '-c', 'copy',
        '-movflags', 'faststart',
        str(output_file),
        '-y'
    ], capture_output=True)

    print(f"✅ Fixed: {video_file.name}")

print("✅ All videos fixed!")
```

#### 6.2 视频组件必需属性

**移动端必须的属性**：
```tsx
<video
  src={videoUrl}
  controls
  playsInline              // iOS 必须：允许内联播放
  webkit-playsinline="true" // iOS Safari 必须
  preload="auto"            // 移动端优化：预加载更多数据
  poster={thumbnailPath}
  onError={handleError}
/>
```

**桌面端兼容配置**：
```tsx
<video
  src={videoUrl}
  controls
  preload="metadata"       // 桌面端优化：减少带宽占用
  onError={handleError}
/>
```

#### 6.3 Worker 配置要求（A 账号）

**问题**：Worker 使用 R2 公开域名访问失败（404 或一直加载）

**解决方案**：直接使用 R2 bucket 访问

**Worker 代码**：
```javascript
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        }
      });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // 直接从 R2 bucket 读取
    if (env.R2_BUCKET) {
      const object = await env.R2_BUCKET.get(path);

      if (!object) {
        return new Response('Not found', { status: 404 });
      }

      const headers = new Headers();
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Cache-Control', 'public, max-age=3600');

      // 设置内容类型
      if (path.match(/\.(mp4|webm|ogg)$/i)) {
        headers.set('Content-Type', 'video/mp4');
      } else if (path.match(/\.(mp3|wav|m4a)$/i)) {
        headers.set('Content-Type', 'audio/mpeg');
      }

      return new Response(object.body, {
        status: 200,
        headers,
      });
    }

    return new Response('R2 bucket not configured', { status: 500 });
  }
};
```

**R2 Bucket 绑定配置**：
1. Cloudflare Dashboard → Workers & Pages
2. 选择 Worker（`r2-proxy-suxiaoshuang2020`）
3. Settings → Variables → **R2 Bucket bindings**
4. 确认配置：
   - Variable name: `R2_BUCKET`
   - Bucket name: `shadowhub`

#### 6.4 常见问题排查速查表

| 症状 | 可能原因 | 检查方法 | 解决方案 |
| :--- | :--- | :--- | :--- |
| 视频黑屏，一直加载中 | Worker 访问 R2 公开域名失败 | 检查 Worker 日志 | 修改 Worker 使用 `env.R2_BUCKET.get()` |
| 视频播放到 1-2 秒就停止 | moov atom 在文件末尾 | `ffprobe` 检查 moov 位置 | 用 `ffmpeg -movflags faststart` 修复 |
| `readyState: 0` | 视频数据加载不足 | 检查 Worker 是否正确返回数据 | 确认 Worker 有 R2 bucket 绑定 |
| `MEDIA_ERR_SRC_NOT_SUPPORTED` | 视频编码或格式问题 | 检查视频编码（H.264/AAC） | 用 baseline profile 重新编码 |
| 视频封面显示但无法播放 | 同步逻辑干扰播放 | 检查 `useEffect` 依赖 | 在同步逻辑中检查播放模式状态 |
| 双重声音（视频+音频） | 练习模式未暂停视频 | 检查 `isFreePlayModeRef.current` | 检测到 `currentTime > 0` 时暂停视频 |

#### 6.5 调试技巧

**获取详细错误信息**：
```tsx
const handleVideoError = () => {
  const video = videoRef.current
  if (video && video.error) {
    console.error('Video Error Details:', {
      code: video.error.code,
      message: video.error.message,
      currentSrc: video.currentSrc,
      readyState: video.readyState,
      networkState: video.networkState,
    })
  }
}

// 添加视频事件监听
<video
  onError={handleVideoError}
  onLoadStart={() => console.log('Video Load Start')}
  onLoadedMetadata={() => console.log('Video Metadata Loaded')}
  onCanPlay={() => console.log('Video Can Play')}
  onPlay={() => console.log('Video Playing')}
  onPause={() => console.log('Video Paused')}
  onTimeUpdate={() => {
    if (Math.floor(videoRef.current.currentTime) % 5 === 0) {
      console.log(`Playing at: ${videoRef.current.currentTime}s`)
    }
  }}
/>
```

**验证视频文件**：
```bash
# 检查 moov atom 位置
ffprobe -v trace -show_format video.mp4 2>&1 | grep "moov.*parent"

# 检查视频编码
ffprobe -v quiet -show_streams video.mp4

# 检查文件大小
ls -lh video.mp4
```

#### 6.6 预防措施（避免重复踩坑）

**视频上传前检查清单**：
- [ ] 视频已用 `ffmpeg -movflags faststart` 处理
- [ ] 视频编码为 H.264/AAC
- [ ] 文件大小合理（建议 < 20MB）

**代码审查检查清单**：
- [ ] `useEffect` 依赖项完整（包括模式状态）
- [ ] 视频组件有 `playsInline` 属性
- [ ] Worker 有 R2 bucket 绑定
- [ ] 数据库存储的是相对路径

**测试流程**：
1. 桌面端测试（Chrome DevTools）
2. 移动端测试（iPhone + Safari）
3. 不同网络环境测试（WiFi / 4G）

---

## 8 SEO 自动化与预留规范 (SEO Automation & Metadata)

### 1. 数据库字段强制预留 (Supabase Schema)
在处理 YouTube 视频入库时，必须确保以下 SEO 相关字段被正确填充，严禁留空：
* **`meta_title`**: 格式为 `[Video Title] | English Dictation & Shadowing`。
* **`meta_description`**: 自动摘取 Whisper 转录文本的前 150 个字符，并去除换行符，作为页面描述。
* **`og_image`**: 直接复用 R2 的 `cover_path` 链接，用于社交媒体分享预览。

### 2. 自动化生成逻辑
* **Slug 优化**: 视频的 `slug` 必须基于标题生成（如 `elon-musk-speech`），严禁使用随机 ID 或 YouTube 原生字符。
* **Alt 文本生成**: 在存入数据库时，预设一个 `image_alt` 字段，内容为 `English learning dictation practice for [Video Title]`。

### 3. 代码层面的 SEO 实现
* **动态渲染**: 在 `[slug]/page.tsx` 中，必须使用 `generateMetadata` 函数，将上述数据库字段映射到页面的 `<title>` 和 `<meta name="description">` 标签中。
* **结构化数据**: 脚本应自动为每个视频页生成 `VideoObject` 的 JSON-LD 脚本块。


# ShadowHub 静态导出部署与维护指南 🚀

## 📌 项目定位
本项目采用 **Next.js 静态导出 (Static Export)** 方案，部署于 **Cloudflare Pages**，并结合 **Supabase** (数据库) 与 **Cloudflare R2** (素材存储) 实现。

---

## 🏗️ 资源架构与账号归属（环境隔离说明）

本项目涉及跨账号资源集成，开发与调试时必须遵循以下架构：

1. **B 账号 (域名与前端托管账号)**：
   - **托管服务**：Cloudflare Pages
   - **域名**：`shadowhub.app`
   - **职责**：主入口，负责前端代码构建、部署与展示。

2. **A 账号 (素材存储账号)**：
   - **托管服务**：Cloudflare R2 存储桶
   - **Bucket 名称**：`shadowhub`
   - **职责**：存放音频、视频、缩略图等所有素材文件
   - **访问方式**：通过 B 账号 Worker 跨账号访问

3. **B 账号 Worker (媒体代理)**：
   - **Worker 名称**：`morning-sound-a67b`（示例）
   - **Worker URL**：`morning-sound-a67b.modongla.workers.dev`
   - **职责**：
     - 接收 `media.shadowhub.app/*` 请求
     - 从 A 账号 R2 bucket 读取文件
     - 返回正确的 Content-Type 和 CORS 头
   - **前端访问**：统一使用 `https://media.shadowhub.app`

3. **Supabase (中枢数据库)**：
   - **项目 ID**：`cuxotlijjnxbsirpdkgr`
   - **职责**：存储素材元数据、练习文本及 R2 资源索引。

---

## 🛠 核心技术规范与解决方案

### 1. 环境变量与凭证处理 🔐
* **核心原则**：在静态导出模式下，`process.env` 无法实时读取，**必须硬编码**到客户端代码中。
* **关键凭证**：
    - **Supabase URL**: `https://cuxotlijjnxbsirpdkgr.supabase.co`
    - **Supabase Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (详见现有配置文件)
    - **R2 Worker URL**: `https://media.shadowhub.app`

### 2. 动态路由生成 (slug) 🛣️
* **问题**：`generateStaticParams` 预渲染失败会导致构建崩溃。
* **规范**：
    1. **必须包含 try-catch**：确保数据库连接失败时返回占位符。
    2. **必须包裹 Suspense**：练习页面组件必须被 `<Suspense fallback={...}>` 包裹。
    3. **Slug 统一化**：确保生成路径和跳转链接均使用 `titleToSlug(m.title)`。
* **代码参考**：
    ```typescript
    export async function generateStaticParams() {
      try {
        const { data } = await supabase.from('materials').select('id, title').limit(1000);
        return data.map(m => ({ slug: titleToSlug(m.title) }));
      } catch (e) {
        return [{ slug: 'placeholder' }];
      }
    }
    ```

### 3. 跨域资源 (CORS) 解决方案 🌐
* **问题**：R2 资源跨账号访问被拒绝。
* **解决**：在 A 账号 Worker 中注入跨域头。
* **代码参考**：
    ```javascript
    const headers = new Headers();
    // ...
    headers.set('Access-Control-Allow-Origin', '*'); // 或 '[https://shadowhub.app](https://shadowhub.app)'
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    return new Response(object.body, { headers });
    ```

---

## 📋 每次发布前的“检查清单” (Checklist)

1. [ ] **本地验证**：执行 `npm run build`。
2. [ ] **日志扫描**：
   - ❌ 严禁出现 `Export encountered errors`。
   - ❌ 严禁出现 `Error occurred prerendering`。
   - ✅ 必须看到 `✓ Generating static pages (X/X)`。
3. [ ] **文件确认**：确认 `out/` 目录下生成了对应的练习页面 HTML。

---

## 🆘 常见错误速查表

| 错误信息 | 原因 | 解决方法 |
| :--- | :--- | :--- |
| `placeholder.supabase.co` | 环境变量未嵌入 | 直接在代码中硬编码 URL 和 Key |
| `CORS policy` / `Failed to fetch` | Worker 缺少 CORS 头 | 在 A 账号 Worker 添加 `Access-Control-Allow-Origin` |
| `useSearchParams() ... suspense` | 缺少渲染边界 | 在页面组件层级补充 `<Suspense>` |
| `404 Not Found` (练习页) | Slug 格式不匹配 | 统一使用 `titleToSlug()` 处理 |
| `404 Not Found` (topics 链接) | topics 页面用 `titleToSlug()` 生成链接，但数据库存储完整 `slug` | 3 处统一使用 `material.slug \|\| titleToSlug(material.title)` |
| `Export encountered errors` | 预渲染失败 | 为 `generateStaticParams` 增加 try-catch |

---

> **给 Claude Code 的提示**：在执行任何修改前，请先读取此指南。严禁引入任何破坏静态导出机制的服务端逻辑。

---

# 🎨 用户体验标准规范 (UX Standards)

### 1. 音量一致性标准
* **统一音量**：所有音频/视频组件的初始音量必须设置为 **0.25**（25%）。
  - ✅ **原因**：1.0（100%）音量过大，0.25 音量适中温和
  - ✅ **范围**：AudioPlayer、VideoPlayer、ShadowingPanel 等所有播放器
* **代码示例**：
  ```typescript
  audio.volume = 0.25  // 固定音量，与 ShadowingPanel 保持一致
  ```

### 2. 加载状态 UI 规范
* **强制要求**：媒体加载时必须显示加载状态指示器。
* **原因**：使用 `preload="metadata"` 策略时，点击播放后才开始下载数据，有明显延迟。显示加载提示可缓解用户等待焦虑。
* **技术实现**：
  - 监听 `canplay`、`playing`、`waiting` 事件
  - 通过 `onLoadingChange` 回调通知父组件
  - 显示旋转图标 + "加载中..."文字提示
* **代码参考**：
  ```typescript
  const [audioLoading, setAudioLoading] = useState(false)

  // AudioPlayer 中
  audio.addEventListener('canplay', () => onLoadingChange?.(false))
  audio.addEventListener('playing', () => onLoadingChange?.(false))
  audio.addEventListener('waiting', () => onLoadingChange?.(true))

  // UI 中
  {audioLoading && (
    <div className="flex items-center gap-1 text-xs text-blue-600">
      <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <span>加载中...</span>
    </div>
  )}
  ```

### 3. 视频加载策略
* **大文件优化**：对于 10MB+ 视频文件，使用 `preload="metadata"` 避免移动端超时。
* **错误降级**：视频加载失败时，引导用户"使用封面图练习"。
* **关键属性组合**：
  ```tsx
  <video
    preload="metadata"
    crossOrigin="anonymous"
    playsInline
    onCanPlay={() => setError(null)}
    onError={() => setError('视频无法加载，请使用封面图练习')}
  />
  ```

---

# 🌐 路由与 SEO 规范 (Routing & SEO Specs)

### 0. 语言与本地化
- **纯英文站点**：项目不再支持多语言，所有 UI 文本为硬编码英文
- **已移除**：LanguageContext、LocalizedLink、LanguageSwitcher 等多语言组件（v16.0.0）
- **路由说明**：无语言前缀，所有页面使用英文路径

### 1. 标准 URL 结构（纯英文）
所有页面必须遵循以下层级，无语言前缀：
- **首页**：`/`
- **素材列表**：`/topics/`
- **分类详情页**：/topics/[category-slug] （显示该分类所有素材）
- **素材练习页**：`/topics/[category-slug]/[material-slug]/`
- **个人中心**：`/profile/`

### 2. 练习模式切换逻辑
- **单一 URL 原则**：听写（Dictation）与跟读（Shadowing）必须共用同一个素材页面。
- **状态区分**：通过 URL 查询参数 `?mode=dictation` 或 `?mode=shadowing` 进行切换。
- **技术实现**：使用 `useSearchParams` 监听模式，并在页面内通过 `Tab` 组件切换 UI，严禁创建物理上的新页面。

### 3. Slug 生成规范
- 🔴 **核心原则**：优先使用数据库中存储的 `slug` 字段，没有时才从 `title` 生成
- ❌ **禁止**：在任何地方直接使用 `titleToSlug(material.title)` 生成链接
- ✅ **正确写法**：`material.slug || titleToSlug(material.title)`
- 路径末尾必须带有斜杠 `/`（配合 `trailingSlash: true` 配置）。

**适用范围**：
- `src/app/topics/[category]/[slug]/page.tsx`：`generateStaticParams()` 必须查询 `slug` 字段
- `src/app/topics/[category]/[slug]/PracticePage.tsx`：材料查找逻辑必须优先用 `slug` 匹配
- `src/app/topics/page.tsx`：链接生成必须使用 `material.slug || titleToSlug(material.title)`

**原因**：数据库中的 `slug` 是完整且唯一的标识符（如 `telephone-conversations-can-i-speak-to-sally-easy-dialogue-role-play`），而从 `title` 生成的 slug 可能不完整或格式不同，导致 404 错误。

### 4. 动态生成要求 (SSG)
- `generateStaticParams` 必须同时返回 `category` 和 `slug`。
- 必须包含 `try-catch` 容错，构建失败时返回占位路径。

---

# 🔥 iPhone Safari 封面图加载问题（已解决）

## 📋 问题描述

**症状：**
- iPhone Safari 上素材页面封面图无法加载
- Network 面板显示状态为空（—）
- 桌面浏览器正常显示

---

## 🔍 根本原因

### 原因 1：Content-Type 不匹配（主要问题）

**问题：**
- Worker 根据文件扩展名 `.jpg` 返回 `Content-Type: image/jpeg`
- 但 R2 中实际存储的是 **WebP 格式**的图片
- **桌面浏览器**比较宽容，会尝试解析实际格式
- **iOS Safari** 严格按照 Content-Type 解析，收到 `image/jpeg` 但数据是 WebP 时直接拒绝

**验证方法：**
```bash
# 检查 Worker 返回的类型
curl -I "https://media.shadowhub.app/thumbnails/uWgaabEb_gQ.jpg" | grep content-type

# 检查实际文件格式
curl -s "https://media.shadowhub.app/thumbnails/uWgaabEb_gQ.jpg" | file -
```

---

### 原因 2：DNS 配置错误（关键问题）

**问题：**
- `media.shadowhub.app` 使用**灰色云朵**（DNS Only）
- 灰色云朵 = 不经过 Cloudflare 代理，直接穿透到源服务器
- 缺少 Cloudflare 的：
  - ✅ 正确的 HTTPS/SSL 处理
  - ✅ CDN 加速
  - ✅ 跨域请求优化
  - ✅ 连接稳定性保障

**iOS Safari 限制：**
- 对 HTTPS 资源的跨域请求有严格要求
- 必须经过 Cloudflare 代理才能正常工作

---

### 原因 3：前端缺少跨域属性

**问题：**
- `<img>` 标签缺少 `crossOrigin="anonymous"` 属性
- 导致浏览器无法正确处理跨域资源

---

## ✅ 解决方案

### 方案 1：修复 Worker Content-Type

**文件：** `worker-simple-ios.js`（B 账号 Worker）

**修改：**
```javascript
// 🔴 关键修复：thumbnails 目录统一返回 image/webp
// 因为实际上所有封面图都是 WebP 格式
if (path.startsWith('thumbnails/')) {
  headers.set('Content-Type', 'image/webp');
}
```

**部署到 B 账号 Worker：**
```bash
npx -y wrangler deploy worker-simple-ios.js --name morning-sound-a67b
```

---

### 方案 2：修改 DNS 配置（必须！）

**位置：** B 账号 Cloudflare Dashboard → DNS → 记录

**修改：** 把 `media.shadowhub.app` 从**灰色云朵**改成**橙色云朵**

| 字段 | 值 |
|------|-----|
| Type | CNAME |
| Name | media |
| 内容 | morning-sound-a67b.modongla.workers.dev |
| 状态 | **橙色云朵** ✅ |

---

### 方案 3：前端添加跨域属性

**文件：** `src/app/topics/page.tsx`

**修改：**
```tsx
<img
  crossOrigin="anonymous"  // ✅ 新增
  src={thumbnailUrl}
  alt={material.title}
  className="w-full h-full object-cover"
  ...
/>
```

---

## 📌 完整配置清单

### B 账号配置（域名账号）

**DNS 记录：**
```
Type: CNAME
Name: media
内容：morning-sound-a67b.modongla.workers.dev
状态：橙色云朵 ✅
```

**Worker 路由：**
```
路由：media.shadowhub.app/*
Zone：shadowhub.app
绑定 Worker：morning-sound-a67b ✅
```

**Worker 代码：**
- 正确返回 `Content-Type: image/webp`（thumbnails 目录）
- 从 A 账号 R2 bucket 读取文件
- 添加 CORS 头：`Access-Control-Allow-Origin: *`

---

### A 账号配置（素材账号）

**R2 Bucket：**
```
名称：shadowhub
内容：所有素材文件（thumbnails/, audio/, videos/）
```

---

## 🔄 请求流程

```
用户访问：https://media.shadowhub.app/thumbnails/xxx.jpg
    ↓
DNS 解析（橙色云朵）：CNAME → morning-sound-a67b.modongla.workers.dev
    ↓
Worker 路由匹配：media.shadowhub.app/*
    ↓
执行 B 账号 Worker（morning-sound-a67b）
    ↓
Worker 从 A 账号 R2 bucket (shadowhub) 读取文件
    ↓
返回图片（Content-Type: image/webp + CORS 头）
```

---

## 🎯 验证检查清单

**桌面端测试：**
- [ ] Chrome DevTools Network 面板检查图片返回 200
- [ ] Content-Type 为 `image/webp`（thumbnails）

**移动端测试：**
- [ ] iPhone Safari 访问页面
- [ ] 封面图正常显示
- [ ] Network 面板显示图片返回 200

**DNS 检查（B 账号）：**
- [ ] `media.shadowhub.app` 是橙色云朵
- [ ] 不使用灰色云朵（DNS Only）

**配置检查（B 账号）：**
- [ ] Worker 路由 `media.shadowhub.app/*` 已绑定
- [ ] Worker 代码正确返回 Content-Type

---

## 📌 关键要点

1. **DNS 必须是橙色云朵**：灰色云朵会导致 iOS Safari 无法加载图片
2. **Content-Type 必须正确**：thumbnails 目录返回 `image/webp`，不是 `image/jpeg`
3. **Worker 路由必须配置**：B 账号必须设置 `media.shadowhub.app/*` 路由
4. **前端必须添加 crossOrigin**：所有 `<img>` 标签需要 `crossOrigin="anonymous"`

---

# 🔊 音频尾音截断问题（已解决）

## 📋 问题描述

**症状：**
- 练习时音频无法完整播放到句子结束
- 句尾单词的辅音（如 /ch/, /t/, /s/）被截断
- 例如："beach" 变成 "bea"，"what" 变成 "wha"

**控制台日志示例：**
```
currentTime: 61.490
endNum: 61.54
实际停止时尾音已被截断
```

---

## 🔍 根本原因

### 原因 1：Whisper 数据源系统性提前

**问题：**
- Whisper 转录的 `endTime` 系统性偏早
- 未包含完整的尾音部分（辅音需要更长的发音时间）
- 导致按照 `endTime` 停止时，尾音已被截断

### 原因 2：事件触发延迟

**问题：**
- `timeupdate` 事件每 250ms 触发一次
- 从检测到停止条件 → 执行 `pause()` → 实际停止有 ~120ms 延迟
- 在这个延迟期间音频继续播放，但停止判定已经结束

### 原因 3：停止判定不够精确

**问题：**
- 即使设置了提前停止（如提前 50ms），也无法补偿 120ms 的执行延迟
- 导致实际停止时间远超预期

---

## ✅ 解决方案

### 核心改进

**文件：** `src/components/AudioPlayer.tsx`

**1. 高频停止检查**
```typescript
// 🔴 使用 requestAnimationFrame 替代 timeupdate
// 检查频率：250ms → 16ms
const checkEndTime = () => {
  if (audio.currentTime >= endNum - END_COMPENSATION) {
    audio.pause()
    audio.currentTime = startNum
    cancelAnimationFrame(rafIdRef.current)
  } else {
    rafIdRef.current = requestAnimationFrame(checkEndTime)
  }
}

// 播放开始时启动
audio.play().then(() => {
  rafIdRef.current = requestAnimationFrame(checkEndTime)
})
```

**2. 向后延伸补偿**
```typescript
const START_COMPENSATION = 0.03   // 30ms 起始避让
const END_COMPENSATION = -0.2     // 200ms 向后延伸

// 停止条件：currentTime >= endNum - (-0.2)
// 等价于：currentTime >= endNum + 0.2
```

**3. 状态重置**
```typescript
audio.pause()
audio.currentTime = startNum  // 重置到起始点，避免悬停
```

---

## 📊 技术对比

| 方案 | 检查频率 | 执行延迟 | 补偿值 | 效果 |
|------|---------|---------|--------|------|
| **旧方案** (timeupdate) | ~250ms | ~120ms | 0.05s | ❌ 尾音截断 |
| **新方案** (rAF) | ~16ms | <16ms | 0.2s | ✅ 完整播放 |

---

## ⚠️ 已知限制

1. **数据质量**：部分素材的 Whisper 时间戳偏早严重，200ms 补偿仍不足
   - **解决方案**：重新转录这些素材

2. **轻微重叠**：200ms 延伸可能引起轻微句子重叠
   - **影响范围**：可接受范围，不影响学习效果

---

## 🎯 验证方法

测试包含尾音辅音的句子：
- "beach"（/tʃ/ 音）
- "what"（/t/ 音）
- "cats"（/s/ 音）

控制台应显示：
```
实际停止时间 ≈ endNum + 0.2
```

---

# 🎥 视频黑屏 + AbortError 问题（已解决）

## 📋 问题描述

**症状：**
- 移动端视频黑屏，无法播放
- 控制台显示 `AbortError` 错误
- Range 请求失败（10001 错误）

---

## 🔍 根本原因

### 原因 1：Range 参数传递错误

**问题：**
- 当没有 Range 请求时，传递了 `{ range: null }` 给 R2
- 导致 R2 返回 10001 错误
- 视频无法正常加载

**错误代码：**
```javascript
// ❌ 错误：rangeHeader 可能是 null
const object = await env.R2.get(path, {
  range: rangeHeader
});
```

### 原因 2：跨账号 R2 访问问题

**问题：**
- Cloudflare R2 不支持跨账号直接访问
- B 账号 Worker 无法绑定 A 账号的 R2 bucket

---

## ✅ 解决方案

### A 账号修复 (Suxiaoshuang2020@gmail.com)

**文件：** `/Users/a/dictation/workers/worker-simple-ios-range.js`
**Worker：** `r2-proxy`

**修复内容：**
```javascript
// ✅ 正确：只有在有 Range 头时才添加 range 参数
let requestOptions = {};
if (rangeHeader) {
  requestOptions = { range: rangeHeader };
}
const object = await env.R2.get(path, requestOptions);
```

**部署命令：**
```bash
# 切换到 A 账号
npx -y wrangler login
npx -y wrangler deploy worker-simple-ios-range.js --name r2-proxy
```

---

### B 账号修复 (modongla@3dpea.com)

**文件：** `/Users/a/dictation/worker-simple-ios.js`
**Worker：** `morning-sound-a67b`

**修复内容：**
```javascript
// 通过 HTTP 访问 A 账号的 R2 公开 URL（跨账号解决方案）
const A_ACCOUNT_R2_URL = 'https://pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev';
const r2Url = `${A_ACCOUNT_R2_URL}/${path}`;
const response = await fetch(r2Request);
```

**部署命令：**
```bash
# 切换到 B 账号
npx -y wrangler login
npx -y wrangler deploy worker-simple-ios.js --name morning-sound-a67b
```

---

## 🏗️ 最终架构

```
用户 → B账号worker (morning-sound-a67b) → A账号R2公开URL
```

**特性：**
- ✅ 流式传输（使用 `response.body`）
- ✅ 无中间缓存
- ✅ 支持 Range 请求
- ✅ 完整 CORS 头

---

## 📌 关键要点

1. **避免传递 null 参数**：R2.get() 的 options 只有在有值时才传递
2. **跨账号访问方案**：使用 HTTP 访问公开 URL，而非 R2 bucket 绑定
3. **流式传输**：直接传递 `response.body`，不缓存整个文件
4. **完整 CORS 头**：确保所有错误响应也包含 CORS 头

---

# 🚀 封面图加载性能优化

## 📋 优化目标

**问题背景：**
- 点击"查看更多"后，图片出现乱序加载（排在后面的先显示）
- 一次性渲染所有 DOM，导致性能问题
- 图片加载缺乏优先级控制，首屏 LCP 性能不佳

**优化效果：**
- ✅ 按顺序加载图片，避免乱序
- ✅ 分片渲染，避免 DOM 爆炸
- ✅ 优先级分层，提升首屏性能
- ✅ 淡入动画，视觉平滑

---

## 🔧 解决方案

### 1. 优先级分层 (Fetch Priority)

**实现逻辑：** 根据全局索引计算图片优先级

```typescript
const getPriorityConfig = () => {
  if (globalIndex < 8) {
    // 第一梯队：高优先级，立即加载
    return { fetchPriority: "high", loading: "eager" }
  } else if (globalIndex < 16) {
    // 第二梯队：低优先级但立即加载
    return { fetchPriority: "low", loading: "eager" }
  } else {
    // 第三梯队：懒加载
    return { fetchPriority: "auto", loading: "lazy" }
  }
}
```

**参数说明：**
| 梯队 | 索引范围 | fetchPriority | loading | 说明 |
|------|----------|----------------|---------|------|
| 第一梯队 | 0-7 | high | eager | 最高优先级，确保 LCP |
| 第二梯队 | 8-15 | low | eager | 次要优先级 |
| 第三梯队 | 16+ | auto | lazy | 懒加载，节省带宽 |

---

### 2. 强制顺序预加载

**实现逻辑：** 按分类顺序预加载每个分类的第二张卡片（索引 1）

```typescript
// 触发时机：首屏所有图片加载完成后
if (firstScreenLoaded && preloadedImages.size === 0) {
  const preloadTargets: Array<{ id: string; url: string }> = []

  // 按分类顺序预加载每个分类的第二张卡片
  Object.entries(materialsByCategory).forEach(([categoryId, categoryMaterials]) => {
    const secondCard = categoryMaterials[1]  // 索引 1 = 第二张卡片
    if (secondCard && secondCard.thumbnail_path) {
      preloadTargets.push({
        id: secondCard.id,
        url: getThumbnailUrl(secondCard.thumbnail_path)
      })
    }
  })

  // 顺序预加载：每次加载一张，间隔 80ms
  const preloadNext = () => {
    if (currentIndex >= preloadTargets.length) return

    const { id, url } = preloadTargets[currentIndex]
    const img = new Image()

    img.onload = () => {
      setPreloadedImages(prev => new Set([...prev, id]))
      setTimeout(() => {
        currentIndex++
        preloadNext()  // 顺序加载下一张
      }, 80) // 每张图间隔 80ms
    }

    img.onerror = () => {
      // 失败也继续下一张
      setPreloadedImages(prev => new Set([...prev, id]))
      setTimeout(() => {
        currentIndex++
        preloadNext()
      }, 80)
    }

    img.src = url
  }

  preloadNext()
}
```

**关键点：**
- **预加载目标**：每个分类的第二张卡片（索引 1），而非跨分类全局索引
- **预加载顺序**：按分类顺序（日常生活 → YouTube Vlog → ...）
- 使用 `setTimeout` 人为控制加载顺序，避免浏览器并行请求导致的乱序
- 间隔 80ms，避免抢占带宽

---

### 3. 分片渲染 (Chunked Rendering)

**实现逻辑：** 展开时分批增加可见图片数量

```typescript
// 未展开：显示首屏数量
const defaultCount = getFirstScreenCount()
const maxVisible = visibleImageCount[categoryId] || defaultCount

const displayedMaterials = isExpanded
  ? categoryMaterials.slice(0, maxVisible)
  : categoryMaterials.slice(0, defaultCount)

// 展开后分 3 批增加
setTimeout(() => {
  setVisibleImageCount(prev => ({
    ...prev,
    [categoryId]: firstScreenCount + 8
  }))
}, 100) // 100ms 后显示第一批

setTimeout(() => {
  setVisibleImageCount(prev => ({
    ...prev,
    [categoryId]: firstScreenCount + 16
  }))
}, 300) // 300ms 后显示第二批

setTimeout(() => {
  setVisibleImageCount(prev => ({
    ...prev,
    [categoryId]: categoryMaterials.length
  }))
}, 600) // 600ms 后显示全部
```

**效果：**
- 避免一次性渲染所有 DOM
- 平滑展开，视觉流畅
- 减少首屏渲染压力

---

### 4. CSS 占位优化

**实现逻辑：** 固定宽高比 + 淡入动画

```typescript
// 固定宽高比
<div className="w-full relative aspect-video ...">

// 淡入动画
<img
  className={`w-full h-full object-cover transition-opacity duration-300 ${
    imageLoaded || isPreloaded ? 'opacity-100' : 'opacity-0'
  `}
  ...
/>
```

**效果：**
- 防止布局偏移（CLS）
- 平滑的淡入效果
- 即使有加载差异，视觉上也平滑

---

## 📊 优化参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 首屏优先级 | Index 0-7 | `fetchPriority="high"`, `loading="eager"` |
| 次要优先级 | Index 8-15 | `fetchPriority="low"`, `loading="eager"` |
| 懒加载阈值 | Index 16+ | `loading="lazy"` |
| 预加载目标 | 每个分类的第 2 张卡片 | 索引 1 |
| 预加载间隔 | 80ms | 顺序加载，避免乱序 |
| 分片渲染 | 3 批 | 100ms → 300ms → 600ms |

## 🖥️ 首屏可见数量（响应式）

| 屏幕宽度 | 首屏可见数量 |
|---------|-------------|
| < 640px（移动端） | 1 张 |
| < 1024px（小屏） | 2 张 |
| < 1280px（中屏） | 3 张 |
| ≥ 1280px（大屏） | 4 张 |

---

## 🎯 实施检查清单

**代码实现：**
- [x] 添加 `visibleImageCount` 状态（分片渲染）
- [x] 添加 `preloadedImages` 状态（预加载跟踪）
- [x] 实现优先级分层计算函数
- [x] 实现顺序预加载逻辑
- [x] 添加淡入动画 CSS 类

**性能验证：**
- [ ] 首屏 LCP < 2.5s
- [ ] 图片按顺序加载（无乱序）
- [ ] 展开时平滑过渡（无 DOM 爆炸）
- [ ] 预加载图片瞬间显示

**移动端测试：**
- [ ] iPhone Safari 访问页面
- [ ] 首屏图片快速加载
- [ ] 展开后图片按顺序显示
- [ ] 淡入动画流畅

---

## 📌 关键要点

1. **优先级必须分层**：首屏图片必须有最高优先级
2. **预加载必须有序**：使用 setTimeout 控制加载顺序
3. **渲染必须分片**：避免一次性渲染所有 DOM
4. **动画必须平滑**：淡入动画提升用户体验

---

# 🔊 影子跟读判断逻辑 (Shadowing Pronunciation Evaluation)

## 📋 核心算法

### 1. 文本预处理标准化
- **转小写**：统一大小写格式
- **移除标点**：`, . ! ? ; : '"` 等
- **连字符处理**：强制替换为空格（`well-known` → `well known`）
- **数字统一**：`zero` → `0`, `one` → `1`, `twenty` → `20`
- **专有名词白名单**：首字母大写的词（Marco、London）自动判定为正确

### 2. 三轮贪婪匹配算法

**第一轮：核心词优先匹配（锚点对齐）**
- 优先匹配长度 ≥ 4 的名词、动词、形容词
- 专有名词自动判定为正确
- 在识别结果中全局搜索

**第二轮：剩余词贪婪匹配（允许跳跃）**
- 跳过脏数据（如识别错误的 `lakes`）
- 继续匹配后续正确单词
- 优先选择高置信度、其次位置接近的匹配

**第三轮：连读合并探测（Linking Merge Detection）**
- 检测相邻的未匹配短词（长度 ≤ 3）
- 尝试合并（`it` + `is` → `itis`）
- 在识别结果中搜索合并后的词
- 防止用户读出完美连读却被判为"漏读"

### 3. 发音黑名单机制
- **强制不匹配**：`his` vs `her`、`is` vs `are`（发音完全不同）
- **允许模糊匹配**：`lived` vs `left`、`there` vs `dear`（Metaphone 相似度高）
- **只允许发音极其接近的词**通过模糊匹配

### 4. 单词级严格比对
- **置信度 ≥ 85%** → 完全匹配（深灰色）
- **置信度 40% - 85%** → 接近匹配（灰色）
- **置信度 < 40%** → 标记为错误（橙色）

### 5. 文案分级矩阵
| 级别 | 触发条件 | 文案 | 图标 | 颜色 |
|------|----------|------|------|------|
| **Perfect** | 单词匹配率 100% | 太棒了！发音非常完美 | 🌟 | 绿色 |
| **Good** | 单词匹配率 ≥ 80% | 很不错！部分单词发音可以更精准 | 👍 | 绿色 |
| **Medium** | 单词匹配率 ≥ 50% | 大部分词都读对了，继续加油！ | ✨ | 黄色 |
| **Keep Trying** | 句子相似度 ≥ 70% 但单词匹配率 < 50% | 读得不错，建议针对橙色单词多加练习 | 💪 | 橙色 |
| **Fail** | 句子相似度 < 50% | 没关系，再试一次，你可以的！ | 😅 | 红色 |

### 6. 视觉反馈原则
- **只显示原文**，不插入用户读错的词
- 读错的词变为橙色或淡灰色
- 句子相似度 ≥ 70% 且无错误词 → 只显示绿色原文
- 有错误词 → 显示详细对比（橙色/灰色标记）

## 🔧 关键文件
- `src/components/ShadowingPanel.tsx` - 影子跟读组件
- `src/lib/audio-checker.ts` - 智能语音比对算法

## 📊 常见问题

### Q: 为什么 `his` 读成 `her` 会判错？
A: 这两个词发音完全不同，在发音黑名单中，强制不匹配。

### Q: 连读为什么会判对？
A: 第三轮连读合并探测会自动检测 `it` + `is` → `itis`，在识别结果中搜索合并后的词。

### Q: 读对大部分词，为什么还是 Fail？
A: 检查单词匹配率是否 ≥ 50%。如果 ≥ 50% 会给 Medium（黄色）评价，不是 Fail。

### Q: 专有名词为什么总是判对？
A: 首字母大写的词（如 Marco、London）自动加入白名单，只要用户在该位置有发音就判定为正确。

---

## 🎯 /topics 路由重构说明（V17）

### 路由结构

```
/topics                              # 聚合页（预览所有分类）
/topics/[category]                   # 分类详情页（显示该分类所有素材）
/topics/[category]/[slug]            # 素材练习页（听写/影子跟读）
```

### URL Slug 与数据库字段映射规范

**⚠️ 关键规则**：URL 中的 slug 是英文（如 `daily-life`），数据库 `materials.category` 字段存储的是中文（如 `日常生活`）。

#### 映射转换逻辑

**1. 中文分类名 → Slug（生成链接时）**
```typescript
import { categoryToSlug } from '@/lib/utils/category'

// 数据库存储: "日常生活"
// URL 路径: "daily-life"
const slug = categoryToSlug("日常生活")  // => "daily-life"
```

**2. Slug → 中文分类名（查询数据库时）**
```typescript
import { slugToCategory } from '@/lib/utils/category'

// URL 参数: "daily-life"
// 数据库查询: "日常生活"
const categoryName = slugToCategory("daily-life")  // => "日常生活"
```

**3. 完整映射表（src/lib/utils/category.ts）**
- `CATEGORY_SLUG_MAP`: 中文 → Slug
- `SLUG_CATEGORY_MAP`: Slug → 中文
- `CATEGORY_METADATA`: 完整元数据（含图标、颜色、描述）

### 聚合页性能约束

**规则**：`/topics` 页面每个分类**仅加载前 4 个素材**作为预览。

#### 实现方式
```typescript
// 并行查询所有分类，每个分类 limit(4)
const promises = CATEGORIES.map(async (category) => {
  const { data } = await supabase
    .from('materials')
    .select('*')
    .eq('category', category.id)
    .order('title')
    .limit(4)  // 🔴 关键：仅取前4个
})
```

#### 跳转逻辑
- **分类标题**（如 "Daily Life (Preview)"）→ 可点击，跳转到 `/topics/[category]`
- **"View All →" 按钮** → 跳转到 `/topics/[category]`
- **素材卡片按钮**（Dictation/Shadowing）→ 跳转到 `/topics/[category]/[slug]?mode=xxx`

### 分类详情页功能

**路径**：`/topics/[category]`

**核心功能**：
1. 使用 `slugToCategory(categorySlug)` 获取中文分类名
2. 查询该分类下的**所有**素材
3. 客户端分页：每页 20 个素材
4. 难度筛选：通过 `DifficultySelector` 组件

#### 关键代码片段

```typescript
// 🔴 正确做法：先用 slugToCategory 转换
const categoryName = slugToCategory(categorySlug)  // "daily-life" => "日常生活"

const { data } = await supabase
  .from('materials')
  .select('*')
  .eq('category', categoryName)  // 使用中文字段名查询
  .order('title')
```

#### 常见错误

❌ **错误做法**：
```typescript
// 使用英文分类名直接查询（匹配不到数据库中的中文记录）
const { data } = await supabase
  .from('materials')
  .eq('category', "Daily Life")  // ❌ 数据库中是"日常生活"
```

✅ **正确做法**：
```typescript
// 先转换 slug 到中文分类名
const categoryName = slugToCategory(categorySlug)
const { data } = await supabase
  .from('materials')
  .eq('category', categoryName)  // ✅ "日常生活"
```

### 文件清单

#### 新建文件
- `src/components/topics/CategoryCard.tsx` - 分类卡片组件（暂未使用）
- `src/components/topics/CategoryPage.tsx` - 分类详情页客户端组件
- `src/app/topics/[category]/page.tsx` - 分类详情页服务端路由

#### 修改文件
- `src/app/topics/page.tsx` - 聚合页（限制每分类4个素材，使用页面跳转）
- `src/lib/utils/category.ts` - 添加 `CATEGORY_METADATA` 和辅助函数

#### 保持不变
- `src/app/topics/[category]/[slug]/page.tsx` - 素材练习页
- `src/components/topics/MaterialCard.tsx` - 素材卡片组件

### 性能优化效果

- **聚合页 DOM 节点**：从 1500+ 降至 ~120（减少 92%）
- **首屏加载时间**：从 3-5秒 降至 <1秒
- **数据加载量**：每个分类仅加载 4 个素材（而非全量）

### 浏览器兼容性

- 使用 `output: 'export'` 模式
- 所有路由预渲染为静态 HTML
- 客户端分页无需 API 路由


---

# 🎧 纯音频素材处理规范

## 📋 默认封面图规范

**定义**：纯音频素材指 `video_path` 为 `null`，仅有 `audio_path` 的素材。

**默认封面**：
- **路径**：`thumbnails/culture-history-cover.jpg`
- **尺寸**：800x450 像素
- **大小**：20KB 以下（当前 9.2KB）
- **格式**：JPG
- **用途**：所有没有自定义封面的纯音频素材

**批量更新脚本**：
```python
# 查找所有没有封面图的纯音频素材
result = supabase.table('materials').select('*').is_('video_path', None).is_('thumbnail_path', None).execute()

# 批量更新默认封面
for m in result.data:
    supabase.table('materials').update({
        'thumbnail_path': 'thumbnails/culture-history-cover.jpg'
    }).eq('id', m['id']).execute()
```

**特殊分类封面**：
- IELTS Listening：`thumbnails/ielts-cover.jpg`
- Culture & History：`thumbnails/culture-history-cover.jpg`

---

# 🎧 IELTS Listening 素材处理规范

## 📋 分类特征

**数据来源**：Cambridge IELTS 系列听力测试
**素材结构**：每套测试包含 4 个 Part（Part 1-4）
**音频特点**：时间戳精准，无需大幅度尾音补偿

## 🔧 批量导入流程

### 1. 准备工作
- 创建新分类：`src/lib/utils/category.ts` 添加 "IELTS Listening"
- 更新 topics 页面：`src/app/topics/page.tsx` 添加到 CATEGORIES 数组（最后一位）

### 2. 批量导入
```bash
# 脚本：scripts/ingest_bulk.py
# 输入：urls.txt（每行一个 Engnovate URL）
python3 scripts/ingest_bulk.py
```

### 3. 导入后处理

#### A. 难度分级
根据 Part 内容特征分级：
- **Part 1**（日常对话）：B1
- **Part 2**（学术内容）：B2
- **Part 3-4**（学术内容）：C1

#### B. 标题优化
- 原标题：`Cambridge IELTS 10 Academic Listening Test 1 Part 1`
- 优化后：`Cam 10 Academic Listening Test 1 Part 1`
- 同步更新 slug 字段
- Slug 格式统一：cam-x-academic-listening-test-y-part-z

#### C. 统一封面
- 压缩封面图至 20KB 以下
- 上传至 R2：`thumbnails/ielts-cover.jpg`
- 批量更新数据库：`thumbnail_path = 'thumbnails/ielts-cover.jpg'`

## 🎛️ 音频播放配置

### endBuffer 参数

**问题背景**：
- 其他素材需要 -0.2s（200ms 向后延伸）以避免尾音截断
- IELTS 素材时间戳精准，200ms 会导致句子重叠

**解决方案**：
在 `PracticePage.tsx` 中动态设置 `endBuffer`：

```typescript
const getEndBuffer = (): number => {
  if (material?.category === 'IELTS Listening') {
    return 0.05  // 50ms，精准停止
  }
  return -0.2   // 200ms，避免尾音截断
}
```

**配置对比**：
| 分类 | endBuffer | 效果 |
|------|-----------|------|
| IELTS Listening | +0.05s | 精准停止，避免重叠 |
| 其他分类 | -0.2s | 延伸播放，避免截断 |

## 📝 数据库字段

```
category: 'IELTS Listening'
difficulty: 'B1' 或 'B2'（根据 Part）
title: 'Cam X Academic Listening Test Y Part Z'
slug: 'cam-x-academic-listening-test-y-part-z'
thumbnail_path: 'thumbnails/ielts-cover.jpg'
audio_path: 'audio/{slug}.mp3'
```

## ✅ 检查清单

导入完成后检查：
- [ ] 分类已在 `/topics` 页面显示（最后一位）
- [ ] 难度标签正确（Part 1 = B1，Part 2-4 = B2）
- [ ] 标题已缩写（Cambridge IELTS → Cam）
- [ ] 封面图统一显示
- [ ] 播放时句子不重叠、不截断
- [ ] 跳转链接正常（`/topics/ielts-listening/{slug}/`）

---

# 🎬 YouTube 视频素材集成规范 (V18)

## 📋 双源驱动架构

### 数据库字段扩展

| 字段 | 类型 | 说明 |
|------|------|------|
| `source_type` | TEXT | 素材来源：'r2' 或 'youtube' |
| `youtube_id` | TEXT | YouTube 视频 ID（source_type=youtube 时） |
| `audio_path` | TEXT | R2 为路径，YouTube 为 `youtube:{video_id}` |
| `audio_size` | INTEGER | YouTube 素材设为 0（占位） |
| `video_path` | TEXT | R2 视频路径，YouTube 为 null |

**数据库迁移**：`supabase/migrations/add_source_type_and_youtube.sql`

---

## 🎭 播放器路由逻辑

### UniversalPlayer 自动选择

```typescript
// src/components/UniversalPlayer.tsx
source_type='youtube' + youtube_id → YouTubePlayer (Iframe API)
source_type='r2' + video_path → VideoPlayer
source_type='r2' → AudioPlayer
```

### YouTubePlayer 双模式

**自由播放模式**：
- 用户点击视频播放按钮 → 完整观看视频（不循环）
- 适用于：预览、复习场景

**练习模式**：
- 用户点击练习区域播放按钮 → 循环播放当前句子
- 适用于：听写、影子跟读练习

**实现方式**：
```typescript
// src/components/YouTubePlayer.tsx
practiceMode={hasStarted && autoPlayTrigger > 0}
// 只在 practiceMode=true 时检查句子结束时间并循环
```

---

## 🎤 Shadowing 模式下的 YouTube 解耦逻辑

### 核心原则

**解耦播放与录音**：YouTube 模式下的 Shadowing 练习与 R2 素材完全一致

| 操作 | 中栏播放按钮 | Start Recording 按钮 |
|------|-------------|---------------------|
| **功能** | 仅控制视频播放 | 仅控制录音开始 |
| **互不影响** | 不触发录音 | 不触发视频播放 |

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    PracticePage.tsx                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────┐ │
│  │  YouTubePlayer  │  │   AudioPlayer   │  │ShadowingPanel│ │
│  │   (仅 YouTube)  │  │   (仅 R2)       │  │   (通用)    │ │
│  │  - 视频播放      │  │  - 音频播放      │  │  - 录音控制  │ │
│  │  - practiceMode │  │  - endBuffer    │  │  - 独立录音  │ │
│  │  - end-0.5s     │  │  - end-0.2s     │  │             │ │
│  └─────────────────┘  └─────────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────┘
         YouTube 素材            R2 素材         通用组件
```

**关键区别：**
- **YouTube 素材**：使用 `YouTubePlayer` + `practiceMode`，播放到 `end - 0.5s` 自动暂停
- **R2 素材**：使用 `AudioPlayer` + `endBuffer`，播放到 `end - 0.2s`（或 `0.05s` for IELTS）自动暂停
- **两种素材互不影响**，各自有独立的播放控制逻辑

### 状态流转

**R2 素材流程：**
```
用户点击播放 → AudioPlayer 播放音频 → 播放到 end-0.5s 停止
                                        ↓
                              ShadowingPanel 独立工作
                                        ↓
                        用户手动点 Start Recording → 开始录音
```

**YouTube 素材流程：**
```
用户点击播放 → YouTubePlayer 播放视频 → 播放到 end-0.5s 停止
                                           ↓
                                 ShadowingPanel 独立工作
                                           ↓
                           用户手动点 Start Recording → 开始录音
```

### 实现细节

**1. YouTube 素材不需要 audioSrc**
```typescript
// PracticePage.tsx - ShadowingPanel 渲染
const playerInfo = getPlayerInfo(material)
const isR2Material = playerInfo.type === 'r2'

<ShadowingPanel
  sentence={currentSentence}
  audioSrc={isR2Material ? playerInfo.audioSrc : undefined}  // YouTube 传入 undefined
  onNext={handleNext}
  onComplete={handleShadowingComplete}
  isLastSentence={isLastSentence}
/>
```

**2. YouTube 视频播放独立控制（仅 YouTube 素材）**
```typescript
// YouTubePlayer.tsx - 播放到句子结束自动暂停
// ⚠️ 注意：此逻辑仅用于 YouTube 素材，R2 素材使用 AudioPlayer 的独立逻辑
if (isPracticeModeRef.current) {  // 只在 practiceMode=true 时生效
  if (currentTime >= endTime - endBuffer) {
    playerRef.current.pauseVideo()
    playerRef.current.seekTo(startTime, true)  // 重置到开头
    isPracticeModeRef.current = false
    // 不触发录音，仅暂停视频
  }
}
```

**对比：R2 素材的播放控制（不受影响）**
```typescript
// AudioPlayer.tsx - R2 素材使用独立的 endBuffer 逻辑
// ⚠️ 注意：此逻辑仅用于 R2 素材，YouTube 素材不受影响
const checkEndTime = () => {
  if (audio.currentTime >= endNum - endBuffer) {
    audio.pause()
    audio.currentTime = startNum
    // R2 素材使用不同的 endBuffer 值（-0.2s 或 0.05s）
  }
}
```

**3. 录音独立控制**
```typescript
// ShadowingPanel.tsx - Start Recording 按钮独立工作
const startRecording = () => {
  // 仅启动录音，不触发视频播放
  recognitionRef.current.start()
  mediaRecorderRef.current.start()
  setIsRecording(true)
}
```

**4. 左侧视频隔离**
```typescript
// YouTubePlayer.tsx - 左侧播放器完全独立
- 用户点击播放/暂停/拖动 → 只影响视频本身
- 不触发中栏练习状态
- 不触发录音功能
- 仅作为参考播放器使用
```

### 关键文件

| 文件 | 作用 | 适用素材 | 关键逻辑 |
|------|------|---------|----------|
| `YouTubePlayer.tsx` | YouTube Iframe 播放器 | **仅 YouTube** | `practiceMode` 控制句子循环，播放到 `end - 0.5s` 自动暂停 |
| `AudioPlayer.tsx` | 音频播放器 | **仅 R2** | `endBuffer` 控制播放停止（-0.2s 或 0.05s），不受本次改动影响 |
| `VideoPlayer.tsx` | 视频播放器 | **仅 R2** | 独立的播放控制逻辑，不受本次改动影响 |
| `ShadowingPanel.tsx` | 影子跟读录音组件 | **通用** | `audioSrc` 可选，YouTube 模式下为 `undefined` |
| `PracticePage.tsx` | 练习页面状态管理 | **通用** | 根据 `source_type` 选择播放器和控制逻辑 |

### 本次改动范围

✅ **仅影响 YouTube 素材的 Shadowing 模式**
- YouTube 添加 `practiceMode` 控制
- YouTube 播放到 `end - 0.5s` 自动暂停
- ShadowingPanel 支持 `audioSrc` 可选

❌ **不影响 R2 素材**
- AudioPlayer 逻辑保持不变
- VideoPlayer 逻辑保持不变
- R2 素材的 `endBuffer` 参数保持不变

### 效果验证

| 测试用例 | 预期行为 |
|---------|----------|
| **点击中栏播放** | YouTube 视频播放到 end-0.5s 自动停止 ✅<br>录音机无动作（保持停止状态） ✅ |
| **手动点 Start Recording** | 开始录音 ✅<br>视频保持暂停（不被触发） ✅ |
| **左侧视频操作** | 不影响中栏练习状态或录音功能 ✅ |
| **播放结束自动停止** | 视频播完单句自动停止，回到开头 ✅ |

### 设计优势

1. **用户体验一致**：YouTube 和 R2 素材的操作逻辑完全一致
2. **功能解耦**：播放和录音互不干扰，用户可自由控制
3. **代码简洁**：不需要复杂的状态同步逻辑
4. **易于维护**：各组件职责清晰，修改影响范围小

---

## 📥 字幕抓取工具

### 推荐工具：yt-dlp

**脚本**：`scripts/ingest_youtube_ytdlp.py`

**优势**：
- 直接通过 API 获取字幕，绕过 PO Token 限制
- 无需浏览器，速度快
- 稳定可靠

**使用方法**：
```bash
python3 scripts/ingest_youtube_ytdlp.py "https://www.youtube.com/watch?v=VIDEO_ID"
python3 scripts/ingest_youtube_ytdlp.py "URL" --category "Education" --difficulty "B1"
```

### 备选方案：Playwright (Fallback)

**脚本**：`scripts/ingest_youtube_with_playwright.py`

**使用场景**：
- yt-dlp 因 PO Token 限制失效时
- 需要模拟人工操作时

**注意**：无论使用哪个工具，获取的原始时间戳都必须经过 0.5s 强切逻辑。

---

## 🔪 智能断句算法

### 输入：YouTube 原始字幕

- 来源：yt-dlp 或 Playwright DOM 抓取
- 特征：通常 70-100+ 条细粒度片段
- 问题：存在严重的末尾溢出（听到下一句开头）

### 断句规则（遵循 Whisper guide）

1. **标点强制切分**：`?.!` 后断句
2. **逗号+停顿切分**：`,` + 停顿 > 0.8s
3. **停顿强制切分**：任何停顿 > 0.8s

### 输出：合理句子

- 数量：通常 40-50 条
- 特征：语义完整，长度适中

---

## ⏱️ 时间戳处理规范

### 核心公式（必须遵守）

```python
# 末端强切（0.5s）+ 极短句保底（0.2s）
final_end_time = max(start_time + 0.2, original_end_time - 0.5)

# 强制真空带（0.2s）
if (next_start - current_end) < 0.2:
    current_end = next_start - 0.2
```

### 参数说明

| 参数 | 值 | 说明 |
|------|-----|------|
| **核心缩进** | 0.5s | 每句结尾减少 500ms，确保断句干净 |
| **最小时长** | 0.2s | 防止极短句消失 |
| **强制真空带** | 0.2s | 确保句间至少 200ms 静音期 |

### 效果验证

```
句[1]: 0.11s - 8.83s ━━━━━━━━━━━━━━━━━━░░  (间隔 0.50s) ✅
                                        ↓
句[2]: 9.33s - 13.63s ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  (间隔 4.36s) ✅
```

**预期效果**：
- ✅ 听不到下一句的开头（避免"炸音"）
- ✅ 句子播放完整
- ✅ 句间有清晰停顿

---

## 📦 入库数据结构

### 完整示例

```javascript
{
  source_type: 'youtube',
  youtube_id: 'zjjL9yaFrFc',
  audio_path: 'youtube:zjjL9yaFrFc',
  audio_size: 0,
  video_path: null,
  thumbnail_path: 'https://i.ytimg.com/vi/zjjL9yaFrFc/maxresdefault.jpg',
  duration: 254,
  transcript: [
    {
      id: 1,
      text: "Earth zooms around the sun at 110,000 kph, but what if it just...stopped?",
      startTime: 0.11,
      endTime: 8.83,  // 已应用末端强切
      translation: null
    },
    // ... 更多句子
  ]
}
```

### SEO 字段（自动生成）

- `meta_title`: `{title} | English Dictation & Shadowing`
- `meta_description`: 前 10 条字幕拼接（150 字符）
- `og_image`: 封面图 URL

---

## ✅ 测试检查清单

### YouTube 素材测试

- [ ] Iframe 正常加载
- [ ] 点击视频播放按钮可完整观看
- [ ] 点击练习播放按钮循环播放当前句
- [ ] 断句干净，无"炸音"
- [ ] 点击字幕行可跳转到对应时间
- [ ] Shadowing 模式下自动开始录音
- [ ] Shadowing 模式下播放结束自动停止录音

### R2 素材回归测试

- [ ] 音频/视频播放正常
- [ ] 听写模式正常
- [ ] 影子跟读模式正常
- [ ] 播放速度控制正常

### 关键文件

- `src/components/YouTubePlayer.tsx` - YouTube Iframe 播放器
- `src/components/ShadowingPanel.tsx` - 影子跟读组件（支持自动录音）
- `src/components/UniversalPlayer.tsx` - 统一播放器路由
- `src/app/topics/[category]/[slug]/PracticePage.tsx` - 练习页面（状态管理）
- `scripts/ingest_youtube_ytdlp.py` - yt-dlp 抓取脚本（推荐）
- `scripts/ingest_youtube_with_playwright.py` - Playwright 抓取脚本（备选）

---

# 🔄 模式独立进度追踪问题（已解决）

## 📋 问题描述

**症状**：
- 在 Dictation 模式练习到第 4 句
- 切换到 Shadowing 模式，从第 1 句重新开始
- Shadowing 练习到第 5 句
- 切换回 Dictation 模式，**预期回到第 4 句，实际回到第 1 句** ❌

**用户需求**：
- Dictation 模式：维护自己的句子索引（如第 4 句）
- Shadowing 模式：维护自己的句子索引（如第 5 句）
- 切换模式时：恢复到该模式对应的进度

---

## 🔍 根本原因

**代码位置**：`src/app/topics/[category]/[slug]/PracticePage.tsx`

**问题 1：重复的状态定义冲突**
```typescript
// ❌ 第 155 行：定义了旧的 currentSentenceIndex 状态
const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0)

// ✅ 第 76-77 行：定义了模式独立的状态
const [dictationIndex, setDictationIndex] = useState(0)
const [shadowingIndex, setShadowingIndex] = useState(0)

// ✅ 第 293 行：根据模式动态选择索引
const currentSentenceIndex = mode === 'dictation' ? dictationIndex : shadowingIndex
```

**冲突说明**：
- 第 155 行的 `currentSentenceIndex` 是一个**可变状态**
- 第 293 行的 `currentSentenceIndex` 是一个**计算值**
- 在 JavaScript 中，后声明的变量会覆盖先声明的变量
- 导致：计算值无法响应状态变化，始终返回初始值

**问题 2：Transcript 点击使用错误的更新函数**
```typescript
// ❌ 第 894 行：调用了不存在的 setCurrentSentenceIndex
onClick={() => {
  setCurrentSentenceIndex(index)  // 这个函数实际上更新的是第 155 行的状态
  setAutoPlayTrigger(prev => prev + 1)
}}
```

---

## ✅ 解决方案

### 修改 1：删除重复的状态定义

**位置**：第 155 行

**删除**：
```typescript
// ❌ 删除这一行
const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0)
```

### 修改 2：修复 Transcript 点击事件

**位置**：第 894 行

**修复前**：
```typescript
onClick={() => {
  setCurrentSentenceIndex(index)
  setAutoPlayTrigger(prev => prev + 1)
}}
```

**修复后**：
```typescript
onClick={() => {
  // 根据当前模式更新对应的索引
  if (mode === 'dictation') {
    setDictationIndex(index)
  } else {
    setShadowingIndex(index)
  }
  setAutoPlayTrigger(prev => prev + 1)
}}
```

---

## 🎯 工作原理

### 状态架构

```typescript
// 两个独立的索引状态
const [dictationIndex, setDictationIndex] = useState(0)      // Dictation 模式的索引
const [shadowingIndex, setShadowingIndex] = useState(0)     // Shadowing 模式的索引

// 根据当前模式动态选择索引
const currentSentenceIndex = mode === 'dictation' ? dictationIndex : shadowingIndex
```

### 数据流转

**场景 1：Dictation 模式练习**
```
用户练习到第 4 句
  ↓
dictationIndex = 3
  ↓
currentSentenceIndex = dictationIndex = 3  （因为 mode === 'dictation'）
```

**场景 2：切换到 Shadowing 模式**
```
用户点击 Shadowing 标签
  ↓
mode = 'shadowing'
  ↓
currentSentenceIndex = shadowingIndex = 0  （因为 mode === 'shadowing'）
  ↓
显示第 1 句（Shadowing 的进度）
```

**场景 3：Shadowing 练习到第 5 句**
```
用户练习到第 5 句
  ↓
shadowingIndex = 4
  ↓
currentSentenceIndex = shadowingIndex = 4
```

**场景 4：切换回 Dictation 模式**
```
用户点击 Dictation 标签
  ↓
mode = 'dictation'
  ↓
currentSentenceIndex = dictationIndex = 3  ✅
  ↓
显示第 4 句（Dictation 的进度）
```

---

## 📊 关键要点

1. **避免变量名冲突**
   - 不要在同一个文件中声明同名的变量
   - 计算值使用 `const`，状态使用 `useState`
   - 后声明的变量会覆盖先声明的变量

2. **模式独立状态**
   - 每个模式维护自己的索引状态
   - 切换模式时不需要重置索引
   - 通过计算值动态选择当前使用的索引

3. **更新函数必须对应**
   - Dictation 模式使用 `setDictationIndex`
   - Shadowing 模式使用 `setShadowingIndex`
   - 不能使用不存在的 `setCurrentSentenceIndex`

---

## ✅ 测试检查清单

- [ ] Dictation 模式练习到第 4 句
- [ ] 切换到 Shadowing 模式，显示第 1 句
- [ ] Shadowing 模式练习到第 5 句
- [ ] 切换回 Dictation 模式，**回到第 4 句** ✅
- [ ] 再切换到 Shadowing 模式，**回到第 5 句** ✅
- [ ] 点击 Transcript 中的句子，正确跳转

---

## 🔗 相关文件

- `src/app/topics/[category]/[slug]/PracticePage.tsx` - 练习页面（状态管理）

