# 技术架构与专项指南

> 本文档包含移动端视频播放、转录算法、CORS、SEO、性能优化等技术架构。
> 使用场景：代码开发、Bug 修复、性能优化时查阅。

---

## 📌 目录

1. [移动端视频播放专项指南](#移动端视频播放专项指南)
2. [跨域资源开发规范 (CORS)](#跨域资源开发规范-cors)
3. [SEO 自动化与预留规范](#seo-自动化与预留规范)
4. [资源架构与账号归属](#资源架构与账号归属)
5. [性能优化](#性能优化)
6. [听力模式核心算法](#听力模式核心算法)
7. [双源驱动架构](#双源驱动架构)

---

## 移动端视频播放专项指南

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
| **CSS 无法加载** | 手机端页面格式错乱 | 启动 dev server: `npx next dev -p 3000 -H 0.0.0.0` |
| **频繁显示加载中** | 桌面端"缓冲中..."不断弹出 | 添加 `onPlaying` 事件清除加载状态 |

### VideoPlayer 核心原则
1. **事件成对绑定**：`onWaiting` + `onPlaying` 必须同时存在
2. **零干预原则**：只修改 React 状态，绝不调用 `video.play()` 或 `video.pause()`
3. **预加载策略**：弱网用 `preload="metadata"`，桌面端可用 `preload="auto"`

---

## 跨域资源开发规范 (CORS)

### 核心原则
所有素材必须通过 A 账号 Worker 代理（`https://media.shadowhub.app`）加载。

**Worker 提供的关键能力**：
- 正确的 CORS 头（`Access-Control-Allow-Origin: *`）
- Range 请求支持（206 Partial Content）- 移动端播放器分段请求的必备能力

### 血泪史教训
- R2 公共域名（`pub-*.r2.dev`）**缺少 CORS 头**，导致 iOS/移动端封面显示失败（黑屏）
- 直接使用 R2 或 Supabase URL 会导致资源加载中断

### 强制动作
凡是 `<img />`, `<audio />`, `<video />` 标签，**必须**显式添加 `crossOrigin="anonymous"` 属性。

```tsx
✅ <video src={url} crossOrigin="anonymous" playsInline />
❌ <video src={url} />
```

### iOS 特定坑点
- ⚠️ **必须包含 `playsInline` 属性**，否则视频无法内联播放
- ⚠️ **不能缺失 `crossOrigin="anonymous"` 属性**，即使有 Worker 代理，封面依然会黑屏

---

## SEO 自动化与预留规范

### 数据库字段强制预留
在处理 YouTube 视频入库时，必须确保以下 SEO 相关字段被正确填充：

* **`meta_title`**: 格式为 `[Video Title] | English Dictation & Shadowing`
* **`meta_description`**: 自动摘取 Whisper 转录文本的前 150 个字符
* **`og_image`**: 直接复用 R2 的 `cover_path` 链接

### 自动化生成逻辑
* **Slug 优化**: 视频的 `slug` 必须基于标题生成（如 `elon-musk-speech`）
* **Alt 文本生成**: 预设 `image_alt` 字段，内容为 `English learning dictation practice for [Video Title]`

### 代码层面实现
* **动态渲染**: 在 `[slug]/page.tsx` 中，使用 `generateMetadata` 函数
* **结构化数据**: 自动为每个视频页生成 `VideoObject` 的 JSON-LD 脚本块

---

## 资源架构与账号归属

### 环境隔离说明

**B 账号 (域名与前端托管账号)**：
- **托管服务**：Cloudflare Pages
- **域名**：`shadowhub.app`
- **职责**：主入口，负责前端代码构建、部署与展示

**A 账号 (素材存储账号)**：
- **托管服务**：Cloudflare R2 存储桶
- **Bucket 名称**：`shadowhub`
- **职责**：存放音频、视频、缩略图等所有素材文件

**B 账号 Worker (媒体代理)**：
- **Worker URL**：`media.shadowhub.app`
- **职责**：接收请求，从 A 账号 R2 bucket 读取文件，返回正确的 Content-Type 和 CORS 头

**Supabase (中枢数据库)**：
- **项目 ID**：`cuxotlijjnxbsirpdkgr`
- **职责**：存储素材元数据、练习文本及 R2 资源索引

### 核心技术规范

**环境变量与凭证处理**：
- 静态导出模式下，`process.env` 无法实时读取，**必须硬编码**到客户端代码中
- 关键凭证：Supabase URL、Supabase Anon Key、R2 Worker URL

**动态路由生成 (slug)**：
- 必须包含 try-catch，确保数据库连接失败时返回占位符
- 必须包裹 Suspense，练习页面组件必须被 `<Suspense fallback={...}>` 包裹
- Slug 统一化，确保生成路径和跳转链接均使用 `titleToSlug(m.title)`

---

## 性能优化

### 优化目标
- 首屏加载时间 < 2s
- 减少网络请求数
- 提升用户感知性能

### 解决方案

**1. 优先级分层 (Fetch Priority)**
- 封面图：`fetchpriority="high"`
- 音频：`fetchpriority="auto"`
- 视频：`fetchpriority="low"`

**2. 强制顺序预加载**
- 使用 `<link rel="preload">` 预加载关键资源
- 封面图优先级最高，视频延迟加载

**3. 分片渲染 (Chunked Rendering)**
- 首屏只渲染可见数量的素材（桌面 8 个，平板 6 个，移动 4 个）
- 使用 Intersection Observer 实现懒加载

**4. CSS 占位优化**
- 使用 SVG placeholder 作为封面图占位符
- 避免布局抖动

### 关键文件
- `src/app/topics/[category]/page.tsx` - 聚合页面
- `src/components/MaterialCard.tsx` - 素材卡片组件

---

## 听力模式核心算法

### 核心算法

**1. 文本预处理标准化**
- 转小写、去除标点、统一空格

**2. 三轮贪婪匹配算法**
- 第一轮：精确匹配（绿色）
- 第二轮：模糊匹配（黄色）
- 第三轮：补全未匹配词（红色）

**3. 发音黑名单机制**
- 过滤 /h/、/w/ 等弱读音

**4. 单词级严格比对**
- 逐词比对，计算准确率

**5. 文案分级矩阵**
- 100%："Perfect! All words recognized."
- 80%+："Great job! Most words recognized."
- 60%+："Good effort! Keep practicing."
- <60%："Don't give up! Try again."

### 关键文件
- `src/components/DictationBox.tsx` - 听写模式组件
- `src/lib/speech-recognition.ts` - 语音识别逻辑

---

## 双源驱动架构

### 数据库字段扩展
```typescript
interface Material {
  youtube_id?: string;        // YouTube 视频 ID
  video_path?: string;        // R2 视频路径
  youtube_thumbnail?: string; // YouTube 缩略图
  cover_path?: string;        // R2 封面路径
}
```

### UniversalPlayer 自动选择
```typescript
const videoSrc = material.youtube_id
  ? getYouTubeUrl(material.youtube_id, 'player')
  : getCdnUrl(material.video_path);
```

### YouTubePlayer 双模式
- **嵌入模式**：iframe API，支持控制
- **无痕模式**：直接链接，无追踪

---

## 常见问题排查

### CORS 问题
**症状**：封面图黑屏、视频无法播放
**排查**：
1. 检查是否使用 `media.shadowhub.app` 代理
2. 检查是否有 `crossOrigin="anonymous"` 属性
3. 检查 Worker 是否返回正确的 CORS 头

### Range 请求问题
**症状**：移动端视频无法播放，Code 4 错误
**排查**：
1. 检查 A 账号 Worker 是否正确处理 Range 请求
2. 检查是否返回 `Content-Length` 和 `Content-Range` 头

### SEO 渲染问题
**症状**：搜索引擎无法抓取页面内容
**排查**：
1. 检查 `generateMetadata` 是否正确实现
2. 检查 meta 标签是否正确渲染
3. 使用 `curl` 模拟搜索引擎爬虫测试

---

**版本**：V19.9
**更新日期**：2026-03-18
