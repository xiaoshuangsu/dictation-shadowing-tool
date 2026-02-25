# 开发记录（Memory Log）

本文件记录项目开发过程中的重要决策、问题解决和经验总结。

---

## 2025-02-25 - v7.3.1 发布（Banner 图片显示修复）

### 问题描述
首页 banner 图片在 GitHub Pages 生产环境无法显示，但在本地开发环境（localhost:3000）正常工作。

**错误信息**：
```
Uncaught (in promise) AbortError: signal is aborted without reason
at 53-e5999eaa1594cae6.js:24:51414
```

**根本原因**：
- `53-e5999eaa1594cae6.js` 是 Framer Motion 的编译文件
- AbortError 发生在 Framer Motion 动画系统中
- Next.js 静态导出 + basePath 配置与 Framer Motion 存在兼容性问题
- 生产构建时，Framer Motion 的动画会中断图片渲染过程

### 解决方案
**遵循原则**：极简优先，选择最简单、最稳妥的实现方式

**替换方案**：移除 Framer Motion，使用纯 CSS 动画
- CSS 动画由浏览器原生支持，性能更好（GPU 加速）
- 无需额外 JavaScript 库
- 与 Next.js 静态导出完全兼容

**实现细节**：

1. **HeroVisual 组件**（`src/components/landing/HeroVisual.tsx`）
   - 移除 `motion.div` 替换为普通 `div`
   - 移除所有 Framer Motion 导入
   - 添加 CSS 动画类：`animate-fade-in`、`animate-float`

2. **全局 CSS**（`src/app/globals.css`）
   - 添加 `@keyframes fade-in` - 淡入 + 缩放效果（0.8s ease-out）
   - 添加 `@keyframes float` - 浮动效果（4s 无限循环）
   - 使用 Tailwind 的 `@layer utilities` 确保优先级正确

**视觉效果**：
- 淡入动画：从 opacity 0 + scale 0.9 到 opacity 1 + scale 1
- 浮动动画：上下移动 15px（0 → -15px → 0）
- 完全复刻原有的 Framer Motion 动画效果

### 验证结果
- ✅ 本地开发：banner 图片正常显示
- ✅ 生产构建：成功生成 90 个静态页面
- ✅ GitHub Pages：部署成功，等待用户验证

### 经验总结
1. **Framer Motion + Next.js 静态导出的兼容性风险**
   - 在某些配置下可能导致 AbortError
   - 特别是使用 basePath 时

2. **CSS 动画的优势**
   - 性能更好（GPU 加速）
   - 兼容性更强
   - 代码更简洁

3. **问题排查思路**
   - 本地可用 + 生产不可用 = 构建配置问题
   - AbortError 来源：Framer Motion 编译代码
   - 最简单的解决方案：移除问题依赖

### 版本更新
- 7.3.0 → 7.3.1
- Git Tag: v7.3.1
- GitHub Pages 部署完成

### 修改文件清单
1. `src/components/landing/HeroVisual.tsx` - 移除 Framer Motion
2. `src/app/globals.css` - 添加 CSS keyframe 动画
3. `CHANGELOG.md` - 更新日志

---

## 2025-02-20 - v5.0.0 发布（Profile 页面重大重构 + 点击跳转功能 + 安全修复）

### 原始需求
1. 个人中心右侧布局纠正：移除模式重复Tab，统一使用"In Progress/Completed"
2. 修正素材完成度计算逻辑（修复38/22句显示为100%的bug）
3. 替换占位符为真实缩略图
4. 实现素材卡片点击跳转，自动定位到上次练习的下一句

### 实现方案

#### 1. Profile 页面重构
**修改文件**：`src/components/profile/MaterialProgress.tsx`
- 移除右侧顶部的"听写练习"/"影子跟读"Tab
- 改为"In Progress"(蓝色) / "Completed"(绿色)双Tab
- 右侧内容由左侧侧边栏选中的模式（dictation/shadowing）过滤

**设计原则**：
- Tab 只显示完成状态，不显示练习模式
- 练习模式由左侧侧边栏统一控制
- 避免UI重复，提升用户体验

#### 2. 完成度逻辑修复
**修改文件**：`src/lib/supabase/client.ts`

**问题**：
- 用户截图显示"38/22句"判定为100%已完成
- 原因：重复练习同一句会多次计数，导致完成数超过总数

**解决方案**：
- 使用 `Set<Number>` 对 `sentence_id` 进行去重
- 完成判断：`uniqueSentences.size >= totalSentences`
- 避免重复练习同一句导致的计数错误

**代码变更**：
```typescript
// 修改前：直接计数
const completedCount = records.length

// 修改后：使用 Set 去重
const uniqueSentences = new Set<number>()
for (const record of records) {
  uniqueSentences.add(record.sentence_id)
}
const completedCount = uniqueSentences.size
```

#### 3. 缩略图显示
**修改文件**：`src/components/profile/MaterialProgress.tsx`

**实现步骤**：
1. 从 Supabase Storage 加载真实缩略图
2. 使用正确 URL 格式：`https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}`
3. 加载失败时回退到首字母占位符

**URL 构建逻辑**：
```typescript
const getThumbnailUrl = (thumbnailPath: string | null | undefined) => {
  if (!thumbnailPath) return null
  // 移除可能存在的 'thumbnails/' 前缀
  const filename = thumbnailPath.replace(/^thumbnails\//, '')
  return `https://cuxotlijjnxbsirpdkgr.supabase.co/storage/v1/object/public/engnovate-audio/thumbnails/${filename}`
}
```

**首字母占位符生成**：
- 单词标题：取首字母大写
- 多词标题：取首词和末词的首字母组合
- 示例："First Snowfall" → "FS"

#### 4. 点击跳转功能
**修改文件**：
- `src/lib/supabase/client.ts`：添加 `materialId` 和 `lastPracticedSentenceIndex` 字段
- `src/components/profile/MaterialProgress.tsx`：实现点击跳转逻辑
- `src/app/page.tsx`：解析 URL `start` 参数

**跳转逻辑**：
- 目标索引计算：`completed >= total ? 0 : completed`
- 已完成所有句子：回到第 1 句（索引 0）
- 未完成：跳转到下一句（索引 = 已完成数）

**URL 参数**：
```
/?id={materialId}&mode={practiceMode}&start={targetIndex}
```

**练习页面解析**：
```typescript
const startParam = searchParams.get('start')
useEffect(() => {
  if (startParam && sampleSentences && !progressRestored) {
    const startIndex = parseInt(startParam, 10)
    if (!isNaN(startIndex) && startIndex >= 0 && startIndex < sampleSentences.length) {
      setCurrentSentenceIndex(startIndex)
    }
  }
}, [startParam, sampleSentences, progressRestored])
```

### 技术细节

#### TypeScript 迭代器问题
**错误**：`Type 'MapIterator' can only be iterated through when using '--downlevelIteration'`

**解决方案**：
```typescript
// 修改前（错误）
for (const [key, value] of map.entries()) { }

// 修改后（正确）
Array.from(map.entries()).forEach(([key, value]) => { })
```

#### 图片加载状态管理
- 使用 `useState(false)` 追踪图片加载状态
- `onError` 回调设置 `setImageError(true)`
- 失败时自动切换到首字母占位符

#### 缩略图文件名处理
- 移除可能的 `thumbnails/` 前缀
- 确保文件名格式一致
- 避免 Supabase Storage 404 错误

### GitHub Secret Scanning 问题与解决

#### 问题发现
推送代码时 GitHub 拒绝，提示：
```
remote: error: GH013: Repository rule violations found for refs/heads/main
remote: - Push cannot contain secrets
remote: - Supabase Secret Key
remote:   - commit: 30e1319e33ef90d3525c4f9137d3d1a851caec75
remote:     path: scripts/translate.js:34
```

#### 根本原因
`scripts/translate.js` 第 34 行包含硬编码的 service_role key：
```javascript
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_xxxxxxxxxx'
// ❌ 不要在代码中硬编码任何密钥！
```

#### 解决方案：Git Filter-Branch
使用 `git filter-branch` 重写历史，移除所有提交中的硬编码密钥：

```bash
# 创建备份分支
git branch backup-main

# 使用 filter-branch 替换历史中的 secret
git filter-branch --force --tree-filter '
  if [ -f scripts/translate.js ]; then
    sed -i.bak "s/ || '\''sb_secret_xxxxxxxxxx'\''//g" scripts/translate.js
    rm -f scripts/translate.js.bak
  fi
' --tag-name-filter cat -- --all

# 清理备份
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

#### 后续修复
更新 `scripts/translate.js`，移除硬编码密钥并添加验证：

```javascript
// 使用 service_role key（必须从环境变量设置）
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_KEY) {
  console.error('❌ 错误: 未找到 SUPABASE_SERVICE_ROLE_KEY 环境变量')
  console.error('\n请先设置 Supabase Service Role Key:')
  console.error('  export SUPABASE_SERVICE_ROLE_KEY=your-key-here')
  process.exit(1)
}
```

#### 强制推送
```bash
git push origin main --force
git push origin --tags --force
```

#### 经验总结
1. **永远不要硬编码密钥** - 即使作为备用值也不行
2. **环境变量优先** - 所有敏感信息必须从环境变量读取
3. **提前验证** - 推送前使用 `git-secrets` 或类似工具扫描
4. **历史重写** - 使用 `git filter-branch` 或 `BFG Repo-Cleaner` 清理历史

### 版本更新
- 4.3.0 → 5.0.0
- Git Tag: v5
- Git 历史重写：139 个 commits 被重写

### 修改文件清单
1. `src/app/page.tsx` - 添加 start 参数解析
2. `src/components/profile/MaterialProgress.tsx` - 重构布局、缩略图、点击跳转
3. `src/lib/supabase/client.ts` - MaterialProgress 接口扩展、去重逻辑
4. `scripts/translate.js` - 移除硬编码密钥
5. `package.json` - 版本号 5.0.0
6. `memory.md` - 更新开发记录

---

## 2025-02-19 - Word 模式添加中文释义功能

### 原始需求
在 dictation 模式的 word 模式下，在原文显示区域（带横线和括号的区域）右上角增加"显示释义"按钮。点击按钮后，在原文句子正下方显示中文翻译。切换句子时翻译同步更新。默认收起状态。

### 实现方案
**遵循原则**：极简优先，选择最简单、最稳妥的实现方式

**修改文件**：
1. `src/app/page.tsx`
   - 添加 `Sentence` 接口定义，`translation` 为可选字段
   - 为 `defaultSentences` 添加中文翻译
   - 自动生成的句子设置 `translation: undefined`

2. `src/components/WordMode.tsx`
   - 添加 `showTranslation` 状态
   - 在原文区域右上角添加"显示释义"/"隐藏释义"按钮
   - 在原文下方显示翻译内容
   - 切换句子时重置翻译状态

### 技术细节
- 只有当 `sentence.translation` 存在时才显示按钮
- 使用 React 状态管理翻译显示/隐藏
- 默认素材（First Snowfall）包含 22 个句子的完整中文翻译
- 自动分割的句子不包含翻译（避免误导用户）

### 版本更新
- 4.1.0 → 4.2.0

---

## 2025-02-19 - 创建自动翻译脚本（智谱 GLM）

### 背景
用户选择方案 A：为数据库中所有素材添加翻译功能。

### 实现方案
创建了完整的自动翻译解决方案：

**核心功能**：
- 遍历数据库中所有素材
- 自动识别未翻译的句子
- 调用智谱 GLM-4-Flash API 批量翻译
- 将翻译结果写回 Supabase 数据库

**技术选型**：
- 使用智谱 GLM-4-Flash（性价比高）
- 新用户每天 100 万 tokens 免费额度
- 足够翻译数万个句子

**创建文件**：
1. `scripts/translate.js` - 核心翻译脚本（Node.js）
2. `.env.local.example` - 环境变量模板
3. `docs/TRANSLATE_GUIDE.md` - 完整使用文档
4. `scripts/README.md` - 快速开始指南

**新增 npm 命令**：
```bash
npm run translate     # 翻译所有未翻译的句子
npm run translate-all # 同上
npm run translate-new # 仅翻译新素材
```

### 使用流程
1. 注册智谱 AI 账号：https://open.bigmodel.cn
2. 获取 API Key
3. 设置环境变量：`export GLM_API_KEY=your-key`
4. 运行翻译：`npm run translate-new`

### 优势
- 完全自动化，无需手动复制粘贴
- 批量处理，效率高
- 幂等性设计，可重复运行
- 支持增量和全量两种模式

### 技术细节
- API 端点：`https://open.bigmodel.cn/api/paas/v4`
- 模型：`glm-4-flash`（可切换为 `glm-4`）
- 批次大小：10 个句子/次
- 批次间隔：1 秒（避免速率限制）

### 版本更新
- 4.2.0（待提交）

---

## 2025-02-19 - Word 模式添加中文释义功能

### 原始需求
在 dictation 模式的 word 模式下，在原文显示区域（带横线和括号的区域）右上角增加"显示释义"按钮。点击按钮后，在原文句子正下方显示中文翻译。切换句子时翻译同步更新。默认收起状态。

### 实现方案
**遵循原则**：极简优先，选择最简单、最稳妥的实现方式

**修改文件**：
1. `src/app/page.tsx`
   - 添加 `Sentence` 接口定义，`translation` 为可选字段
   - 为 `defaultSentences` 添加中文翻译
   - 自动生成的句子设置 `translation: undefined`

2. `src/components/WordMode.tsx`
   - 添加 `showTranslation` 状态
   - 在原文区域右上角添加"显示释义"/"隐藏释义"按钮
   - 在原文下方显示翻译内容
   - 切换句子时重置翻译状态

### 技术细节
- 只有当 `sentence.translation` 存在时才显示按钮
- 使用 React 状态管理翻译显示/隐藏
- 默认素材（First Snowfall）包含 22 个句子的完整中文翻译
- 自动分割的句子不包含翻译（避免误导用户）

### 版本更新
- 4.1.0 → 4.2.0

---

## 2025-02-19 - 音频播放错误修复

### 问题描述
在本地开发环境下，点击 dictation 模式的播放按钮时出现错误：
```
Uncaught (in promise) NotSupportedError: The element has no supported sources.
```

### 根本原因
- `next.config.js` 中 `basePath: '/dictation-shadowing-tool'` 始终生效
- 导致本地开发时查找音频路径为 `/dictation-shadowing-tool/learn-english-via-listening-1001.mp3`
- 但本地 public 文件夹中的音频实际在 `/learn-english-via-listening-1001.mp3`

### 解决方案
**修改文件**：`next.config.js`
- 将 `basePath` 和 `assetPrefix` 改为条件配置
- 仅在生产环境（`NODE_ENV === 'production'`）启用
- 本地开发环境使用空字符串

```javascript
const isProd = process.env.NODE_ENV === 'production'
const nextConfig = {
  basePath: isProd ? '/dictation-shadowing-tool' : '',
  assetPrefix: isProd ? '/dictation-shadowing-tool' : '',
  // ...
}
```

**修改文件**：`src/app/page.tsx`
- 更新 `DEFAULT_AUDIO_SRC` 从 `/dictation-shadowing-tool/learn-english-via-listening-1001.mp3`
- 改为 `/learn-english-via-listening-1001.mp3`
- Next.js 会在生产环境自动添加 basePath

### 验证结果
- ✅ 本地开发：音频加载自 `/learn-english-via-listening-1001.mp3`（HTTP 200）
- ✅ 生产构建：音频加载自 `/dictation-shadowing-tool/learn-english-via-listening-1001.mp3`
- ✅ GitHub Pages 部署正常

### 版本更新
- 4.0.0 → 4.1.0
- Git Tag: v4.1.0

---

## 项目背景

### 产品定位
- 英语听写 & 影子跟读工具
- 面向中国英语学习者
- 使用真实英语音视频素材
- 句子级练习体验

### 技术栈
- 前端：Next.js 14 + React 18
- 语言：TypeScript
- 样式：Tailwind CSS
- 部署：GitHub Pages
- 数据库：Supabase（PostgreSQL）
- 认证：Supabase Auth

### 核心功能
- **Dictation（听写）**：Word Mode / Whole Caption Mode
- **Shadowing（影子跟读）**：句子级播放控制
- **用户系统**：注册/登录、数据持久化
- **Profile 页面**：统计、连胜、练习历史

### 部署配置
- GitHub Pages：需要 `basePath: '/dictation-shadowing-tool'`
- 本地开发：`basePath: ''`
