#!/usr/bin/env python3
"""
测试 "That's right, which isn't great." 的挖空逻辑
"""

sentence = "That's right, which isn't great."

# 黑名单词（来自挖空脚本）
STRICT_BLACKLIST = {
    # 代词/引导词
    'he', 'she', 'it', 'they', 'we', 'you', 'i', 'me', 'him', 'her', 'us', 'them',
    'that', 'which', 'who', 'this', 'these', 'those',
    'my', 'your', 'his', 'hers', 'its', 'our', 'their', 'ours', 'theirs',
    'whom', 'whose',

    # 虚词/连词
    'a', 'an', 'the', 'and', 'or', 'but', 'so', 'because', 'if',
    'when', 'where', 'while', 'since', 'until', 'unless', 'although',

    # 简单介词
    'in', 'on', 'at', 'to', 'of', 'for', 'with', 'by', 'from', 'about',

    # 基础系动词/助动词
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'do', 'does', 'did', 'have', 'has', 'had', 'having',

    # 语气词/感叹词
    'yes', 'no', 'okay', 'well', 'quite',

    # 低级/模糊词汇
    'things', 'stuff', 'know',

    # 问候语
    'hello', 'hi', 'hey', 'goodbye', 'bye', 'thanks', 'please',

    # 常见形容词
    'good', 'bad', 'big', 'small', 'right', 'wrong', 'sure', 'clear',
    'nice', 'fine', 'okay', 'alright', 'great', 'little',

    # 常见动词
    'say', 'says', 'said', 'tell', 'told', 'ask', 'get', 'make', 'go', 'come', 'take',
    'let', 'put', 'call', 'keep', 'give', 'find', 'show', 'hold',

    # 填充语/虚词
    'then', 'too', 'either', 'though', 'anyway', 'actually',

    # 情态助动词
    'can', 'could', 'would', 'should', 'may', 'might', 'must', 'shall',

    # 疑问代词
    'what',

    # 低级认知词/填充词
    'think', 'uh', 'hmm', 'um',
}

def is_blacklisted(word):
    """检查是否在黑名单中"""
    word_clean = word.lower().strip('.,!?;:"\'')
    return word_clean in STRICT_BLACKLIST

def is_fact_word(word):
    """检查是否为事实词"""
    word_clean = word.strip('.,!?;:"\'')
    # 纯数字
    if word_clean.isdigit():
        return True
    # 带数字的词（如 B12, 2nd）
    if any(char.isdigit() for char in word_clean):
        return True
    return False

def is_proper_noun(word, sentence_text, index):
    """检查是否为专有名词"""
    word_clean = word.strip('.,!?;:"\'')

    # 1. 大写字母开头（非句首）通常是专有名词
    if word_clean and word_clean[0].isupper() and index > 0:
        return True

    # 2. 常见地名、机构名、品牌名（略）

    return False

def should_skip_word(word, sentence_text, index):
    """综合判断是否应该跳过该词"""
    # 1. 黑名单词
    if is_blacklisted(word):
        return True

    # 2. 事实词
    if is_fact_word(word):
        return True

    # 3. 专有名词
    if is_proper_noun(word, sentence_text, index):
        return True

    return False

# 分析
words = sentence.split(' ')

print(f"句子: {sentence}")
print()

print("空格分词:")
for i, word in enumerate(words):
    clean = word.strip('.,!?;:"\'')
    skip = should_skip_word(word, sentence, i)
    skip_reason = []

    if is_blacklisted(word):
        skip_reason.append("黑名单")
    if is_fact_word(word):
        skip_reason.append("事实词")
    if is_proper_noun(word, sentence, i):
        skip_reason.append("专有名词")

    status = "❌ 跳过" if skip else "✅ 候选"
    reason = f" ({', '.join(skip_reason)})" if skip_reason else ""

    print(f"  [{i}] {word:15s} → {clean:12s} | {status}{reason}")

print()
print("结论:")
print("  根据 v6.0 挖空脚本逻辑，这句话的候选词：")
print()

# 找出所有候选词
candidates = []
for i, word in enumerate(words):
    if not should_skip_word(word, sentence, i):
        clean = word.strip('.,!?;:"\'')
        candidates.append((i, clean))

if candidates:
    print(f"  候选词（按顺序）:")
    for i, (idx, word) in enumerate(candidates):
        print(f"    [{i+1}] {word} (index: {idx})")

    # 模拟权重判断（简化版）
    print()
    print(f"  最终选择: {candidates[-1][1]} (最后一个非黑名单词)")
    print(f"  理由: 其他词都在黑名单中，只能选择最后一个词")
    print()
    print(f"  blanks 数据: {{word: '{candidates[-1][1]}', index: {candidates[-1][0]}}}")
else:
    print("  ❌ 没有候选词！整句话都在黑名单中")
