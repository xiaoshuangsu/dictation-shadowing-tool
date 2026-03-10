# Changelog

## [12.0.6] - 2026-03-10

### Fixed
- **回滚错误修改，恢复图片正常显示** 🔙
  - 恢复到 v12.0.3 版本的 page.tsx
  - 修复图片 URL 重复拼接问题
  - 保持原有的展开/收起功能

## [12.0.5] - 2026-03-10

### Fixed
- **修复图片 URL 重复拼接问题** 🔧
  - 恢复使用 `getThumbnailUrl` 函数正确处理图片 URL
  - 该函数会检查路径是否为完整 URL，避免重复拼接 Worker 域名
  - 修复线上环境封面图无法加载的问题

### Technical Details
- 修改文件：
  - `src/app/topics/page.tsx` - 使用 getThumbnailUrl 函数
  - `package.json` - 版本号更新

## [12.0.4] - 2026-03-10

### Fixed
- **移动端素材页面性能优化** 🚀
  - 修复变量名错误：`totalCategories` → `totalCategoriesCount`
  - 修复渲染循环错误：使用正确的 `categoryMaterials` 变量
  - iOS Safari 兼容修复：简化 console.log 错误日志，避免"未能抓取属性"错误

### Optimized
- **图片加载策略优化** 📱
  - 每个分类默认只显示 1 个素材（适合移动端一行一卡）
  - 实现展开/收起切换功能：
    - 默认状态：显示 1 个素材 + "查看全部 →"按钮
    - 展开状态：显示所有素材 + "收起 ↑"按钮
  - 图片懒加载优化：
    - 第一张封面图：`loading="eager"` + `fetchPriority="high"`（立即加载）
    - 其他封面图：`loading="lazy"`（进入视口才加载）

### Added
- **多语言支持** 🌐
  - 中文：查看全部 → / 收起 ↑
  - 英文：View More → / Collapse ↑

### Removed
- **调试工具清理** 🧹
  - 删除"强制刷新图片"按钮及相关代码
  - 移除不再使用的状态：`refreshKey`、`handleForceRefresh` 函数

### Technical Details
- 修改文件：
  - `src/app/topics/page.tsx` - 性能优化和展开/收起功能
  - `src/contexts/LanguageContext.tsx` - 添加翻译文本
  - `package.json` - 版本号更新

## [12.0.3] - 2026-03-09

### Fixed
- **移动端封面图加载优化** 📱
  - 移除 3 秒强制超时检查，让浏览器原生加载机制接管
  - 添加 `importance="low"` 属性，降低图片加载优先级
  - 添加 `decoding="async"` 属性，异步解码图片
  - 保留 `loading="lazy"` 懒加载，只加载可见区域图片
  - 添加调试日志：第一张图片加载时打印 URL 信息

### Technical Details
- 修改文件：
  - `src/app/topics/page.tsx` - 移除超时检查，添加调试日志
  - `src/components/topics/MaterialCard.tsx` - 添加 importance="low" 和调试日志
  - `package.json` - 版本号更新

## [12.0.2] - 2026-03-09

### Fixed
- **Worker Media Proxy 路径修复** 🔧
  - 修复路径纠错：移除 pathname 前导斜杠，确保传给 R2 的 Key 不带开头斜杠
  - 根路径处理：访问根路径时返回 200 状态和友好提示
  - 完善 MIME 类型：mp4 → video/mp4，mp3 → audio/mpeg
  - 强效缓存：所有成功请求使用 `public, max-age=31536000, immutable`（永久缓存）
  - CORS 兜底：确保所有响应（包括 404）都包含 CORS_HEADERS

### Fixed
- **开发环境混合内容问题修复** 🌐
  - VideoPlayer.tsx：
    - 添加环境检测，开发环境使用 `preload="metadata"` 避免高频 Range 请求
    - 添加指数退避重试机制：最大延迟 10 秒，最多重试 5 次
  - next.config.js：
    - 添加 rewrites 配置：`/api/proxy-media/*` → `https://media.shadowhub.app/*`
    - 开发环境下通过本地代理转发，避免 HTTP 页面加载 HTTPS 视频的混合内容警告
  - practice/page.tsx 和 PracticePage.tsx：
    - 开发环境使用本地代理 `/api/proxy-media/...`
    - 生产环境直接使用 `https://media.shadowhub.app/...`

### Technical Details
- 修改文件：
  - `worker-media-proxy.js` - Worker 代理路径和缓存优化
  - `src/components/VideoPlayer.tsx` - 环境检测和重试机制
  - `next.config.js` - 开发环境代理配置
  - `src/app/practice/page.tsx` - CDN URL 环境判断
  - `src/app/topics/[category]/[slug]/PracticePage.tsx` - CDN URL 环境判断
  - `package.json` - 版本号更新

## [12.0.1] - 2026-03-09

### Added
- **封面图预加载优化** 🖼️
  - 实现智能预加载逻辑：首屏加载完成后，自动预加载剩余封面图
  - 分批预加载策略：每批5张图片，延迟100ms，避免抢占带宽
  - 自动识别首屏可见数量：根据屏幕宽度自适应（移动端1个，大屏4个）
  - 利用浏览器缓存：使用 `new Image()` 在后台预加载到缓存
  - 确保首屏优先：只有在首屏图片加载完成后才开始预加载

### Technical Details
- 修改文件：
  - `src/app/topics/page.tsx` - 添加预加载逻辑和首屏加载状态跟踪

## [12.0.0] - 2026-03-09

### Fixed
- **Worker 代理优化** ⚡
  - 添加 `.webp` 格式支持（`image/webp` Content-Type）
  - 优化缓存策略：
    - 图片（.jpg/.png/.webp）：7天缓存
    - 视频/音频：1小时缓存
  - 修复 HEAD 请求和完整文件返回的缓存逻辑重复设置问题
  - 版本标识从 v2.1 更新到 v2.2

- **数据库修复** 🔧
  - 修复两个素材的 `thumbnail_path` 字段（设置为 null）：
    - `Yellowstone National Park`
    - `Two Great Artists: Leonardo and Michelangelo`
  - 解决了封面图 404 和 CORS 错误问题

### Added
- **缩略图压缩脚本** 🗜️
  - 新增 `scripts/compress-thumbnails.js`：批量压缩 R2 缩略图至 20KB 以下
  - 支持质量递减和分辨率降级策略
  - 自动上传压缩后的图片到 R2

### Technical Details
- 修改文件：
  - `cloudflare-workers/r2-proxy-worker/index.js` - Worker 代码修复
  - `package.json` - 版本号更新至 12.0.0
  - 数据库记录更新（通过 Supabase）

## [11.0.0] - 2026-03-09

### Added
- **移动端视频播放专项指南** 📱🎬
  - 新增详细文档：iOS 视频格式要求（moov atom 问题）
  - 视频组件必需属性说明（移动端必备属性）
  - Worker 配置要求（R2 Bucket 绑定配置）
  - 常见问题排查速查表（5 种常见症状的病因和解决方案）
  - 调试技巧（详细的错误日志获取方法）
  - 预防措施（上传前检查清单、代码审查检查清单）

### Fixed
- **移动端视频播放优化** 📱
  - VideoPlayer 组件重构：简化状态管理，优化 iOS 兼容性
  - 添加 playsInline、webkit-playsinline、muted 等移动端必需属性
  - 使用 useRef 跟踪自由播放模式，确保状态立即生效
  - 修复 iOS 自动播放限制问题

- **Worker 代理优化** ⚡
  - 改用 R2 bucket 直接访问（不再使用公共域名转发）
  - 优化 Range 请求处理，支持视频流式播放
  - 完善错误处理和日志输出

### Technical Details
- 修改文件：
  - `claude code guide.md` - 新增移动端视频播放专项指南
  - `src/components/VideoPlayer.tsx` - 重构组件，优化移动端兼容性
  - `worker-media-proxy.js` - 改用 R2 bucket 直接访问
  - `src/app/topics/[category]/[slug]/PracticePage.tsx` - 清理冗余代码

## [9.0.0] - 2026-03-07

### Added
- **统一三级路由架构** 🏗️
  - 重构路由为 `/topics/[category]/[slug]/` 结构
  - 删除旧的 `dictation/[slug]` 和 `shadowing/[slug]` 路由
  - 新增分类工具函数 `categoryToSlug` 和 `slugToCategory`
  - 实现统一的 URL slug 映射（支持中文分类名转 URL-friendly slug）

### Changed
- **练习页面三栏布局优化** 🎨
  - 重构页面布局：左（视频+进度）、中（练习区）、右（原文）
  - 优化顶部导航：面包屑 → 标题 → 模式切换 Tab
  - 进度统计移至左栏视频上方
  - 素材标题居中显示，移除难度标签
  - 修复 sticky 定位遮挡问题（top-20 → top-40）

- **右侧原文稿交互增强** 📝
  - 隐藏模式：默认显示星号（`***`）代替单词
  - 点击 Show 按钮显示原文和翻译
  - 点击任意句子切换并播放该句

- **媒体播放架构重构** 🎵
  - 实现"单音源、双入口"架构
  - 中栏 AudioPlayer 为唯一音源
  - 左栏 VideoPlayer 重构为纯展示组件（移除内部 `<video>` 标签）
  - 修复双重声音 Bug

- **分句播放逻辑重写** ▶️
  - 引入 `hasStarted` 状态跟踪首次点击
  - 使用 `flushSync` 强制同步更新状态
  - 修复分句步进 Bug，确保每次点击都递增索引并播放
  - 左栏和中栏播放按钮统一调用 `handlePlayOrNext`

### Fixed
- **修复 WordMode 死循环问题**
  - 删除调试 useEffect，避免无限重渲染
  - 优化计算逻辑，提升性能

- **修复索引更新时序问题**
  - 所有索引更新改用函数式更新 (`prev => prev + 1`)
  - 使用 `flushSync` 解决 React 18 批处理导致的时序问题

### Technical Details
- 新增文件：
  - `src/app/topics/[category]/[slug]/page.tsx` - 新的三级路由页面
  - `src/app/topics/[category]/[slug]/PracticePage.tsx` - 练习页主组件
  - `src/lib/utils/category.ts` - 分类工具函数
  - `public/_redirects` - 重定向配置

- 删除文件：
  - `src/app/topics/dictation/[slug]/DictationPracticeClient.tsx`
  - `src/app/topics/dictation/[slug]/page.tsx`
  - `src/app/topics/shadowing/[slug]/ShadowingPracticeClient.tsx`
  - `src/app/topics/shadowing/[slug]/page.tsx`

- 修改文件：
  - `src/components/VideoPlayer.tsx` - 重构为纯展示组件
  - `src/components/WordMode.tsx` - 删除调试 useEffect
  - `src/components/profile/MaterialProgress.tsx`
  - `src/lib/supabase/client.ts` - 硬编码凭证（静态导出）
  - `src/app/topics/page.tsx` - 更新路由结构
  - `src/app/practice/page.tsx` - 更新 VideoPlayer props

- Breaking Changes:
  - 练习页面 URL 从 `/practice?slug=xxx` 改为 `/topics/[category]/[slug]/`
  - 需要重新生成所有静态页面（已自动完成）



### Added
- **自定义域名支持** 🌐
  - 配置主域名 `shadowhub.app` 指向 GitHub Pages
  - 配置媒体子域名 `media.shadowhub.app` 通过 Worker 代理访问 R2 资源
  - 解决跨账户 R2 绑定问题（R2 在账号 A，域名在账号 B）

- **Worker 代理优化** ⚡
  - 在账号 B 创建 Worker `morning-sound-a67b` 作为媒体代理
  - 自动添加 CORS 头，解决跨域问题
  - 智能缓存策略（图片 7 天，音视频 30 天）
  - 透明代理所有媒体请求

### Changed
- **统一媒体域名** 🎯
  - 所有媒体链接更新为 `https://media.shadowhub.app/...`
  - 数据库 89 条记录全部更新
  - 前端代码统一使用新域名
  - 移除设备类型检测，所有设备使用同一域名

### Technical Details
- 新增文件：
  - `cloudflare-workers/media-proxy/worker.js` - Worker 代理脚本
  - `cloudflare-workers/media-proxy/README.md` - 部署指南
  - `CNAME` - GitHub Pages 自定义域名配置
  - `scripts/update_to_custom_domain.py` - 数据库链接更新脚本

- 修改文件：
  - `src/lib/r2/client.ts` - 统一使用 media.shadowhub.app
  - `src/app/topics/page.tsx` - 更新媒体域名配置
  - `src/components/topics/MaterialCard.tsx` - 更新媒体域名配置
  - `src/app/practice/page.tsx` - 更新媒体域名配置
  - `package.json` - 版本号更新至 8.3.0

## [8.2.2] - 2026-03-06

### Added
- **新增"动画片"内容分类** 🎨
  - 添加 `cartoon` 分类支持，难度级别 A1
  - 更新前端分类映射，支持中英文显示
  - 优化分类筛选功能，确保所有分类正确显示

### Technical Details
- 修改文件：
  - `scripts/youtube_single.py` - 添加 cartoon 分类支持
  - `src/app/topics/page.tsx` - 更新 CATEGORY_MAP 和 CATEGORIES
  - `src/components/topics/FilterBar.tsx` - 完善分类映射表

## [8.2.1] - 2026-03-06

### Fixed
- **音频播放 QUIC 协议错误** 🎵
  - 修复 ERR_QUIC_PROTOCOL_ERROR.QUIC_TOO_MANY_RTOS 错误
  - 所有设备统一使用 R2 CORS Worker 代理访问音频
  - 添加缓存破坏参数 ?v=2，确保使用最新配置
  - 避免 QUIC 协议与 R2 公共域名的兼容性问题

- **首页文案不显示问题** 🏠
  - 移除 framer-motion 动画，改用普通 div 元素
  - 调整 z-index，确保文字层级正确
  - 解决浏览器缓存导致的渲染问题

- **个人中心缩略图显示** 👤
  - 修复 MaterialProgress 组件中缩略图 URL 处理逻辑
  - 添加对完整 URL 的检测，避免重复处理 R2 CDN URL

### Technical Details
- 修改文件：
  - `src/app/practice/page.tsx` - getCdnUrl 函数优化
  - `src/components/landing/Hero.tsx` - 移除 framer-motion
  - `src/components/landing/HeroVisual.tsx` - z-index 调整
  - `src/components/profile/MaterialProgress.tsx` - URL 处理逻辑

## [8.2.0] - 2026-03-06

### Added
- **SEO 字段支持** 🔍
  - 数据库新增 4 个 SEO 字段：`slug`、`meta_title`、`meta_description`、`og_image`
  - Python 脚本自动生成 SEO 元数据
  - 50 条现有记录批量填充 SEO 数据
  - 新增 BBC Learning English 和 VOA Learning English 分类参数

- **R2 公共域名迁移** ☁️
  - 开启 R2 Bucket Public Access
  - 迁移所有资源 URL 到 R2 公共域名
  - 桌面端/移动端分离策略，解决 CORS 和移动访问问题

### Fixed
- **跨域资源加载 (CORS)** 🌐
  - 桌面端：使用 R2 Worker 代理（提供 CORS 头）
  - 移动端：使用 R2 公共域名（避免运营商限制）
  - 更新 5 个前端组件的 CDN 选择逻辑
  - 修复练习页面音频/视频播放无声音问题

- **素材卡片布局优化** 📱
  - 默认显示数量自适应屏幕大小（移动1/小屏2/中屏3/大屏4）
  - 统一使用网格布局，移除复杂的响应式隐藏逻辑
  - "查看全部"按钮显示条件优化

### Changed
- **分类整理** 📂
  - 迁移 BBC 视频到 "BBC Learning English" 分类
  - 数据库当前共 50 条记录

### Technical Details
- 修改文件：
  - `scripts/youtube_single.py` - SEO 字段生成、新增 bbc/voa 分类
  - `scripts/add_seo_fields.js` - SEO 字段填充脚本
  - `scripts/add_seo_fields.sql` - SQL 脚本
  - `src/app/practice/page.tsx` - CDN 选择逻辑
  - `src/app/topics/page.tsx` - 布局优化、CDN 选择
  - `src/app/topics/dictation/[slug]/DictationPracticeClient.tsx` - CDN 选择
  - `src/app/topics/shadowing/[slug]/ShadowingPracticeClient.tsx` - CDN 选择
  - `src/components/topics/MaterialCard.tsx` - CDN 选择
  - `src/lib/r2/client.ts` - 设备检测、URL 生成逻辑
- 数据库更新：新增 SEO 字段，50 条记录批量更新

## [8.1.0] - 2026-03-05

### Added
- **YouTube 自动化处理脚本** 🎬
  - 新建 `scripts/youtube_single.py` - 单视频处理脚本
  - 支持 YouTube 视频下载、转录、翻译、上传全流程自动化
  - Whisper 毫秒级对齐 + GLM API 翻译
  - 物理断句逻辑：标点强制切分、逗号+停顿>0.8s切分、任何停顿>0.8s切分
  - R2 Worker URL 自动配置，移动端跨域兼容
  - 支持分类：story, ted, speech, daily, culture

- **TED 演讲分类** 🎤
  - 新增 "TED演讲" 分类 (B1 难度)
  - 已上传 3 个 TED 素材：
    - What happens to your brain without any social contact? - Terry Kupers
    - The 3 best predictors of how well youll age - Juulia Jylhv
    - What lack of sleep does to the teenage brain - Wendy Troxel

### Fixed
- **错误处理优化** 🐛
  - 修复 `src/app/topics/page.tsx` 错误对象显示为 `[object Object]` 的问题
  - 安全提取错误信息，支持 Error 对象、字符串、JSON 等多种格式

- **单词模式单词分割修复** 🔧
  - 修复 `src/components/WordMode.tsx` 单词分割逻辑
  - 使用正则表达式 `/\s+/` 代替 `split(" ")` 正确分割所有空白字符
  - 修复转录脚本单词拼接逻辑：`" ".join()` 代替 `"".join()`

### Changed
- **移动端素材展示优化** 📱
  - 默认显示素材数从 4 个改为 2 个（适配小屏幕）
  - "查看全部"按钮触发条件从 >4 改为 >2
  - 更好适配 iPhone 15 等小屏设备

### Technical Details
- 新增文件：`scripts/youtube_single.py` (350 行)
- 修改文件：
  - `src/app/topics/page.tsx` - 错误处理、默认显示数量、TED 分类
  - `src/components/WordMode.tsx` - 单词分割逻辑优化
  - `src/app/topics/dictation/[slug]/DictationPracticeClient.tsx` - 右侧文稿显示优化
- 数据库更新：3 个 TED 素材，新增 transcript (38-70 句不等)

## [8.0.0] - 2026-03-04

### Fixed
- **修复视频文件检测逻辑** 🐛
  - 优先检查 `material.video_path` 字段，不再误判 `audio_path` 结尾为 `.mp4` 的情况
  - 修复 April Fool's Day Joke 等素材的视频显示问题
  - 为 Food、Ordering in a Restaurant、Introductions、Sports & Activities、Vocabulary、It's raining、Three Little Pigs、What time is it 等 8 个素材添加 `video_path` 字段
  - 当前有 13 个素材正确设置了 video_path

- **修复缩略图文件名特殊字符问题** 🖼️
  - 重命名 5 个包含特殊单引号（'）的缩略图文件
  - Lou_Gehrig_'Farewell_Speech'.jpg → lou-gehrig-farewell-speech.jpg
  - Jessica's_First_Day_of_School.jpg → jessicas-first-day-of-school.jpg
  - New_Year's_Day.jpg → new-years-day.jpg
  - Handel's_"Messiah".jpg → handels-messiah.jpg
  - Mark's_Big_Game.jpg → marks-big-game.jpg
  - 更新 Supabase 数据库中的 thumbnail_path 路径
  - 重新上传到 R2 存储

- **修复音频文件路径错误** 🎵
  - 修复 8 个素材的 audio_path（错误的 -mp4 后缀改为 .mp3）
  - Food、Ordering in a Restaurant、Introductions、Unlock the Secrets to School Success、Describing your Hometown、Vocabulary、Talking about a Trip、Sports & Activities
  - 修复 Sports & Activities 文件名（去掉 `&` 符号）

### Changed
- **文件命名标准化** 📝
  - 所有新素材文件名必须使用标准连字符 `-`，剔除特殊单引号
  - 数据库路径与 R2 物理路径保持一致

### Technical Details
- 修改文件：`src/app/topics/dictation/[slug]/DictationPracticeClient.tsx`
- 数据库更新：13 条 video_path 记录，8 条 audio_path 记录，5 条 thumbnail_path 记录
- R2 上传：5 个重命名的缩略图文件

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
