
# ShadowHub 项目全流程开发与自动化规范 (Master Guidelines)

## 🚨 移动端视频播放问题修复记录 (2026-03-12)

### 问题 1：Code 4 错误
**症状**：移动端播放视频时出现 `MEDIA_ERR_SRC_NOT_SUPPORTED` (错误码 4)，视频加载很久后偶尔能播放。

**根本原因**：
1. **开发环境代理失效**：静态导出模式下 `next.config.js` 的 `rewrites` 不生效，`/api/proxy-media` 无法访问
2. **Range 请求透传失败**：Worker 未正确处理 Range 请求，导致移动端无法分段加载视频

**解决方案**：
1. **统一使用线上 Worker**：开发环境和生产环境都使用 `https://media.shadowhub.app`
2. **优化 Worker 架构**：
   - 部署 A 账号 Worker (`r2-proxy`) 直接访问 R2 bucket
   - B 账号 Worker 代理到 A 账号 Worker（而非 R2 公开域名）
3. **修复 Range 请求处理**：A 账号 Worker 正确传递 Range 参数并返回准确的 Content-Length

### 问题 2：AbortError 错误
**症状**：移动端视频播放时出现 `AbortError: The operation was aborted`。

**根本原因**：
- 组件卸载后仍执行操作
- useEffect 中手动修改 `video.src = ""`

**解决方案**：
1. 添加 `isMountedRef` 标志位，防止组件卸载后执行操作
2. 移除手动修改 `video.src` 的逻辑，让 React 完全控制 src 属性

### 问题 3：VideoPlayer src 错误赋值
**症状**：video 标签的 src 属性被设置为当前页面 URL，导致浏览器尝试加载页面本身作为视频。

**根本原因**：
- useEffect 中执行 `video.src = ""` 清理旧状态
- 当 `actualVideoSrc` 是 `undefined` 时，浏览器使用当前页面 URL

**解决方案**：
- 强化 `actualVideoSrc` 验证：必须包含 `.mp4` 和 `media.shadowhub.app`
- useEffect 中添加阻尼检查，拒绝加载无效的 videoSrc
- 移除所有手动修改 `video.src` 的逻辑

### 问题 4：手机端页面格式错乱
**症状**：手机端页面显示格式错乱，CSS 无法加载。

**根本原因**：
1. **dev server 只绑定 IPv6**：手机端（IPv4）无法访问
2. **CSS 文件 404**：dev server 采用按需编译，需要先访问页面才会编译 CSS

**解决方案**：
- 启动 dev server 时使用 `-H 0.0.0.0` 参数，确保同时绑定 IPv4 和 IPv6
- 先访问页面触发编译，然后再加载 CSS

### 架构
```
用户 → media.shadowhub.app (B账号Worker)
     → r2-proxy.suxiaoshuang2020.workers.dev (A账号Worker)
     → R2 bucket (shadowhub)
```

### 关键文件
- `/Users/a/dictation/src/app/practice/page.tsx` - getCdnUrl 函数
- `/Users/a/dictation/worker-simple-ios.js` - B 账号 Worker
- `/Users/a/dictation/workers/worker-simple-ios-range.js` - A 账号 Worker
- `/Users/a/dictation/workers/wrangler.toml` - A 账号 Worker 配置
- `/Users/a/dictation/src/components/VideoPlayer.tsx` - 视频组件修复

### 开发服务器启动命令
```bash
# 正确的启动方式（绑定 IPv4 和 IPv6）
npx next dev -p 3000 -H 0.0.0.0
```

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
* **毫秒级对齐**：Whisper `word_timestamps=True`。
* **物理断句**：
    - 标点 `?.!` 强制切分。
    - 逗号 `,` + 停顿 `> 0.8s` 强制切分。
    - 任何停顿 `> 0.8s` 强制切分。
* **翻译**：指定调用 **GLM API**，确保结合整篇内容进行准确翻译，表达地道。

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

### 1. 标准 URL 结构
所有页面必须遵循以下层级，严禁使用扁平化路径：
- **分类页**：`/topics/[category-slug]/`
- **素材练习页**：`/topics/[category-slug]/[material-slug]/`
- **个人中心**：`/profile/`

### 2. 练习模式切换逻辑
- **单一 URL 原则**：听写（Dictation）与跟读（Shadowing）必须共用同一个素材页面。
- **状态区分**：通过 URL 查询参数 `?mode=dictation` 或 `?mode=shadowing` 进行切换。
- **技术实现**：使用 `useSearchParams` 监听模式，并在页面内通过 `Tab` 组件切换 UI，严禁创建物理上的新页面。

### 3. Slug 生成规范
- 必须调用 `titleToSlug()` 函数处理标题。
- 路径末尾必须带有斜杠 `/`（配合 `trailingSlash: true` 配置）。

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