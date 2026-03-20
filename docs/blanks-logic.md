# 单词挖空系统设计文档

## 概述

单词挖空是一个智能的听写辅助系统，通过在每个句子中挖空一个关键词，帮助用户专注于核心词汇的听写和记忆。系统采用**后端智能计算 + 前端优先读取**的架构设计。

---

## 后端挖空逻辑 (`scripts/improve_blanks.py`)

### 1. 核心词表构建

**词表来源**：Oxford 3000 核心词汇
- **规模**：约 1,200+ 常用词
- **分类**：
  - 动词（500）：miss, get, take, stay, believe, think...
  - 名词（800）：day, sky, weather, culture, park, water...
  - 形容词（500）：happy, beautiful, rainy, cloudy, important...
  - 副词（200）：very, really, quite, often...

**词形归一化**：
```python
clouds  → cloud   # 去除复数 -s
cities  → city    # -ies → -y
boxes   → box     # 去除复数 -es
```

### 2. 排除规则

#### 停用词列表（STOP_WORDS）
```python
# 冠词、代词
a, an, the, i, you, he, she, it, we, they, my, your, his...

# 介词、连词
in, on, at, to, for, of, with, by, and, but, or...

# 助动词
is, am, are, was, were, be, have, has, had, do, does, did...

# 副词和程度词
very, really, quite, rather, too, also, just, only...
```

#### 礼貌套话（EXCLUDE_PHRASES）
```python
thank, thanks, hello, hi, hey, sorry, excuse, forgive,
pardon, bye, goodbye, bless, cheers, greetings...
```

### 3. 短句特殊处理

**短句定义**：3-5 个单词

**处理规则**：
```python
if 3 <= word_count <= 5:
    # 严禁挖空无意义词汇
    if word not in content_words:
        continue

    # 必须挖空核心实词
    if not is_core and pos != 'NN':
        continue
```

**示例**：
- "A rainy day." → 挖空 **day** ✓（核心名词）
- "Jane asked." → 挖空 **asked** ✓（核心动词）
- ❌ "The clouds were very Gray." → 不挖空 were（助动词）

### 4. 优先级算法

**词性优先级**：
```
动词 (VB) > 名词 (NN) > 形容词 (JJ) > 副词 (RB)
```

**得分计算**：
```python
score = 0

# 核心词汇加分
if is_core:
    score += 50

# 实词加分
if pos in ['NN', 'VB', 'JJ']:
    score += 30

# 词性加分
if pos == 'VB':  score += 20
elif pos == 'NN': score += 15
elif pos == 'JJ': score += 10

# 短句核心词加分
if is_short_sentence and is_core:
    score += 30

# 单词长度加分
if 3 <= len(word) <= 10:
    score += 5

# 添加随机性（避免总是选择同一个词）
score += random(0, 5)
```

**示例对比**：

| 句子 | 候选词 | 词性 | 核心词 | 得分 | 选择 |
|------|--------|------|--------|------|------|
| The clouds were very Gray. | clouds | NN | ✓ | 95 | ✅ |
| | Gray | NNP | ✗ | 40 | |
| Jane wanted to take pictures. | wanted | VBD | ✓ | 100 | ✅ |
| | take | VB | ✓ | 100 | ✅ |
| | pictures | NNS | ✓ | 95 | |

### 5. 数据格式

**每个句子的 blanks 字段**：
```json
{
  "word": "clouds",
  "index": 1,
  "pos": "NNS",
  "is_core": true
}
```

**字段说明**：
- `word`: 被挖空的单词（原始形式，包含大小写和标点）
- `index`: 单词在 NLTK tokenize 结果中的位置
- `pos`: 词性标注（Penn Treebank 格式）
- `is_core`: 是否为核心词汇

---

## 前端挖空逻辑 (`src/components/WordMode.tsx`)

### 1. 优先级策略

```
sentence.blanks (后端智能挖空)
         ↓
    有效且存在？
         ↓
    是 → 使用 blanks
         ↓
    否 → 随机算法（sentence.id % length）
```

### 2. 代码实现

```typescript
const { hiddenWordIndex, hiddenWord, visibleWordsBefore, visibleWordsAfter } = useMemo(() => {
  // 1. 优先使用 sentence.blanks
  if (sentence.blanks && sentence.blanks.length > 0) {
    const blank = sentence.blanks[0]
    const blankWord = blank.word

    // 在 sentenceWords 中找到匹配的词
    let foundIndex = sentenceWords.findIndex(w => w === blankWord)

    // 大小写不敏感匹配
    if (foundIndex === -1) {
      foundIndex = sentenceWords.findIndex(w =>
        w.toLowerCase() === blankWord.toLowerCase()
      )
    }

    if (foundIndex >= 0) {
      return {
        hiddenWordIndex: foundIndex,
        hiddenWord: sentenceWords[foundIndex],
        visibleWordsBefore: sentenceWords.slice(0, foundIndex),
        visibleWordsAfter: sentenceWords.slice(foundIndex + 1)
      }
    }
  }

  // 2. 回退到随机算法
  const seed = sentence.id || 1
  const randomIndex = seed % sentenceWords.length
  return { /* ... */ }
}, [sentence.id, sentenceWords, sentence.blanks])
```

### 3. 匹配策略

**匹配优先级**：
1. 精确匹配：`clouds === "clouds"`
2. 忽略大小写：`"Clouds".toLowerCase() === "clouds"`

**示例**：

| blanks.word | 句子中的词 | 匹配结果 |
|-------------|------------|----------|
| clouds | clouds | ✅ 精确匹配 |
| Clouds | clouds | ✅ 忽略大小写 |
| clouds | cloud | ❌ 不匹配 |

---

## 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        后端挖空流程                          │
├─────────────────────────────────────────────────────────────┤
│  1. 加载核心词表 (Oxford 3000, ~1200词)                      │
│  2. 遍历所有素材的 transcript                                │
│  3. 对每个句子：                                             │
│     - NLTK 分词 + 词性标注                                   │
│     - 过滤停用词、礼貌套话                                   │
│     - 应用短句特殊规则                                       │
│     - 计算每个候选词的得分                                   │
│     - 选择得分最高的词                                       │
│  4. 更新数据库 (sentence.blanks 字段)                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
                        Supabase DB
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        前端挖空流程                          │
├─────────────────────────────────────────────────────────────┤
│  1. 读取 sentence.blanks 字段                               │
│  2. 如果存在且有效：                                         │
│     - 在 sentenceWords 中找到匹配的词                        │
│     - 使用该词作为挖空目标                                   │
│  3. 如果不存在或无效：                                       │
│     - 使用随机算法 (sentence.id % length)                    │
│  4. 渲染挖空后的文本                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 使用说明

### 更新所有素材的挖空数据

```bash
# 全量更新（谨慎使用）
python3 scripts/improve_blanks.py

# 单个素材测试
python3 scripts/improve_blanks.py --test-slug a-rainy-day

# 单个素材更新
python3 scripts/improve_blanks.py --update-slug a-rainy-day
```

### 环境要求

```bash
pip3 install nltk supabase python-dotenv --break-system-packages
```

### 环境变量

```bash
# .env.local
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # 需要写入权限
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
```

---

## 设计决策

### 为什么前端不直接计算挖空？

1. **性能**：后端预先计算，前端无需复杂的 NLP 处理
2. **一致性**：所有用户看到相同的挖空结果
3. **可维护性**：算法集中在后端，便于优化和调试
4. **回退机制**：前端保留随机算法，确保向后兼容

### 为什么每句只挖空 1 个词？

1. **降低难度**：避免用户挫败感
2. **聚焦核心**：每次专注一个重要词汇
3. **渐进学习**：逐词积累，建立信心

### 为什么需要词形归一化？

```python
# 问题：词表中有 "cloud"，但句子中是 "clouds"
# 解决：clouds → cloud
```

这样可以让复数形式也能匹配核心词表，扩大覆盖范围。

---

## 未来优化方向

### 1. 动态难度调整

根据用户水平调整挖空策略：
- 初级：只挖核心高频词
- 中级：挖空中等难度词
- 高级：挖空复杂词汇

### 2. 上下文感知

考虑句子语境：
- "I **miss** you." → 挖空情绪词
- "The **sky** is blue." → 挖空名词

### 3. 用户反馈循环

记录用户错误率，优化挖空选择：
- 高错误率的词 → 挖空频率增加
- 低错误率的词 → 减少挖空

### 4. 多词挖空模式

高级用户可选多词挖空：
- 简单句：挖空 2-3 个词
- 复杂句：挖空 1-2 个词

---

## 附录：词性标注对照表

| Tag | 词性 | 示例 |
|-----|------|------|
| NN | 名词（单数） | cloud, sky |
| NNS | 名词（复数） | clouds, skies |
| NNP | 专有名词 | Jane, Bill |
| VB | 动词（原形） | get, take |
| VBD | 动词（过去式） | got, took |
| VBG | 动词（现在分词） | getting, taking |
| VBN | 动词（过去分词） | got, taken |
| VBP | 动词（非第三人称单数） | get |
| VBZ | 动词（第三人称单数） | gets |
| JJ | 形容词 | happy, rainy |
| RB | 副词 | very, really |
| IN | 介词 | in, on, at |

---

## 相关文件

- **后端脚本**：`scripts/improve_blanks.py`
- **前端组件**：`src/components/WordMode.tsx`
- **类型定义**：`src/types/index.ts`
- **数据模型**：Supabase `materials.transcript`

---

**最后更新**：2026-03-19
**维护者**：Claude
**版本**：v1.0.0
