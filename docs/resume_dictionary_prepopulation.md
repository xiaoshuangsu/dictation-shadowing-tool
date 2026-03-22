# 🔄 方案C 恢复口令：全量预生成 7,139 个单词

**状态**: 准备就绪，等待执行
**最后更新**: 2026-03-21

---

## 📋 当前进度

✅ **已完成**：
- 数据库表 `dictionary_cache` 已创建
- 多语言架构已测试通过（Top 10 单词）
- 预生成脚本已就绪：`scripts/test_multilingual_cache.py`

⏳ **待执行**：
- 运行全量预生成脚本（7,139 个单词）
- 预计耗时：约 4 小时
- 预计费用：约 ¥14

---

## 🚀 快速恢复命令

### 第一步：读取核心文档

```bash
cat claude-code-guide.md docs/dictionary_and_translation_implementation.md docs/dictionary_cache_guide.md
```

### 第二步：检查环境变量

```bash
# 确保 .env.local 中已设置 GLM_API_KEY
grep GLM_API_KEY .env.local
```

### 第三步：检查数据库表

访问 Supabase Dashboard SQL Editor：
```
https://supabase.com/dashboard/project/cuxotlijjnxbsirpdkgr/sql/new
```

执行：
```sql
SELECT COUNT(*) as total_words FROM dictionary_cache;
```

### 第四步：执行全量预生成

```bash
# 激活虚拟环境并运行脚本
source scripts/.venv/bin/activate
python scripts/prepopulate_dictionary_cache.py --yes
```

**预计输出**：
```
📖 正在提取所有素材的单词...
✅ 提取完成！共找到 7139 个唯一单词
📝 需要预生成 7139 个单词
⚠️  预计需要调用 GLM API 7139 次
⚠️  预计耗时：238.0 分钟
✅ 自动确认模式，开始执行...
```

---

## 📊 关键信息

**脚本位置**: `scripts/prepopulate_dictionary_cache.py`
**单词总数**: 7,139
**支持语言**: zh-CN（简中）, zh-Hant（繁中）, vi（越南语）
**API 模型**: GLM-4-Flash
**费用**: 约 ¥14

---

## ⚠️ 注意事项

1. **长时间运行**：确保电脑不休眠，网络稳定
2. **API 配额**：确认 GLM API 余额充足
3. **断点续传**：脚本支持断点续传，中断后重新运行会自动跳过已缓存的单词
4. **监控方法**：在 Supabase Dashboard 查询缓存数量增长

**监控查询**：
```sql
SELECT COUNT(*) FROM dictionary_cache;
```

---

## 🔧 如果遇到问题

### 脚本执行失败
```bash
# 检查 Python 环境
source scripts/.venv/bin/activate
python --version  # 应该是 Python 3.9+

# 检查依赖
pip list | grep -E "(supabase|requests)"
```

### API 调用失败
- 检查 `GLM_API_KEY` 是否正确
- 确认网络可以访问 `https://open.bigmodel.cn`

### 构建失败
```bash
npm run build
```

---

## 📚 相关文档

- **实现总结**: `docs/dictionary_and_translation_implementation.md`
- **优化指南**: `docs/dictionary_cache_guide.md`
- **测试脚本**: `scripts/test_multilingual_cache.py`

---

## 🎯 完成标准

✅ 缓存单词数 ≥ 7,000
✅ Top 100 高频词命中率 ≈ 100%
✅ 平均每个单词有 3 种语言释义

**验证命令**：
```sql
-- 查看缓存统计
SELECT * FROM dictionary_stats;

-- 查看热门词汇
SELECT word, hit_count
FROM dictionary_cache
ORDER BY hit_count DESC
LIMIT 20;
```

---

**版本**: V25.0.0
**状态**: ✅ 准备就绪，等待执行
