# 自动修复句子分句问题

## 问题
某些素材的句子被错误地分割，例如：
- 标题："Canada Provinces and Territories"
- 原本应该是一句："Canada is one of the largest countries in the world"
- 但被错误分成两句，导致 "world" 出现在下一句

## 解决方案

### ✅ 自动修复（已实现）

我已经在代码中添加了自动修复逻辑，无需手动修改数据库：

**修复逻辑**：
- 自动检测以小写字母开头的句子
- 自动将其合并到上一句
- 自动调整结束时间

**修复位置**：
- `/Users/a/dictation/src/lib/utils/materialLookup.ts` - `fixTranscriptSentences()` 函数
- `/Users/a/dictation/src/app/topics/dictation/[slug]/DictationPracticeClient.tsx` - 应用自动修复
- `/Users/a/dictation/src/app/topics/shadowing/[slug]/ShadowingPracticeClient.tsx` - 应用自动修复

**生效范围**：
- ✅ 所有通过 `/topics/dictation/{slug}` 访问的页面
- ✅ 所有通过 `/topics/shadowing/{slug}` 访问的页面

### 📝 验证修复

请刷新浏览器并访问：
1. http://localhost:3002/topics/shadowing/canada-provinces-and-territories
2. 检查句子是否正确合并

## 为什么这样修复？

1. **不需要修改数据库** - 在代码层面自动修复，零风险
2. **即时生效** - 刷新页面即可看到修复效果
3. **适用所有素材** - 自动检测并修复所有类似问题
4. **向后兼容** - 不影响现有功能

## 技术原理

当一个句子的文本以小写字母开头时（如 "world"），这通常表示它是被错误分割的。修复函数会：

1. 检测当前句子的第一个字符是否为小写
2. 如果是，则将当前句子的文本附加到上一句
3. 合并结束时间，确保音频播放连续

## 其他方案（备选）

如果自动修复不够用，还有批量修复脚本：

### 方法 1：使用 Supabase Dashboard
1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入 Table Editor → `materials` 表
3. 找到问题素材，编辑 `transcript` 字段
4. 调整句子的 `end_time` 或合并句子

### 方法 2：运行批量修复脚本
```bash
cd /Users/a/dictation
node scripts/fix-sentence-timings.js
```

脚本位置：`/Users/a/dictation/scripts/fix-sentence-timings.js`

此脚本会：
- 扫描所有素材的 transcript
- 自动检测并修复句子分句问题
- 更新数据库

---

**现在请刷新浏览器测试修复效果！**
