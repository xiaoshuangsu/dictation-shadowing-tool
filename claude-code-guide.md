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

## 🏗️ 架构与账号配置（V29.6.1 更新）

### 当前架构（2026-03-22 迁移到 Vercel）

```
用户访问 shadowhub.app
    ↓
Vercel 托管（前端 + API Routes）
    ↓
┌─────────────────────────────────────┐
│  前端页面（静态）                     │
│  练习页面 /topics/...                │
│  生词本 /vocabulary                  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  API Routes（Vercel Serverless）     │
│  /api/word-definition  (点词翻译)    │
│  /api/user-words       (生词本)      │
│  /api/user-words/check (检查生词)    │
│  /api/update-transcript (更新字幕)   │
└─────────────────────────────────────┘
    ↓
Supabase (数据库 + dictionary_cache)
    ↓
┌─────────────────────────────────────┐
│  媒体文件访问                        │
│  media.shadowhub.app (B账号Worker)  │
│       ↓                              │
│  R2 bucket (A账号)                   │
└─────────────────────────────────────┘
```

### 账号归属（跨账号架构）

**B 账号（域名与前端托管账号）**
- **域名**：`shadowhub.app`（Cloudflare DNS，DNS Only 模式）
- **前端托管**：**Vercel**（2026-03-22 迁移）
- **Vercel 项目**：`xiaoshuangsus-projects/dictation`
- **Worker**：`media.shadowhub.app`（媒体代理，橙色云朵开启）
- **职责**：
  - 前端页面展示
  - API Routes 服务
  - 媒体文件代理（通过 Worker）

**A 账号（素材存储账号）**
- **托管服务**：Cloudflare R2
- **Bucket 名称**：`shadowhub`
- **Worker**：`r2-proxy.suxiaoshuang2020.workers.dev`
- **职责**：存放音频、视频、缩略图等所有素材文件
- **访问方式**：通过 B 账号 Worker 跨账号访问

**Supabase（中枢数据库）**
- **项目 ID**：`cuxotlijjnxbsirpdkgr`
- **URL**：`https://cuxotlijjnxbsirpdkgr.supabase.co`
- **职责**：
  - 存储素材元数据
  - 存储练习文本
  - R2 资源索引
  - **dictionary_cache** 表（词典缓存）
  - **user_words** 表（生词本）

### 部署流程（Vercel）

1. **代码推送**：`git push origin main`
2. **自动触发**：GitHub → Vercel（自动部署）
3. **域名指向**：Cloudflare DNS → Vercel
4. **全球 CDN**：Vercel Edge Network

### Vercel 环境变量

```
GLM_API_KEY=***（智谱 AI API 密钥）
SUPABASE_SERVICE_ROLE_KEY=***（Supabase Service Key）
NEXT_PUBLIC_SUPABASE_URL=https://cuxotlijjnxbsirpdkgr.supabase.co
```

### 架构迁移历史

| 日期 | 托管平台 | API Routes | 原因 |
|------|---------|-----------|------|
| 2026-03-22 前 | GitHub Pages | ❌ 不支持 | 静态托管 |
| 2026-03-22 | **Vercel** | ✅ 支持 | 需要后端 API |

### 关键凭证

**前端访问 URL**：
- **Worker 代理**：`https://media.shadowhub.app`（所有素材必须通过此代理访问）
- **Supabase URL**：`https://cuxotlijjnxbsirpdkgr.supabase.co`
- **Supabase Anon Key**：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`（详见代码）

### 关键文件

**前端组件**：
- `src/components/VideoPlayer.tsx` - 视频播放组件
- `src/components/AudioPlayer.tsx` - 音频播放组件
- `src/components/WordMode.tsx` - **单词挖空组件**（Dictation 模式）
- `src/app/practice/page.tsx` - 练习页面（旧版，含 getCdnUrl 函数）
- `src/app/topics/[category]/[slug]/PracticePage.tsx` - 练习页面（新版，三栏布局）

**Worker 代码**：
- `cloudflare-workers/media-proxy/` - B 账号 Worker（媒体代理）
- `cloudflare-workers/r2-cors-proxy/` - A 账号 Worker（CORS 代理）

---

## 📋 Git 提交与部署规范

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

### 部署流程（Vercel 自动部署）

1. **代码自检**：检查逻辑，确保无错误
2. **本地构建**：`npm run build`
3. **提交代码**：`git add . && git commit -m "..."`
4. **推送到 GitHub**：`git push origin main`
5. **Vercel 自动部署**（约 1-2 分钟）
6. **访问新版本**：`https://shadowhub.app`

### 推送前检查
- [ ] 代码逻辑自检完成
- [ ] 本地构建成功（`npm run build`）
- [ ] 版本号已更新（如需要）
- [ ] CHANGELOG.md 已更新（如需要）
- [ ] API Routes 变更检查（如有）

### ⚠️ GitHub Actions 状态说明

**重要**：项目已迁移到 Vercel，不再使用 GitHub Actions 构建。

| 平台 | 状态 | 说明 |
|------|------|------|
| **GitHub Actions** | ❌ **已禁用** | 不再用于前端构建 |
| **Vercel** | ✅ **正常工作** | 自动从 GitHub 拉取并部署 |

**为什么 GitHub 显示红色叉号？**
- ❌ **GitHub Actions** 失败是正常的（已禁用）
- ✅ **Vercel 部署** 才是实际的部署
- ✅ **生产环境** 能正常访问说明部署成功

**workflow 文件**：
- `.github/workflows/nextjs.yml.disabled`（已禁用）
- 如需恢复 GitHub Actions，改回 `.github/workflows/nextjs.yml`

### Vercel 部署状态查看

```bash
# 查看最近的部署
npx vercel ls

# 查看实时日志
npx vercel logs --limit 50

# 查看环境变量
npx vercel env ls
```

### 重要配置文件

**Vercel 配置** (`vercel.json`)：
```json
{
  "buildCommand": "npm run build",
  "framework": "nextjs",
  "regions": ["hkg1"],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    }
  ]
}
```

**Next.js 配置** (`next.config.js`)：
```javascript
// 注意：Vercel 部署时，已禁用 output: 'export'
// Vercel 原生支持 Next.js，不需要静态导出

---

## 📁 模块索引

本项目采用模块化文档结构，按需加载：

| 模块 | 文件路径 | 使用场景 |
|------|---------|---------|
| **自动化规范** | `docs/automation_standards.md` | 文件操作、R2 上传、批量导入 |
| **技术架构** | `docs/technical_deep_dive.md` | 代码开发、Bug 修复、性能优化 |
| **经验库** | `docs/knowledge_base.md` | 遇到 Bug 时查阅解决方案 |
| **翻译引擎** | `.shadowhub/translation-rules.json` | 翻译任务（JSON 格式） |
| **点词翻译与生词本** | `docs/dictionary_and_translation_implementation.md` | 点词翻译功能、生词本管理、多语言缓存 |
| **词典缓存优化** | `docs/dictionary_cache_guide.md` | 词典缓存架构、成本优化、监控统计 |
| **词典预生成恢复** | `RESUME_PREPOPULATION.md` | **重要！预生成脚本恢复口令（避免字段名错误和重复进程）** |

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
- **点词翻译与生词本**：`docs/dictionary_and_translation_implementation.md`
- **词典缓存优化**：`docs/dictionary_cache_guide.md`

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

# 点词翻译与生词本功能（完整上下文）
cat claude-code-guide.md docs/dictionary_and_translation_implementation.md

# 词典缓存优化与预生成
cat claude-code-guide.md docs/dictionary_cache_guide.md

# ⚠️ 词典预生成脚本恢复（重要！）
cat RESUME_PREPOPULATION.md
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

### 4. 挖空逻辑分词规范（V29.6.1 修复）
- **挖空脚本**（`scripts/reprocess_ietts_blanks.py`）使用**空格分词**：`split(' ')`
  - 生成的 `blanks.index` 基于空格分词
  - 数据库中的 `blanks` 数据必须与空格分词一致

- **前端 WordMode** 使用**双重分词**：
  - `spaceTokens`：空格分词，用于匹配 `blanks.index`
  - `renderTokens`：正则分词，用于渲染原文（保留标点）
  - **必须添加索引转换逻辑**：将空格分词的 index 转换为正则分词的 index

- **正则表达式必须支持两种撇号**：
  - ASCII 撇号（U+0027）：`'`
  - 弯撇号/智能引号（U+2019）：`'\u2019`
  - 正则：`/([a-zA-Z0-9'\u2019-]+|[.,!?;:]+|\s+)/g`

- **关键原则**：
  - ❌ **禁止**：直接用 `blanks.index` 索引正则分词结果（会错位）
  - ✅ **正确**：先用空格分词验证，再转换为正则分词索引
  - ✅ **向后兼容**：数据库 `blanks` 数据无需修改，前端自动适配

---

## 🔄 快速恢复上下文

如果对话终止，快速恢复上下文的方法：

### 方式一：快速恢复命令
```bash
# 项目指南
cat claude-code-guide.md

# 挖空逻辑规范（V29.6.1 最新修复）
cat claude-code-guide.md docs/knowledge_base.md

# 完整上下文恢复
cat CONTEXT_RESTORE.md
```

### 方式二：一句话恢复
> "请先阅读 `claude-code-guide.md`，当前版本是 V29.6.1（2026-03-27），主要实现了：
> - **挖空逻辑修复**：修复分词索引不一致和撇号丢失问题（v6.1 修复引入的 bug）
> - **双重分词机制**：空格分词匹配 blanks.index，正则分词渲染原文（保留标点）
> - **字符编码支持**：正则表达式同时支持 ASCII 撇号（U+0027）和弯撇号（U+2019）
> - **Vercel 部署**：从 GitHub Pages 迁移到 Vercel，启用 API Routes
> - **训练模式选择弹窗**：Dictation 和 Shadowing 两种模式选择"

---

**版本**：V29.6.1
**更新日期**：2026-03-27
**架构状态**：生产就绪（Vercel 托管）
**部署平台**：https://shadowhub.app（Vercel）
**GitHub**：https://github.com/xiaoshuangsu/dictation-shadowing-tool
