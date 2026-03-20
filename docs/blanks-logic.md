# 单词挖空系统设计文档

## 概述

单词挖空是一个智能的听写辅助系统，通过在每个句子中挖空一个关键词，帮助用户专注于核心词汇的听写和记忆。系统采用**后端智能计算 + 前端优先读取**的架构设计。

### 核心逻辑（v1.2.0）

**处理流程**：
```
素材句子 → NLTK 分词与词性标注 → 过滤排除词 → 计算得分 → 选择最高分词 → 专有名词修复 → 更新数据库
```

**选择优先级**（得分高者优先）：
| 优先级 | 类型 | 示例 | 加分 |
|-------|------|------|------|
| 1 | 核心实词 | miss, day, happy | +50 |
| 2 | 不定代词 | everything, something | +25 |
| 3 | 实义缩写 | o'clock | +20 |
| 4 | 动词 | get, take, believe | +20 |
| 5 | 名词 | sky, weather | +15 |
| 6 | 形容词 | rainy, cloudy | +10 |
| 7 | 数词（保底） | seven, five | +8 |

**排除规则**：
- ❌ 停用词：a, an, the, is, are, was, were...
- ❌ 礼貌套话：thank, hello, sorry...
- ❌ 黑名单缩写：That's, I'm, isn't, don't...
- ❌ 专有名词：Kate, Saturday（由修复脚本处理）

**短句特殊处理**（3-5词）：必须挖空核心实词，禁止挖空助动词。

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
# 复数形式
clouds  → cloud   # 去除复数 -s
cities  → city    # -ies → -y
boxes   → box     # 去除复数 -es

# 动词 -ing 形式（v1.2.2 新增）
crying  → cry     # 去除 -ing
running → run     # 去除 -ing + 双写字母
making  → make    # 去除 -ing + 恢复 e
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

#### ⭐ 白名单：允许挖空的词（新增）

**实义代词（不定代词）**：
```python
# 这些词有实际意义，应该保留挖空价值
everything, something, anything, nothing,
everyone, someone, anyone, noone, nobody,
everybody, somebody, anybody, one, none, all, some, any, most, few
```

**实义缩写词**：
```python
# 有实际意义的缩写，允许挖空
o'clock  # 时间表达
```

#### ⭐ 黑名单：禁止挖空的缩写词（新增）

**代词+系动词组合**：
```python
# 正则匹配：^[A-Za-z]+'s$ (That's, It's)
that's, it's, he's, she's, we're, they're,
that'll, it'll, i'll, you'll, he'll, she'll, we'll, they'll,
that'd, it'd, i'd, you'd, he'd, she'd, we'd, they'd,
this's, these're, those're
```

**代词+助动词组合**：
```python
# 正则匹配：^[A-Za-z]+'m$ (I'm)
i'm, you're, we're, they're
```

**助动词+not缩写**：
```python
# 正则匹配：^[A-Za-z]+n't$ (can't, don't...)
isn't, aren't, wasn't, weren't, don't, doesn't, didn't,
can't, couldn't, shouldn't, wouldn't, won't, mightn't, mustn't,
haven't, hasn't, hadn't
```

**设计理念**：
- ❌ 禁止挖空：语法结构词（That's, I'm, You're）
- ✅ 允许挖空：有实际意义的词（everything, o'clock）

#### 专有名词（PROPER_NOUNS）
```python
# 人名识别（约 200 个常见英文名）
james, john, mary, kate, joe, bill, tom, jane...

# NLTK 词性标注排除
NNP  # 单数专有名词
NNPS # 复数专有名词

# 辅助规则
- 首字母大写且不在句首
- 在常用人名列表中
```

**重要**：专有名词修复逻辑 (`scripts/fix_proper_nouns.py`)

初始挖空可能包含专有名词（人名、地名、星期等），需要后处理修复：

1. **识别专有名词**：
   - NLTK 词性标注为 `NNP` 或 `NNPS`
   - 在常用人名列表中
   - 首字母大写且不在句首

2. **二次重选**：
   - 丢弃当前的专有名词挖空
   - 重新从剩余词中选择：动词 > 普通名词(NN) > 形容词
   - 如果没有合适的词，移除挖空

3. **修复示例**：
   - "Milo cannot have kittens." → **Milo** → **kittens**
   - "The Bright family went camping." → **Bright** → **camping**
   - "On Saturday, they went canoeing." → **Saturday** → **went**

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

### 4. 优先级算法（v1.1 更新）

**词性优先级**：
```
实义动词 (VB) > 名词 (NN) > 形容词 (JJ) > 不定代词 > 数词 (CD) > 缩写实词
```

**得分计算（v1.1）**：
```python
score = 0

# ⭐ 白名单加分：不定代词
if word_clean in MEANINGFUL_PRONOUNS:
    score += 25
    reason.append('meaningful_pronoun')

# ⭐ 白名单加分：实义缩写
if word in MEANINGFUL_CONTRACTIONS:
    score += 20
    reason.append('meaningful_contraction')

# 核心词汇加分
if is_core:
    score += 50

# 实词加分
if pos_category in ['NN', 'VB', 'JJ']:
    score += 30

# 词性加分（动词 > 名词 > 形容词）
if pos_category in ['VB', 'VBP', 'VBZ', 'VBD', 'VBG', 'VBN']:
    score += 20
    reason.append('verb')
elif pos_category in ['NN', 'NNS', 'NNP']:
    score += 15
    reason.append('noun')
elif pos_category in ['JJ', 'JJR', 'JJS']:
    score += 10
    reason.append('adjective')

# 数词加分（保底机制）
if pos_category == 'CD':
    score += 8
    reason.append('number')

# 短句核心词加分
if is_short_sentence:
    score += 30
    reason.append('short_sentence_key_word')

# 单词长度适中
if 3 <= len(word_clean) <= 10:
    score += 5
    reason.append('good_length')

# 添加随机性
score += random.uniform(0, 5)
```

**优先级示例对比**：

| 句子 | 挖空词 | 原因 | 优先级 |
|------|--------|------|--------|
| She's **everything** to me. | everything | 不定代词 | +25 分 |
| It's **seven** o'clock. | seven | 数词 | +8 分 |
| That's **bad** for you. | bad | 形容词 | +10 分 |
| I **like** everything. | like | 动词 | +20 分 |
| They're **open** from 7:30... | open | 动词 | +20 分 |

### 5. 保底机制（新增）

**问题**：某些句子全是简单词（如 "It's seven o'clock."），如果严格过滤可能无词可挖。

**解决方案**：
```python
# 保底优先级（降序）：
1. 实义动词/名词/形容词（最高优先级）
2. 不定代词（everything, something等）
3. 数词（seven, five等）
4. 实义缩写（o'clock等）

# 只有完全没有实词时才不挖空
# 例如：Hi. Thank you. → 不挖空
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

## 专有名词修复逻辑 (`scripts/fix_proper_nouns.py`)

### 问题背景

初始挖空算法没有完全排除专有名词，导致人名、地名、星期等被错误挖空：

**错误示例**：
- "Milo cannot have kittens." → 挖空 **Milo** ❌
- "The Bright family went camping." → 挖空 **Bright** ❌
- "On Saturday, they went canoeing." → 挖空 **Saturday** ❌

### 修复流程

#### 1. 识别专有名词

**识别规则**（满足任一条件即为专有名词）：

```python
def is_proper_noun(word, pos, word_index, sentence_length):
    # 规则 1: NLTK 词性标注
    if pos in ['NNP', 'NNPS']:
        return True

    # 规则 2: 常用人名列表（约 200 个）
    if word.lower() in COMMON_NAMES:
        return True

    # 规则 3: 首字母大写且不在句首
    if word_index > 0 and word[0].isupper():
        return True

    return False
```

**常见人名列表**：
- 男性：james, john, robert, michael, william, david, joe, bill, tom...
- 女性：mary, kate, jane, susan, lisa, sarah, emily, anna...
- 变体：katie, lizzy, becky, bob, jim, tony, mike...

#### 2. 二次重选算法

**重选逻辑**：
```python
def reselect_blank(words_with_pos, exclude_index):
    candidates = []

    for word, pos in words_with_pos:
        # 跳过被排除的专有名词
        if index == exclude_index:
            continue

        # 跳过停用词和专有名词
        if word in STOP_WORDS or is_proper_noun(word, pos, index, length):
            continue

        # 只考虑动词、普通名词、形容词
        if pos_category not in ['VB', 'NN', 'JJ', 'NNS']:
            continue

        # 排除专有名词变体（复数大写）
        if pos == 'NNS' and word[0].isupper():
            continue

        # 计算得分并选择最佳候选
        candidates.append({...})

    return best_candidate if candidates else None
```

**优先级**：动词 (VB) > 普通名词 (NN) > 形容词 (JJ)

#### 3. 处理结果

- **找到替代词**：用新的词替换专有名词
- **无合适替代**：移除挖空（设置 `blanks = []`）

**示例**：
| 句子 | 原挖空 | 类型 | 新挖空 | 结果 |
|------|--------|------|--------|------|
| Milo cannot have kittens. | Milo | 人名 | kittens | ✅ 修复 |
| The Bright family went camping. | Bright | 姓氏 | camping | ✅ 修复 |
| On Saturday, they went canoeing. | Saturday | 星期 | went | ✅ 修复 |
| It is Joe. | Joe | 人名 | (无) | ✅ 移除 |

### 执行统计

**2026-03-19 修复结果**：
- 总素材数：201 个
- 处理句子数：7,714 句
- 修复句子数：276 句（重新选择挖空词）
- 移除挖空数：181 句（无其他可用词）
- 跳过句子数：7,674 句（原本正确）

**修复类型分布**：
- 人名（Milo, Bill, Jane, Kate...）：约 40%
- 姓氏（Bright, Smith, Jones...）：约 30%
- 地名（Silent Lake, Australia...）：约 20%
- 时间（Saturday, Friday, January...）：约 10%

### 使用方法

```bash
# 修复所有素材
python3 scripts/fix_proper_nouns.py

# 批量模式（每批 10 个素材）
python3 scripts/fix_proper_nouns.py --batch-size 10

# 静默模式
python3 scripts/fix_proper_nouns.py --silent
```

### 生成报告

修复完成后生成 `fix_proper_nouns_report.json`，包含：
- 修复统计
- 前 10 个修复示例
- 修复类型分布

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
3. **去除标点符号**：`removePunctuation("bad.") === "bad"`

**示例**：

| blanks.word | 句子中的词 | 匹配结果 |
|-------------|------------|----------|
| clouds | clouds | ✅ 精确匹配 |
| Clouds | clouds | ✅ 忽略大小写 |
| bad | bad. | ✅ 去除标点符号 |
| That's | That's | ❌ 黑名单缩写（不应匹配）|

### 4. ⭐ 标点符号匹配问题（v1.2.1 修复）

#### 问题背景

**问题描述**：后端 `blank.word` 存储的是纯单词（如 `"bad"`），但前端 `sentenceWords` 分割时保留了标点符号（如 `"bad."`），导致匹配失败。

**示例**：
```javascript
// 后端数据
blank.word = "bad"

// 前端分割
sentenceWords = "That's too bad.".split(/\s+/)
// 结果：["That's", "too", "bad."]  ← 注意 "bad." 有句号

// 匹配尝试
"bad." === "bad"           // ❌ 失败
"bad.".toLowerCase() === "bad".toLowerCase()  // ❌ 失败
// 回退到随机算法 → 可能挖空 "That's"
```

#### 解决方案

**增加第三级匹配**：去除标点符号后比较

```typescript
// 辅助函数：去除标点符号
const removePunctuation = (word: string) => word.replace(/[.,!?;:'""]/g, '')

// 匹配优先级（v1.2.1）
// 1. 精确匹配
foundIndex = sentenceWords.findIndex(w => w === blankWord)

// 2. 忽略大小写
if (foundIndex === -1) {
  foundIndex = sentenceWords.findIndex(w =>
    w.toLowerCase() === blankWord.toLowerCase()
  )
}

// 3. 去除标点符号后匹配（新增）
if (foundIndex === -1) {
  foundIndex = sentenceWords.findIndex(w =>
    removePunctuation(w).toLowerCase() === removePunctuation(blankWord).toLowerCase()
  )
}
```

#### 影响范围

**修复前**：所有句末单词的挖空都失效，回退到随机算法

**修复后**：正确匹配句末单词，遵循后端挖空逻辑

**测试案例**：
- "That's too bad." → 挖空 **bad** ✅
- "Kate is sick." → 挖空 **sick** ✅
- "I like everything." → 挖空 **everything** ✅

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

- **后端脚本**：
  - `scripts/improve_blanks.py` - 智能挖空算法
  - `scripts/fix_proper_nouns.py` - 专有名词修复
- **前端组件**：`src/components/WordMode.tsx`
- **类型定义**：`src/types/index.ts`
- **数据模型**：Supabase `materials.transcript`

---

## 更新日志

### v1.2.0 (2026-03-19) - 缩写词和代词优化

**问题背景**：
- 之前的修复逻辑过于严格，删除了有价值的练习（everything, o'clock）
- 需要区分"禁止挖空"和"允许挖空"的缩写词和代词

**新增功能**：

1. **白名单机制**：
   - ✅ 不定代词：everything, something, anything, nothing, everyone 等
   - ✅ 实义缩写：o'clock（时间表达）

2. **黑名单机制**：
   - ❌ 禁止挖空：That's, It's, I'm, You're（代词+系动词）
   - ❌ 禁止挖空：isn't, don't, can't, couldn't（助动词+not）

3. **精细化优先级**：
   - 实义动词/名词/形容词：基础优先级
   - **不定代词**：+25 分（保留挖空价值）
   - **实义缩写**：+20 分
   - **数词**：+8 分（保底选项）

4. **保底机制**：
   - 短句全是简单词时，优先挖数字或形容词
   - 只有完全无实词时才不挖空

**修复效果**：
- "She's **everything** to me." ✓（已恢复）
- "They're **open** from 7:30..." ✓（跳过 o'clock）
- "That's **bad**." ✓（挖空形容词）
- "I **like** everything." ✓（挖空动词）

**技术细节**：
- 正则匹配：`^[A-Za-z]+'s$` 识别 That's, It's
- 正则匹配：`^[A-Za-z]+'m$` 识别 I'm
- 正则匹配：`^[A-Za-z]+n't$` 识别 can't, don't
- 强制全量覆盖：重写所有 blanks 字段，确保逻辑统一

---

### v1.2.1 (2026-03-19) - 前端标点符号匹配修复

**问题描述**：
- 后端 `blank.word` 存储纯单词（如 `"bad"`）
- 前端 `sentenceWords` 保留标点符号（如 `"bad."`）
- 导致匹配失败，回退到随机算法

**解决方案**：
- 新增第三级匹配：去除标点符号后比较
- `removePunctuation("bad.") === "bad"`

**修复效果**：
- "That's too bad." → 挖空 **bad** ✅（而非回退到随机）
- "Kate is sick." → 挖空 **sick** ✅
- 所有句末单词现在正确匹配

**技术细节**：
- 修改文件：`src/components/WordMode.tsx`
- 正则表达式：`/[.,!?;:'""]/g` 用于去除标点符号

---

### v1.2.2 (2026-03-19) - 动词 -ing 形式归一化

**问题描述**：
- `crying` 无法匹配核心词汇表中的 `cry`
- 短句 "Why are you crying?" 因无候选词而不挖空

**解决方案**：
- 扩展 `normalize_word` 函数，处理动词 -ing 形式
- 支持：crying → cry, running → run, making → make

**修复效果**：
- "Why are you crying?" → 挖空 **crying** ✅（之前为空）

**技术细节**：
- 修改文件：`scripts/improve_blanks.py`
- 归一化规则：
  1. 去掉 -ing 后双写字母：running → run
  2. 短词加 e：making → make
  3. 直接去掉 -ing：crying → cry

---

**最后更新**：2026-03-19
**维护者**：Claude
**版本**：v1.2.2
