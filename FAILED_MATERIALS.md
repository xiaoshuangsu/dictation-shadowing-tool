# 翻译失败素材清单

**生成日期**: 2026-03-18
**脚本版本**: V20.3
**总素材数**: 201
**成功**: 183 (91.0%)
**失败**: 18 (9.0%)

---

## ❌ 对齐失败 (17个)

这些素材在翻译过程中，GLM-4 模型返回的行数与原文不匹配，经过 2 次重试后仍失败。

| # | 素材名称 | 分类 | 难度 | 句数 | 失败详情 |
|---|---------|------|------|------|---------|
| 1 | The Lion And The Mouse | 故事 | A2 | 80 | 批次 7、9 返回 7/8 |
| 2 | What lack of sleep does to the teenage brain | TED演讲 | B1 | 70 | 批次 3 返回 1/8、6/8 |
| 3 | The Bear and the Bee | 故事 | A2 | 58 | 批次 6 返回 6/8 |
| 4 | The Crane of Gratitude | 故事 | A2 | 29 | 对齐失败 |
| 5 | Cam 12 Academic Listening Test 2 Part 1 | IELTS | B1 | 55 | 对齐失败 |
| 6 | Do you really need to take 10,000 steps a day? | TED演讲 | B1 | 45 | 对齐失败 |
| 7 | Jessica's First Day of School | 日常生活 | A1 | 33 | 对齐失败 |
| 8 | The Wind and the Sun | 故事 | A2 | 28 | 对齐失败 |
| 9 | What happens to your brain without any social contact? | TED演讲 | A2 | 43 | 对齐失败 |
| 10 | The Fox and the Crow | 故事 | A2 | 36 | 对齐失败 |
| 11 | The Frightened Lion | 故事 | A2 | 50 | 对齐失败 |
| 12 | Cam 11 Academic Listening Test 3 Part 3 | IELTS | C1 | 61 | 对齐失败 |
| 13 | Cam 11 Academic Listening Test 1 Part 2 | IELTS | B2 | 39 | 对齐失败 |
| 14 | The Goose That Laid Golden Eggs | 故事 | A2 | 57 | 对齐失败 |
| 15 | Cam 10 Academic Listening Test 4 Part 1 | IELTS | B1 | 56 | 对齐失败 |
| 16 | The Goose That Laid The Golden Egg | 故事 | A2 | 30 | 对齐失败 |
| 17 | Empty Your Mind - A Powerful Motivational Story | 心灵故事 | A1 | 86 | 对齐失败 |
| 18 | The Cunning Fox And The Clever Stork | 故事 | A2 | 147 | 对齐失败 |

---

## ⚠️ 数据库错误 (1个)

| # | 素材名称 | 分类 | 难度 | 句数 | 错误详情 |
|---|---------|------|------|------|---------|
| 1 | Cam 10 Academic Listening Test 4 Part 1 | IELTS | B1 | 62 | Connection reset by peer |

---

## 🔧 处理建议

### 对齐失败素材
**可能原因**:
- 原文包含特殊字符或格式问题
- 某些句子触发了 GLM-4 的合并逻辑
- 批次大小（8句）对某些素材不适用

**建议方案**:
1. ✅ **优先方案**: 减小批次大小到 4 句，重新翻译
2. ✅ **备选方案**: 使用不同的温度参数（0.3 或 0.4）
3. ✅ **人工干预**: 导出原文，手动检查并修复格式问题
4. ✅ **备用模型**: 考虑使用 GPT-4 或 Claude API 处理

### 数据库错误素材
**可能原因**: 网络连接中断
**建议方案**: 重新翻译即可

---

## 📋 下一步行动

- [ ] 检查失败素材的原文格式
- [ ] 修改脚本，将批次大小从 8 改为 4
- [ ] 重新翻译这 18 个失败素材
- [ ] 抽查 10-20 个成功素材的翻译质量
- [ ] 验证冰球术语和状语前置规则的应用效果

---

**生成工具**: `retranslate_with_glm_v20.py` (V20.3)
**应用规则**:
- 冰球体育术语保护 (Body check → 身体冲撞)
- 中式语序优化 (状语前置 - 只适用于动作状语)
