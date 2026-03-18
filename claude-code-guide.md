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

## 📋 Git 提交规范

### 提交类型
- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `refactor:` 代码重构
- `perf:` 性能优化

### 提交格式
```bash
git commit -m "feat: 简短描述

详细说明（可选）

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### 推送前检查
- [ ] 代码逻辑自检完成
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

### 快速恢复命令
```bash
# 核心文档
cat claude-code-guide.md

# 文件操作场景
cat claude-code-guide.md docs/automation_standards.md

# 代码开发场景
cat claude-code-guide.md docs/technical_deep_dive.md docs/knowledge_base.md

# 翻译任务
cat claude-code-guide.md .shadowhub/translation-rules.json
```

---

## 📌 项目概览

**项目名称**：ShadowHub - 英语听写与跟读练习平台

**技术栈**：
- 前端：Next.js 15、React 19、TypeScript
- 后端：Supabase (PostgreSQL)
- 存储：Cloudflare R2
- 部署：Vercel + Cloudflare Workers

**核心功能**：
- 听写模式 (Dictation)
- 跟读模式 (Shadowing)
- 单词练习模式
- YouTube 素材集成

---

**版本**：V19.9
**更新日期**：2026-03-18
**状态**：生产就绪
