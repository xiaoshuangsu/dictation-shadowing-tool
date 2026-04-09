# Mastery Mode 实现进度总结

## 📅 更新时间
2026-04-09

## ✅ 已完成的功能

### 1. 自动入库（Upsert 逻辑）
- **文件**: `src/app/api/user-words/route.ts`
- **功能**: 从任意词库练习时自动添加单词到 `user_words` 表
- **实现**: PATCH API 实现 Upsert 逻辑
  - 先根据单词名称查找
  - 存在则更新
  - 不存在则创建

### 2. 彻底掌握模式统计
- **文件**: `src/app/api/user-words/stats/route.ts`
- **功能**: 只有 `familiar`/`mastered` 才计入复习进度
- **实现**:
  - 删除了 `updatedAt` 的日期限制
  - `Still Learning` 状态的单词仍计入 `Due Today`

### 3. 前端乐观更新（条件计数）
- **文件**: `src/app/vocabulary/VocabularyHubContent.tsx`
- **功能**: 点击后立即更新首页数字
- **实现**:
  - 只有 `familiar`/`mastered` 才 +1
  - `learning` 不计数
  - 1500ms 延迟刷新
  - "Syncing..." 蓝色脉冲动画

### 4. 进度条修正
- **文件**: `src/app/vocabulary/VocabularyHubContent.tsx`
- **修复**: 进度条显示改为 `reviewed / dailyGoal`
- **效果**: 不会再出现 164% 的异常

### 5. 单词索引修复
- **文件**: `src/components/ReviewOverlay.tsx`
- **修复**: 点击第 N 个词，弹窗显示第 N 个词
- **实现**: `currentIndex` 强制初始化为 0

### 6. 数据库迁移
- **文件**: `supabase/migrations/20260409_alter_user_words_nullable.sql`
- **内容**: 将 `definition` 字段改为 nullable

---

## ⏳ 待执行的操作

### 1. 执行数据库迁移（必须！）
在 Supabase Dashboard SQL Editor 中运行：
```sql
ALTER TABLE user_words ALTER COLUMN definition DROP NOT NULL;
```

### 2. 测试流程
1. 刷新浏览器
2. 去 Oxford 3000 页面
3. 点击单词 'art'
4. 选择 "Still Learning"
5. 返回首页
6. 观察 "Today's Review" 从 0 变成 1

---

## 🎯 预期行为

| 操作 | Today's Review | Reviewed | Due Today |
|------|----------------|----------|-----------|
| Oxford 练习（Still Learning） | **+1** | **不变** | **+1** |
| 点击 "Kinda Know" | **不变** | **+1** | **-1** |
| 点击 "Too Easy" | **不变** | **+1** | **-1** |

---

## 📂 修改的文件列表

1. `src/app/api/user-words/route.ts` - Upsert 逻辑
2. `src/app/api/user-words/stats/route.ts` - 统计修正
3. `src/components/ReviewOverlay.tsx` - 索引修复 + 条件回调
4. `src/app/vocabulary/VocabularyHubContent.tsx` - 条件乐观更新
5. `supabase/migrations/20260409_alter_user_words_nullable.sql` - 数据库迁移

---

## 📝 下一步计划

1. 执行数据库迁移
2. 测试完整流程
3. 提交代码到远程仓库
4. 观察 Vercel 自动部署

---

## 🔗 快速恢复命令

```bash
# 查看最新提交
git log -1 --stat

# 查看修改内容
git diff HEAD~1

# 撤销最后一次提交（如果需要）
git reset --soft HEAD~1
```
