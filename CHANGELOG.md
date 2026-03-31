# Changelog

> **版本号体系说明**（自 v22.0.0 起）
>
> 本项目采用统一的语义化版本号体系（Semantic Versioning）：
> - **主版本号**（package.json）：项目的唯一版本号（如 v22.0.0）
> - **功能模块**：不再使用独立版本号，所有变更体现在主版本号中
>
> 历史说明：
> - 3月18-20日期间，部分 commits 使用了功能版本号标记（如 "V21翻译脚本"、"v1.2.0单词挖空"）
> - 这些标记仅用于功能开发跟踪，不代表项目的正式版本号
> - v22.0.0 统一版本号体系，避免混乱

## [29.7.8] - 2026-03-31

### Perf
- **深度清理核心逻辑冗余日志** 🧹
  - **PracticePage.tsx 清理**：
    - 删除所有表情符号日志（🎵🎵🎵、🔴🔴🔴 等）
    - 删除交互日志（=== handlePlayOrNext Called ===、播放按钮被点击了）
    - 删除敏感数据输出（Material found、ID、audio_path、video_path 等）
    - 删除 Supabase 初始化日志（Creating singleton instance）
    - 删除滚动和状态变更日志（🔧 页面加载、🎯 跳转到句子等）
  - **Supabase client.ts 清理**：
    - 移除所有初始化日志
    - 移除 URL 和 Key 格式验证日志
    - 移除单例模式复用日志
  - **性能提升**：
    - 包体积减少 1.25 kB（practice/page：10.4 kB → 9.15 kB）
    - 生产环境控制台更加简洁，只保留错误日志

## [29.7.7] - 2026-03-31

### Perf
- **规范化日志管理，优化 VideoPlayer 性能** ⚡
  - **引入统一 Logger 机制**：
    - 创建 `src/lib/utils/logger.ts` 工具类
    - 开发环境输出带时间戳的日志
    - 生产环境完全禁用调试日志（仅保留 error）
    - 支持多种日志级别：log, info, warn, error, debug
  - **全局日志替换**：
    - `VideoPlayer.tsx` - 所有调试日志替换为 logger.debug
    - `AudioPlayer.tsx` - 所有调试日志替换为 logger.debug
    - `ClickableTranscript.tsx` - 替换调试日志
    - `ReviewOverlay.tsx` - 替换调试日志
    - `TrainingModeModal.tsx` - 替换调试日志
  - **性能优化**：
    - VideoPlayer 添加 `React.memo` 优化渲染
    - 减少无效渲染，降低生产环境控制台输出
  - **保留错误日志**：
    - 所有组件保留 `console.error` 用于生产环境错误追踪

## [29.7.5] - 2026-03-31

### Refactor
- **重构素材完成率逻辑（基于数据库 blanks 字段）** 🔄
  - **核心逻辑变更**：
    - 旧逻辑：完成率 = 用户练习的句子数 / 总句数
    - 新逻辑：完成率 = (用户练习的句子数 + 无 blanks 的句子数) / 总句数
  - **技术实现**：
    - ✅ 在 `getMaterialProgressFallback` 中添加 `skippableCount` 计算
    - ✅ 统计 transcript 中 `blanks` 字段为空或不存在 的句子数
    - ✅ 自动标记这些句子为"已完成"（无需用户输入）
  - **用户体验提升**：
    - 无 blanks 的句子可正常播放音频
    - 点击"下一句"时自动标记为完成，无需手动输入
    - 练习完成后显示 100% 完成率
  - **影响范围**：
    - `src/lib/supabase/client.ts`（重构完成率计算逻辑）
    - `src/app/topics/[category]/[slug]/PracticePage.tsx`（添加自动完成逻辑）
    - `src/components/WordMode.tsx`（清理调试日志）
  - **数据说明**：
    - `blanks` 字段是数据库中预计算的挖空配置
    - 由挖空脚本 `reprocess_ietts_blanks_v6.py` 生成
    - 包含 `word`（单词）、`index`（位置）、`pos`（词性）等信息

### Fixed
- **修复单词卡片点击练习功能** 🐛
  - **问题**：修改后单词卡片无法点击
  - **根本原因**：之前的修改禁用了点击事件
  - **修复**：恢复点击事件，确保卡片可以正常点击
  - **影响范围**：
    - `src/app/VocabularyContent.tsx`

## [29.7.4] - 2026-03-31

### Added
- **单词卡片点击即练习（Specific Word Training）** ⭐
  - **功能**：点击 Vocabulary 列表中的任意单词卡片，立即弹出闪卡练习该单词
  - **双模式支持**：
    - ✅ 全局练习模式：点击 "Start Training" 练习所有单词（显示 1/N 进度）
    - ✅ 单点练习模式：点击单个单词卡片（显示 1/1 进度）
  - **UI 改进**：
    - 单词卡片添加 `cursor-pointer` 和 hover 效果
    - 防止冒泡：删除按钮、发音按钮（US/UK）不触发练习弹窗
  - **代码重构**：
    - 新增 `singleWordTraining` state 存储单点练习的单词
    - 新增 `handleWordCardClick` 处理卡片点击
    - 新增 `handleCloseSingleTraining` / `handleCloseGlobalTraining` 关闭弹窗
  - **影响范围**：
    - `src/app/VocabularyContent.tsx`（核心修改）

### Fixed
- **修复练习后单词分类不更新的问题** 🐛
  - **问题**：在闪卡中选择 "Too Easy" 后，单词没有从 Learning 分类转到 Mastered 分类
  - **根本原因**：SWR 的 `mutate()` 默认不重新验证，只更新缓存
  - **修复方案**：
    - ✅ 所有 `mutate()` 调用添加第二个参数 `true`：`mutate(undefined, true)`
    - ✅ 强制 SWR 从数据库获取最新数据
  - **影响范围**：
    - `src/app/VocabularyContent.tsx`（修复三处 mutate 调用）
  - **技术说明**：
    - `mutate()` - 只更新缓存，不重新请求
    - `mutate(undefined, true)` - 强制重新验证（revalidate）

## [29.7.3] - 2026-03-31

### Fixed
- **修复 Topics ↔ Vocabulary 切换时闪现 Loading 动画** ⚡
  - **问题**：从 Topics 切换到 Vocabulary 时，页面会短暂显示 Loading 圆圈
  - **根本原因**：
    - 组件重新挂载时，SWR 的默认缓存是内存缓存，组件卸载后缓存丢失
    - 导致每次切换页面都会重新请求数据，触发 Loading 状态
  - **修复方案**：
    - ✅ 创建全局缓存存储（`globalCache = new Map()`）
    - ✅ 配置 SWR 使用自定义 cache provider：`provider: () => globalCache`
    - ✅ 优化 Loading 判断逻辑：`shouldShowLoading = isLoading && !data && !error`
    - ✅ 只在首次加载且无缓存时显示 Loading
  - **技术细节**：
    - `revalidateOnFocus: false` - 禁用焦点切换时重新验证
    - `revalidateOnMount: true` - 配合 Loading 判断，智能加载
    - `keepPreviousData: true` - 请求期间保留旧数据
    - 全局缓存确保组件卸载后数据仍然保留
  - **影响范围**：
    - `src/lib/hooks/useUserWords.ts`（添加全局缓存）
    - `src/app/VocabularyContent.tsx`（优化 Loading 判断）
  - **用户体验提升**：
    - Topics ↔ Vocabulary 切换实现瞬时渲染
    - 完全看不到 Loading 圆圈
    - 首次访问仍正常显示 Loading

## [29.7.2] - 2026-03-31

### Fixed
- **手术级重构 Vocabulary 页面（彻底修复 React Error #310）** 🐛
  - **问题**：Vocabulary 页面触发 #310 报错并导致整个应用崩溃
  - **重构方案**：四阶段结构规范化
    - ✅ 第一阶段：Hook 堆放区（无条件执行，绝对顶部）
      - 所有 useAuth, useRouter, useState, useSWR, useMemo, useEffect 都在绝对顶部
      - 严禁在 Hook 调用之前有任何提前返回
    - ✅ 第二阶段：逻辑拦截区（在所有 Hook 之后）
      - 提前状态判断：if (authLoading) return ...
      - 提前状态判断：if (!user) return ...
      - 提前状态判断：if (isLoading && !words) return ...
      - 提前状态判断：if (!words || words.length === 0) return ...
    - ✅ 第三阶段：辅助函数定义（在 return 之前）
      - playAudio, handleDeleteWord, parseDefinition, getCurrentDefinition
    - ✅ 第四阶段：渲染区（无条件渲染）
      - 所有逻辑已提前处理，JSX 中不再有复杂条件
  - **技术说明**：
    - Hook 调用顺序完全固定，不会在不同渲染之间变化
    - 符合 React 最佳实践：Early Return 模式
    - 消除了 JSX 中的复杂条件渲染逻辑
  - **影响范围**：
    - `src/app/VocabularyContent.tsx`（手术级重构）

## [29.7.1] - 2026-03-31

### Fixed
- **彻底修复 React Error #310（移除 ReviewOverlay 条件式 Hook 调用）** 🐛
  - **问题**：Vocabulary 页面触发 #310 报错并导致整个应用崩溃
  - **根本原因**：`ReviewOverlay` 组件内部调用了 `useAuth()` Hook
    - `ReviewOverlay` 被条件渲染：`{trainingMode && words && <ReviewOverlay />}`
    - 当条件为 true 时，`useAuth` 被调用
    - 当条件为 false 时，`useAuth` 不被调用
    - 这违反了 React Hook 规则：Hook 必须在每次渲染时以相同的顺序调用
  - **最终修复**：
    - ✅ 移除 `ReviewOverlay` 内部的 `useAuth` Hook 调用
    - ✅ 改为通过 props 传递 `user`
    - ✅ 确保 Hook 调用顺序完全固定
  - **影响范围**：
    - `src/components/ReviewOverlay.tsx`（移除 useAuth，添加 user prop）
    - `src/app/VocabularyContent.tsx`（传递 user prop）
  - **技术说明**：
    - 条件渲染的组件内部不能使用 Hook
    - 解决方案：将 Hook 调用移到父组件，通过 props 传递数据
    - 这符合 React 最佳实践：保持组件的纯净性和可预测性

## [29.7.0] - 2026-03-31

### Fixed
- **彻底修复 React Error #310（Vocabulary 页面打不开）** 🐛
  - **问题**：之前修复无效，Vocabulary 页面仍然报错 React Error #310
  - **根本原因**：`useAuth` Hook 的 `useCallback` 依赖项问题
    - `fetchProfile` 使用 `useCallback` 包装，空依赖数组 `[]`
    - `useEffect` 依赖 `fetchProfile`：`useEffect(..., [fetchProfile])`
    - 虽然空依赖数组的 `useCallback` 返回稳定的引用，但在某些情况下仍可能导致问题
  - **最终修复**：
    - ✅ 移除 `fetchProfile` 的 `useCallback` 包装
    - ✅ 直接在 `useEffect` 内部定义 `fetchProfile` 函数
    - ✅ `useEffect` 依赖数组设置为空 `[]`，确保只在组件挂载时运行一次
  - **影响范围**：
    - `src/lib/hooks/useAuth.ts`（彻底重构 useEffect 依赖管理）
  - **技术说明**：
    - 将函数直接定义在 effect 内部是 React 官方推荐的模式
    - 避免了 `useCallback` 和 `useEffect` 之间的复杂依赖关系
    - 确保 Hook 调用顺序完全固定，不会在不同渲染之间变化

## [29.6.9] - 2026-03-31

### Fixed
- **修复 React Error #310（Vocabulary 页面打不开）** 🐛
  - **问题**：Vocabulary 页面无法打开，控制台显示 React Error #310
  - **根本原因**：`useAuth` Hook 的 `useEffect` 依赖项包含 `loading`，导致无限循环
    - `loading` 在依赖数组中：`useEffect(..., [loading, fetchProfile])`
    - `loading` 也在 effect 中被修改：`setLoading(false)`
    - 这导致 effect 重复运行，Hook 调用顺序不一致
  - **修复**：从 `useEffect` 依赖项中移除 `loading`，只保留 `fetchProfile`
  - **影响范围**：
    - `src/lib/hooks/useAuth.ts`（修复 useEffect 依赖项）
  - **技术说明**：
    - `loading` state 的变化不应该触发 effect 重新运行
    - `fetchProfile` 使用 `useCallback` 包装，依赖项稳定
    - Effect 只在组件挂载时运行一次，`fetchProfile` 变化时重新运行

## [29.6.8] - 2026-03-31

### Fixed
- **修复 React Hook 顺序错误（React Error #310）** 🐛
  - **问题**：在 Hook 调用之后有条件返回（`if (loading) return`），违反了 React Hook 规则
  - **原因**：Vocabulary 页面使用 SWR 后，Hook 调用顺序需要保持固定
  - **修复**：
    - ✅ 所有 Hook 必须在组件顶部调用，不能有任何条件返回在 Hook 之前
    - ✅ 条件渲染逻辑完全放在 JSX 中
    - ✅ 确保 Hook 调用顺序固定，符合 React 规则
  - **影响范围**：
    - `src/app/VocabularyContent.tsx`（优化 Hook 调用顺序）
    - `src/app/TopicsContent.tsx`（重构，修复 Hook 顺序）

### Performance
- **Topics 页面缓存优化** ⚡
  - **创建 `useMaterials` Hook**：使用 SWR 管理素材数据，实现全局缓存
  - **缓存策略**：
    - ✅ 完全禁用自动重新验证：`revalidateIfStale: false`
    - ✅ 长时间缓存：`dedupingInterval: 3600000`（1小时）
    - ✅ 保留旧数据：`keepPreviousData: true`
  - **用户体验**：
    - Vocabulary ↔ Topics 反复横跳：✅ 零延迟，数据瞬间显示
    - 站内路由切换：✅ 无白屏闪烁
  - **影响范围**：
    - `src/lib/hooks/useMaterials.ts`（新建，SWR Hook）
    - `src/app/TopicsContent.tsx`（重构，使用 SWR）
  - **技术实现**：
    - 与 Vocabulary 页面保持一致的缓存策略
    - SWR 全局单例缓存，路由切换不丢失数据

## [29.6.7] - 2026-03-31

### Performance
- **修复站内路由切换时的加载闪烁** ⚡
  - **问题**：从 topics 切换到 vocabulary 时重新加载，出现白屏闪烁
  - **原因**：组件级状态在路由切换时被销毁，数据丢失
  - **修复**：
    - ✅ 使用 SWR 全局缓存替代组件级 useState
    - ✅ 配置长时间缓存（1小时）：`dedupingInterval: 3600000`
    - ✅ 完全禁用自动重新验证：`revalidateIfStale: false`
    - ✅ 移除手动 fetchWords 函数，使用 SWR mutate
  - **影响范围**：
    - `src/lib/hooks/useUserWords.ts`（更新 SWR 配置）
    - `src/app/VocabularyContent.tsx`（使用 SWR Hook）
  - **用户体验**：
    - 标签页返回：✅ 瞬时加载
    - 站内路由切换：✅ 瞬时加载（已修复）
    - 删除单词：✅ 乐观更新
  - **技术实现**：
    - SWR 是全局单例缓存
    - 路由切换不会丢失缓存数据
    - 内存缓存，响应速度极快

## [29.6.6] - 2026-03-31

### Performance
- **优化 Vocabulary 页面加载性能** ⚡
  - **问题**：切换标签时页面重新加载，出现白屏闪烁
  - **修复**：
    - ✅ 实现数据保留：首次加载显示 loading，后续切换保持旧数据
    - ✅ 瞬时加载：从 Topics 切回 Vocabulary 时立即展示缓存数据
    - ✅ 乐观更新：删除单词时立即更新列表，无需等待服务器响应
    - ✅ 安装 SWR：为未来更高级的缓存机制做准备
  - **影响范围**：
    - `src/lib/hooks/useUserWords.ts`（新建，预留 SWR Hook）
    - `src/app/VocabularyContent.tsx`（优化加载逻辑）
    - `package.json`（新增 swr 依赖）
  - **用户体验**：
    - 首次加载：显示 loading 动画
    - 再次访问：瞬时展示，零延迟
    - 删除操作：立即生效，无等待

## [29.6.5] - 2026-03-31

### Fixed
- **修复重定向循环问题（ERR_TOO_MANY_REDIRECTS）** 🔄
  - **问题**：`trailingSlash: false` 与手动 redirects 配置冲突
  - **原因**：两者同时处理末尾斜杠导致无限重定向
  - **修复**：移除手动 redirects 配置，完全交给 Next.js 默认处理
  - **影响范围**：`next.config.js`

### Fixed
- **全面优化 SEO 和 Sitemap 逻辑** 🌐

### Fixed
- **全面优化 SEO 和 Sitemap 逻辑** 🌐
  - **问题**：Google Search Console 报告重复内容和末尾斜杠问题
  - **修复**：
    - ✅ 统一 Sitemap 规范：所有 URL 不带末尾斜杠（与 trailingSlash: false 一致）
    - ✅ 添加全局 Canonical Tag：动态生成规范网址，移除斜杠和查询参数
    - ✅ 修复 Vocabulary 页面索引：改为 `index: true, follow: true`（之前被阻止）
    - ✅ 添加重定向逻辑：`/* (带斜杠)` → `/* (不带斜杠)` [301 永久重定向]
  - **影响范围**：
    - `src/components/CanonicalLink.tsx`（新建）
    - `src/app/layout.tsx` - 添加全局 Canonical Link
    - `src/app/vocabulary/page.tsx` - 允许搜索引擎索引
    - `next.config.js` - 添加 redirects 配置
  - **SEO 效果**：
    - 解决重复内容问题（带/不带斜杠）
    - 解决查询参数导致的重复索引（?mode=dictation）
    - 告诉 Google 索引迁移到规范 URL
  - **验证**：构建成功，所有检查通过

### Technical Notes
- **Canonical Tag 逻辑**：
  - 用户访问 `https://shadowhub.app/topics/daily-life/slug/?mode=dictation`
  - Canonical 标签指向 `https://shadowhub.app/topics/daily-life/slug`
  - 移除末尾斜杠和查询参数
- **Sitemap 规范**：
  - 所有 URL 不带末尾斜杠
  - 符合 trailingSlash: false 配置
- **重定向规则**：
  - 301 永久重定向告诉搜索引擎索引迁移
  - 自动将带斜杠请求重定向到不带斜杠

## [29.6.4] - 2026-03-31

### Fixed
- **修复 API 路由末尾斜杠导致的 500 错误** 🐛
  - **问题**：`GET https://shadowhub.app/api/user-words/` 返回 500 错误
  - **原因**：`next.config.js` 中 `trailingSlash: true` 导致所有 URL 自动添加末尾斜杠，API 路由无法正确处理
  - **修复**：
    - 禁用 `trailingSlash`，设置为 `false`
    - 创建 `src/lib/utils/url.ts` 工具函数，规范化 URL 拼接
    - 使用 `new URL()` 构造函数，自动处理斜杠拼接
    - 更新 `TrainingModeModal.tsx` 使用新的工具函数
  - **影响范围**：
    - `next.config.js`
    - `src/lib/utils/url.ts`（新建）
    - `src/components/topics/TrainingModeModal.tsx`
  - **标准格式**：API 路由和页面路由均不带末尾斜杠
    - ✅ `/api/user-words`
    - ✅ `/topics/daily-life/material-slug`
    - ❌ `/api/user-words/`

## [29.6.3] - 2026-03-31

### Fixed
- **修复 TrainingModeModal 预加载逻辑崩溃问题** 🐛
  - **问题 1**：重复域名拼接导致音频 URL 错误
    - 现象：`https://media.shadowhub.app/https://media.shadowhub.app/audio.mp3`
    - 原因：未检测 `audio_path` 是否已是完整 URL
    - 修复：添加 `startsWith('http')` 检测，避免重复拼接
  - **问题 2**：AbortError 导致错误日志和弹窗
    - 现象：用户跳转时控制台报错 "预加载失败"
    - 原因：将正常取消操作误判为错误
    - 修复：使用 `DOMException` 代替普通 `Error`，AbortError 时静默返回
  - **问题 3**：硬编码 localhost 域名
    - 现象：生产环境日志显示 `localhost:3000`
    - 原因：硬编码 `http://localhost:3000${practiceUrl}`
    - 修复：使用 `NEXT_PUBLIC_SITE_URL` 环境变量，自动适配生产/开发环境
  - **影响范围**：
    - `src/components/topics/TrainingModeModal.tsx`
    - `.env.local` - 新增 `NEXT_PUBLIC_SITE_URL=https://shadowhub.app`

### Technical Notes
- **预加载优化**：AbortError 不再设置 `error` 状态，避免影响页面数据判断
- **环境变量注入**：Vercel 部署时自动读取 `NEXT_PUBLIC_SITE_URL`，无需手动配置

## [29.6.2] - 2026-03-29

### Added
- **扩展翻译语言支持至 20 种** 🌍
  - **新增语言**（16 种）：Arabic (ar), Deutsch (de), Español (es), 日本語 (ja), Malay (ms), Russian (ru), Türkçe (tr), Greek (el), Indonesian (id), Korean (ko), Português (pt), Thai (th), Ukrainian (uk), Bengali (bn), Mongolian (mn), Hindi (hi)
  - **原有语言**（3 种）：中文简体 (zh), 中文繁体 (zh_hant), 越南语 (vi)
  - **总计**：20 种语言选项（含"隐藏"选项）
  - **更新文件**：
    - `src/components/TranslationLanguageSelector.tsx` - 扩展语言类型和选项列表
    - `src/components/WordTooltip.tsx` - 更新 WordDefinition 接口和语言映射
    - `src/lib/utils/wordTranslation.ts` - 同步 WordDefinition 接口
  - **UI 优化**：下拉菜单高度从 `max-h-48` 增加到 `max-h-80`，改善滚动体验
  - **向后兼容**：新语言暂时映射到英语释义，待后端 API 支持后更新

### Technical Notes
- **语言映射策略**：
  - 由于后端 GLM API 目前只支持 4 种语言（zh-CN, zh-Hant, vi, en）
  - 新增语言暂时映射到英语释义作为替代方案
  - 未来需要更新 `/api/word-definition/route.ts` 和 `dictionary_cache` 表以支持完整多语言

## [29.6.1] - 2026-03-27

### Fixed
- **修复挖空词分词索引不一致问题** 🐛
  - **问题**：v6.1 修复标点符号丢失后，WordMode 使用正则分词 `/([a-zA-Z0-9'-]+|[.,!?;:]+|\s+)/g`，但挖空脚本使用空格分词 `split(' ')`，导致索引错位
  - **现象**：数据库中 `blanks.index=5` 指向 "information"，但前端用正则分词，index 5 对应 "I"，完全挖空错误
  - **修复**：
    - WordMode 同时使用两种分词：
      - `spaceTokens`（空格分词）：匹配 `blanks.index`
      - `renderTokens`（正则分词）：用于渲染原文
    - 添加索引转换逻辑：将空格分词的 index 转换为正则分词的 index
    - 保留 v6.1 的标点符号显示效果，同时修正挖空位置
  - **向后兼容**：数据库中的 blanks 数据无需修改，前端自动正确匹配
  - **影响范围**：`src/components/WordMode.tsx`

- **修复挖空词撇号丢失问题** 🐛
  - **问题**：句子 "It's 07786643091." 挖空后显示为 "[ ]s 07786643091."，撇号丢失
  - **根本原因**：数据库中使用的是 **U+2019**（弯撇号/智能引号），但正则表达式 `/([a-zA-Z0-9'-]+|[.,!?;:]+|\s+)/g` 只匹配 **U+0027**（ASCII撇号）
  - **字符编码分析**：
    - `It's` = `I` (U+0049) + `t` (U+0074) + `'` (U+2019 ❌) + `s` (U+0073)
    - 正则只匹配 U+0027，所以 U+2019 被当作标点符号
    - "It's" 被拆分成 `["It", "'", "s"]`，而不是 `["It's"]`
  - **修复**：更新正则表达式为 `/([a-zA-Z0-9'\u2019-]+|[.,!?;:]+|\s+)/g`，同时支持 ASCII 撇号（U+0027）和弯撇号（U+2019）
  - **效果**：`[     ] 07786643091.`（完整保留撇号）
  - **影响范围**：`src/components/WordMode.tsx`

### Technical Notes
- **分词方式对比**：
  - 空格分词（挖空脚本）：`"It's 07786643091.".split(' ')` → `["It's", "07786643091."]`
  - 正则分词（v6.1）：`"It's 07786643091.".match(/([a-zA-Z0-9'\u2019-]+|[.,!?;:]+|\s+)/g)` → `["It's", " ", "07786643091", "."]`
  - **关键**：正则分词的索引包含空格和标点，不能直接用于 blanks.index

- **索引转换逻辑**：
  ```typescript
  let spaceTokenCount = 0;
  let renderIndex = -1;

  for (let i = 0; i < renderTokens.length; i++) {
    const token = renderTokens[i];
    // 跳过纯空格和纯标点的 token
    if (/^\s+$/.test(token) || /^[.,!?;:]+$/.test(token)) {
      continue;
    }
    // 找到第 blank.index 个非标点/空格的 token
    if (spaceTokenCount === blank.index) {
      renderIndex = i;
      break;
    }
    spaceTokenCount++;
  }
  ```

## [29.6.0] - 2026-03-27

### Added
- **训练模式选择弹窗** 🎯
  - 新增 `TrainingModeModal` 组件，提供 Dictation 和 Shadowing 两种训练模式选择
  - 对齐 ShadowHub 品牌视觉规范：
    - Dictation 模式：纯白纸张 + 紫色笔图标，展示书写动画
    - Shadowing 模式：紫色头戴式耳机图标，展示发光动画
    - 浅灰色背景框 + 紫色主题色（#9333EA）
  - 弹窗设计：居中显示，带关闭按钮（X），点击背景关闭
  - CSS 动效：悬停时图标轻微放大，点击时缩放反馈

- **React Error Boundary 防御** 🛡️
  - 新增 `TrainingModeErrorBoundary` 组件，包裹弹窗防止崩溃
  - 弹窗异常时显示友好错误提示，不影响页面其他功能
  - 错误信息记录到控制台，方便问题排查

### Changed
- **素材卡片交互重构** 🎨
  - **Topics 页面**（素材列表页）：
    - 移除原有 `<Link>` 标签直接跳转
    - 点击 Dictation/Shadowing 按钮触发弹窗选择
    - 保持原有卡片样式（圆角、阴影、难度标签、时长标签）
    - 添加按钮点击缩放反馈（`active:scale-95`）
  - **CategoryPage 页面**（分类详情页）：
    - 卡片封面和按钮点击统一触发弹窗
    - 移除直接跳转逻辑，改为通过弹窗选择模式

- **URL 格式统一** 🔗
  - 练习页面 URL 格式：`/topics/{category-slug}/{material-slug}/?mode={mode}`
  - 使用查询参数 `?mode=dictation` 或 `?mode=shadowing`
  - 分类名称自动转换为英文 slug（中文 → 英文）
  - 修复旧版 URL 格式问题（路径模式 → 查询参数模式）

### Performance
- **静默异步预加载机制** ⚡
  - 弹窗打开时立即预加载音频和挖空数据，不阻塞 UI
  - 音频预加载：
    - 使用 `canplaythrough` 事件监听，等待音频可播放
    - 超时机制：5 秒后自动放弃，不影响用户操作
    - Promise 包装，确保异步加载不阻塞主线程
  - 挖空数据预加载：
    - Fetch API 请求 `/api/cloze/{materialId}`
    - 超时机制：3 秒后自动放弃
    - 静默失败，预加载失败不影响正常跳转

- **容错处理** 🛡️
  - 预加载失败时只打印错误日志，不抛出异常
  - 用户点击弹窗按钮时，无论预加载成功或失败都能正常跳转
  - 添加详细的调试日志，方便排查问题

### Fixed
- **API 路由 Dynamic Server Usage 构建错误** 🔧
  - **问题**：Next.js 构建时报错 `Dynamic server usage: Route /api/user-words/check/ couldn't be rendered statically because it used request.url`
  - **原因**：API 路由使用 `request.url` 获取查询参数，无法在构建时静态化
  - **修复**：在相关 API 路由文件顶部添加 `export const dynamic = 'force-dynamic'`，强制声明为动态路由
  - **影响文件**：
    - `src/app/api/user-words/check/route.ts` - 检查单词是否在生词本
    - `src/app/api/user-words/route.ts` - 生词本增删改查接口
  - **验证**：本地 `npm run build` 构建成功，无 Dynamic Server Usage 错误
  - **技术说明**：
    - Next.js 14 默认尝试静态化所有路由
    - 使用运行时请求参数（`request.url`、`request.headers`）的 API 必须显式声明为动态
    - `export const dynamic = 'force-dynamic'` 告诉 Next.js 跳过静态化，始终在运行时渲染

### Technical Details
- **新增文件**：
  - `src/components/topics/TrainingModeModal.tsx` - 弹窗组件
  - `src/components/topics/TrainingModeModal.css` - 弹窗样式
  - `src/components/topics/TrainingModeErrorBoundary.tsx` - 错误边界

- **修改文件**：
  - `src/app/TopicsContent.tsx` - 集成弹窗功能
  - `src/components/topics/CategoryPage.tsx` - 集成弹窗功能
  - `src/components/topics/MaterialCardWithModal.tsx` - 添加按钮和弹窗

- **删除文件**：
  - `src/app/debug-modal/` - 临时测试路由（已清理）

- **用户体验改进**：
  - 移除原有 3D 翻页动画，改为简洁的弹窗选择
  - 统一交互逻辑：卡片整体和按钮都能触发弹窗
  - 点击反馈：按钮缩放、鼠标悬停效果

---

## [29.5.2] - 2026-03-26

### Performance
- **修复播放按钮性能瓶颈** ⚡
  - 使用 `useCallback` 缓存 `getCdnUrl` 函数，防止每帧渲染重复调用
  - 使用 `useMemo` 缓存 `playerInfo` 对象，避免重复计算 CDN URL
  - 删除 `getCdnUrl` 内部的高频 `console.log`，减少主线程阻塞
  - 解决点击播放按钮时控制台日志爆炸问题

- **优化音频播放延迟** 🎵
  - 修复音频加载策略：从组件挂载时预加载改为用户点击时触发
  - 移动浏览器兼容性优化：避免浏览器阻止预加载导致的 readyState 停留在 0
  - 使用 `requestAnimationFrame` 异步更新状态，避免 React 渲染阻塞音频启动
  - 优化 Safari 权限激活逻辑：只在 `readyState === 0` 时才激活权限
  - 移除 `flushSync` 强制同步更新，改用自然的事件循环处理状态

### Changed
- **AudioPlayer 组件**
  - 移除组件挂载时的 `audio.load()` 调用
  - 在 `playSentence` 函数中添加 `audio.load()` 触发加载
  - 等待 `canplay` 事件触发后再执行 seek 和 play 操作
  - 临时移除 `crossorigin="anonymous"` 以测试 CORS 影响

- **PracticePage 组件**
  - 优化 `handlePlayOrNext` 函数，优先播放后更新状态
  - 改进 Safari 权限激活逻辑，避免不必要的 play() 调用
  - 统一使用缓存的 `playerInfo` 替代所有 `getPlayerInfo(material)` 调用

### Technical Details
- **修复前问题**：
  - 点击播放按钮时，`getCdnUrl` 函数每秒被调用 4-10 次（timeupdate 事件触发）
  - 每次调用打印 6 条日志，导致控制台爆炸和主线程阻塞
  - 音频 readyState 停留在 0，导致播放延迟数秒

- **修复后效果**：
  - 控制台清静，无高频日志输出
  - 音频 readyState 正常提升到 4（HAVE_ENOUGH_DATA）
  - 播放响应速度显著提升

---

## [29.5.1] - 2026-03-26

### Fixed
- **SEO 优化** 🔍
  - 添加 `public/robots.txt`，允许所有爬虫访问首页和公开素材页
  - 优化爬可达性，移除全局 noindex 屏蔽

### Performance
- **缓存 URL 计算** ⚡
  - 使用 `useMemo` 缓存 `getCdnUrl` 结果，防止每帧渲染重复计算
  - 解决并发请求挤兑导致的音频延迟问题

### Cleanup
- **修复 Auth 监听器** 🔧
  - 防止重复订阅，避免控制台密集日志刷屏
  - 清理冗余日志（移除 15+ 个 Auth state changed 日志）
  - 移除高频调试日志（视频/音频 URL 验证等）

### Build
- ✅ 成功通过生产环境构建测试

---

## [29.4.0] - 2026-03-24

### Added
- **付费素材分级拦截功能** 🔒
  - 实现素材详情页的「分级拦截」功能，引导用户升级到 PRO 账户
  - 创建 `PremiumBlocker` 组件：紫色渐变背景 + 锁头图标 + Unlock PRO 按钮
  - 拦截逻辑：`is_premium === true && !isPro` 时启用拦截
  - 左栏（视频区）：保持正常，允许预览
  - 中栏（练习区）：完全隐藏播放控制和练习组件，替换为拦截面板
  - 右侧（Transcript）：保持显示但半透明，点击时提示升级

### Changed
- **PracticePage.tsx**
  - 添加 `is_premium` 字段到 Material 接口
  - 添加拦截状态判定：`isPro = false`（默认所有用户非 Pro），`isBlocked = material?.is_premium && !isPro`
  - 中栏条件渲染：拦截状态显示 PremiumBlocker，否则显示完整练习组件
  - 右侧 Transcript 点击拦截：Toast 提示 + 视觉引导至拦截按钮

- **ClickableTranscript.tsx**
  - 添加 `isBlocked` prop 支持拦截状态
  - 拦截状态样式：锁图标覆盖层 + 半透明效果 + cursor-not-allowed

### Technical Details
- 素材分类：前 200 个免费，第 201 个起为付费素材（is_premium = true）
- 当前付费素材：1 个
- 测试 URL：http://localhost:3000/topics/Science and Facts/what-if-the-earth-stopped-orbiting-the-sun

---

## [27.8.0] - 2026-03-23

### Fixed
- **修复练习记录保存问题** 🎯
  - 新练习页面缺少连胜统计更新函数调用
  - 添加 `onDictationComplete` 和 `onShadowingComplete` 导入
  - 练习完成后正确更新 `practice_stats` 表的连胜数据

### 问题原因
- 新页面 `PracticePage.tsx` 已调用 `savePracticeRecord` 保存练习记录
- 但缺少连胜统计更新逻辑，导致 Profile 页面看不到更新
- 旧页面 `/practice` 有完整逻辑，但新页面迁移时遗漏

### 核心解决
- 导入 streak 函数：`import { onDictationComplete, onShadowingComplete } from '@/lib/supabase/streak'`
- 在 `handleDictationComplete` 中添加连胜更新调用

## [27.5.0] - 2026-03-22

### Changed
- **闪卡布局重构** 🎨
  - 使用 justify-between 均匀分配垂直空间
  - 释义保留在顶部（中文 22px + 英文 16px）
  - 例句块移到正中心位置
  - 音标和喇叭移到例句块下方（12px 间距）
  - 输入框自然在底部，移除多余留白

### Fixed
- **解决空间分布不均** 📐
  - 上半部分信息拥挤问题已解决
  - 输入框上方留白过多已优化
  - 视觉重心下移，整体更平衡

---

## [27.4.0] - 2026-03-22

### Added
- **拼写错误抖动反馈** 📳
  - 输入完整但错误时触发左右抖动效果
  - 添加 shake 动画到全局样式

### Changed
- **闪卡正面视觉打磨** ✨
  - 增加释义区域与例句块的留白（呼吸感更强）
  - 例句块使用半透明蓝色背景 (bg-blue-50/50)
  - 音标行重排：音标 | US | UK（用竖线分隔）
  - "Show Answer" 只保留英文，去除中文

- **交互状态优化** 🎯
  - "Show Answer" Hover 变色效果 (hover:text-blue-600)
  - 输入框聚焦时增加阴影效果 (focus:shadow-sm)
  - 优化按钮布局和间距

### Fixed
- **自评逻辑修复** 🔄
  - "仍需学习"翻转回正面，继续练习当前单词
  - "已掌握"才切换到下一个单词

---

## [27.3.0] - 2026-03-22

### Added
- **查看答案功能** 👁️
  - 输入框下方添加"查看答案"按钮
  - 快捷键支持：输入框为空时按回车键
  - 触发卡片翻转动画

- **自评功能** 📊
  - 背面添加"仍需学习"和"已掌握"按钮
  - 查看答案时默认高亮"仍需学习"（橙色）
  - 状态提示："Great job!" 或 "Keep practicing!"

### Changed
- **视觉布局优化** 🎨
  - 减少空白间隙，优化卡片间距
  - 词性置顶显示（小字居中）
  - 释义层级：中文主（4xl）+ 英文辅（base 灰色）
  - 例句块美化：蓝色背景 + 圆角
  - 音标和喇叭图标对齐优化

- **状态反馈增强** ✨
  - 拼写正确时卡片边缘绿色发光效果
  - 输入框圆角调整为 rounded-xl

### Fixed
- **空白间隙问题** 📏
  - 移除释义区域的 flex-1
  - 统一间距为 mb-2/mb-3
  - 输入框固定在底部（mt-auto）

---

## [27.2.0] - 2026-03-22

### Added
- **闪卡训练模式优化** ⚡
  - 正面显示中英文双语释义（中文主 + 英文辅）
  - 音标 + US/UK 发音按钮移到输入框上方
  - 输入框自动聚焦，优化用户体验

### Changed
- **释义视觉层级优化** 🎨
  - 中文翻译：3xl 字号，加粗，深色（主要提示）
  - 英文定义：lg 字号，灰色（辅助参考）
  - 帮助用户通过中文和声音回忆拼写

### Fixed
- **训练模式音频播放功能** 🔊
  - 修复音频 URL 传递问题
  - 确保 US/UK 发音按钮可以正常点击播放

---

## [27.1.1] - 2026-03-22

### Added
- **单词页面添加 US/UK 发音播放按钮** 🔊
  - 音标旁边显示可点击的 US/UK 按钮（带文字标签）
  - 蓝色按钮：美音 (US)
  - 紫色按钮：英音 (UK)

### Fixed
- **修复单词页面音频数据缺失问题** 🔧
  - API 改为分步查询（user_words → dictionary_cache）
  - 添加脚本为现有单词填充音频 URL
  - 修复 dictionary_cache 表主键使用错误（word 不是 id）

### Scripts
- **新增脚本**: `scripts/update_word_audio.py`
  - 批量为现有单词获取 US/UK 音频 URL
  - 支持从 dictionaryapi.dev 获取音频

### Documentation
- 更新 `docs/dictionary_and_translation_implementation_v27.md`
  - 添加问题 7：单词页面缺失发音按钮的完整解决方案

---

## [27.1.0] - 2026-03-22

### Fixed
- **修复答案泄露问题** 🔒
  - 改进 Cloze 打码算法，防止用户在填空句中看到答案
  - 使用双层匹配策略：精确匹配 + 宽松变形匹配
  - 填空位置使用蓝色下划线样式提示

### Added
- **闪卡背面显示完整原句** 📄
  - 在闪卡翻转后的背面展示完整的 context_sentence
  - 帮助用户在查看答案时理解完整语境

### Changed
- **填空句样式优化** 🎨
  - 使用蓝色高亮和下划线标记填空位置
  - 使用 `dangerouslySetInnerHTML` 渲染带样式的填空句

---

## [25.0.0] - 2026-03-21

### Added
- **点词翻译功能** 📖✨
  - 点击 Transcript 中的单词即可查看释义
  - 多语言支持（简体中文、繁体中文、越南语）
  - 悬浮气泡显示单词音标、释义和例句
  - 智能缓存机制（减少 API 调用成本 80%+）
  - 支持动态扩展新语言（ja, ko, th 等）

- **生词本管理功能** 📚
  - 一键将单词加入生词本
  - 掌握状态追踪（learning/familiar/mastered）
  - 生词增删改查 API 接口
  - 按掌握状态筛选和分页

- **词典缓存系统** 💾
  - 新增 `dictionary_cache` 表存储单词释义
  - 智能缓存策略（优先读缓存，未命中才调用 API）
  - 断点续传（只翻译缺失的语言）
  - 缓存命中统计和热门词汇追踪

- **多语言架构优化** 🌍
  - 使用 JSONB 存储多语言释义
  - 新增 `supported_languages` 配置表
  - 预留接口支持未来语言扩展
  - 数据格式：`{"zh-CN": "...", "zh-Hant": "...", "vi": "..."}`

### Database
- **新增数据库表**：
  - `user_words` - 用户生词本表（支持 RLS 策略）
  - `dictionary_cache` - 词典缓存表（JSONB 多语言释义）
  - `supported_languages` - 语言配置表

- **数据库迁移文件**：
  - `supabase/migrations/create_user_words_table.sql`
  - `supabase/migrations/create_dictionary_cache_table.sql`
  - `supabase/migrations/update_dictionary_cache_multilingual.sql`

### API
- **新增 API 接口**：
  - `POST /api/user-words` - 添加生词
  - `GET /api/user-words` - 获取生词列表（支持筛选、分页）
  - `PATCH /api/user-words` - 更新掌握状态
  - `DELETE /api/user-words` - 删除生词
  - `POST /api/word-definition` - 查询单词释义（带缓存）

### Components
- **新增前端组件**：
  - `src/components/WordTooltip.tsx` - 单词释义悬浮气泡
  - `src/components/ClickableTranscript.tsx` - 可点击单词的 Transcript
  - 集成到 `PracticePage.tsx`

### Utils
- **新增工具函数**：
  - `src/lib/utils/wordTranslation.ts` - 分词和翻译工具
  - `src/lib/supabase/client.ts` - 新增 UserWord 类型定义

### Scripts
- **新增脚本**：
  - `scripts/prepopulate_dictionary_cache.py` - 批量预生成词汇缓存
  - `scripts/test_multilingual_cache.py` - 多语言测试脚本
  - `scripts/test_cache_top5.py` - 快速测试脚本

### Documentation
- **新增文档**：
  - `docs/dictionary_and_translation_implementation.md` - 完整实现总结
  - `docs/dictionary_cache_guide.md` - 词典缓存优化指南
  - 更新 `claude-code-guide.md` - 添加新文档路径和恢复命令

### Performance
- **API 成本优化**：
  - 缓存命中时响应时间从 1-2 秒降至 < 100ms
  - 预计节省 80%+ API 调用成本
  - 支持预生成模式（7,139 个高频词）

### Technical
- **修改文件**：
  - `src/app/topics/[category]/[slug]/PracticePage.tsx` - 集成可点击 Transcript
  - `src/lib/supabase/client.ts` - 新增 UserWord 类型
  - `claude-code-guide.md` - 更新模块索引和恢复命令

### Testing
- **测试结果**：
  - ✅ Top 10 单词测试：9/10 成功
  - ✅ 生成 180 条多语言翻译
  - ✅ 断点续传逻辑验证通过
  - ✅ 构建成功，无错误

---

## [24.5.0] - 2026-03-21

### Fixed
- **缩写词分词问题修复** 🔧
  - 修复前端分词正则表达式，支持缩写词（如 what's, don't, can't）
  - 正则从 `/[a-zA-Z0-9-]+/g` 更新为 `/[a-zA-Z0-9-']+/g`
  - 缩写词现在被正确识别为一个完整的单词
  - 同时保持对连字符词（如 self-esteem）的支持

### Changed
- **前端组件更新**：
  - `src/components/DictationBox.tsx` - 更新分词正则
  - `src/components/WordMode.tsx` - 更新分词正则

### Documentation
- **知识库更新**：
  - `docs/knowledge_base.md` - 添加缩写词分词问题记录
  - 将连字符词和缩写词问题合并到同一章节
  - 添加数据库说明（无需更新）

---

## [24.4.0] - 2026-03-21

### Added
- **Dictation Sentence 模式原文容器优化** 🎯
  - 添加始终显示的原文容器卡片，避免模式切换时的布局跳动
  - Sentence 模式下使用 `invisible` 隐藏原文但保留高度
  - Word 模式下显示占位提示文字
  - 翻译按钮始终在卡片右上角（绝对定位）
  - 容器设置最小高度（min-h-[80px]），保持视觉一致性

### Changed
- **翻译显示逻辑重构**：
  - 翻译文本合并到原文容器内，使用分隔线区分
  - 多语言翻译正常显示，作为听写辅助参考
  - 统一 Dictation 和 WordMode 的容器结构

### Technical
- **修改文件**：
  - `src/components/DictationBox.tsx` - 添加原文容器，优化布局

---

## [24.3.0] - 2026-03-21

### Changed
- **多语言翻译按钮布局优化（第二版）** 🎨
  - 优化按钮位置，确保始终在卡片内部
  - 消除按钮占据的垂直空间，原文紧贴卡片顶部
  - 压缩容器 padding（Dictation: pt-2, Shadowing: p-4）
  - 按钮尺寸精简（padding: 1, 图标: 3）

### Technical
- **修改文件**：
  - `src/components/TranslationLanguageSelector.tsx` - 压缩按钮尺寸
  - `src/components/DictationBox.tsx` - 优化按钮定位和容器布局
  - `src/components/WordMode.tsx` - 绝对定位在卡片右上角
  - `src/components/ShadowingPanel.tsx` - 保持原有 padding

### Detail
- **Dictation-Word 模式**：按钮在挖空卡片右上角（absolute top-2 right-2）
- **Dictation-Sentence 模式**：显示翻译时在翻译卡片内，未显示时在 Label 区域
- **Shadowing 模式**：按钮在参考文本卡片右上角，保持 1rem padding

---

## [24.2.0] - 2026-03-21

### Changed
- **多语言翻译按钮布局优化** 🎨
  - 改为绝对定位（Absolute Positioning），固定在练习卡片右上角
  - 移除冗余容器间距，正文内容贴近卡片顶部
  - 压缩按钮尺寸（padding: 1.5 → 1，图标: 3.5 → 3），更精致
  - Dictation 和 Shadowing 两个模式同步生效

### Technical
- **修改文件**：
  - `src/components/TranslationLanguageSelector.tsx` - 压缩按钮尺寸
  - `src/components/DictationBox.tsx` - 绝对定位布局
  - `src/components/ShadowingPanel.tsx` - 绝对定位布局

---

## [24.1.0] - 2026-03-21

### Added
- **Shadowing 模式多语言翻译支持** 🌐
  - 同步 Dictation 模式的多语言翻译切换功能到 Shadowing 模式
  - 支持简体中文、繁体中文、越南语三种翻译语言
  - 新增翻译语言选择器，位于参考文本区域右上角
  - 翻译文本根据选择的语言动态更新

- **状态同步机制** 🔗
  - 两个模式使用同一个 localStorage 键值存储语言偏好
  - 从 Dictation 切换到 Shadowing 时，语言选择自动同步
  - 右侧 Transcript 列表翻译文本与中栏翻译状态同步

- **UI 优化** 🎨
  - 移除 "Original:" 和翻译语言标签，界面更简洁
  - 翻译按钮居右显示，与原文本对齐
  - 移除提示文字，减少视觉干扰

### Changed
- **ShadowingPanel 组件**：
  - 新增 `translationLanguage`, `showTranslation`, `onTranslationLanguageChange` props
  - 添加内部翻译状态管理（兼容无外部 props 情况）
  - 集成 `TranslationLanguageSelector` 组件

- **PracticePage 组件**：
  - 将翻译状态传递给 ShadowingPanel 组件
  - 统一管理 Dictation 和 Shadowing 两个模式的翻译状态

### Technical
- **修改文件**：
  - `src/components/ShadowingPanel.tsx` - 添加多语言翻译支持
  - `src/app/topics/[category]/[slug]/PracticePage.tsx` - 状态管理同步

---

## [24.0.0] - 2026-03-20

### Changed
- **移动端 Topics 页面优化** 📱
  - 移动端（< 640px）每个分类只显示 1 个素材卡片
  - 桌面端（≥ 640px）保持显示 4 个素材卡片
  - 使用 Tailwind CSS 响应式类 `hidden sm:block` 实现自适应布局

### Technical
- **修改文件**：
  - `src/app/topics/page.tsx` - 添加响应式显示逻辑

---

## [23.0.0] - 2026-03-20

### Added
- **翻译 UI 交互重构** 🎨
  - 新增组合翻译面板：语言选择器 + Translate 按钮合并为一个弹出面板
  - 语言图标按钮：简洁的多语言图标触发器（移除文字标签）
  - 二阶段操作：先选择语言，再点击 Translate 应用更改
  - 面板点击外部自动关闭，提升用户体验

- **翻译语言前缀显示** 🌐
  - 中栏翻译文本显示语言前缀（如"中文 (简体): [翻译文本]"）
  - 支持中文（简体）和越南语（Tiếng Việt）两种语言
  - 自动读取数据库 `translation.zh` 和 `translation.vi` 字段

- **右侧 Transcript 联动优化** 🔗
  - 恢复独立的 Show/Hide 按钮
  - 点击 Show 同时显示原文稿和翻译（使用中栏选择的语言）
  - 翻译语言与中栏练习区域保持同步

### Changed
- **TranslationLanguageSelector 组件重构** ⚙️
  - 移除"翻译设置"和"选择语言"标签，简化 UI
  - 移除"隐藏"选项，改为独立的 Translate 按钮控制
  - 优化面板尺寸（w-56），更紧凑
  - 图标尺寸缩小（w-3.5 h-3.5），更精致

### Fixed
- **localStorage 持久化逻辑** 💾
  - 新增 `translation-show-preference` 存储键，独立控制显示状态
  - 解决刷新后翻译状态丢失问题
  - 用户偏好设置跨素材保持

### Technical
- **新增文件**：
  - `src/components/TranslationLanguageSelector.tsx` - 核心翻译选择器组件
  - `docs/translation-ui-refactor.md` - 完整的重构文档

- **修改文件**：
  - `src/app/topics/[category]/[slug]/PracticePage.tsx` - 恢复 Show 按钮和联动逻辑
  - `src/components/DictationBox.tsx` - 添加语言前缀显示
  - `src/components/WordMode.tsx` - 添加语言前缀显示

### UI/UX 改进
- 面板样式：白色背景、灰色边框、圆角阴影
- Translate 按钮：蓝色背景、白色文字、醒目突出
- 语言标签：粗体显示，翻译文本斜体，层次分明
- 点击外部自动关闭面板，符合用户习惯

---

## [22.0.0] - 2026-03-20

### Added
- **越南语翻译功能完整上线** 🇻🇳
  - 完成所有 201 个素材的越南语翻译（100% 覆盖率）
  - 新增 6 种翻译风格体系，适配不同素材类型
  - 总翻译句数超过 15,000 句

- **翻译风格体系** 📝
  - 💼 职场正式：用词正式，术语准确，无俚语（tham nhũng, hối lộ）
  - 💪 励志哲学：文学化表达，简洁有力（bồn chồn, suy nghĩ, bình yên）
  - 🏛️ 文化历史：正式叙述，客观准确（chiến binh, đột kích, hoành gia）
  - 🔬 科学/TED：术语严谨，无情绪，不使用语气词
  - 🎯 IELTS学术：正式表达，术语规范（nghiên cứu tình huống, phỏng vấn）
  - 🏠 日常对话：口语化，语气词（có chứ, à, mà, nhé, cậu）

- **批量翻译脚本** 🤖
  - `translate_to_vietnamese.py` - 核心翻译模块（V1.0）
  - `translate_business_to_vietnamese.py` - 职场商务类翻译脚本
  - `translate_motivational_to_vietnamese.py` - 励志哲学类翻译脚本
  - `translate_culture_to_vietnamese.py` - 文化历史类翻译脚本
  - `translate_bbc_to_vietnamese.py` - BBC Learning English 翻译脚本

- **翻译成果统计** 📊
  - 职场商务类：1 个素材（Corruption - 腐败）
  - 励志哲学类：1 个素材（Empty Your Mind - 86 句）
  - 文化历史类：7 个素材（262 句）
  - BBC Learning English：8 个素材（737 句）
  - 艺术文化类：1 个素材（Handel's Messiah - 37 句）
  - 故事/动画/日常：4 个素材（228 句）

### Changed
- **多语言数据结构** 🌐
  - transcript.translation 字段现在支持多语言：
    ```json
    {
      "translation": {
        "zh": "中文翻译",
        "vi": "Tiếng Việt翻译",
        "en": "English translation"
      }
    }
    ```

- **翻译规则引擎** ⚙️
  - 新增 `.shadowhub/translation-rules.json`（V20.2）
  - 结构化规则定义，分类风格映射
  - 通用规则：反问句式、指代对象、角色追踪、语义分析
  - 词汇规则：特定词汇的标准翻译

### Technical Details
- 修改文件：
  - `scripts/translate_to_vietnamese.py` - 核心翻译模块（V1.0）
  - `scripts/translate_business_to_vietnamese.py` - 职场商务类脚本
  - `scripts/translate_motivational_to_vietnamese.py` - 励志哲学类脚本
  - `scripts/translate_culture_to_vietnamese.py` - 文化历史类脚本
  - `scripts/translate_bbc_to_vietnamese.py` - BBC 翻译脚本
  - `.shadowhub/translation-rules.json` - 翻译规则引擎
  - `package.json` - 版本号更新至 21.0.0

- 翻译质量：
  - ✅ 术语准确：tham nhũng（腐败）、hối lộ（贿赂）、bóng băng（冰球）
  - ✅ 风格适配：正式叙述、口语对话、文学化表达
  - ✅ 自动修复：19 处中文混杂问题自动修正

---

## [19.1.0] - 2026-03-17

### Added
- **多领域语境自适应翻译系统** 🎯
  - V19.5 System Prompt：根据素材分类自动选择翻译风格
  - 科学科普类：术语严谨，不带情绪，无语气词
  - 职场正式类：用词正式，无口语俚语
  - 日常生活类：口语俚语 + 强制语气词（啊、呢、吧、嘛）

### Fixed
- **口语翻译质量大幅提升** 💬
  - 拒绝"词典中文"：You were joking → "你逗我呢？"（非"你在开玩笑吗"）
  - 俚语正确处理：pulling my leg → "拿我开涮"（非"拉我的腿"）
  - 整蛊语境对齐：I got you → "嘿嘿，上当了吧？"（非"我捉到你了"）
  - 情绪对齐：Thanks for saying those nice things → "不过，谢啦，难得听你这么夸我"

### Improved
- **格式化约束机制** 📏
  - 物理隔离：带编号列表输入，严禁句子合并
  - 长句拆分：that comes when → "源于...所带来的..."
  - 引导句处理：Take the belief that → "采取这一信念：..."
  - 不完整句处理：逗号结尾的句子保持不完整状态

### Technical Details
- 更新文件：
  - `scripts/retranslate_with_glm_v19.py` - V19.5 多领域语境自适应翻译脚本
  - `claude code guide.md` - 更新多语言翻译功能升级文档（V19.1）
  - `POTOKEN_GUIDE.md` - YouTube PO Token 获取指南
  - `scripts/requirements.txt` - Python 依赖列表

## [19.0.0] - 2026-03-17

### Added
- **多语言翻译功能升级** 🌍
  - 新增 TypeScript 类型定义（Translation、Sentence 接口）
  - 支持多语言 JSONB 格式：`{"zh": "中文", "en": "English", "ja": "日本語"}`
  - 向后兼容旧格式（string）和新格式（Translation 对象）
  - 添加辅助函数：`getTranslation()`、`hasTranslation()`

- **专业级上下文感知翻译脚本** 🤖
  - `scripts/retranslate_with_glm.py`：使用 GLM-4 API 批量翻译
  - 每批 8 句，保持上下文连贯
  - 注入视频标题作为翻译语境
  - 地理常识补丁（自动修正"之上"为"以北"等）
  - 单句重试逻辑（自动检测并修正问题翻译）

- **单句修复和批量恢复工具** 🔧
  - `scripts/fix_failed_translations.py`：修复单个失败句子
  - `scripts/restore_empty_translations.py`：批量恢复空翻译

### Fixed
- **前端渲染错误修复** 🐛
  - 修复 `Error: Objects are not valid as a React child`
  - 所有组件使用向后兼容逻辑：
    ```typescript
    typeof sentence.translation === 'string'
      ? sentence.translation
      : (sentence.translation?.['zh'] || '')
    ```
  - 修复文件：
    - `src/components/DictationBox.tsx`
    - `src/components/ShadowingPanel.tsx`
    - `src/components/WordMode.tsx`
    - `src/app/topics/[category]/[slug]/PracticePage.tsx`
    - `src/app/practice/page.tsx`
    - `src/app/tools/timestamp-marker/page.tsx`

- **翻译质量优化** ✨
  - 上下文背景注入：获取视频标题作为翻译语境
  - 地理常识补丁：`above the United States` → `美国以北`（非`美国之上`）
  - 自动检测地理问题并触发单句重试

### Technical Details
- 新增文件：
  - `src/types/index.ts` - TypeScript 类型定义
  - `scripts/retranslate_with_glm.py` - 专业级翻译脚本
  - `scripts/fix_failed_translations.py` - 单句修复工具
  - `scripts/restore_empty_translations.py` - 批量恢复工具
  - `supabase/migrations/add_multilingual_translation.sql` - 数据库迁移

- 数据结构示例：
  ```json
  {
    "transcript": [
      {
        "id": 1,
        "text": "Canada is located above the United States.",
        "startTime": 0.0,
        "endTime": 3.5,
        "translation": {
          "zh": "加拿大位于美国以北。",
          "en": "Canada is located north of the United States.",
          "ja": "カナダは米国の北に位置します。"
        }
      }
    ]
  }
  ```

- 验证结果：
  - ✅ Canada 素材：40/40 句翻译成功
  - ✅ Empty Your Mind 素材：86/86 句翻译成功
  - ✅ 地理问题修正：`美国之上` → `美国以北`

- 构建验证：✅ 231 个静态页面全部生成成功

---

## [18.1.4] - 2026-03-17

### Fixed
- **个人中心跳转到指定句子** 📍
  - 修复从个人中心点击未完成句子时无法定位到该句子的问题
  - URL 参数 `start` 现在正确应用到对应模式的索引
  - 添加 useEffect 监听 startIndex 和 mode 变化

### Technical Details
- 修改文件：
  - `src/app/topics/[category]/[slug]/PracticePage.tsx`
    - 添加 useEffect 处理 start 参数
    - 根据当前模式设置对应的索引（dictationIndex 或 shadowingIndex）
  - `claude code guide.md` - 新增问题文档和解决方案说明

- 修复逻辑：
  - 从个人中心跳转时，URL 带有 `?mode=xxx&start=N` 参数
  - useEffect 监听 startIndex 和 mode，自动设置对应模式的索引
  - 保持模式独立进度追踪不受影响

## [18.1.3] - 2026-03-17

### Fixed
- **个人中心跳转到指定句子** 📍
  - 修复从个人中心点击未完成句子时无法定位到该句子的问题
  - URL 参数 `start` 现在正确应用到对应模式的索引
  - 使用 useEffect 监听 startIndex 和 mode 变化

### Technical Details
- 修改文件：
  - `src/app/topics/[category]/[slug]/PracticePage.tsx`
    - 添加 useEffect 处理 start 参数
    - 根据当前模式设置对应的索引（dictationIndex 或 shadowingIndex）

- 修复逻辑：
  - 从个人中心跳转时，URL 带有 `?mode=xxx&start=N` 参数
  - useEffect 监听 startIndex 和 mode，自动设置对应模式的索引
  - 保持模式独立进度追踪不受影响

## [18.1.2] - 2026-03-17

### Fixed
- **模式独立进度追踪** 🔄
  - 修复 Dictation/Shadowing 模式切换时进度丢失问题
  - Dictation 模式和 Shadowing 模式现在维护各自独立的句子索引
  - 切换模式时自动恢复到该模式的上次进度
  - 修复 Transcript 点击跳转逻辑

### Technical Details
- 修改文件：
  - `src/app/topics/[category]/[slug]/PracticePage.tsx`
    - 删除重复的 `currentSentenceIndex` 状态定义
    - 修复 Transcript 点击事件，使用模式独立的索引更新函数
  - `claude code guide.md` - 新增问题文档和解决方案说明

- 问题根因：重复的变量声明导致计算值无法响应状态变化
- 解决方案：使用 `mode === 'dictation' ? dictationIndex : shadowingIndex` 动态选择索引

## [18.1.1] - 2026-03-17

### Changed
- **UI 优化：进度标识位置调整** 📍
  - 将进度标识从左栏移至中栏播放控制组件上方
  - 确保移动端视频隐藏后用户仍能看到练习进度
  - 样式与控制按钮视觉对齐

- **UI 优化：左栏添加素材类型标题** 🏷️
  - 左栏添加 "Video" / "Audio" 标题
  - 参考右侧 Transcript 标签样式（font-semibold, text-gray-900）
  - 左对齐，保持三栏视觉一致

### Technical Details
- 修改文件：
  - `src/app/topics/[category]/[slug]/PracticePage.tsx` - UI 布局调整

## [18.1.0] - 2026-03-17

### Added
- **YouTube Shadowing 模式解耦逻辑** 🎤
  - ShadowingPanel 支持 YouTube 素材（audioSrc 可选）
  - YouTube 播放与录音完全解耦，互不影响
  - 点击中栏播放按钮 → 仅播放视频，不触发录音
  - 点击 Start Recording → 仅开始录音，不触发视频播放

### Changed
- **YouTube 练习模式优化** 🎬
  - YouTube 素材使用 practiceMode 控制句子循环
  - 播放到 end-0.5s 自动暂停并重置到开头
  - 左侧视频播放器独立操作，不影响中栏练习状态

### Technical Details
- 修改文件：
  - `src/components/ShadowingPanel.tsx` - audioSrc 改为可选
  - `src/components/YouTubePlayer.tsx` - 添加 practiceMode 逻辑
  - `src/app/topics/[category]/[slug]/PracticePage.tsx` - 解耦播放与录音状态
  - `src/lib/supabase/client.ts` - 更新 Material 接口类型
  - `claude code guide.md` - 新增 YouTube Shadowing 解耦逻辑文档

- 构建验证：✅ 编译成功
- 功能验证：✅ YouTube 和 R2 素材逻辑互不影响

## [16.0.0] - 2026-03-15

### Breaking Changes
- **彻底移除多语言架构** 🌐❌
  - 删除 LanguageContext.tsx 和 useLocalizedPath.ts
  - 删除 LanguageSwitcher 和 LocalizedLink 组件
  - 移除所有 useLanguage 和 t() 函数调用
  - 所有 UI 文本改为硬编码英文

### Fixed
- **修复路由 404 问题** 🔗
  - 移除 /en/ 路径，统一使用英文路由
  - 修复访问 /en/topics/... 导致的 404 错误
  - 所有素材现在通过 /topics/[category]/[slug]/ 访问

### Changed
- **简化项目架构** 🏗️
  - 减少 912 行代码（删除多语言相关代码）
  - 修改 25 个文件，移除多语言依赖
  - 提升构建速度和运行性能

### Technical Details
- 删除文件：
  - `src/contexts/LanguageContext.tsx` (671 行)
  - `src/lib/hooks/useLocalizedPath.ts` (18 行)
  - `src/components/LanguageSwitcher.tsx` (77 行)
  - `src/components/LocalizedLink.tsx` (40 行)
  - `src/app/en/page.tsx` (31 行)

- 修改文件：
  - `src/app/layout.tsx` - 移除 LanguageProvider
  - `src/app/page.tsx` - 移除 useLanguage
  - `src/app/topics/page.tsx` - 移除 useLanguage，LocalizedLink 改为 Link
  - `src/components/topics/FilterBar.tsx` - 硬编码英文
  - `src/components/topics/DifficultySelector.tsx` - 硬编码英文
  - `src/components/DictationBox.tsx` - 移除 useLanguage
  - `src/components/WordMode.tsx` - 移除 useLanguage
  - `src/components/ShadowingPanel.tsx` - 移除 useLanguage
  - `src/components/landing/*` - 所有落地页组件硬编码英文

- 构建验证：✅ 117 个静态页面全部生成成功
- 路由验证：✅ /topics/[category]/[slug]/ 正常访问
- 旧路由：✅ /en/topics/ 正确返回 404

## [15.3.12] - 2026-03-14

### Fixed
- **修复移动端专注模式播放组件被隐藏的问题** 📱
  - 第一次点击播放：只在移动端执行滚动操作，桌面端保持三栏格局
  - 切换句子：手动计算滚动位置，减去 Header 高度（120px）
  - 确保播放组件完全可见，不被 Header 遮挡
  - 优化滚动位置算法，从 `scrollIntoView` 改为精确计算

### Changed
- **优化移动端滚动逻辑** 🎯
  - 第一次点击：添加移动端判断 `isMobile = window.innerWidth < 1024`
  - 切换句子：使用 `window.scrollTo` 替代 `scrollIntoView`
  - 滚动位置 = 元素顶部位置 - Header 高度（120px）

## [15.3.11] - 2026-03-14

### Fixed
- **修复桌面端三栏布局被破坏的问题** 🖥️
  - 修复移动端专注模式在桌面端也生效的问题
  - 标题从条件渲染改为使用 `max-lg:hidden` 类名控制，桌面端始终显示
  - 视频列从条件渲染改为使用 `max-lg:hidden` 类名控制，桌面端始终显示
  - 练习区域固定为 `lg:col-span-[2]`，桌面端保持三栏格局（左-中-右）

### Changed
- **优化响应式布局策略** 📱
  - 移动端（< 1024px）：播放后隐藏标题和视频，练习区域全屏（专注模式）
  - 中屏幕（1024px - 1279px）：始终保持左-中-右三栏格局
  - 大屏幕（≥ 1280px）：始终保持左-中-右三栏格局

## [15.3.10] - 2026-03-14

### Fixed
- **修复静态导出模式下路径生成问题** 🔗
  - 修复 `generateStaticParams()` 未查询 `slug` 字段导致的 500 错误
  - 修复 PracticePage 材料查找逻辑使用 `titleToSlug()` 导致的路径不匹配
  - 统一使用数据库中的 `slug` 字段，没有时才从 `title` 生成

- **修复 topics 页面链接生成错误** 📱
  - 修复 topics 页面使用 `titleToSlug()` 生成链接导致的 404 错误
  - 添加 `slug` 字段到 Material 类型定义
  - 链接生成改为 `material.slug || titleToSlug(material.title)`

### Added
- **移动端视频降级体验优化** 📺
  - Toast 提示从顶部改为垂直居中，添加半透明黑色背景遮罩
  - Toast 提示 3 秒后自动消失，不遮挡后续操作
  - 视频降级后完全隐藏容器，练习区域向上移动填补空白
  - 充分利用移动端屏幕空间

- **移动端专注模式** 🎯
  - 点击播放按钮后自动隐藏标题和视频区域
  - 练习区域扩展到全宽（100%），屏幕利用率提升 50%+
  - 保留导航栏、面包屑、切换组件
  - 300ms 流畅动画过渡

- **优化句子切换体验** ⚡
  - 修复点击"下一句"后页面滚动导致播放组件被隐藏的问题
  - 只在第一次点击播放时滚动到顶部隐藏标题
  - 后续句子切换不再滚动，播放组件始终可见

### Changed
- **更新开发指南** 📚
  - 添加 topics 链接 404 错误到常见错误速查表
  - 更新 Slug 生成规范：优先使用数据库中的 `slug` 字段
  - 列出 3 处需要统一使用 `slug` 字段的文件位置

## [15.3.9] - 2026-03-14

### Fixed
- **修复影子跟读判断逻辑** 🎯
  - 重构比对算法：使用三轮贪婪匹配（核心词优先 → 剩余词贪婪匹配 → 连读合并探测）
  - 解决位置偏移问题：不再使用死板的索引比对（A[i] vs B[i]），改为全局搜索匹配
  - 允许跳跃匹配：自动跳过脏数据（如识别错误的 lakes），继续匹配后续正确单词
  - 新增连读合并探测：检测 `it` + `is` → `itis`，防止连读被误判为漏读

- **优化发音相似度判断** 🗣️
  - 添加发音黑名单：`his` vs `her` 强制不匹配（发音完全不同）
  - 限制 Metaphone 模糊匹配范围：只允许发音极其接近的词（如 `lived` vs `left`）
  - 单词级严格比对：置信度 < 40% 标记为错误，40%-85% 标记为接近匹配

- **优化文案反馈逻辑** 💬
  - 新增 Medium 级别评价（黄色）：单词匹配率 ≥ 50% 显示"大部分词都读对了"
  - 修复语意矛盾：有单词错误时不再显示"发音很标准"
  - 根据单词匹配率动态反馈：Perfect(100%) → Good(≥80%) → Medium(≥50%) → Keep Trying → Fail

- **优化视觉反馈** 👁️
  - 只显示原文，不插入用户读错的词（如 lakes）
  - 读错的词变色提示（橙色/淡灰色），不再破坏句子队形
  - 句子相似度 ≥ 70% 且无错误词：只显示绿色原文
  - 有错误词：显示详细对比，高亮读错的单词

### Changed
- **更新开发指南** 📚
  - 添加"影子跟读判断逻辑"章节
  - 记录三轮贪婪匹配算法、发音黑名单、文案分级矩阵
  - 记录连读合并探测规则（短词长度 ≤ 3、相邻检测、合并策略）

## [15.3.8] - 2026-03-13

### Fixed
- **修复词尾辅音截断问题** 🎯
  - 实现动态冲突检测算法，解决吞音现象
  - 动态后扩：句子结束时间延长 `min(300ms, 间隙/2)`
  - 静音裁剪：使用 Whisper 停顿作为切割点
  - 首部锁定：起始时间最多前移 30ms
  - 优化 Whisper VAD 参数：`no_speech_threshold=0.05`

- **修复 timestamp-marker 数据丢失 bug** 🐛
  - 修复 `markEndTime` 函数直接修改对象属性导致翻译丢失
  - 使用展开运算符保留所有字段：`{ ...sentence, endTime: time }`

### Added
- **新增转录脚本** 📝
  - `scripts/retranscribe_empty_your_mind.py`：针对单个素材的重新转录脚本
  - 支持动态冲突检测算法
  - 支持自动翻译恢复

### Changed
- **更新开发指南** 📚
  - 添加"吞音问题解决方案"章节
  - 详细记录动态冲突检测算法
  - 记录 VAD 参数优化配置

## [15.3.7] - 2026-03-12

### Added
- **大分片预取策略** 🚀
  - A 账号 Worker：最小返回 1MB，即使浏览器请求很小
  - 预取倍数 10x：浏览器请求 100KB，Worker 返回 1MB
  - 目的：最大化单次吞吐量，减少频繁的 Range 请求

### Fixed
- **彻底禁用 Stalled 干扰** 🎬
  - readyState >= 3 时只显示 Loading UI
  - 绝不调用 video.load()，不重设 src
  - 不打断 MediaSource，让浏览器自然恢复

### Changed
- **Worker 调试优化** 🔍
  - A 账号 Worker：记录 ETag、返回大小（MB）
  - B 账号 Worker：记录分片大小日志
  - 移除导致二次加工的 Header

### Improved
- **减少极小分片循环** 📈
  - 单次分片从 0.1s 提升到 MB 级别
  - ETag 一致性确保 Safari 不会频繁切断连接
  - 流式转发，不等待全部下载

## [15.3.6] - 2026-03-12

### Added
- **Buffer Throttling 缓冲节流机制** 🎬⏳
  - 检查缓冲是否领先当前时间 ≥ 2 秒
  - 缓冲不足时暂停视频并显示加载状态
  - 每 500ms 检查一次，直到缓冲足够再播放
  - 避免极小分片循环（0.04s）导致的频繁卡顿

### Changed
- **Worker 吞吐量优化** ⚡
  - A 账号 Worker：添加 Cache-Control: public, max-age=3600
  - 利用 Cloudflare 边缘缓存加速分片读取
  - B 账号 Worker：确保 Content-Length 被显式透传

### Improved
- **减少卡顿和极小分片循环** 📈
  - 缓存命中后，Range 请求更快响应
  - 缓冲节流确保播放连贯性
  - 加载状态明确提示缓冲进度

## [15.3.5] - 2026-03-12

### Fixed
- **修复 Safari Code 4 错误 - 优化 Range 处理和被动恢复** 🎬🔧
  - 问题：数据流不稳定触发 Safari 保护机制，导致 MEDIA_ERR_SRC_NOT_SUPPORTED (Code 4)
  - 解决：
    - A 账号 Worker：精确 Range 边界（有 Range → 206，无 Range → 200）
    - A 账号 Worker：强制 Accept-Ranges: bytes，明确支持断点续传
    - B 账号 Worker：透明转发所有响应头
    - B 账号 Worker：CORS 补充，暴露 Content-Range 给 Safari
    - 前端：移除强制缓冲策略（暂停会触发 Code 4）
    - 前端：被动激活策略，stalled 时静默恢复而非重载

### Removed
- **移除有害的强制缓冲策略** ⚠️
  - 删除播放前检查 5 秒缓冲的逻辑
  - 删除暂停视频等待缓冲的逻辑
  - 这些策略会触发 Safari 的保护机制导致 Code 4 错误

## [15.3.4] - 2026-03-12

### Added
- **视频缓冲优化和加载状态显示** 🎬⏳
  - 加载状态图标：当视频缓冲中时显示转圈图标和"缓冲中..."提示
  - 强制缓冲策略：播放前确保至少有 5 秒的缓冲数据
  - 缓冲检查机制：每 200ms 检查一次，10 秒超时保护

### Improved
- **缓冲体验优化** ⚡
  - 减少播放过程中的卡顿和 stalled
  - 明确的加载状态提示，避免用户误以为网页卡死
  - 智能暂停机制：缓冲不足时自动暂停等待

## [15.3.3] - 2026-03-12

### Fixed
- **重构 Worker Range 处理 - 完全使用 R2 原生能力** 🎬🔧
  - 问题：手动计算 Content-Range 导致 Safari 拒收响应，视频在 5.94 秒卡死
  - 解决：
    - A 账号 Worker：直接传递 Range header 字符串给 R2，完全使用 httpMetadata
    - B 账号 Worker：透传所有头，只添加 CORS
    - 前端：移除 stalled 重试机制，避免打断缓冲链路

### Changed
- **Worker 大幅简化** ⚡
  - 代码量减少 180+ 行
  - 移除所有手动 Range 计算
  - 让 R2 处理所有 Range 逻辑

## [15.3.2] - 2026-03-12

### Fixed
- **修复视频播放 stalled 问题** 🎬🔄
  - 问题：视频播放几秒后报 stalled，Range 请求不稳定
  - 原因：
    - Worker 响应包含 Alt-Svc 头，导致手机尝试不稳定的 HTTP/3 (QUIC)
    - 前端重试机制只在开发环境启用
  - 解决：
    - 移除 B/A 账号 Worker 的 Alt-Svc 头，强制使用稳定的 HTTP/2
    - 生产环境也启用 stalled 重试机制（最多 3 次，每次 3 秒）
    - 添加播放位置恢复逻辑，重试后继续从原位置播放

### Changed
- **Worker 优化** ⚡
  - B 账号 Worker: 过滤掉 Alt-Svc 响应头
  - A 账号 Worker: 删除 Alt-Svc 响应头

## [15.3.1] - 2026-03-12

### Fixed
- **修复生产环境视频加载慢问题** 🎬⚡
  - 原因：生产环境使用 `preload="auto"` 导致浏览器预加载整个视频
  - 解决：统一使用 `preload="metadata"`，点击播放时才下载数据

## [15.3.0] - 2026-03-12

### Fixed
- **修复多个移动端视频播放问题** 📱✅
  - **问题 1 - Code 4 错误**：
    - 原因：开发环境代理失效，Range 请求透传失败
    - 解决：统一使用线上 Worker，优化 Worker 架构（B → A Worker → R2）
  - **问题 2 - AbortError**：
    - 原因：组件卸载后执行操作，手动修改 video.src
    - 解决：添加 isMountedRef，移除手动修改 src 的逻辑
  - **问题 3 - src 错误赋值**：
    - 原因：video.src 被设置为页面 URL
    - 解决：强化 actualVideoSrc 验证，移除手动修改 src
  - **问题 4 - 页面格式错乱**：
    - 原因：dev server 只绑定 IPv6，CSS 404
    - 解决：使用 `-H 0.0.0.0` 参数启动，同时绑定 IPv4 和 IPv6

### Performance
- **Range 请求速度提升 5.5 倍** 🚀
  - Range 请求：110 KB/s → 610 KB/s
  - 完整下载：2220 KB/s → 2979 KB/s
  - 14MB 视频下载时间：6.46s → 4.81s

### Changed
- **更新《Claude Code Guide》** 📚
  - 添加移动端视频播放问题修复记录
  - 添加 dev server 启动命令说明

### Technical Details
- 修改文件：
  - `src/app/practice/page.tsx` - getCdnUrl 统一使用线上 Worker
  - `worker-simple-ios.js` - B 账号 Worker 代理到 A 账号 Worker，添加 Connection: keep-alive
  - `workers/worker-simple-ios-range.js` - A 账号 Worker 正确处理 Range 请求
  - `workers/wrangler.toml` - A 账号 Worker 配置（新增）
  - `src/components/VideoPlayer.tsx` - 移除手动修改 src，添加 isMountedRef
  - `claude code guide.md` - 添加完整的问题修复记录

---

## [15.2.3] - 2026-03-12

### Fixed
- **修复 video src 被设置为页面 URL 的 Bug** 🐛✅
  - 问题：useEffect 中手动修改 `video.src = ""`，导致浏览器使用当前页面 URL 作为视频 src
  - 错误表现：`src` 属性显示为 `http://10.104.15.185:3000/topics/...` 而非视频 URL
  - 解决方案：移除手动修改 src 的逻辑，让 React 完全控制 src 属性
  - 清理函数：只调用 `pause()`，不修改 `src` 属性

### Technical Details
- 修改文件：
  - `src/components/VideoPlayer.tsx` - 移除手动修改 video.src 的逻辑

---

## [15.2.2] - 2026-03-12

### Fixed
- **修复 VideoPlayer src 错误赋值 Bug** 🐛✅
  - 问题：video 标签的 src 被错误地赋值为当前网页 URL，而非视频文件 URL
  - 根本原因：actualVideoSrc 验证不足，允许了非 media.shadowhub.app 的 URL
  - 防御性修复：
    1. 强化 actualVideoSrc 验证：必须包含 `.mp4` 和 `media.shadowhub.app`
    2. 在 useEffect 中添加阻尼检查：拒绝加载无效的 videoSrc
    3. 添加详细的错误日志，便于调试
  - 影响范围：仅 VideoPlayer.tsx 组件

### Technical Details
- 修改文件：
  - `src/components/VideoPlayer.tsx` - 添加防御性验证逻辑

---

## [15.2.1] - 2026-03-12

### Fixed
- **修复移动端视频 AbortError 问题** 📱✅
  - 问题：移动端视频播放时出现 `AbortError: The operation was aborted`
  - 前端修复（VideoPlayer.tsx）：
    1. 添加 `isMountedRef` 标志位，防止组件卸载后执行操作
    2. 在 useEffect 设置新 src 之前，先清理旧状态：
       - `video.pause()`
       - `video.src = ""`
       - `video.load()`
    3. 优雅处理 play() promise：使用 `.catch()` 捕获并静默处理 AbortError
  - 后端修复（worker-simple-ios.js）：
    - 添加 `Connection: keep-alive` 响应头，避免连接意外关闭

### Technical Details
- 修改文件：
  - `src/components/VideoPlayer.tsx` - 视频组件优化
  - `worker-simple-ios.js` - 添加 Connection: keep-alive 头

---

## [15.2.0] - 2026-03-12

### Fixed
- **修复移动端视频 Code 4 错误** 📱✅
  - 问题：移动端播放视频时出现 `MEDIA_ERR_SRC_NOT_SUPPORTED`，视频加载很久后偶尔能播放
  - 根本原因：
    1. 开发环境代理失效：静态导出模式下 `next.config.js` 的 `rewrites` 不生效
    2. Range 请求透传失败：Worker 未正确处理 Range 请求，移动端无法分段加载
  - 解决方案：
    1. 统一使用线上 Worker：开发环境和生产环境都使用 `https://media.shadowhub.app`
    2. 优化 Worker 架构：
       - 部署 A 账号 Worker (`r2-proxy`) 直接访问 R2 bucket
       - B 账号 Worker 代理到 A 账号 Worker（而非 R2 公开域名）
    3. 修复 Range 请求处理：正确传递 Range 参数并返回准确的 Content-Length

### Performance
- **Range 请求速度提升 5.5 倍** 🚀
  - Range 请求：110 KB/s → 610 KB/s
  - 完整下载：2220 KB/s → 2979 KB/s
  - 14MB 视频下载时间：6.46s → 4.81s

### Technical Details
- 修改文件：
  - `src/app/practice/page.tsx` - getCdnUrl 统一使用线上 Worker
  - `worker-simple-ios.js` - B 账号 Worker 改为代理到 A 账号 Worker
  - `workers/worker-simple-ios-range.js` - A 账号 Worker 正确处理 Range 请求
  - `workers/wrangler.toml` - A 账号 Worker 配置（新增）
  - `claude code guide.md` - 添加问题修复记录

---

## [15.1.0] - 2026-03-11

### Fixed
- **修复视频和音频同时播放问题** 🎵🎬
  - 问题：点击练习播放按钮时，如果视频正在播放，会导致双重声音
  - 原因：VideoPlayer 的暂停逻辑条件过于严格（要求 `!isVideoPlaying`）
  - 修复：移除 `!isVideoPlaying` 条件，只要检测到音频播放就自动暂停视频
  - 效果：练习模式优先于视频播放，避免双重声音

### Improved
- **AudioPlayer 超时逻辑优化** ⏱️
  - 音频加载时：10 秒超时（之前是 2 秒）
  - 音频已加载：2 秒超时
  - 超时后不报错，继续等待 canplay 事件

- **音频文件后缀处理** 🔧
  - PracticePage getCdnUrl 函数添加音频后缀检查
  - 自动添加 `.mp3` 后缀（如果缺失）

- **音量统一调整** 🔊
  - 练习音频：25% → 40% 音量
  - 视频播放：默认 100% → 40% 音量
  - 统一听量体验，避免音频和视频音量差异过大

### Technical Details
- 修改文件：
  - `src/components/VideoPlayer.tsx` - 修复暂停逻辑
  - `src/components/AudioPlayer.tsx` - 超时优化
  - `src/app/topics/[category]/[slug]/PracticePage.tsx` - 音频后缀处理
  - `package.json` - 版本号更新至 15.1.0

---

## [15.0.0] - 2026-03-11

### Fixed
- **修复视频黑屏 + AbortError 问题** 🎥✅
  - A 账号 Worker (r2-proxy)：修复 Range 参数传递错误
    - 当没有 Range 请求时，传递了 `{ range: null }` 给 R2，导致 10001 错误
    - 修复：只有在存在 Range 头时才添加 range 参数
  - B 账号 Worker (morning-sound-a67b)：跨账号 R2 访问方案
    - Cloudflare R2 不支持跨账号直接访问
    - 解决方案：通过 HTTP 访问 A 账号的 R2 公开 URL
    - 添加完整的 CORS 头和 Range 请求转发支持
  - 最终架构：用户 → B账号worker → A账号R2公开URL（流式传输，无中间缓存）

### Changed
- **更新《Claude Code Guide》文档** 📚
  - 新增《视频黑屏 + AbortError 问题》章节
  - 包含问题原因分析、修复方案、代码示例、架构图
  - 更新 Worker 配置说明和跨账号访问解决方案

### Technical Details
- 修改文件：
  - `workers/worker-simple-ios-range.js` - A 账号 Worker（Range 参数修复）
  - `worker-simple-ios.js` - B 账号 Worker（跨账号 HTTP 访问）
  - `wrangler.toml` - 更新 Worker 配置
  - `claude code guide.md` - 新增问题排查章节
  - `package.json` - 版本号更新

---

## [14.1.0] - 2026-03-11

### Fixed
- **修复预加载乱序问题** 🔄
  - 修改预加载逻辑：从跨分类全局索引改为每个分类单独预加载
  - 预加载目标：每个分类的第二张卡片（索引 1），而非跨分类计算
  - 预加载顺序：按分类顺序（日常生活 → YouTube Vlog → 历史演讲 → ...）
  - 确保用户点击任意分类的"查看更多"时，第二张卡片都已被预加载

### Changed
- **更新《Claude Code Guide》文档** 📚
  - 更新预加载逻辑说明，与实际代码保持一致
  - 更新优化参数表：预加载目标改为"每个分类的第 2 张卡片"
  - 新增首屏可见数量响应式说明表格

### Technical Details
- 修改文件：
  - `src/app/topics/page.tsx` - 修复预加载逻辑
  - `claude code guide.md` - 更新文档

---

## [14.0.0] - 2026-03-11

### Performance
- **封面图加载性能优化** 🚀
  - 实现优先级分层：前 8 张高优先级，8-15 张次优先级，16+ 张懒加载
  - 强制顺序预加载：按索引顺序依次加载，每张图间隔 80ms
  - 分片渲染：展开时分 3 批增加可见图片（100ms → 300ms → 600ms）
  - 添加淡入动画：平滑的 opacity 过渡效果
  - 优化参数：预加载总量 16 张，每分类 4 张，分批大小 4 张

### Improved
- **解决图片乱序加载问题** 📸
  - 使用 setTimeout 人为控制加载顺序
  - 按全局索引（跨分类）计算优先级
  - 展开时分片渲染，避免 DOM 爆炸

### Technical Details
- 修改文件：
  - `src/app/topics/page.tsx` - 重写预加载和渲染逻辑
  - `claude code guide.md` - 添加《封面图加载性能优化》章节
  - `package.json` - 版本号更新

### 性能提升
- 首屏 LCP：前 8 张图片设置 `fetchPriority="high"`
- 点击展开：分 3 批平滑展开，瞬间显示预加载的图片
- 内存优化：第三梯队使用懒加载，节省带宽

---

## [13.0.0] - 2026-03-11

### Fixed
- **修复 iPhone Safari 封面图加载问题** 📱✅
  - 为 `<img>` 标签添加 `crossOrigin="anonymous"` 属性
  - 更新 Worker 代码，正确返回 `Content-Type: image/webp`（thumbnails 目录）
  - 完善《Claude Code Guide》文档，添加完整的问题排查和解决方案

### Changed
- **基础设施配置更新** 🏗️
  - 修正 DNS 配置：`media.shadowhub.app` 必须使用橙色云朵（Cloudflare 代理）
  - 更新 Worker 路由配置说明：B 账号必须设置 `media.shadowhub.app/*` 路由
  - 更新资源架构文档：明确 B 账号 Worker 的职责和跨账号访问方式

### Documentation
- **新增《iPhone Safari 封面图加载问题》章节** 📚
  - 问题症状描述
  - 三大根本原因分析（Content-Type 不匹配、DNS 配置错误、缺少跨域属性）
  - 完整解决方案和代码示例
  - 请求流程图和验证检查清单
  - 关键要点总结

### Technical Details
- 修改文件：
  - `src/app/topics/page.tsx` - 添加 `crossOrigin="anonymous"` 属性
  - `worker-simple-ios.js` - 新增 Worker 代码（修复 Content-Type）
  - `claude code guide.md` - 完整文档更新
  - `package.json` - 版本号更新

---

## [12.0.7] - 2026-03-10

### Fixed
- **加载指示器优化** 🎨
  - 将加载指示器背景改为半透明 (`bg-white/50`)
  - 添加背景模糊效果 (`backdrop-blur-sm`)
  - 确保图片在加载时也能透过加载指示器显示

### Technical Details
- 修改文件：
  - `src/app/topics/page.tsx` - 优化加载指示器样式
  - `package.json` - 版本号更新

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
