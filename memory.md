# 开发记录（Memory Log）

本文件记录项目开发过程中的重要决策、问题解决和经验总结。

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
