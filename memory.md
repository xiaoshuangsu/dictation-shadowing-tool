# 开发记录（Memory Log）

本文件记录项目开发过程中的重要决策、问题解决和经验总结。

---

## 2025-02-20 - v5.0.0 发布（Profile 页面重大重构 + 点击跳转功能）

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

#### 2. 完成度逻辑修复
**修改文件**：`src/lib/supabase/client.ts`
- 使用 `Set<Number>` 对 `sentence_id` 进行去重
- 完成判断：`uniqueSentences.size >= totalSentences`
- 避免重复练习同一句导致的计数错误

#### 3. 缩略图显示
**修改文件**：`src/components/profile/MaterialProgress.tsx`
- 从 Supabase Storage 加载真实缩略图
- 使用正确 URL：`https://cuxotlijjnxbsirpdkgr.supabase.co/storage/v1/object/public/engnovate-audio/thumbnails/{filename}`
- 加载失败时回退到首字母占位符

#### 4. 点击跳转功能
**修改文件**：
- `src/lib/supabase/client.ts`：添加 `materialId` 和 `lastPracticedSentenceIndex` 字段
- `src/components/profile/MaterialProgress.tsx`：实现点击跳转逻辑
- `src/app/page.tsx`：解析 URL `start` 参数

**跳转逻辑**：
- 目标索引 = `completed >= total ? 0 : completed`
- URL 参数：`id={materialId}&mode={practiceMode}&start={targetIndex}`
- 练习页面自动定位到指定句子

### 技术细节
- 使用 `Array.from(map.entries())` 避免 TypeScript 迭代器错误
- 缩略图文件名处理：移除可能的 `thumbnails/` 前缀
- 图片加载状态管理：`onError` 回退到占位符

### 版本更新
- 4.3.0 → 5.0.0
- Git Tag: v5

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
