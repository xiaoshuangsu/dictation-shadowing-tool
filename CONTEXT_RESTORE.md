# Claude Code 上下文恢复指南

> 当对话终止时，使用以下命令快速恢复上下文

---

## 🚀 快速恢复命令

### 方式一：核心文档恢复（推荐）

```bash
cat docs/dictionary_and_translation_implementation_v27.md
```

### 方式二：项目指南恢复

```bash
cat claude-code-guide.md
```

### 方式三：完整上下文恢复（点词翻译+生词本）

```bash
cat claude-code-guide.md docs/dictionary_and_translation_implementation_v27.md
```

---

## 📋 当前项目状态（V27.0.5）

### 基本信息
- **项目名称**: ShadowHub
- **当前版本**: V27.0.5
- **技术栈**: Next.js 14 + React 19 + TypeScript + Supabase + Cloudflare R2
- **部署**: GitHub Pages + Cloudflare Workers

### 最新功能（V27）
1. **生词采集与复习闭环**
   - Tooltip 中保存生词（含音频时间戳）
   - 生词本页面展示例句+播放图标
   - 跳转到练习页并自动播放

2. **Tooltip 优化**
   - 自动联动全局语言设置
   - 移除语言切换标签
   - 精简 UI 布局
   - 美音/英音发音按钮
   - 预加载音频确保秒播

3. **优雅跳转体验**
   - URL 自动清理（移除 ?t= 参数）
   - 目标句子 3 秒高亮闪烁动画
   - 使用 router.replace 避免页面刷新

4. **导航栏优化**
   - 添加 Vocabulary 入口

---

## 🗂️ 核心文档索引

| 文档 | 路径 | 用途 |
|------|------|------|
| **项目指南** | `claude-code-guide.md` | 项目架构、账号配置、Git 规范 |
| **点词翻译与生词本** | `docs/dictionary_and_translation_implementation_v27.md` | V27 最新功能实现 |
| **自动化规范** | `docs/automation_standards.md` | 文件操作、批量导入 |
| **技术架构** | `docs/technical_deep_dive.md` | 代码开发、Bug 修复 |
| **词典缓存优化** | `docs/dictionary_cache_guide.md` | 缓存架构、成本优化 |

---

## 🔧 常用开发命令

### 构建与部署
```bash
npm run build          # 本地构建
npm run dev            # 启动开发服务器
git add . && git commit -m "feat: xxx" && git push
```

### 数据库操作
```bash
# 连接 Supabase
psql "$DATABASE_URL"

# 执行迁移
# 在 Supabase Dashboard 的 SQL Editor 中执行
```

### 预生成脚本（7,139 个单词）
```bash
source scripts/.venv/bin/activate
python scripts/prepopulate_dictionary_cache.py --yes
```

---

## 📊 当前版本功能清单

### 点词翻译
- ✅ 点击单词查看释义
- ✅ 自动联动全局语言
- ✅ 美音/英音发音
- ✅ 预加载音频
- ✅ 一键加入生词本

### 生词本管理
- ✅ 生词列表展示
- ✅ 例句显示
- ✅ 播放图标跳转
- ✅ 多语言联动
- ✅ 掌握状态管理

### 用户体验
- ✅ 优雅 URL 处理
- ✅ 视觉聚焦动画
- ✅ 导航栏快速入口
- ✅ 移动端适配

---

## ⚠️ 待执行的数据库迁移

如果遇到以下字段不存在的问题，请执行对应迁移：

### V27.0.2 - user_words 表添加音频字段
```sql
-- supabase/migrations/add_audio_fields_to_user_words.sql
ALTER TABLE public.user_words
ADD COLUMN IF NOT EXISTS audio_timestamp DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS audio_url TEXT;
```

### V27.0.5 - dictionary_cache 表添加音频字段
```sql
-- supabase/migrations/add_audio_fields_to_dictionary_cache.sql
ALTER TABLE public.dictionary_cache
ADD COLUMN IF NOT EXISTS audio_url_us TEXT,
ADD COLUMN IF NOT EXISTS audio_url_uk TEXT;
```

---

## 🎯 下一步计划

请根据需要选择：

1. **继续功能开发** - 告诉我需要实现什么功能
2. **Bug 修复** - 描述遇到的问题
3. **性能优化** - 说明需要优化的部分
4. **文档更新** - 指定需要更新的文档

---

## 📞 快速问题诊断

### 常见问题

**Q: 生词本跳转 URL 是中文？**
A: 确保执行了 V27.0.2 迁移，代码已使用 `categoryToSlug()` 转换

**Q: Tooltip 不切换语言？**
A: 检查是否在正确的组件中，只有 WordTooltip 和 /vocabulary 支持自动联动

**Q: 发音按钮不播放？**
A: 检查浏览器控制台是否有 CORS 错误，dictionaryapi.dev 可能有跨域限制

**Q: 预生成脚本慢？**
A: 正常，7,139 个单词预计 3-4 小时，使用 `--yes` 参数自动确认

---

**文档版本**: V27.0.5
**更新日期**: 2026-03-22
**维护者**: Claude Sonnet 4.5
