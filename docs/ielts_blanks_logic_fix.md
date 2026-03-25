# 雅思素材挖空逻辑 - 完整规则总结

> **版本**: v3.0 (2026-03-25)
> **状态**: 生产就绪
> **脚本**: `scripts/reprocess_ietts_blanks.py`

---

## 🎯 核心目标

创建**高质量的词汇训练内容**，而非简单的填空题。优先挖掘能体现**英语语感、词汇量和表达能力**的单词。

---

## 📋 挖空规则（优先级排序）

### 1️⃣ 语感词汇 (40%) - 最高优先级

**目标**: 选择能展示语言精度的词

**示例**:
- 副词: `rarely`, `particularly`, `instead`, `merely`, `significantly`
- 动词: `cultivated`, `maintain`, `consume`, `illustrate`, `demonstrate`
- 形容词: `essential`, `significant`, `remarkable`, `distinctive`

**原因**: 这些词能体现学习者的词汇量和语感

---

### 2️⃣ 核心词汇多样性 (30%)

**目标**: 选择功能性实词

**类型**:
- 功能性动词
- 描述性形容词
- 学术名词

**原因**: 这些词是英语表达的核心

---

### 3️⃣ 学术名词 (20%)

**目标**: 专业术语和概念词

**示例**: `photosynthesis`, `economy`, `cultivation`, `presentation`

---

### 4️⃣ 逻辑信号词 (10%)

**目标**: 转折、强调、递进词

**示例**: `however`, `moreover`, `consequently`, `although`

---

### 5️⃣ 数字/日期 (0%) - 最低优先级

**限制**: 每个 Part 最多挖空 **2 个**数字

**原因**: 数字太多会降低词汇训练价值

**定义**: 纯数字 (1995, 15th)、日期词汇 (January, Monday)

---

## 🔒 核心黑名单（严禁挖空）

### 代词/引导词
```
he, she, it, they, we, you, I, me, him, her, us, them
that, which, who, this, these, those
my, your, his, hers, its, our, their, ours, theirs
whom, whose
```

### 虚词/连词
```
a, an, the, and, or, but, so, because, if
```

### 简单介词
```
in, on, at, to, of, for, with, by, from, about
```

### 基础动词
```
is, am, are, was, were, be, been, do, does, did, have, has, had
```

### 其他
```
there, here
```

---

## 🛡️ 三大保护机制

### 1. 保底机制

**规则**: 每一句必须至少有一个挖空

**实现**:
- GLM-4 返回多个候选词（2-3个）
- 如果所有候选词都不符合条件，使用本地算法
- 本地算法优先选择：动词 > 副词 > 形容词 > 名词

**效果**: 确保没有空句子

---

### 2. 全局去重

**规则**: 同一单词在**整个 Part** 中最多挖空 **2 次**

**示例**:
- 第1句挖空 `however`
- 第5句可以再挖空 `however`
- 第10句遇到 `however` 时跳过，选择其他词

**效果**: 避免重复词，增加词汇多样性

---

### 3. 数字限制

**规则**: 每个 Part 中数字类挖空不超过 **2 个**

**实现**:
- 检测候选词是否为数字或日期
- 如果是数字，检查数字计数器
- 如果已达上限（2个），跳过该候选词

**效果**: 避免数字过多，确保词汇训练质量

---

## 🤖 GLM-4 Prompt 策略

### 多候选词方案

GLM-4 返回 2-3 个候选词，按优先级排序：

```json
{
  "candidates": [
    {"word": "第一候选词", "index": 位置, "reason": "理由"},
    {"word": "第二候选词", "index": 位置, "reason": "理由"}
  ]
}
```

### 算法流程

1. GLM-4 返回 2-3 个候选词
2. 遍历候选词，应用过滤规则：
   - ✅ 不在黑名单
   - ✅ 未挖空 2 次（全局去重）
   - ✅ 数字未达上限（数字限制）
3. 选择第一个符合条件的候选词
4. 如果所有候选词都不符合，使用本地算法

---

## 📊 效果验证

### Cam 13 Test 4 Part 4（前15句）

**挖空率**: 15/15 (100%)
**数字挖空**: 1/15 (6.7%)
**词汇质量**: ⭐⭐⭐⭐⭐

**挖空的词**:
```
1. presentation (学术名词)
2. drunk (动词)
3. Although (逻辑词)
4. evidence (名词)
5. early (形容词)
6. known (动词)
7. being (动词)
8. next (形容词)
9. particularly (副词) ⭐
10. rarely (副词) ⭐
11. people (名词)
12. share (动词)
13. ruler (名词)
14. Although (逻辑词)
15. 17th (数字) ✓ 唯一的数字
```

---

## 🚀 使用指南

### 重新处理单个素材

```bash
python3 /tmp/reprocess_single_material.py
```

### 重新处理多个素材

```bash
python3 scripts/reprocess_ietts_blanks.py
```

### 验证挖空结果

```python
import os, json
from pathlib import Path
from supabase import create_client

# 加载环境变量
env_path = Path('/Users/a/dictation/.env.local')
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

client = create_client(
    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_ROLE_KEY']
)

# 获取素材
slug = 'cam-13-academic-listening-test-4-part-4'
result = client.table('materials').select('*').eq('slug', slug).execute()
transcript = result.data[0]['transcript']

# 分析前10句
for i, sentence in enumerate(transcript[:10], 1):
    blanks = sentence.get('blanks', [])
    text = sentence.get('text', '')

    if blanks:
        word = blanks[0].get('word', '')
        print(f"{i}. [{word}] -> {text[:50]}...")
    else:
        print(f"{i}. (无挖空) -> {text[:50]}...")
```

---

## 📌 相关文件

- **重新处理脚本**: `scripts/reprocess_ietts_blanks.py`
- **上传脚本**: `scripts/ingest_bulk.py`
- **本文档**: `docs/ielts_blanks_logic_fix.md`

---

## 📝 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| **v3.0** | 2026-03-25 | 保底机制 + 数字限制 + 语感词汇优先 |
| **v2.3** | 2026-03-25 | 方案3：多候选词自动选择 |
| **v2.2** | 2026-03-25 | 全局去重：同一单词最多2次 |
| **v2.1** | 2026-03-25 | 雅思专家级挖空协议 + 黑名单 |

---

**最后更新**: 2026-03-25
**维护者**: Sarah + Claude
