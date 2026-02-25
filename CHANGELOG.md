# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
