# CAM 雅思素材挖空规则 v6.1

> **版本**: v6.1 (2026-03-28)
> **状态**: 生产就绪
> **脚本**: `scripts/reprocess_cam_batch_v61.py`
> **用途**: CAM 10/11/12 系列素材挖空重处理

---

## 🎯 核心目标

创建**语言习得导向**的高质量词汇训练内容，优先挖掘能体现**英语语感、词汇量和表达能力**的单词，而非简单的填空练习。

**设计理念**：
- ❌ 避免：挖空功能词（the, is, of）→ 无训练价值
- ❌ 避免：重复挖空同一词 → 降低学习效率
- ✅ 优先：语感词汇（particularly, cultivated）→ 提升语言精度
- ✅ 优先：具象动作（demonstrate, maintain）→ 实用性强

---

## 📊 权重系统（0-12）

### 权重 12：音节复杂度极高的词汇

**定义**：拼写复杂、多音节的学术或专业词汇

**示例**：
```
available, throughout, refurbishment, significantly
particularly, especially, approximately, specifically
automatically, immediately, successfully, additionally
fundamental, excellent, important, environment, government
September, February, Wednesday, Saturday
dictionary, university, opportunity, responsibility
```

**权重原因**：这些词拼写难度高，是语言能力的重要标志

---

### 权重 11：超长单词

**定义**：长度超过 11 个字母的实义词

**示例**：`refurbishment`, `responsibility`

**权重原因**：长单词通常是有意义的核心词汇

---

### 权重 10：程度/逻辑与频率副词（40%）

**定义**：体现语言精度的副词

**示例**：
```
程度副词：massively, extremely, completely, entirely, totally
逻辑副词：particularly, especially, significantly, considerably
频率副词：frequently, regularly, constantly, continuously
相对副词：relatively, comparatively, approximately
时间副词：ultimately, eventually, initially, originally
效果副词：effectively, efficiently, successfully
```

**长单词提权**：8-10 个字母的实义词（非 -ly 结尾）

**权重原因**：副词体现语言表达的高级程度

---

### 权重 9：高级/具象动词 + 月份/星期（30%）

**定义**：具体动作动词或时间词汇

**动词示例**：
```
职业动词：help, pay, join, choose, decide, manage, control, check
高级动词：refurbishment, thriving, indicates, support, maintain
-ing 形式：going 以外的动词-ing形式（非基础）
-ed 形式：非规则变化的动词过去式
```

**时间词汇**：
```
月份：January, February, March, April, May, June, July,
       August, September, October, November, December
星期：Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
```

**权重原因**：具象动词有实用价值，月份/星期拼写具有挑战性

---

### 权重 8：比较级/最高级与描述性形容词（20%）

**比较级/最高级**：
```
younger, older, better, worse, more, less
bigger, smaller, faster, slower
useful, useless, helpful, harmful
serious, popular, possible, available, responsible
```

**描述性形容词词尾**：
```
-ive: significant, beneficial, essential, effective
-ous: dangerous, various, serious, obvious
-ent: important, different, excellent, silent
-ant: important, significant, constant, relevant
```

**权重原因**：比较级和形容词体现描述能力

---

### 权重 7：固定搭配中的语义重心（10%）

**定义**：动词+名词、形容词+名词 等固定搭配中的核心词

**检测方式**：自动识别常见搭配模式

**示例**：
```
go [wrong] → wrong 是语义重心
feel [relaxed] → relaxed 是语义重心
most [useful] part → useful 是语义重心
```

**权重原因**：固定搭配是英语表达的地道用法

---

### 权重 6：普通名词（默认）

**定义**：普通名词，无特殊权重

**示例**：
```
room, conference, member, service, product
facility, space, place, area, person, people
```

**权重原因**：保底机制，确保所有实词都可被考虑

---

### 权重 5：基础名词

**定义**：常见名词词尾或特定词汇

**示例**：
```
词尾：-ment, -tion, -ness, -ity, -ence, -ance
-dom, -ship, -ism, -ist
```

---

## 🔒 严格黑名单（严禁挖空）

### 1. 代词/引导词（32个）

```
he, she, it, they, we, you, i, me, him, her, us, them
that, which, who, this, these, those
my, your, his, hers, its, our, their, ours, theirs
whom, whose
```

**原因**：功能词，无词汇训练价值

---

### 2. 虚词/连词（15个）

```
a, an, the, and, or, but, so, because, if
when, where, while, since, until, unless, although
```

**原因**：语法结构词

---

### 3. 简单介词（18个）

```
in, on, at, to, of, for, with, by, from, about
into, onto, upon, within, without, during, before, after
```

**原因**：基础介词

---

### 4. 基础系动词/助动词（15个）

```
is, am, are, was, were, be, been, being
do, does, did, have, has, had, having
```

**原因**：语法功能词

---

### 5. 情态助动词（8个）⭐ v6.0 新增

```
can, could, would, should, may, might, must, shall
```

**原因**：情态助动词表示语气而非具体意义

---

### 6. 疑问代词（1个）⭐ v6.0 新增

```
what
```

**原因**：疑问代词无实质内容

---

### 7. 缩写代词（代词+系动词/助动词）

**检测模式**：
```
^(you|it|that|what|who|there|here|i|we|they)['']re$
^(he|she|it|that|what|there|here)['']s$
^(i|you|we|they|he|she|it)['']ve$
^(i|you|we|they|he|she|it|would|could|should)['']d$
^(i|you|we|they|he|she|it)['']ll$
^let['']s$
^can['']t$, ^won['']t$, ^don['']t$
```

**示例**：
```
❌ That's, It's, You're, I'm, We're, They've
❌ Can't, Won't, Don't
```

**原因**：缩写代词是语法结构词

---

### 8. 低级认知词/填充词（4个）⭐ v6.0 新增

```
think, uh, hmm, um
```

**原因**：填充词无实质内容

---

### 9. 纯语气词/感叹词（5个）

```
yes, no, okay, well, quite
```

**原因**：对话填充词，无词汇训练价值

---

### 10. 低级/模糊词汇（3个）

```
things, stuff, know
```

**原因**：模糊词汇，无法体现词汇水平

---

### 11. 问候语（7个）

```
hello, hi, hey, goodbye, bye, thanks, please
```

**原因**：社交套话，无需练习

---

### 12. 常见形容词（低价值）

```
good, bad, big, small, right, wrong, sure, clear
nice, fine, okay, alright, great, little
```

**原因**：基础形容词，过于简单

---

### 13. 常见动词（低价值）

```
say, says, said, tell, told, ask
get, make, go, come, take
let, put, call, keep, give, find, show, hold
```

**原因**：基础动词，过于频繁

---

### 14. 填充语/虚词（句末或句中）（6个）⭐ v5.2 新增

```
then, too, either, though, anyway, actually
```

**原因**：填充语，无实质内容

---

### 15. 其他功能词（3个）

```
there, here, just, really, very
```

---

## 🛡️ 过滤规则

### 1. 黑名单词 → 直接跳过

### 2. 缩写代词 → 直接跳过

检测正则：`^(you|it|that|what|who|there|here|i|we|they)['']re$` 等

### 3. 事实词 → 直接跳过

**包括**：
- 纯数字：`1975`, `15th`, `3.5`, `20%`
- 包含数字的词：`1990s`, `15th`, `3.5`, `20%`
- 价格相关：`$15`, `£50`, `yen`, `dollar`, `pound`, `cent`, `euro`

⚠️ **注意**：
- **月份/星期不在事实词列表中**（v6.0 修复）
- **日期词汇（date, time）不在事实词列表中**（v6.0 修复）

### 4. 地址相关词 → 直接跳过

```
street, road, avenue, boulevard, lane, drive, way
building, room, floor, suite, apartment, flat
north, south, east, west, central, city, town
```

⚠️ **注意**：
- **"address" 本身不在地址词列表中**！

### 5. 专有名词 → 直接跳过

**检测规则**：
1. 首字母大写且不在句首（index > 0）
2. 在常见地名列表中：`london, paris, tokyo, new york, sydney...`
3. 在机构名列表中：`cambridge, oxford, bbc, unesco...`
4. 在品牌名列表中：`google, apple, microsoft...`

---

## 🎯 挖空流程

### 第一步：GLM-4 推荐候选词

GLM-4 返回 2-3 个候选词，格式：
```json
{
  "candidates": [
    {"word": "候选词", "index": 位置, "reason": "权重X:理由"}
  ]
}
```

### 第二步：验证候选词

对每个候选词进行验证：
1. ✅ 是单个词（非短语）
2. ✅ index 在有效范围内
3. ✅ **v6.1 新增**：验证 word 是否与 index 位置的词匹配
4. ✅ 不在黑名单中
5. ✅ 不是缩写代词
6. ✅ 不是事实词
7. ✅ 不是专有名词
8. ✅ 未挖空过（全局去重）

### 第三步：v6.1 索引修正 ⭐ 新增

如果 `word` 与 `index` 位置的词不匹配：
1. 在句子中查找 `word` 的实际位置
2. 使用实际找到的 index
3. 记录修正日志：`⚠️ 修正 index: X -> Y`

### 第四步：权重计算

对通过验证的候选词，使用权重系统计算得分：
- 权重 10-12：语感/复杂词
- 权重 8-9：高级动词/形容词
- 权重 5-7：普通实词
- 权重 0-4：跳过

### 第五步：选择最佳候选词

选择权重最高的候选词

### 第六步：保底机制

如果所有 GLM 候选词都不符合条件：
1. 使用本地算法遍历所有词
2. 计算每个词的权重
3. 选择权重最高的词

---

## 🔐 三大保护机制

### 1. 全局去重

**规则**：同一单词在整个素材中最多挖空 **1 次**

**实现**：
```python
blanked_words = {}  # 记录已挖空的单词

if blanked_words.get(word_lower, 0) >= 1:
    continue  # 跳过已挖过的词
```

**效果**：增加词汇多样性，避免重复

---

### 2. 保底机制

**规则**：每句必须至少有一个挖空

**实现**：
- GLM 返回多个候选词（2-3个）
- 如果都不符合，使用本地算法
- 本地算法优先级：动词 > 副词 > 形容词 > 名词

**效果**：确保没有空白句子

---

### 3. 索引修正（v6.1 新增）

**问题**：GLM 可能返回错误的 index

**示例**：
```json
{"word": "wrong", "index": 3, "reason": "权重7:固定搭配"}
```

但实际句子中 "wrong" 在 index 5

**解决方案**：
1. 检测 word 与 index 位置的词是否匹配
2. 如果不匹配，在句子中查找 word 的实际位置
3. 使用实际找到的 index

**效果**：避免挖空错误位置的词

---

## 📝 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| **v6.1** | 2026-03-28 | 索引转换逻辑（自动修正 GLM 错误的 index） |
| **v6.0** | 2026-03-26 | 新增黑名单（情态助动词、疑问代词、低级认知词）+ 修复逻辑冲突 |
| **v5.2** | 2026-03-26 | 长单词提权、音节复杂度加成、月份提权、禁止填充语 |
| **v5.1** | 2026-03-26 | 修复 W6 占比过高，扩展黑名单和权重规则 |
| **v5.0** | 2026-03-26 | 语言习得导向重构，权重系统，固定搭配识别 |
| **v4.1** | 2026-03-25 | 验证单个词，防止短语挖空 |
| **v4.0** | 2026-03-25 | 剔除事实词、专有名词、逻辑连接词 |

---

## 📌 相关文件

- **批量处理脚本**: `scripts/reprocess_cam_batch_v61.py`
- **单个素材处理**: `scripts/reprocess_ietts_blanks.py`
- **日志目录**: `scripts/logs/`
- **进度文件**: `logs/cam_reprocess_progress.json`

---

## 🎓 使用示例

### 验证挖空结果

```python
from supabase import create_client
import os
import json

# 连接数据库
client = create_client(
    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_ROLE_KEY']
)

# 查询素材
slug = 'cam-11-academic-listening-test-2-part-1'
result = client.table('materials').select('transcript').eq('slug', slug).execute()

transcript = result.data[0]['transcript']

# 分析挖空
for sentence in transcript[:5]:
    blanks = sentence.get('blanks', [])
    text = sentence.get('text', '')

    if blanks:
        blank = blanks[0]
        word = blank.get('word', '')
        index = blank.get('index', -1)
        weight = blank.get('weight', 0)

        print(f"句子: {text}")
        print(f"挖空: {word} (索引 {index}, 权重 {weight})")
        print("-" * 50)
```

---

**最后更新**: 2026-03-28
**维护者**: Sarah + Claude
**审核状态**: ✅ 已确认
