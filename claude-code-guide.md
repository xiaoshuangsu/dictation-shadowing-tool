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

**A 账号（素材存储账号）**
- **托管服务**：Cloudflare R2
- **Bucket 名称**：`shadowhub`
- **Worker**：`r2-proxy.suxiaoshuang2020.workers.dev`

**Supabase（中枢数据库）**
- **项目 ID**：`cuxotlijjnxbsirpdkgr`
- **URL**：`https://cuxotlijjnxbsirpdkgr.supabase.co`

### Vercel 环境变量

```
GLM_API_KEY=***（智谱 AI API 密钥）
SUPABASE_SERVICE_ROLE_KEY=***（Supabase Service Key）
NEXT_PUBLIC_SUPABASE_URL=https://cuxotlijjnxbsirpdkgr.supabase.co
```

### 关键凭证

**前端访问 URL**：
- **Worker 代理**：`https://media.shadowhub.app`（所有素材必须通过此代理访问）
- **Supabase URL**：`https://cuxotlijjnxbsirpdkgr.supabase.co`

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

1. **代码推送**：`git push origin main`
2. **自动触发**：GitHub → Vercel（自动部署）
3. **访问新版本**：`https://shadowhub.app`

---

## 📁 模块索引

本项目采用模块化文档结构，按需加载：

| 模块 | 文件路径 | 使用场景 |
|------|---------|---------|
| **YouTube 自动化** | `docs/youtube_automation.md` | YouTube 视频自动入库、翻译 |
| **词典预生成** | `docs/dictionary_prepopulation.md` | Oxford 3000、IELTS 词汇预生成 |
| **挖空逻辑规范** | `docs/blank_logic_guide.md` | 挖空逻辑 v6.2、索引转换 |
| **自动化规范** | `docs/automation_standards.md` | 文件操作、R2 上传、批量导入 |
| **技术架构** | `docs/technical_deep_dive.md` | 代码开发、Bug 修复、性能优化 |
| **经验库** | `docs/knowledge_base.md` | 遇到 Bug 时查阅解决方案 |
| **点词翻译与生词本** | `docs/dictionary_and_translation_implementation.md` | 点词翻译功能、生词本管理 |
| **词典缓存优化** | `docs/dictionary_cache_guide.md` | 词典缓存架构、成本优化 |

---

## 🚀 快速恢复命令

### YouTube 视频入库

```bash
# 单个视频
python3 scripts/ingest_youtube_ytdlp.py "https://youtu.be/xxxxx"

# 批量处理（推荐）
python3 scripts/ingest_youtube_batch.py "URL1" "URL2" --category "BBC Earth"
```
📖 **详细文档**：`docs/youtube_automation.md`

### 词典预生成

```bash
# 测试模式（推荐先运行）
python3 scripts/prepopulate_dictionary_cache_v3.py --test --oxford --limit 3

# 完整运行
python3 scripts/prepopulate_dictionary_cache_v3.py --oxford
```
📖 **详细文档**：`docs/dictionary_prepopulation.md`

### 挖空逻辑修复

```bash
# 单个素材重处理
python3 scripts/reprocess_ietts_blanks.py

# CAM 13/14 批量处理
python3 scripts/reprocess_cam13_14_only.py
```
📖 **详细文档**：`docs/blank_logic_guide.md`

### 素材上传

```bash
# Engnovate 批量导入
echo "https://engnovate.com/..." > /tmp/urls.txt
python3 scripts/ingest_bulk.py
```
📖 **详细文档**：`docs/automation_standards.md`

### 翻译修复

```bash
# 自动重试失败的翻译
python3 scripts/retry_failed_translations.py

# 清理翻译格式标签
python3 scripts/clean_translation_tags.py
```

### 代码开发与 Bug 修复

```bash
# 查看版本历史
git log --oneline -10

# 查看最近的修改
git diff HEAD~1
```
📖 **详细文档**：`docs/technical_deep_dive.md` + `docs/knowledge_base.md`

---

## 📖 文档版本索引

| 文档名称 | 版本 | 更新日期 | 用途 |
|---------|------|----------|------|
| `claude-code-guide.md` | V30.1 | 2026-04-06 | 项目主指南（精简版） |
| `docs/youtube_automation.md` | v2.2 | 2026-04-06 | YouTube 视频自动入库 |
| `docs/dictionary_prepopulation.md` | V3.0 | 2026-04-06 | 词典预生成脚本 |
| `docs/blank_logic_guide.md` | v6.2 | 2026-04-06 | 挖空逻辑规范 |
| `docs/knowledge_base.md` | V29.6.1 | 2026-03-27 | Bug 记录与解决方案 |
| `docs/automation_standards.md` | V19.9 | 2026-03-18 | 素材上传规范 |
| `docs/dictionary_and_translation_implementation.md` | V20.1 | 2026-03-21 | 点词翻译与生词本 |
| `docs/dictionary_cache_guide.md` | - | - | 词典缓存优化 |

---

## 🔄 快速恢复上下文

如果对话中断，快速恢复上下文的方法：

### 方式一：快速恢复命令
```bash
# 项目指南（精简版）
cat claude-code-guide.md

# 完整上下文恢复
cat claude-code-guide.md docs/youtube_automation.md docs/dictionary_prepopulation.md
```

### 方式二：一句话恢复
> "请先阅读 `claude-code-guide.md`，当前版本是 V30.1（2026-04-06），主要实现了：
> - **YouTube 脚本 v2.2**：完整自动化流程（LLM 标点恢复 → yt-dlp 字幕抓取 → 智能断句 v6.3 → 智能挖空 v6.2 → 19国翻译）
> - **词典系统 V3.0**：多语言 JSONB 架构，R2 音频优化，支持 19 种语言
> - **挖空逻辑 v6.2**：语言习得导向，权重系统，索引转换，自动修正
> - **Vercel 部署**：从 GitHub Pages 迁移到 Vercel，启用 API Routes"

---

**版本**：V30.1
**更新日期**：2026-04-06
**架构状态**：生产就绪（Vercel 托管）
**部署平台**：https://shadowhub.app
**GitHub**：https://github.com/xiaoshuangsu/dictation-shadowing-tool
