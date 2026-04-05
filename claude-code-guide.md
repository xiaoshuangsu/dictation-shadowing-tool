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

## 🏗️ 架构与账号配置（V29.6.2 更新）

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
> "请先阅读 `claude-code-guide.md`，当前版本是 V29.7.9（2026-04-05），主要实现了：
> - **YouTube 脚本 v2.2**：完整自动化流程（LLM 标点恢复 → yt-dlp 字幕抓取 → 智能断句 → 时间轴优化 → 智能挖空 v6.2 → 19国翻译 → 入库）
> - **翻译语言扩展**：支持 19 种语言（原有 3 种 + 新增 16 种：Arabic, Deutsch, Español, 日本語, Bahasa Melayu, Russian, Türkçe, Greek, Indonesian, 한국어, Português, ภาษาไทย, Українська, বাংলা, Монгол, हिन্দी）
> - **v6.2 挖空逻辑**：语言习得导向，权重系统，索引转换，自动修正
> - **Prompt 干扰修复**：自动清理 GLM 返回的 prompt 内容
> - **双重分词机制**：空格分词匹配 blanks.index，正则分词渲染原文（保留标点）
> - **Vercel 部署**：从 GitHub Pages 迁移到 Vercel，启用 API Routes
> - **前端崩溃修复**：过滤无效句子，添加安全检查和错误边界"
> - **YouTube 脚本 v2.2**：完整自动化流程（LLM 标点恢复 → yt-dlp 字幕抓取 → 智能断句 → 时间轴优化 → 智能挖空 v6.2 → 19国翻译 → 入库）
> - **翻译语言扩展**：支持 19 种语言（原有 3 种 + 新增 16 种：Arabic, Deutsch, Español, 日本語, Bahasa Melayu, Russian, Türkçe, Greek, Indonesian, 한국어, Português, ภาษาไทย, Українська, বাংলা, Монгол, हिन्दी）
> - **v6.2 挖空逻辑**：语言习得导向，权重系统，索引转换，自动修正
> - **Prompt 干扰修复**：自动清理 GLM 返回的 prompt 内容
> - **双重分词机制**：空格分词匹配 blanks.index，正则分词渲染原文（保留标点）
> - **Vercel 部署**：从 GitHub Pages 迁移到 Vercel，启用 API Routes"

---

**版本**：V29.7.9
**更新日期**：2026-04-05
**架构状态**：生产就绪（Vercel 托管）
**部署平台**：https://shadowhub.app（Vercel）
**GitHub**：https://github.com/xiaoshuangsu/dictation-shadowing-tool

**最新更新**：
- ✅ **前端崩溃修复**（v29.7.9）：过滤无效句子，添加安全检查和错误边界
  - 修复了翻译缺失导致的页面崩溃问题
  - 添加 DebugErrorBoundary 组件捕获客户端错误
  - 所有 sentence.text 的 split() 调用添加空字符串后备
  - 数据库清理：删除 Cam 10 素材中的无效句子
- ✅ **词典预生成脚本 V3.0**：模块化架构（6 个模块），Oxford 3000 + 19国翻译 + Edge TTS + R2 存储
- ✅ **TranslationEngine 翻译引擎**：19 国语言批量翻译，指数退避重试（2s→4s→8s）
- ✅ **OxfordScraper 抓取模块**：支持空行容错，已修复 Accept-Encoding 问题
- ✅ **数据库迁移完成**：7142 条记录迁移到 JSONB 结构，translations 字段支持 19 种语言
- ✅ **测试验证**：20 个单词联调测试，100% 成功率
- ✅ **YouTube 脚本 v2.2**：完整自动化流程（LLM 标点恢复 + 智能断句 v6.3 + 智能挖空 v6.2 + 19 国翻译）
- ✅ **YouTube 批量处理脚本 v2.2**：批量处理，断点恢复，每完成一个立即入库
- ✅ **翻译语言扩展**：19 种语言（原有 3 种 + 新增 16 种）

---

## 📚 核心脚本索引（快速恢复）

### 挖空脚本（Blank Logic）

| 脚本名称 | 版本 | 路径 | 功能描述 | 最后更新 |
|---------|------|------|----------|----------|
| **主挖空脚本** | v6.2 | `scripts/reprocess_ietts_blanks.py` | 雅思素材挖空重处理，支持索引转换和自动修正 | 2026-03-28 |
| **CAM 13/14 批量** | v1.0 | `scripts/reprocess_cam13_14_only.py` | 批量处理 CAM 13/14 系列素材（32个） | 2026-03-28 |

**挖空逻辑版本历史**：
- v6.1 (2026-03-28): **新增索引转换逻辑（自动修正 GLM 返回的错误 index）**
- v6.0 (2026-03-26): 新增黑名单（情态助动词、疑问代词、低级认知词）+ 修复事实词过滤与提权规则冲突
- v5.2 (2026-03-26): 长单词提权、音节复杂度加成、月份提权、禁止填充语
- v5.1 (2026-03-26): 修复 W6 占比过高，扩展黑名单和权重规则
- v5.0 (2026-03-26): 语言习得导向重构，权重系统，固定搭配识别

**关键修复**（v6.1）：
- ✅ **索引转换逻辑**：验证 word 是否与 index 位置的词匹配
- ✅ **自动修正**：GLM 返回错误 index 时，在句子中查找实际位置
- ✅ 空格分词索引 → 正则分词索引的转换逻辑（前端）
- ✅ 正则表达式支持 ASCII 撇号（U+0027）和弯撇号（U+2019）
- ✅ 数据库 `blanks.index` 基于空格分词，前端自动适配

### 素材上传脚本（Ingest Scripts）

| 脚本名称 | 版本 | 路径 | 功能描述 | 最后更新 |
|---------|------|------|----------|----------|
| **批量上传** | v6.1 | `scripts/ingest_bulk.py` | Engnovate 批量素材导入，GLM 翻译，智能挖空，索引转换 | 2026-03-28 |
| **单个上传** | - | `scripts/ingest_single.py` | 单个素材上传 | - |
| **YouTube 上传** | **v2.2** | `scripts/ingest_youtube_ytdlp.py` | **YouTube 自动化完整版：LLM 标点恢复 + 智能断句 + 挖空(v6.2) + 19国翻译** | **2026-04-01** |
| **YouTube 批量上传** | **v2.2** | `scripts/ingest_youtube_batch.py` | **批量处理，断点恢复，每完成一个立即入库** | **2026-04-01** |

**YouTube 脚本特点（v2.2）**：
- ✅ **完整自动化流程**：yt-dlp 字幕抓取 → LLM 标点恢复 → 智能断句 → 时间轴优化 → 智能挖空 → 19国翻译 → 入库
- ✅ **LLM 标点恢复**（v2.2 新增）：自动修复字幕缺失的标点符号
- ✅ **智能断句（v6.3）**：简化时间戳对齐逻辑，末尾滞后容差
- ✅ **智能挖空（v6.2 逻辑）**：语言习得导向，权重系统，索引转换，自动修正
- ✅ **19 种语言翻译**：原有 3 种（zh, zh_hant, vi）+ 新增 16 种（Group A + Group B）
- ✅ **Iframe 兼容性**：自动设置 `source_type: "youtube"` 和 `youtube_id`
- ✅ **翻译顺序**：原有语言 → Group A → Group B（确保稳定性）
- ✅ **错误处理**：失败标记 `[TODO_RETRY]`，支持后续重试
- ✅ **Prompt 干扰修复**：自动清理 GLM 返回的 prompt 内容

**批量处理脚本特点（v2.2）**：
- ✅ **每完成一个立即入库**：避免中途中断导致数据丢失
- ✅ **断点恢复**：自动跳过已入库的视频
- ✅ **进度保存**：`/tmp/youtube_batch_progress.json` 记录处理进度
- ✅ **统计报告**：显示成功/失败/跳过的数量

**注意**：`ingest_bulk.py` (v6.2) 和 `reprocess_ietts_blanks.py` (v6.2) 均为独立实现，逻辑相同但未共享代码。

### 翻译脚本（Translation Scripts）

| 脚本名称 | 版本 | 路径 | 功能描述 | 最后更新 |
|---------|------|------|----------|----------|
| **中文翻译** | - | `scripts/translate.js` | 英译中翻译 | - |
| **越南语翻译** | - | `scripts/translate_to_vietnamese.py` | 英译越南语翻译 | - |

### 词典预生成脚本（Dictionary Cache Prepopulation）

| 脚本名称 | 版本 | 路径 | 功能描述 | 最后更新 |
|---------|------|------|----------|----------|
| **词典预生成** | **V3.0** | `scripts/prepopulate_dictionary_cache_v3.py` | **Oxford 3000 + 19国翻译 + Edge TTS + R2 存储** | **2026-04-01** |

**V3.0 模块化架构**：
- ✅ **【模块 A】基础框架与配置**：dotenv, Supabase, R2, 19 国语言定义
- ✅ **【模块 B】OxfordScraper 抓取模块**：从 engnovate.com 抓取 Oxford 3000 单词数据（支持空行容错）
- ✅ **【模块 C】TranslationEngine 翻译引擎**：19 国语言批量翻译，指数退避重试，语种分组
- ✅ **【模块 D】Edge TTS 音频生成**：异步音频生成
- ✅ **【模块 E】R2 上传**：S3 兼容接口上传到 R2
- ✅ **【模块 F】数据保存**：JSONB translations + audio_r2_url（向后兼容 definitions 字段）

**TranslationEngine 核心特性**：
- **批量翻译**：一次性请求 19 种语言（分组处理：Group 1: 11种 + Group 2: 8种）
- **指数退避重试**：2s → 4s → 8s（MAX_RETRIES=3）
- **成本优化**：紧凑 Prompt（语言缩写：简中, 繁中, 越南, 阿拉伯...）
- **冷却机制**：分组间冷却 1 秒（缓解 Rate Limit）

**翻译语言列表（19 种）**：
- **原有 (3种)**：zh, zh_hant, vi
- **Group A (8种)**：ar, de, es, ja, ms, ru, tr, el
- **Group B (8种)**：id, ko, pt, th, uk, bn, mn, hi

**数据结构**：
```json
{
  "word": "act",
  "phonetic": "/ækt/",
  "translations": {
    "en": "to do something for a particular purpose...",
    "zh": "执行",
    "zh_hant": "執行",
    "vi": "thực hiện",
    "ar": "فعل",
    "de": "tun",
    ... (19 种语言)
  },
  "example": "We need to act quickly.",
  "audio_r2_url": "https://media.shadowhub.app/audio/dictionary/act.mp3"
}
```

**使用方法**：
```bash
# 测试模式（3 个单词）
python3 scripts/prepopulate_dictionary_cache_v3.py --test --oxford --limit 3

# 自定义单词数量
python3 scripts/prepopulate_dictionary_cache_v3.py --test --oxford --limit 20
```

**测试结果（2026-04-01）**：
- ✅ 20 个单词联调测试
- ✅ 100% 成功率（20/20）
- ✅ translations 字段包含完整 19 种语言
- ✅ audio_r2_url 指向正确的 R2 路径

**恢复口令（重要！）**：
> "请先阅读 `claude-code-guide.md`，词典预生成脚本已更新到 V3.0，实现了模块化架构（6 个模块）：
> - 【模块 A】基础框架与配置（dotenv, Supabase, R2, 19 国语言）
> - 【模块 B】OxfordScraper 抓取模块（支持空行容错，已修复 Accept-Encoding 问题）
> - 【模块 C】TranslationEngine 翻译引擎（19 国语言批量翻译，指数退避重试 2s→4s→8s）
> - 【模块 D】Edge TTS 音频生成（异步）
> - 【模块 E】R2 上传（S3 兼容接口）
> - 【模块 F】数据保存（同时填充 definitions 旧字段和 translations 新字段）
>
> TranslationEngine 分组翻译：
> - Group 1: 原有 (3种) + Group A (8种) = 11 种
> - 冷却 1 秒
> - Group 2: Group B (8种)
>
> 数据库迁移已完成（7142 条记录），translations 字段为 JSONB 类型。
> 测试结果：20 个单词 100% 成功，translations 包含完整 19 种语言。

### 文本规范化（Text Normalization）

| 脚本名称 | 版本 | 路径 | 功能描述 | 最后更新 |
|---------|------|------|----------|----------|
| **文本规范化** | - | `scripts/text_normalizer.py` | 连字符词空格清理，确保 `word-word` 格式统一 | - |

---

## 🚀 快速恢复指令

### 场景 1：挖空逻辑问题（索引错误、撇号丢失）

```bash
# 恢复上下文
cat claude-code-guide.md docs/knowledge_base.md

# 验证修复
python3 scripts/test_index_conversion.js

# 批量重处理（单个素材）
python3 scripts/reprocess_ietts_blanks.py

# 批量重处理（CAM 13/14 系列）
python3 scripts/reprocess_cam13_14_only.py
```

### 场景 2：连字符词分词问题

```bash
# 恢复上下文
cat claude-code-guide.md docs/automation_standards.md

# 测试文本规范化
python3 scripts/text_normalizer.py

# 检测数据库中的问题
python3 scripts/find_hyphenated_words.py

# 批量修复
python3 scripts/fix_hyphen_spacing.py
```

### 场景 3：素材上传（Engnovate 批量导入）

```bash
# 恢复上下文
cat claude-code-guide.md docs/automation_standards.md

# 准备 URL 列表
echo "https://engnovate.com/..." > /tmp/urls.txt

# 运行批量上传
python3 scripts/ingest_bulk.py
```

### 场景 3.5：YouTube 视频自动入库

```bash
# 恢复上下文
cat claude-code-guide.md scripts/ingest_youtube_ytdlp.py scripts/ingest_youtube_batch.py

# ========== 单个视频入库 ==========
# 默认分类：Science and Facts，难度：B2
python3 scripts/ingest_youtube_ytdlp.py "https://youtu.be/xxxxx"

# 指定分类和难度
python3 scripts/ingest_youtube_ytdlp.py "https://youtu.be/xxxxx" --category "Science and Facts" --difficulty "B2"

# 查看帮助
python3 scripts/ingest_youtube_ytdlp.py --help

# ========== 批量视频入库（推荐）==========
# 批量处理多个视频，每完成一个立即入库
python3 scripts/ingest_youtube_batch.py \
  "https://youtu.be/xxxxx" \
  "https://youtu.be/yyyyy" \
  "https://youtu.be/zzzzz" \
  --category "BBC Earth" \
  --difficulty "C2"

# 强制重新处理（即使已入库）
python3 scripts/ingest_youtube_batch.py "https://youtu.be/xxxxx" --force
```

**预期时间**：每个视频约 35-40 分钟（取决于句子数量，约 1 分钟/句）

**v2.2 自动化流程**：
1. yt-dlp 获取字幕（Chrome cookies 绕过 bot 检测）
2. **LLM 标点恢复**（v2.2 新增）
3. 智能断句（v6.3，82 → 38 句）
4. 时间轴优化（简化对齐逻辑 + 末尾滞后容差）
5. 智能挖空（v6.2 逻辑，W10=13, W9=2, W6=2）
6. 19 国语言翻译（原有 3 种 + Group A 8 种 + Group B 8 种）
7. 入库 Supabase（source_type: "youtube", youtube_id: "xxxxx"）

**批量处理优势**：
- ✅ 每完成一个立即入库（避免数据丢失）
- ✅ 支持断点恢复（跳过已入库视频）
- ✅ 进度保存（`/tmp/youtube_batch_progress.json`）

**数据格式**：
```json
{
  "id": 1,
  "text": "One day around 850 CE, a goatherd named Kaldi observed that...",
  "startTime": 6.79,
  "endTime": 16.43,
  "blanks": [{"word": "goatherd", "index": 6, "weight": 10}],
  "translation": {
    "zh": "公元850年左右的一天，一个名叫卡迪的牧羊人...",
    "zh_hant": "公元850年左右的一天，一個名叫卡迪的牧羊人...",
    "vi": "Vào khoảng năm 850 SCN...",
    // ... 共 19 种语言
  }
}
```

### 场景 3.75：词典预生成脚本（Oxford 3000 + 19国翻译）

```bash
# 恢复上下文（使用恢复口令）
cat claude-code-guide.md scripts/prepopulate_dictionary_cache_v3.py

# ========== 测试模式（推荐先运行）==========
# 测试 3 个单词
python3 scripts/prepopulate_dictionary_cache_v3.py --test --oxford --limit 3

# 测试 20 个单词
python3 scripts/prepopulate_dictionary_cache_v3.py --test --oxford --limit 20

# ========== 验证数据 ==========
# 检查 Supabase 中的 translations 字段
# 访问 Supabase Table Editor → dictionary_cache 表
# 验证 translations (JSONB) 字段包含 19 种语言

# ========== 验证 translations 字段完整性 ==========
python3 << 'EOF'
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('.env.local')
supabase = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

# 查询单词
response = supabase.table('dictionary_cache').select('*').eq('word', 'act').execute()
translations = response.data[0]['translations']

# 检查语言数量
print(f"翻译语言数量: {len(translations)} 种")

# 检查 19 种语言是否都存在
expected = ['en', 'zh', 'zh_hant', 'vi', 'ar', 'de', 'es', 'ja', 'ms', 'ru', 'tr', 'el', 'id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi']
missing = [lang for lang in expected if lang not in translations]

if missing:
    print(f"❌ 缺失语言: {missing}")
else:
    print("✅ 所有 19 种语言翻译完整！")
EOF
```

**V3.0 模块化架构**：
- ✅ **【模块 A】基础框架与配置**：dotenv, Supabase, R2, 19 国语言定义
- ✅ **【模块 B】OxfordScraper 抓取模块**：支持空行容错，已修复 Accept-Encoding 问题
- ✅ **【模块 C】TranslationEngine 翻译引擎**：19 国语言批量翻译，指数退避重试
- ✅ **【模块 D】Edge TTS 音频生成**：异步音频生成
- ✅ **【模块 E】R2 上传**：S3 兼容接口上传到 R2
- ✅ **【模块 F】数据保存**：同时填充 definitions（旧）和 translations（新）

**TranslationEngine 分组翻译策略**：
- **Group 1**：原有 (3种: zh, zh_hant, vi) + Group A (8种: ar, de, es, ja, ms, ru, tr, el) = 11 种
- **冷却 1 秒**（缓解 Rate Limit）
- **Group 2**：Group B (8种: id, ko, pt, th, uk, bn, mn, hi) = 8 种

**指数退避重试机制**：
- **重试次数**：MAX_RETRIES = 3
- **退避时间**：2s → 4s → 8s（BACKOFF_MULTIPLIER = 2.0）

**成本优化**：
- **紧凑 Prompt**：语言缩写（简中, 繁中, 越南, 阿拉伯...）
- **批量翻译**：一次性请求所有语言

**预期性能**：
- 每个单词约 15-20 秒（翻译 2 次 + 音频生成 + R2 上传）
- 20 个单词约 6-8 分钟

**数据库迁移状态**：
- ✅ 已完成（7142 条记录）
- ✅ translations 字段（JSONB）
- ✅ audio_r2_url 字段
- ✅ 向后兼容 definitions 字段

### 场景 4：点词翻译与生词本

```bash
# 恢复上下文
cat claude-code-guide.md docs/dictionary_and_translation_implementation.md

# 词典预生成恢复（重要！）
cat RESUME_PREPOPULATION.md

# 查看词典缓存统计
# 访问 Supabase Table Editor：dictionary_cache 表
```

### 场景 5：代码开发与 Bug 修复

```bash
# 恢复上下文
cat claude-code-guide.md docs/technical_deep_dive.md docs/knowledge_base.md

# 查看版本历史
git log --oneline -10

# 查看最近的修改
git diff HEAD~1
```

---

## 📖 重要文档版本索引

| 文档名称 | 版本 | 更新日期 | 用途 |
|---------|------|----------|------|
| `claude-code-guide.md` | V29.7.10 | 2026-04-01 | 项目主指南，脚本索引，YouTube 批量处理 |
| `docs/knowledge_base.md` | V29.6.1 | 2026-03-27 | Bug 记录与解决方案 |
| `docs/automation_standards.md` | V19.9 | 2026-03-18 | 素材上传规范 |
| `docs/dictionary_and_translation_implementation.md` | V20.1 | 2026-03-21 | 点词翻译与生词本 |
| `docs/dictionary_cache_guide.md` | - | - | 词典缓存优化 |
| `RESUME_PREPOPULATION.md` | - | - | 词典预生成恢复口令 |

---
