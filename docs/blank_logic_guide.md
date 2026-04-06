# 挖空逻辑规范指南

**版本**：v6.2
**更新日期**：2026-04-06
**适用场景**：雅思素材挖空、批量素材处理、索引转换

---

## 📋 脚本概览

| 脚本名称 | 版本 | 路径 | 功能描述 |
|---------|------|------|----------|
| **主挖空脚本** | v6.2 | `scripts/reprocess_ietts_blanks.py` | 雅思素材挖空重处理，支持索引转换和自动修正 |
| **CAM 13/14 批量** | v1.0 | `scripts/reprocess_cam13_14_only.py` | 批量处理 CAM 13/14 系列素材（32个） |

---

## 🚀 快速开始

### 单个素材重处理

```bash
python3 scripts/reprocess_ietts_blanks.py
```

### 批量处理 CAM 13/14

```bash
python3 scripts/reprocess_cam13_14_only.py
```

---

## 🔄 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v6.2 | 2026-03-28 | 新增索引转换逻辑（自动修正 GLM 返回的错误 index） |
| v6.1 | 2026-03-28 | 优化索引验证逻辑 |
| v6.0 | 2026-03-26 | 新增黑名单（情态助动词、疑问代词、低级认知词） |
| v5.2 | 2026-03-26 | 长单词提权、音节复杂度加成、月份提权 |
| v5.1 | 2026-03-26 | 修复 W6 占比过高 |
| v5.0 | 2026-03-26 | 语言习得导向重构，权重系统 |

---

## 🎯 挖空逻辑 v6.2

### 权重系统

| 权重 | 类型 | 示例 |
|------|------|------|
| W10 | 核心词汇 | goatherd, observe, cultivation |
| W9 | 重要事实词 | 850 CE, Kaldi, coffee |
| W6 | 普通词汇 | day, one, see, go |
| W0 | 黑名单 | will, can, what, this |

### 黑名单规则

- **情态助动词**：will, would, can, could, may, might
- **疑问代词**：what, which, who, whom, whose
- **低级认知词**：this, that, these, those, there
- **填充语**：well, so, like, you know

### 提权规则

- **长单词提权**：7+ 字母 → +1 权重
- **音节复杂度**：3+ 音节 → +1 权重
- **月份提权**：January, February... → W9
- **固定搭配识别**：coffee bean → coffee 提权

---

## 🔧 索引转换逻辑

### v6.1 关键修复

**问题**：GLM 返回的 `blanks.index` 可能与实际位置不匹配

**解决方案**：
1. **验证 word 是否与 index 位置的词匹配**
2. **自动修正**：GLM 返回错误 index 时，在句子中查找实际位置
3. **空格分词索引 → 正则分词索引的转换逻辑**（前端）

### 分词规范

**挖空脚本**使用**空格分词**：
```python
# 数据库中的 blanks.index 基于空格分词
tokens = text.split(' ')
```

**前端 WordMode** 使用**双重分词**：
```typescript
// 空格分词：用于匹配 blanks.index
const spaceTokens = text.split(' ');

// 正则分词：用于渲染原文（保留标点）
const renderTokens = text.match(/([a-zA-Z0-9'\u2019-]+|[.,!?;:]+|\s+)/g);
```

---

## 📝 正则表达式规范

### 支持两种撇号

- **ASCII 撇号**（U+0027）：`'`
- **弯撇号/智能引号**（U+2019）：`'\u2019`

### 正则表达式

```javascript
/([a-zA-Z0-9'\u2019-]+|[.,!?;:]+|\s+)/g
```

**说明**：
- `[a-zA-Z0-9'\u2019-]+`：匹配单词（支持两种撇号和连字符）
- `[.,!?;:]+`：匹配标点符号
- `\s+`：匹配空白字符

---

## ⚠️ 关键原则

### ❌ 禁止

- 直接用 `blanks.index` 索引正则分词结果（会错位）

### ✅ 正确

1. 先用空格分词验证
2. 再转换为正则分词索引
3. 向后兼容：数据库 `blanks` 数据无需修改，前端自动适配

---

## 🔍 索引转换示例

### 原始句子

```
One day, a goatherd named Kaldi observed that coffee beans had...
```

### 空格分词（用于匹配 blanks.index）

```python
[
  "One",     # 0
  "day,",    # 1
  "a",       # 2
  "goatherd", # 3  ← blanks.index = 3
  "named",   # 4
  "Kaldi",   # 5
  "observed", # 6
  "that",    # 7
  ...
]
```

### 正则分词（用于渲染）

```javascript
[
  "One",      # 0
  " ",        # 1
  "day",      # 2
  ",",        # 3
  " ",        # 4
  "a",        # 5
  " ",        # 6
  "goatherd", # 7  ← 转换后的索引
  " ",        # 8
  "named",    # 9
  ...
]
```

---

## 🛠️ 常见问题

### 1. 撇号丢失

**问题**：单词中的撇号被过滤掉

**解决方案**：
- 确保正则表达式支持两种撇号（U+0027 和 U+2019）
- 检查数据库中的原始文本

### 2. 索引错位

**问题**：挖空的位置不正确

**解决方案**：
- 验证 `blanks.index` 是否基于空格分词
- 检查前端索引转换逻辑

### 3. 黑名单失效

**问题**：will, can 等词被挖空

**解决方案**：
- 检查黑名单配置
- 验证权重系统是否正确应用

---

## 📊 数据格式

### Blanks 数据结构

```json
{
  "word": "goatherd",
  "index": 3,
  "weight": 10
}
```

### Sentence 数据结构

```json
{
  "id": 1,
  "text": "One day, a goatherd named Kaldi observed that...",
  "startTime": 6.79,
  "endTime": 16.43,
  "blanks": [
    {
      "word": "goatherd",
      "index": 3,
      "weight": 10
    },
    {
      "word": "observed",
      "index": 6,
      "weight": 10
    }
  ]
}
```

---

## 📖 相关文档

- **经验库**：`docs/knowledge_base.md`
- **自动化规范**：`docs/automation_standards.md`
- **主指南**：`claude-code-guide.md`

---

## 🔗 快速恢复口令

> "请先阅读 `claude-code-guide.md`，挖空逻辑已更新到 v6.2：
> - 索引转换逻辑：验证 word 是否与 index 位置的词匹配
> - 自动修正：GLM 返回错误 index 时，在句子中查找实际位置
> - 双重分词：空格分词匹配 blanks.index，正则分词渲染原文
> - 正则表达式支持 ASCII 撇号（U+0027）和弯撇号（U+2019）"
