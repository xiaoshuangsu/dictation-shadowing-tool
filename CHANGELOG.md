# Changelog

## [7.8.11] - 2026-03-04

### Fixed
- **修复移动端素材加载失败问题** 🐛
  - 修复练习页面音频/视频 URL 拼接错误，现在正确支持 R2 Worker URL
  - 修复素材卡片缩略图路径问题，所有素材封面现在能正常显示
  - 移动端音频现在能正常播放，视频不再黑屏

### Changed
- **R2 存储架构简化** 🗂️
  - 统一所有资源到 R2 bucket (shadowhub)
  - 删除冗余的 VIDEOS bucket 绑定
  - Worker 简化为单一 R2 bucket 路由
  - 文件命名标准化：全部使用小写+连字符格式
  - 数据库路径与 R2 物理路径 100% 吻合

### Technical Details
- 清理重复文件：videos/ 从 47 个减少到 20 个
- 重命名 audio/ 文件：29 个文件改为标准格式
- 重命名康轩文件：音频、视频、缩略图命名统一（kh-b5l2-dialogue.*）
- 更新 Supabase 数据库：24 个 audio_path，1 个 thumbnail_path
- Worker 测试：5/5 通过，支持 CORS、Range 请求

## [7.8.10] - 2026-03-03

### Fixed
- 修复右侧文稿区域滚动问题 - "显示文稿"标题现在固定在顶部，句子列表在下方独立滚动
- 修复 R2 Worker 视频缓存问题 - 将视频文件缓存从 1 年改为 1 小时

### Added
- 新增素材："Empty Your Mind - A Powerful Motivational Story for Your Life"
- 新增分类："心灵故事" (Heart & Soul Stories)
- 时间戳标记工具支持视频文件播放

### Changed
- 优化 Cloudflare R2 Worker 缓存策略
  - 视频文件 (.mp4): 1 小时缓存
  - 其他文件: 1 天缓存
- 更新 April Fool's Day Joke 视频到新的 R2 路径

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [7.8.9] - 2025-03-02

### Added
- **新素材：Come to the Fair**
  - 添加到文化历史分类，B1 难度
  - 使用 Whisper 生成带时间戳的文稿（42句）
  - 使用 GLM-4-Flash API 翻译成地道中文
  - 上传音频文件和封面图到 R2 存储

### Fixed
- **面包屑导航自适应**
  - 使用环境变量判断 basePath（process.env.NODE_ENV）
  - 开发环境使用 /topics，生产环境使用 /dictation-shadowing-tool/topics
  - 解决了本地和 GitHub Pages 路径不一致的问题
  - 删除了重复的 Valentine's Day Story 素材（保留日常生活分类的）

### Changed
- **素材封面更新**
  - A Funny Thing Happened On The Way To School
  - Advice
  - Cowboys
  - I Want to Dye My Hair Green
  - Come to the Fair
  - Why Do People Dislike Other People
  - 所有封面图均为 1280x720 像素，48KB

### Dependencies
- 添加 axios 依赖用于 GLM API 调用

## [7.8.8] - 2025-03-02

### Fixed
- **面包屑导航路径修复**
  - 修复面包屑链接缺少 basePath 前缀导致 404 的问题
  - 将 /topics 改为 /dictation-shadowing-tool/topics
  - 现在点击面包屑可以正确返回素材列表并定位到对应分类

## [7.8.7] - 2025-03-02

### Performance
- **音频/视频预加载优化**
  - 将 AudioPlayer 的 preload 从 "auto" 改为 "metadata"
  - 将 VideoPlayer 的 preload 从 "auto" 改为 "metadata"
  - 页面加载时只加载元数据（时长、尺寸等），大幅减少初始加载时间
  - 用户点击播放时使用流式加载，边下载边播放
  - 第一句可以立即开始播放，无需等待整个文件下载完成
  - 用户练习时后台继续缓冲后续内容，提升用户体验

## [7.8.6] - 2025-03-02

### Fixed
- **面包屑导航修复**
  - 修复点击面包屑"素材"无法返回素材列表的问题
  - 修复点击面包屑分类名称无法返回并定位的问题
  - 点击"素材"可返回到素材列表页面
  - 点击分类名称（如"日常生活"）可返回并自动滚动到对应分类
  - 在素材列表页面添加 URL hash 处理逻辑，确保带 hash 的 URL 能正确滚动

## [7.8.5] - 2025-03-02

### Changed
- **URL Slug生成优化**
  - 增强titleToSlug()函数，处理带特殊字符的长标题
  - 移除方括号内容，如[Time]、[Video]等
  - 移除常见前缀标记，如"Easy Dialogue"、"Beginner English"、"English video for Kids"等
  - 限制slug长度为100字符
  - 统一DictationPracticeClient和ShadowingPracticeClient使用共享的slug生成函数
  - 重新生成materialSlugs.ts，使用简化后的slug（40个素材）
  - 将素材标题从"[Time] What time is it_ Time for breakfast. - Easy Dialogue - English video for Kids"改为"What time is it - Time for breakfast"
  - 新slug为"what-time-is-it-time-for-breakfast"（原为"time---what-time-is-it-time-for-breakfast---easy-dialogue---english-video-for-kids"）

## [7.8.4] - 2025-03-02

### Fixed
- **TypeScript类型错误**
  - 修复DictationPracticeClient中onClick事件处理器的类型注解
  - 修复ShadowingPracticeClient中onClick事件处理器的类型注解
  - 确保GitHub Pages构建成功

## [7.8.3] - 2025-03-02

### Changed
- **AudioPlayer组件重构**
  - 简化播放逻辑，从400行减少到140行
  - 使用requestAnimationFrame替代复杂的事件处理
  - 移除seeked事件的重试逻辑，提升播放响应速度
  - 直接设置currentTime并播放，减少延迟

- **素材卡片布局优化**
  - 单个卡片保持固定宽度，不拉伸填满整行
  - 右侧留白，卡片位置在左侧第一格
  - 使用max-width和flex-1组合实现响应式布局
  - 支持不同屏幕尺寸：1/4/4列布局

- **练习页面布局调整**
  - 优化三栏高度设置，更好利用屏幕空间
  - 调整左右两侧的padding和margin间隙
  - 改善整体视觉平衡

- **听写和影子跟读模式样式改进**
  - 优化单词模式和整句模式的显示样式
  - 统一交互体验

### Fixed
- **Audio播放定位问题**
  - 修复音频播放时无法正确跳转到指定时间的问题
  - 确保每个句子从正确的startTime开始播放
  - 在endTime时准确停止播放

- **Transcript数据结构**
  - 修复id属性覆盖问题，使用`s.id ?? index`保留数据库中已有id
  - 确保AudioPlayer正确检测句子变化

### Removed
- **删除素材分类和卡片**
  - 删除"历史演讲"分类（9个素材，包括Bill Clinton系列）
  - 删除"YouTube Vlog"分类（4个素材）
  - 删除"故事"分类中的多个素材（17个）
  - 总计删除30个素材

### Technical
- 主要修改文件：
  - `src/components/AudioPlayer.tsx` - 完全重构，简化代码
  - `src/app/topics/page.tsx` - 卡片响应式布局
  - `src/app/topics/dictation/[slug]/DictationPracticeClient.tsx` - 修复id属性，布局优化
  - `src/app/topics/shadowing/[slug]/ShadowingPracticeClient.tsx` - 布局优化
  - `src/components/topics/MaterialCard.tsx` - 卡片布局
  - `src/components/ShadowingPanel.tsx` - 样式改进
  - `src/components/VideoPlayer.tsx` - 样式调整
  - `src/hooks/useSuccessSound.ts` - 音效处理优化

## [7.8.2] - 2025-03-01

### Added
- **听写模式筛选器**
  - 在输入标签右侧添加模式下拉框，支持"单词"和"整句"切换
  - 自定义下拉组件，白色背景，灰色边框，阴影悬浮效果
  - 触发按钮显示当前选中模式，下拉箭头指示可展开
  - 移除顶部标题下方的旧模式下拉框，简化UI布局

- **显示文稿功能**
  - 右栏"原文"改为可点击的"显示文稿"按钮
  - 默认隐藏文稿内容，每个单词显示为星号（如：`**** ****** ***`）
  - 点击按钮后显示完整英文原文和中文翻译
  - 再次点击变为"隐藏文稿"
  - 隐藏状态下不显示中文翻译，防止剧透

### Changed
- **标签统一**
  - 单词模式和整句模式标签统一为"输入您听到的内容："
  - 移除原有的"输入缺失的单词："标签
  - 提升UI一致性

- **布局高度优化**
  - 右栏最大高度从 600px 增加到 850px
  - 更好利用屏幕空间，减少下方空白区域
  - 应用到听写和影子跟读两个练习页面

- **翻译文本简化**
  - "输入缺失的单词："改为"输入："
  - 中英文翻译同步更新

### Technical
- 修改文件：
  - `src/components/WordMode.tsx` - 添加模式下拉框，统一标签
  - `src/components/DictationBox.tsx` - 添加模式下拉框
  - `src/contexts/LanguageContext.tsx` - 更新翻译文本
  - `src/app/topics/dictation/[slug]/DictationPracticeClient.tsx` - 移除顶部下拉框，添加显示文稿功能，增加高度
  - `src/app/topics/shadowing/[slug]/ShadowingPracticeClient.tsx` - 添加显示文稿功能，增加高度
- 下拉组件样式：bg-white, border-gray-200, shadow-xl, whitespace-nowrap
- 星号生成逻辑：每个单词最多4个星号，保持单词数量一致

## [7.8.1] - 2025-03-01

### Fixed
- **Slug 匹配问题修复**
  - 修复 20 个素材页面 404 错误
  - 添加缺失的 slugs，包括：
    - april-fools-day-joke-english-conversation
    - the-lion-and-the-mouse (80 句)
    - the-cunning-fox-and-the-clever-stork (147 句)
    - the-goose-that-laid-golden-eggs
    - 以及其他 16 个素材
  - 移除 3 个无效的 slugs：
    - b5l2-dialogue（无对应素材）
    - b5l4-dialogue（无对应素材）
    - talking-about-a-trip-using-past-simple（素材无 transcript）
  - 最终 slug 数量：70（对应 72 个有 transcript 的素材，有 2 对素材生成相同 slug）

### Technical
- Slug 生成逻辑验证和测试
- 确认 slug 与素材的一一对应关系
- 修复 TypeScript 类型错误（HTMLVideoElement.HAVE_METADATA）

## [7.8.0] - 2025-03-01

### Added
- **自动翻译系统**
  - 新增 GLM API 自动翻译脚本 (`scripts/add_translations_with_glm.py`)
  - 使用智聊 GLM-4-flash 模型批量翻译英文句子
  - 为所有 74 个素材添加完整中文字幕
  - 支持部分翻译素材的自动补全

- **Whisper 转录改进脚本**
  - 新增 `scripts/regenerate_transcript_with_word_timestamps.py`
  - 使用 word_timestamps=True 获取精确的词级时间戳
  - 添加 `no_speech_threshold=0.6` 参数，减少幻听
  - 添加 `logprob_threshold=-1.0`，提高转录准确度
  - 自动去除重复句子，保持 transcript 清洁

- **视频文件格式支持**
  - 支持检测 `.mp4` 和 `-mp4` 文件扩展名
  - 自动识别视频素材并显示视频播放器
  - 为 8 个素材更新视频路径

- **R2 Proxy Worker**
  - 新增 Cloudflare Worker 用于 R2 存储代理
  - 正确处理 HTTP Range 请求，支持视频流式播放
  - 配置 CORS 头，支持跨域访问
  - 使用 `{ offset, length }` 格式处理 range 请求

### Changed
- **VideoPlayer 组件重构**
  - 简化代码，移除调试日志
  - 移除轮询等待 readyState 的逻辑
  - 优化视频加载和播放流程
  - 修复 readyState: 0 导致的视频无法播放问题

- **视频播放优化**
  - 修复 Range 请求处理逻辑
  - 正确返回 206 Partial Content 响应
  - 添加 Content-Range 和 Content-Length 头
  - 改进视频缓冲和 seek 性能

### Fixed
- **视频无法播放问题**
  - 修复 R2 proxy worker range 请求格式错误
  - 修复 HEAD 请求处理，支持元数据加载
  - 修复视频元素 readyState 检查逻辑
  - 修复视频初始化时机问题

- **Transcript 幻听问题**
  - "It's raining" 素材：删除 9 个重复的幻听句子
  - "Food" 素材：删除幻觉句子，合并错误分割的句子
  - 添加自动去重逻辑，防止类似问题

### Technical
- 添加 Cloudflare Workers 配置 (`wrangler.toml`)
- 添加 R2 bucket 绑定配置
- 更新 .gitignore，排除临时文件和媒体文件

## [7.7.0] - 2025-02-28

### Added
- **听写模式下拉框**
  - 点击"听写"按钮弹出下拉菜单，选择"单词"或"整句"模式
  - 添加下拉箭头图标，指示可展开选项
  - 优化UI交互体验

- **原文显示/隐藏功能**
  - 右侧原文区域添加"显示原文/隐藏原文"按钮
  - 默认隐藏原文，以星号（`**************************`）代替
  - 点击按钮后显示完整英文原文
  - 翻译（中文）始终显示

- **三栏布局优化**
  - 视频区域：42%（5/12栏）
  - 练习区域：33%（4/12栏）
  - 原文区域：25%（3/12栏）
  - 响应式设计：移动端自动转为单列

### Changed
- **音频匹配逻辑优化**
  - 添加高频误判词映射：`pig` ↔ `picked`/`peak`/`peaks`/`pick`
  - 添加词尾 -ed 容错规则（基础词 + ed 误读修正）
  - 添加60+可省略功能词（冠词、介词、助动词、连接词等）
  - 扩展核心词汇映射（little, three, mother, brothers等）

- **进度保存机制改进**
  - 听写模式和影子跟读模式独立保存进度
  - 切换模式时自动保存/恢复当前进度
  - 使用 ref 存储模式状态，避免重置

- **调试日志增强**
  - `intelligentMatch` 函数添加详细调试日志
  - 显示匹配过程：HIGH_FREQUENCY_MISHEARS 检查、Metaphone 相似度等
  - 便于排查词匹配问题

### Fixed
- **模式切换进度丢失**
  - 修复从听写切换到影子跟读时进度重置的问题
  - 修复从影子跟读切换到听写时进度重置的问题
  - 每个模式独立维护 `currentIndex`、`completedSentences`、`correctSentences` 等

### Technical Details
- 修改文件：
  - `src/lib/audio-checker.ts` - 高频误判词映射扩展，添加词尾 -ed 容错
  - `src/app/topics/shadowing/[slug]/ShadowingPracticeClient.tsx` - UI 优化，进度保存
- 新增功能：
  - 下拉框菜单组件（听写模式选择）
  - 原文显示/隐藏切换
  - 模式独立进度管理

---

## [7.3.1] - 2025-02-25

### Fixed
- **Banner 图片显示问题**
  - 修复首页 banner 图片在 GitHub Pages 生产环境无法显示的问题
  - 本地可用 + 生产不可用 = 构建配置问题
  - AbortError 来自 Framer Motion 编译代码（53-e5999eaa1594cae6.js）
  - Next.js 静态导出 + basePath 配置与 Framer Motion 存在兼容性问题

### Changed
- **移除 Framer Motion 依赖**
  - HeroVisual 组件：使用纯 CSS 动画替代 Framer Motion
  - 添加 `@keyframes fade-in` - 淡入 + 缩放效果（0.8s ease-out）
  - 添加 `@keyframes float` - 浮动效果（4s 无限循环）
  - CSS 动画由浏览器原生支持，性能更好（GPU 加速）

### Technical Details
- 修改文件：
  - `src/components/landing/HeroVisual.tsx` - 移除 Framer Motion，使用 CSS 动画类
  - `src/app/globals.css` - 添加 keyframe 动画定义
- 优势：
  - 完全复刻原有动画效果
  - 无 JavaScript 库依赖
  - 与 Next.js 静态导出完全兼容

---

## [7.2.0] - 2025-02-24

### Added
- **逐词窥视功能（Dictation Whole Caption 模式）**
  - 每个单词上方添加眼睛图标，点击可单独显示该单词
  - 新增 "Show All Words" 按钮，一键显示整句答案
  - 使用 Set 状态跟踪已窥视的单词
  - 翻译支持：`practice.showAllWords`、`practice.hideWords`

- **成功音效反馈（所有练习模式）**
  - Dictation Word 模式：完全正确时播放成功音效
  - Dictation Whole Caption 模式：完全正确时播放成功音效
  - Shadowing 模式：完全正确时播放成功音效
  - 创建 `useSuccessSound` Hook，自动预加载音频文件
  - 音频文件：`success-notification.wav`（518KB）
  - 音量设置为 0.5，避免过于响亮
  - 支持快速连续点击，会中断前一个声音并重新播放

### Fixed
- **音频播放一半自动停止问题**
  - 移除 `setTimeout` 方式（网络延迟导致计算不准确）
  - 改用 `timeupdate` 事件监听，实时检查播放位置
  - 当 `audio.currentTime >= endTime` 时自动暂停
  - 修复连续点击播放按钮导致的 AbortError

- **速度下拉框溢出问题**
  - 移除 "Speed:" 文本标签
  - 减小所有 gap（从 `gap-3` 改为 `gap-2`）
  - 移除父容器的 `flex-wrap`，防止换行
  - 下拉框宽度从 70px 减小到 60px
  - 响应式字体大小：`text-xs sm:text-sm`
  - 影响文件：DictationPracticeClient、ShadowingPracticeClient、practice 页面

### Improved
- **连读提示优化（Shadowing 模式）**
  - 只在错误率 < 30% 时显示连读建议
  - 根据原声音频时长判断语速，慢速（>0.5s/词）不提示
  - 将 "Linking Tips" 改为 "Suggestion"（更友好的语气）
  - 不在 "Keep practicing!" 警告上方显示，避免误解
  - 只在用户有连读潜力时才提示

### Technical Details
- 新增文件：`src/hooks/useSuccessSound.ts`
- 新增文件：`public/success-notification.wav`
- 修改文件：
  - `src/components/AudioPlayer.tsx` - 修复播放逻辑
  - `src/components/DictationBox.tsx` - 添加逐词窥视 + 成功音效
  - `src/components/WordMode.tsx` - 添加成功音效
  - `src/components/ShadowingPanel.tsx` - 添加成功音效 + 优化连读提示
  - `src/app/topics/dictation/[slug]/DictationPracticeClient.tsx` - UI 布局优化
  - `src/app/topics/shadowing/[slug]/ShadowingPracticeClient.tsx` - UI 布局优化
  - `src/app/practice/page.tsx` - UI 布局优化

---

## [7.1.0] - 2025-02-24

### Fixed
- **GitHub Pages 静态导出问题**
  - 修复 `generateStaticParams()` 返回空数组导致构建失败
  - 恢复返回 `MATERIAL_SLUGS`（42 个素材）
  - 移除 `layout.tsx` 中的 `cookies()` 调用（静态导出不支持）
  - 所有页面现在可以成功静态导出

### Technical Details
- 问题原因：`generateStaticParams` 被改成返回 `[]`，导致 Next.js 认为不需要生成任何页面
- 问题原因：`generateMetadata()` 使用 `cookies()` 读取语言设置，但静态导出在构建时无法访问 cookies
- 解决方案：使用固定的 metadata（英文），语言切换仍可在客户端正常工作
- 成功生成 90 个静态页面（42 dictation + 42 shadowing + 6 其他）

---

## [7.0.0] - 2025-02-23

### Added
- **完整的中英文双语支持系统**
  - URL 基础的语言路由：`/` (英文) 和 `/zh-CN` (中文)
  - 导航栏语言切换按钮（下拉菜单）
  - 全站 UI 文本完整翻译（100+ 翻译键）
  - 自动语言检测和 cookie 持久化

- **多语言架构**
  - `LanguageContext` - 语言状态管理和翻译系统
  - `LocalizedLink` - 自动添加语言前缀的链接组件
  - `middleware.ts` - URL 重写和语言 cookie 设置
  - 翻译字典模式：点符号访问 (`practice.dictation.correct`)

- **翻译覆盖范围**
  - 导航栏：品牌名、菜单、语言切换器
  - 首页：Hero、How It Works、功能介绍、FAQ、CTA
  - 素材页面：标题、分类、难度筛选
  - 练习页面：DictationBox、WordMode、ShadowingPanel
  - 认证页面：登录/注册表单
  - 个人中心：统计卡片、历史记录

### Changed
- 所有硬编码的英文 UI 文本改为使用翻译函数
- Link 组件替换为 LocalizedLink（自动语言路由）
- 添加语言切换图标和下拉菜单

### Technical Details
- 使用 React Context API 管理语言状态
- 使用 Next.js middleware 实现 URL 重写
- 翻译文件：`src/contexts/LanguageContext.tsx`
- 语言检测优先级：URL path > cookie > 默认值 (en)

---

## [6.2.0] - 2025-02-22

### Added
- **Clean URL Routing Structure**
  - Implement SEO-friendly URLs for practice pages
  - Change from `/practice/?id=xxx&mode=dictation` to `/topics/dictation/{slug}`
  - Change from `/practice/?id=xxx&mode=shadowing` to `/topics/shadowing/{slug}`
  - URL slugs generated from material titles (e.g., "first-snowfall")
  - Clean URLs redirect to practice page with correct query parameters

### Technical Details
- Added `src/lib/utils/slug.ts` - Title-to-slug conversion utilities
- Added `src/lib/data/materialSlugs.ts` - Static slug data for build-time generation
- Created dynamic routes with `generateStaticParams()` for static export
- 78 static pages generated (39 dictation + 39 shadowing routes)
- Routes use Suspense boundaries for `useSearchParams()` compatibility

---

## [6.1.0] - 2025-02-21

### Added
- **营销首页**
  - 新增完整的营销首页，展示产品价值
  - Hero 区域：品牌形象 + CTA 按钮 + 浮动动画
  - How It Works：4 步骤核心流程（Choose Materials → Listen & Dictate → Shadow & Record → Track Progress）
  - 功能展示：Dictation（听写）、Shadowing（影子跟读）、AI 智能纠错、Growth Tracking（成长追踪）
  - FAQ 折叠面板：13 个常见问题解答
  - CTA 行动号召区域
  - 响应式设计（移动端/桌面端适配）
  - 滚动触发动画（Framer Motion）

- **固定导航栏**
  - 全站统一的顶部导航栏
  - ShadowHub 品牌 + Topics 入口
  - 用户认证：未登录显示 Login/Sign Up，已登录显示用户名和头像
  - 移动端汉堡菜单
  - 滚动时添加阴影效果

- **面包屑导航**
  - Practice 页面添加面包屑导航：Topics › Category › Audio Title
  - 便于用户了解当前位置

- **完整英文本地化**
  - 将所有中文 UI 文本翻译为英文
  - 导航栏、按钮、标签、错误消息、表单验证等
  - 首页、素材页、个人中心、登录/注册页面
  - 练习页面所有提示文本

- **路由结构调整**
  - 练习页面从 `/` 移动到 `/practice`
  - 营销首页占据根路径 `/`
  - 更新所有内部链接指向新路径

### Changed
- 依赖新增：framer-motion、lucide-react（图标库）
- 移除所有页面中的重复导航栏
- 统一页面最大宽度为 1280px (max-w-screen-xl)

### Technical Details
- 使用 `"use client"` 指令创建客户端组件
- 使用 Framer Motion 的 `whileInView` 实现滚动动画
- Lucide React 图标库提供现代化图标
- Navigation 组件使用 useAuth hook 管理认证状态

---

## [6.0.0] - 2025-02-21

### Added
- **营销首页（Marketing Landing Page）**
  - 新增营销首页展示产品价值
  - Hero 区域：鹦鹉图片 + 浮动动画 + CTA 按钮
  - How It Works：4 步骤核心流程展示
  - 功能展示：Dictation、Shadowing、AI 纠错、成长追踪
  - FAQ 折叠面板
  - 底部 CTA 区域
  - 响应式设计（移动端/桌面端适配）
  - 滚动触发动画（Framer Motion）

- **路由结构调整**
  - 练习页面从 `/` 移动到 `/practice`
  - 营销首页占据根路径 `/`

### Changed
- 依赖新增：framer-motion、lucide-react、clsx、tailwind-merge

### Technical Details
- 使用 `"use client"` 指令创建客户端组件
- 使用 Framer Motion 的 `whileInView` 实现滚动动画
- Lucide React 图标库提供现代化图标

---

## [5.3.0] - 2025-02-21

### Added
- **Shadowing Practice Display Modes**
  - Three display modes for progressive difficulty:
    * Full Mode (Blue): Show original text + translation
    * Translation Only Mode (Orange): Show Chinese translation only
    * Blind Mode (Purple): Hide all text, pure audio practice
  - User preference persistence: Selected mode maintained when switching sentences
  - Color-coded buttons for easy mode identification
  - Visual indicator for blind mode with 🙈 emoji

### Benefits
- Translation Only Mode: Improve listening comprehension skills
- Blind Mode: Challenge pure audio shadowing without text support
- Progressive difficulty: Users can choose their preferred difficulty level

---

## [5.2.0] - 2025-02-21

### Added
- **Word-Level Comparison & Error Highlighting**
  - Display detailed word-by-word comparison for shadowing practice
  - Highlight wrong words (red bold underline)
  - Show missed words (red dashed brackets [word])
  - Color-coded feedback for easy identification

- **Intelligent Linking Detection**
  - Auto-detect linking opportunities in sentences (e.g., "looked at", "taken a")
  - Display IPA pronunciation for linked phrases
  - Only show tips when errors involve linking words

- **Linking Weak Sound Recognition**
  - Identify weak words in linking contexts (e.g., "taken a" → "taken")
  - Mark weak link as gray parenthesis instead of error
  - Don't penalize for natural linking reduction

- **Similar-Sounding Words Detection**
  - Recognize confused words (he/she, there/their, it's/its)
  - Treat similar-sounding words as correct
  - Prevent false errors from speech recognition issues

- **External Link Navigation**
  - Material selection persistence (localStorage)
  - Disable auto-play when navigating from profile/topics
  - Direct jump to specific sentences from profile page
  - Detailed progress display: show completed/missing sentence IDs

- **UI/UX Improvements**
  - Rename `/materials` → `/topics` for better clarity
  - Update breadcrumb navigation
  - Add expandable material progress cards
  - Show missing sentence IDs in profile

### Fixed
- Fix shadowing audio playback with dynamic audio sources
- Fix wrong sentence playing in shadowing mode
- Fix audio path issues with basePath
- Correct word comparison algorithm with dual-pointer traversal

---

## [5.1.0] - 2025-02-19

### Added
- **Translation Refinement Script**
  - Batch optimize 1,157 sentence translations using GLM-4-Flash API
  - Focus on colloquial, natural Chinese expressions
  - Remove "translationese" patterns
  - Context-aware translation based on material titles

### Fixed
- Fix shadowing audio playback issue (basePath problem)
- Fix audio source not updating for different materials

---

## [5.0.0] - 2025-02-17

### Added
- **Material-Level Progress Display**
  - Show progress for each completed material
  - Display material thumbnails and categories
  - Track last practiced date
  - Progress bars with percentage completion

- **Navigation Improvements**
  - Click material card to resume practice
  - Jump to specific sentence when resuming
  - Auto-save last practiced sentence index

### Changed
- Redesign progress display from sentence-level to material-level
- Improve visual hierarchy with card-based layout

---

### Added
- **Word 模式中文释义功能**
  - 在原文显示区域右上角添加"显示释义"按钮
  - 点击按钮在原文句子正下方显示中文翻译
  - 默认收起状态，用户主动点击才显示
  - 切换句子时释义自动同步更新
  - 为默认素材（First Snowfall）添加完整中文翻译

### Changed
- 更新句子数据类型，添加可选的 `translation` 字段
- WordMode 组件支持翻译显示/隐藏功能

### Technical Details
- 新增 `Sentence` 接口定义，`translation` 为可选字段
- 自动生成的句子不包含翻译（`translation: undefined`）
- 使用 React 状态管理翻译显示状态

---

## [4.1.0] - 2025-02-19

### Changed
- **Materials Page Responsive Layout**
  - Changed grid breakpoint from `lg:grid-cols-2` to `md:grid-cols-2` for tablet displays
  - Tablet screens (768px+) now show 2 columns per row instead of single column
  - Large screens (1024px+) show 3 columns per row
  - Extra large screens show 4 columns per row

- **Card Layout Breakpoints**
  - Changed card layout breakpoint from `lg:flex-col` to `md:flex-col`
  - Cards now use vertical layout (thumbnail top, content below) at medium screens (768px+)
  - Mobile screens (< 768px) continue to use horizontal layout (thumbnail left, content right)

- **Container Padding**
  - Increased horizontal padding from `px-4 sm:px-6 lg:px-8` to `px-6 md:px-12 lg:px-20`
  - Better breathing room for cards on smaller screens

- **Card Styling Enhancements**
  - Added `shadow-sm` to cards for better depth
  - Changed border radius from `rounded-xl` to `rounded-2xl` for softer appearance
  - Added `overflow-hidden` to image containers for cleaner edges
  - Added `object-cover` to images for proper scaling without distortion

- **Responsive Component Updates**
  - All responsive breakpoints changed from `lg` to `md` for consistency:
    - Thumbnail width: `w-32 md:w-full`
    - Content padding: `p-3 md:p-4`
    - Badge positions and sizes
    - Button sizes
    - Title margins

- **Filter Bar Layout**
  - Changed to horizontal layout on desktop: `flex-col md:flex-row md:items-end`
  - Each filter now uses `flex-1 min-w-[200px]` for equal width distribution
  - Better use of horizontal space on desktop screens

### Fixed
- Filter bar now aligns properly with material cards
- Filter spacing from top improved with `mt-12` class
- Cards no longer touch screen edges on smaller devices

---

## [3.1.0] - 2025-02-17

### Added
- **练习进度保存与恢复**
  - 自动保存当前练习句子到 localStorage
  - 从 Profile 返回时恢复到最后练习的位置
  - 保存时机：完成练习后、切换句子、点击转录文本
  - 同时恢复练习模式（Dictation/Shadowing）和听写模式（Word/Whole Caption）
  - 仅对已登录用户启用

- **V3.1 Dictation 有效作答时间跟踪**
  - 跟踪真实参与听写思考与输入的时间（不是页面停留时间）
  - 计时启动：第一次点击播放音频 / 输入框获得焦点 / 开始输入
  - 计时暂停：浏览器失焦 / 页面最小化 / 连续无操作超过 60 秒
  - 有效性过滤：最小 3 秒（防止误触），最大 min(180秒, 音频时长×5)（防止挂机）
  - 浏览器可见性检测（visibilitychange 事件）
  - 60 秒无操作自动暂停计时

- **Shadowing 真实播放时间跟踪**
  - 从主播放器（AudioPlayer）跟踪实际音频播放时间
  - 不再使用"句数 × 固定分钟数"的估算方式
  - 兜底逻辑：真实播放时间 > 页面停留时间 > 默认值

- **duration_seconds 字段**
  - 添加到 `practice_records` 表
  - 数据库存储秒数，UI 展示转换为分钟
  - 用于 Dictation 和 Shadowing 的精确时间统计

- **今日进度统计改进**
  - 新目标：听写 ≥ 10句 **或** Shadowing ≥ 10分钟
  - 单条进度条显示（取两者最大百分比）
  - 大号百分比显示
  - 简洁 UI，不显示具体句数/分钟数

### Changed
- **Profile 页面统计逻辑**
  - 从 `practice_records.duration_seconds` 实时计算 Shadowing 总时间
  - 不再依赖 `user_stats` 表的缓存值
  - 今日 Shadowing 时间也从 `practice_records` 计算

### Fixed
- **RPC 函数列名错误**
  - 修复 `increment_user_stats_dictation` 和 `increment_user_stats_shadowing`
  - WHERE 条件从 `id = p_user_id` 改为 `user_id = p_user_id`
  - 这导致之前的统计数据无法更新

- **RPC 函数缺失**
  - 添加 `increment_today_dictation` 和 `increment_today_shadowing`
  - 用于原子性地更新每日记录

- **每日完成触发器**
  - 更新目标值为 10 句听写或 10 分钟 Shadowing
  - 修复 OR 逻辑（之前要求同时完成）

### Database Migrations
- `add_duration_seconds.sql` - 添加 duration_seconds 字段
- `create_increment_rpc.sql` - 创建原子性 RPC 函数
- `update_daily_goal.sql` - 更新每日目标触发器

---

## [3.0.0] - 2025-02-16

### Added
- **账号系统**
  - 用户注册/登录功能
  - 邮箱密码认证
  - Session 持久化

- **数据留存系统**
  - 练习记录保存到数据库
  - 用户统计数据（累计句数、时间）
  - 每日记录追踪
  - 连胜系统（当前连胜、历史最高）

- **Profile 页面**
  - 用户信息展示
  - 连胜统计卡片
  - 累计统计（Dictation / Shadowing 分离）
  - 今日进度追踪
  - 练习历史记录

- **数据库表结构**
  - `user_profiles` - 用户档案
  - `user_stats` - 用户统计数据
  - `daily_records` - 每日记录
  - `practice_records` - 练习记录

### Changed
- 静态导出模式改为动态（支持 API 路由）

---

## [2.0.0] - 2025-02-15

### Added
- **双模式练习**
  - Dictation（听写）模式
    - Word Mode（填空模式）
    - Whole Caption Mode（整句模式）
  - Shadowing（影子跟读）模式

- **音频播放器**
  - 句子级别播放控制
  - 变速功能（0.25x - 2x）
  - 自动播放下一句

- **实时反馈**
  - 逐词正确性检查（Word Mode）
  - 整句正确性验证（Whole Caption Mode）
  - 语音识别（Shadowing Mode）

- **UI 功能**
  - 显示/隐藏原文
  - 音频对比（原音 vs 用户录音）
  - 进度追踪

---

## [1.5.0] - 2025-02-14

### Added
- Word-level highlighting in transcript during audio playback
- Current playing word highlighted with darker yellow background
- Already-played words highlighted with lighter yellow background
- Synchronized highlighting with audio progress

## [1.4.0] - 2025-02-14

### Changed
- Transcript now always shows full text without hiding uncompleted sentences with asterisks
- Users can easily review all content in the transcript panel

## [1.3.0] - 2025-02-14

### Added
- Allow clicking transcript sentences to play audio
- Hover effect on transcript sentences for better UX
- Works in both Dictation and Shadowing modes

## [1.2.0] - 2025-02-14

### Added
- Add Next button in Shadowing mode audio comparison area
- Next button appears below microphone button after recording completion
- Button only displays when recorded audio is available
- Button is disabled on the last sentence

## [1.1.0] - Previous Release

### Added
- Initial Shadowing mode functionality
- Word mode dictation practice
- Whole caption dictation mode
- Audio playback with sentence-level timestamps
- Speed control (0.25x to 2x)
- Progress tracking and transcript display
