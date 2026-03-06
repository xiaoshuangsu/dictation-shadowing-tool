
# ShadowHub 项目全流程开发与自动化规范 (Master Guidelines)

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
3. **R2 唯一化上传**：上传前检查桶内是否存在该 Slug 的旧文件，执行覆盖式同步。
4. **数据库对齐**：确保 Supabase 存储的是**完整的 R2 公共域名 URL**（移动端兼容）。
5. **物理删除（安全锁）**：只有收到 R2 和 Supabase 的"成功双重确认"后，才允许删除本地原始文件。

---

## 4. 路径处理与前端规范 (404 Prevention)
* **禁止拼接**：前端 `practice/page.tsx` 直接使用数据库中的完整 URL。
* **R2 公共域名规范**：所有资源路径必须使用 R2 公共域名（`https://pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev/`），不使用 Worker 代理。
* **清理脏数据**：发现数据库中带有 `supabase.co` 或 `r2-proxy.workers.dev` 拼接路径的记录，一律修正为 R2 公共域名 URL。

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

## 7.移动端与跨域资源开发规范 (Mobile & CORS Protocol)

### 1. 跨域资源强制要求 (CORS Requirements)
* **核心原则**：使用 R2 公共域名（`pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev`）加载资源，移动端完全兼容。
* **强制动作**：凡是 `<img />`, `<audio />`, `<video />` 标签，只要 `src` 涉及非同源 URL，**必须**显式添加 `crossOrigin="anonymous"` 属性。
    - ✅ ` <video src={url} crossOrigin="anonymous" playsInline />`
* **iOS 特性**：视频组件必须包含 `playsInline` 属性，以防止在移动端自动全屏或加载失败。
* **禁止 Worker 代理**：不使用 `r2-proxy.suxiaoshuang2020.workers.dev`，移动运营商可能限制访问。

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