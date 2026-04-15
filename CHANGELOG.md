# Changelog

## [30.2.4] - 2026-04-15

### Fix (Emergency)
- **紧急修复：Supabase Egress 超配导致数据库连接中断** 🚨
  - **问题背景**：Supabase Egress 流量达到 121%，数据库状态变为 Unhealthy，所有查询返回 HTTP 522（Connection timed out）。
  - **官方宽限期**：Supabase 提供宽限期至 5 月 11 日，但网关持续阻断 PostgreSQL 层连接（Auth 层已恢复）。

  - **临时方案 - 优雅降级（Graceful Degradation）**：
    1. **API 硬编码**：`api/topics/route.ts` 切换为硬编码静态数据，确保前端页面可用。
    2. **精简字段**：预置了精简字段的 SQL 查询逻辑，仅查询 `id, title, category, difficulty, audio_path, thumbnail_path, audio_size, duration, play_count, slug` 等必要字段。
    3. **错误处理**：添加 try-catch 包装，数据库超时时返回空数据而非 500 错误，避免前端崩溃。

  - **性能优化**（之前提交）：
    - 移除 MaterialCard 组件中的 Supabase Storage fallback 逻辑
    - 所有 API 路由使用 `select('字段列表')` 替代 `select('*')`，减少 30-50% 响应体积
    - API 路由优化：`user-words`, `word-definition`, `stats` 等接口实施字段精简

  - **自动监控逻辑**：
    - 新增 `scripts/ping-db.ts`：快速探测数据库连接是否恢复
    - 新增 `scripts/watch-db.sh`：低频监控脚本，每 15 分钟自动探测数据库状态
    - 成功时触发 macOS 语音播报和系统通知，立即提醒开发人员

  - **待办事项**：
    - 一旦 Supabase 网关完全放行（PostgreSQL 层恢复），立即回滚 `api/topics` 硬编码
    - 恢复全量数据库查询逻辑
    - 停止自动监控脚本

### Technical
- **关键文件变更清单** 📝
  - `api/topics/route.ts`：实施硬编码降级，保留精简字段查询逻辑（注释状态）
  - `lib/supabase/client.ts`：Auth 配置已恢复（`persistSession: true`, `autoRefreshToken: true`）
  - `components/topics/MaterialCard.tsx`：移除 Supabase Storage fallback 逻辑
  - `components/topics/MaterialCardWithModal.tsx`：移除 Supabase Storage fallback 逻辑
  - `api/user-words/route.ts`：精简查询字段，移除 `select('*')`
  - `api/user-words/stats/route.ts`：精简查询字段
  - `api/word-definition/route.ts`：精简查询字段
  - `scripts/ping-db.ts`：新增数据库连接探测脚本
  - `scripts/watch-db.sh`：新增低频监控脚本（15 分钟间隔）

---

## [30.2.3] - 2026-04-10

### Fix
- **修复 Supabase 连接池耗尽导致的 500 错误** 🔧
  - **问题描述**：用户快速连续点击多个单词时，PATCH 请求失败，报错 `ECONNRESET`（连接重置）。
  - **根本原因**：Supabase 连接池无法处理快速连续的并发请求，多个长时间运行的请求（5-7秒）导致连接耗尽。

  - **解决方案**：
    1. **自动重试机制**：实现 `retrySupabaseQuery` 包装器，在遇到网络错误时自动重试 3 次。
    2. **指数退避**：重试延迟依次为 1s → 2s → 4s，避免雪崩效应。
    3. **全面覆盖**：对所有 Supabase 操作（查询/更新/插入）应用重试逻辑。

  - **效果**：
    - 用户连续点击 5 个单词顺畅无阻
    - 网络抖动时自动恢复，无需手动重试
    - 500 错误彻底消失

### Refactor
- **简化闪卡组件状态管理** 🧹
  - **移除进度显示 UI**：删除 `Batch X: Y/30` 的显示，避免触发非预期的 GET 请求。
  - **移除 masteredWordIds 状态**：简化为直接检查 `dynamicQueue.length === 0` 判断完成状态。
  - **回滚 Key 属性**：从 `key={currentWord.id}` 改回 `key={currentIndex}`，确保组件稳定挂载。

  - **保留核心战果**：
    - ✅ 物理锁机制（防并发重复提交）
    - ✅ 统计双轨制（区分复习消耗与学习新增）
    - ✅ SWR 乐观更新（解决数据回滚问题）

### Code Quality
- **清理所有调试日志** 🧹
  - 移除 `ReviewOverlay.tsx` 中的物理锁调试日志
  - 移除 `VocabularyCategoryContent.tsx` 中的翻译补全日志和音频播放日志
  - 移除 `stats/route.ts` 中的今日统计调试日志
  - 保持生产环境代码整洁

### Technical
- **关键文件变更清单** 📝
  - `api/user-words/route.ts`：添加 `retrySupabaseQuery` 重试包装器，覆盖所有数据库操作
  - `ReviewOverlay.tsx`：简化状态管理，移除进度显示，保留核心逻辑
  - `VocabularyCategoryContent.tsx`：清理所有调试日志
  - `api/user-words/stats/route.ts`：清理调试日志，保留错误处理

---

## [30.2.2] - 2026-04-10

### Fix
- **修复 SWR 异步竞态导致的数据回滚 Bug** 🐛
  - **问题描述**：在生产环境中，用户点击 "Too Easy" 后 Today's Review 数字从 6 变成 5，但关闭弹窗后数字又弹回 6。
  - **根本原因**：SWR 异步竞态问题 - 弹窗关闭时触发的 `mutateStats()` 强制刷新会在 API 返回前执行，用服务器旧数据覆盖了乐观更新的新数据。

  - **解决方案**：
    1. **深度乐观更新**：在 `handleReviewComplete` 中使用 `mutate(newStats, { revalidate: false })` 立即更新 SWR 缓存，禁止自动刷新。
    2. **移除冗余刷新**：完全移除 `handleCloseReview` 中的强制 SWR 刷新逻辑，避免在 API 返回前触发数据回滚。
    3. **延迟重置计数器**：将本地计数器重置延迟到 5 秒后，确保 3 秒 API 延迟（生产环境）已完成。

  - **测试验证**：
    - 本地模拟测试：在 API Route 中添加 3 秒延迟模拟生产环境高延迟。
    - 验收通过：在 API 返回前关闭弹窗，Today's Review 数字稳住在正确值，不会回滚。

### Code Quality
- **清理调试日志** 🧹
  - 移除 `ReviewOverlay.tsx` 中所有物理锁相关的调试日志（锁定/释放/拦截）
  - 移除批量释义补全的详细日志（补全单词/匹配翻译/队列更新）
  - 移除 API Route 中的模拟延迟代码（验收测试后清理）
  - 保持生产环境代码整洁，减少控制台噪音

### Technical
- **关键文件变更清单** 📝
  - `VocabularyHubContent.tsx`：实现深度乐观更新，移除 handleCloseReview 中的冗余刷新
  - `ReviewOverlay.tsx`：清理所有调试日志，保留核心逻辑
  - `api/user-words/route.ts`：移除模拟延迟代码，恢复生产环境性能

---

## [30.2.1] - 2026-04-10

### Feature
- **生词复习统计逻辑重构（双轨并行系统）** 📊
  - **核心哲学**：严格区分"复习消耗"与"学习新增"，彻底解决统计数字乱跳问题。

  - **复习模式 (isOriginallyDue = true)**：
    - Kinda Know / Too Easy：Today's Review -1（消耗任务），Reviewed +1
    - Still Learning：视为未完成，Today's Review 不变，Reviewed 不变

  - **主动学习模式 (isOriginallyDue = false)**：
    - 首次点击 Still Learning：视为将新词加入今日计划，Today's Review +1，Reviewed +1
    - 后续重复点击：通过物理锁拦截，计数保持不变

### Refactor
- **前端：物理锁拦截机制（Anti-Race Condition）** 🛡️
  - **从 useState 迁移至 useRef**：解决 useState 异步性导致的快速连点拦截失效问题
  - **同步锁定机制**：使用 `submittingWordsRef` 在点击瞬间（微秒级）立即锁定 ID
  - **第二次点击拦截**：在进入逻辑前就会被 return，彻底消除并发重复提交

  - **乐观更新保护**：
    - UI 数字先更新，增加 `isSubmitting` 状态管理
    - SWR 延迟刷新：弹窗关闭前禁止 SWR 自动刷新，防止后端旧数据回滚前端已更新的数字
