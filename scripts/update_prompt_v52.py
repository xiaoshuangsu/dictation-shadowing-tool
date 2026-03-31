#!/usr/bin/env python3
"""
更新 reprocess_ietts_blanks_v5.py 的 GLM Prompt 到 v5.2
"""
import re

# 读取文件
with open('scripts/reprocess_ietts_blanks_v5.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 新的 BLANKS_PROMPT (v5.2)
new_prompt = '''"""你是一位英语教学专家，专注于设计**语言习得导向**的高质量词汇训练内容。

**核心目标**：通过挖空训练，帮助学习者内化【高价值表达】、【逻辑连接】和【具象动作】，而非拼写无意义的虚词。

**🔥 v5.2 择优逻辑（最高优先级）**：

1. **【音节复杂度加成】权重 12**：
   - 示例：available, refurbishment, September, significantly, throughout
   - 理由：多音节、拼写复杂、容易混淆的词汇，习得价值最高

2. **【长单词提权协议】权重 10-11**：
   - 长度 ≥ 11 字母：权重 11（如 opportunity, responsibility）
   - 长度 8-10 字母：权重 10（如 expensive, necessary, different）
   - 理由：长单词拼写挑战大，优先级高于短词

3. **【月份/星期提权】权重 9**：
   - 示例：February, Wednesday, September, Saturday
   - 理由：虽然是大写，但拼写具有挑战性，优先级高于 then, the 等虚词

**标准权重系统**（按优先级排序）：
1. **【权重 10】程度、逻辑与频率副词**：
   - 示例：massively, throughout, normally, extremely, particularly, rarely, merely
   - 理由：体现语言精度和语感

2. **【权重 9】高级/具象动词**：
   - 示例：refurbishment, thriving, indicates, stolen, support, maintain, cultivate
   - 理由：具象动作和职业词汇，具有拼写价值

3. **【权重 8】比较级/最高级与描述性形容词**：
   - 示例：younger, useful, significant, beneficial, essential, effective
   - 理由：强化比较级表达和属性描述的语感

4. **【权重 7】固定搭配中的语义重心**：
   - 示例：go [wrong], deal [with], feel [relax], most [useful] [part]
   - 理由：固定搭配的语义重心，避开系动词和介词

**严禁挖空的词类**（v5.2 扩展）：
1. **🔥 填充语/虚词（句末或句中）**：then, too, either, though, anyway, actually
2. **纯语气词/感叹词**：Yes, No, Okay, Well, So, Very, Quite
3. **功能性缩写/代词**：You're, It's, That's, I'm, They've, Don't, Won't
4. **低级/模糊词汇**：things, stuff, get, use, know
5. **事实词**：数字、日期、价格、地址（1998, January, $15, Street）
6. **专有名词**：人名（Louise Taylor）、地名（Atlit-Yam）、机构名
7. **基础黑名单**：代词、虚词、介词、系动词、逻辑连接词

**🔥 名词保底原则**：
- **当一句话中没有发现高价值动词或形容词时，强制选择核心名词**
- 示例：February, date, room, time, place, area
- 理由：即使这些词是基础词汇，也比填充语更有习得价值

**全局去重规则**：
- **同一单词在整个素材中最多挖空1次**
- 确保词汇多样性最大化

**保底机制**：
- **每一句必须至少有一个候选词**
- 如果句子中只有简单词，选择最核心的动词、形容词或副词
- 避免返回空的 candidates 数组

**输出格式**（JSON，不要有任何其他文字）：
{
  "candidates": [
    {"word": "第一候选词", "index": 位置1, "reason": "权重X:理由"},
    {"word": "第二候选词", "index": 位置2, "reason": "权重X:理由"},
    {"word": "第三候选词", "index": 位置3, "reason": "权重X:理由"}
  ]
}

**🔥 v5.2 案例校准（Few-shot Samples）**：

输入: Well, let's go for the February date then.
输出: {"candidates": [{"word": "February", "index": 5, "reason": "权重9:月份提权，拼写挑战词"}, {"word": "date", "index": 6, "reason": "权重5:核心名词保底"}]}
注意：then 是填充语，严禁挖掘

输入: Oh, yes. That's free and available throughout the hotel.
输出: {"candidates": [{"word": "available", "index": 4, "reason": "权重12:音节复杂度极高"}, {"word": "throughout", "index": 5, "reason": "权重10:长单词提权"}]}
注意：free 虽然是形容词，但 available 和 throughout 的习得价值更高

输入: Coffee bushes are cultivated in shaded areas.
输出: {"candidates": [{"word": "cultivated", "index": 3, "reason": "权重9:具象动词"}, {"word": "shaded", "index": 5, "reason": "权重8:描述性形容词"}]}

输入: Europeans set up coffee plantations.
输出: {"candidates": [{"word": "plantations", "index": 4, "reason": "权重10:长单词提权（11字母）"}]}
注意：set up 是短语，不能选择

输入: If anything goes wrong...
输出: {"candidates": [{"word": "wrong", "index": 3, "reason": "权重7:固定搭配go wrong的语义重心"}]}

输入: {sentence}
输出:"""

# 替换 BLANKS_PROMPT
pattern = r'BLANKS_PROMPT = """[^"]*(?=""\"\n)'
content = re.sub(pattern, f'BLANKS_PROMPT = {new_prompt}\n', content, flags=re.DOTALL)

# 更新版本注释
content = content.replace('# ==================== GLM-4 挖空词识别（v5.0 更新） ====================',
                          '# ==================== GLM-4 挖空词识别（v5.2 更新） ====================')

# 写回文件
with open('scripts/reprocess_ietts_blanks_v5.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ GLM Prompt 已更新到 v5.2")
print("✅ 版本注释已更新")
