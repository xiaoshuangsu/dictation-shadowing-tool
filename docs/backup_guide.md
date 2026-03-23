# 数据库备份指南

> 本文档说明如何备份和恢复 Supabase 数据库中的重要数据。

---

## 📋 目录

1. [自动备份（Supabase）](#1-自动备份supabase)
2. [手动备份（本地）](#2-手动备份本地)
3. [备份最佳实践](#3-备份最佳实践)

---

## 1. 自动备份（Supabase）

### Supabase 内置备份

Supabase 提供**自动备份**功能：

- **备份频率**：每天自动备份
- **保留时间**：根据计划不同，通常保留 7-30 天
- **恢复方式**：在 Dashboard 一键恢复

### 查看备份

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目 → **Database** → **Backups**
3. 查看备份历史和恢复点

---

## 2. 手动备份（本地）

### 备份命令

**备份 dictionary_cache 表**：
```bash
npm run backup:dictionary
```

**备份 user_words 表**：
```bash
npm run backup:user-words
```

**备份其他表**：
```bash
node scripts/backup_dictionary_cache.js backup [table_name]
```

### 恢复命令

⚠️ **恢复操作会清空目标表，请谨慎操作！**

```bash
node scripts/backup_dictionary_cache.js restore [table_name] [backup_file.json]
```

**示例**：
```bash
# 恢复 dictionary_cache 表
node scripts/backup_dictionary_cache.js restore dictionary_cache dictionary_cache_2026-03-22.json
```

---

## 3. 备份最佳实践

### 何时需要备份

✅ **建议备份的时机**：
- 执行批量更新前（如上传单词音频、更新翻译）
- 修改数据库结构前
- 定期备份（如每周一次）
- 重要功能上线前

❌ **不需要备份的情况**：
- 日常开发（使用自动备份即可）
- 只读操作（查询、统计）

### 备份文件管理

- **存储位置**：`/backups/` 目录
- **文件命名**：`{table_name}_{YYYY-MM-DD}.json`
- **Git 管理**：备份目录已添加到 `.gitignore`，不会提交到仓库

### 备份文件大小参考

| 表名 | 预估大小 |
|------|---------|
| `dictionary_cache` | ~50-100 MB |
| `user_words` | < 1 MB |
| `materials` | ~10-20 MB |

---

## 🔒 安全建议

1. **定期备份**：建议每周备份一次重要表
2. **异地备份**：将备份文件同步到云存储（如 Google Drive）
3. **保留策略**：保留最近 3-5 个备份文件
4. **权限控制**：备份脚本使用 SERVICE_ROLE_KEY，请勿泄露

---

## 📚 相关文档

- [Supabase 备份文档](https://supabase.com/docs/guides/platform/backups)
- [数据库迁移指南](../supabase/migrations/README.md)

---

**版本**：V27.7.0
**更新日期**：2026-03-22
