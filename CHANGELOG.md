# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.2.0] - 2025-02-19

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
