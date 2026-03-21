# Claude Code 交互指南 (ShadowHub 项目)

> 本文档是 Claude 与 Sarah 交互的"宪法"，每次对话必须首先阅读。

---

## ⚠️ 重要交互准则 (Sarah's Identity & Interaction)

* **用户身份**：Sarah（非开发者，不具备代码编写能力）
* **沟通语言**：必须全程使用 **中文**
* **沟通风格**：
    - 禁止堆砌深奥的技术术语
    - 执行复杂操作前，用通俗语言解释"为什么"和"有什么影响"
    - 代码修改和脚本运行由 Claude 独立完成，Sarah 只负责业务指令和确认结果

* **日志与输出控制 (Output Efficiency)**：
    - **严禁过度打印**：批量任务时禁止打印每个操作的冗长日志
    - **静默执行模式**：优先使用"静默模式"或"简略输出"
    - **结果汇总**：执行完毕后提供简洁的"成功/失败列表"或"汇总报告"
    - **避免卡死**：减少日志输出，确保任务能在单次上下文窗口内完成

---

## 🏗️ 架构与账号配置

### 架构流程
```
用户 → media.shadowhub.app (B账号Worker)
     → r2-proxy.suxiaoshuang2020.workers.dev (A账号Worker)
     → R2 bucket (shadowhub)
```

### 账号归属

**B 账号（域名与前端托管账号）**
- **托管服务**：GitHub Pages（通过 GitHub Actions 自动部署）
- **域名**：`shadowhub.app`（通过 Cloudflare DNS）
- **职责**：主入口，负责前端代码构建、部署与展示
- **Worker**：`morning-sound-a67b`（媒体代理）

**A 账号（素材存储账号）**
- **托管服务**：Cloudflare R2
- **Bucket 名称**：`shadowhub`
- **职责**：存放音频、视频、缩略图等所有素材文件
- **访问方式**：通过 B 账号 Worker 跨账号访问

**Supabase（中枢数据库）**
- **项目 ID**：`cuxotlijjnxbsirpdkgr`
- **URL**：`https://cuxotlijjnxbsirpdkgr.supabase.co`
- **职责**：存储素材元数据、练习文本及 R2 资源索引

### 关键凭证

**前端访问 URL**：
- **Worker 代理**：`https://media.shadowhub.app`（所有素材必须通过此代理访问）
- **Supabase URL**：`https://cuxotlijjnxbsirpdkgr.supabase.co`
- **Supabase Anon Key**：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`（详见代码）

### 关键文件

**前端组件**：
- `src/components/VideoPlayer.tsx` - 视频播放组件
- `src/components/AudioPlayer.tsx` - 音频播放组件
- `src/app/practice/page.tsx` - 练习页面（旧版，含 getCdnUrl 函数）
- `src/app/topics/[category]/[slug]/PracticePage.tsx` - 练习页面（新版，三栏布局）

**Worker 代码**：
- `cloudflare-workers/media-proxy/` - B 账号 Worker（媒体代理）
- `cloudflare-workers/r2-cors-proxy/` - A 账号 Worker（CORS 代理）

---

## 📋 Git 提交规范

### 提交类型
- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `refactor:` 代码重构
- `perf:` 性能优化
- `style:` 样式调整

### 提交格式
```bash
git commit -m "feat: 简短描述

详细说明（可选）

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### 部署流程
1. 代码自检：检查逻辑，确保无错误
2. 本地构建：`npm run build`
3. 提交代码：`git add . && git commit -m "..."`
4. 推送到 GitHub：`git push origin main`
5. GitHub Actions 自动构建并部署到 GitHub Pages
6. Cloudflare DNS 自动指向新的 GitHub Pages

### 推送前检查
- [ ] 代码逻辑自检完成
- [ ] 本地构建成功（`npm run build`）
- [ ] 版本号已更新（如需要）
- [ ] CHANGELOG.md 已更新（如需要）

---

## 📁 模块索引

本项目采用模块化文档结构，按需加载：

| 模块 | 文件路径 | 使用场景 |
|------|---------|---------|
| **自动化规范** | `docs/automation_standards.md` | 文件操作、R2 上传、批量导入 |
| **技术架构** | `docs/technical_deep_dive.md` | 代码开发、Bug 修复、性能优化 |
| **经验库** | `docs/knowledge_base.md` | 遇到 Bug 时查阅解决方案 |
| **翻译引擎** | `.shadowhub/translation-rules.json` | 翻译任务（JSON 格式） |

---

## 🔄 上下文恢复指南

如果对话中断或需要恢复完整上下文：

### 核心文档（必读）
- `claude-code-guide.md` （本文件）

### 按需加载
- **文件操作/批量导入**：`docs/automation_standards.md`
- **代码开发/Bug 修复**：`docs/technical_deep_dive.md` + `docs/knowledge_base.md`
- **翻译任务**：`.shadowhub/translation-rules.json`
- **翻译 UI 开发**：`docs/translation-ui-refactor.md`

### 快速恢复命令
```bash
# 核心文档
cat claude-code-guide.md

# 文件操作场景
cat claude-code-guide.md docs/automation_standards.md

# 代码开发场景
cat claude-code-guide.md docs/technical_deep_dive.md docs/knowledge_base.md

# 翻译任务（中文翻译）
cat claude-code-guide.md scripts/translate.js

# 翻译任务（越南语翻译）
cat claude-code-guide.md scripts/translate_to_vietnamese.py

# 翻译 UI 开发
cat claude-code-guide.md docs/translation-ui-refactor.md
```

---

## 📌 项目概览

**项目名称**：ShadowHub - 英语听写与跟读练习平台

**技术栈**：
- 前端：Next.js 14、React 19、TypeScript
- 后端：Supabase (PostgreSQL)
- 存储：Cloudflare R2
- 部署：GitHub Pages + Cloudflare Workers
- 域名：Cloudflare DNS (`shadowhub.app`)

**核心功能**：
- 听写模式 (Dictation)
- 跟读模式 (Shadowing)
- 单词练习模式
- YouTube 素材集成

---

## ⚠️ 核心开发规范

### 1. 素材访问强制要求
- **所有素材必须通过 Worker 代理访问**：`https://media.shadowhub.app`
- **禁止直接使用 R2 公共域名**（缺少 CORS 头）
- **所有 `<img>`, `<audio>`, `<video>` 标签必须添加 `crossOrigin="anonymous"`**
- **iOS 视频必须添加 `playsInline` 属性**

### 2. Worker 配置要求
- **B 账号必须设置 `media.shadowhub.app/*` 路由**
- **DNS 记录必须是橙色云朵**（不是灰色云朵）
- **Worker 必须返回正确的 CORS 头**：`Access-Control-Allow-Origin: *`

### 3. 视频格式要求
- **iOS 要求 moov atom 在文件开头**（使用 `ffmpeg -movflags faststart` 处理）
- **视频编码必须为 H.264/AAC**
- **建议文件大小 < 20MB**

---

**版本**：V20.0
**更新日期**：2026-03-18
**状态**：生产就绪
