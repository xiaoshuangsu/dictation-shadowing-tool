#!/usr/bin/env python3
"""
测试 "Thank you. And your address?" 的挖空逻辑
"""

sentence = "Thank you. And your address?"

# 空格分词（与挖空脚本一致）
words = sentence.split(' ')

print("句子:", sentence)
print()
print("空格分词:")
for i, word in enumerate(words):
    print(f"  [{i}] {word}")

print()
print("="*60)
print()

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

# 辅助函数：去除标点
def remove_punctuation(word):
    return word.strip('.,!?;:"\'').lower()

# 分析每个词
print("候选词分析:")
candidates = []
for i, word in enumerate(words):
    clean_word = remove_punctuation(word)

    # 检查是否在黑名单
    in_blacklist = clean_word in STRICT_BLACKLIST

    # 判断词性（简单规则）
    pos = "未知"
    if clean_word in ['thank', 'thanks']:
        pos = "动词（问候）"
    elif clean_word in ['you', 'your']:
        pos = "代词"
    elif clean_word == 'and':
        pos = "连词"
    elif clean_word == 'address':
        pos = "名词"

    print(f"  [{i}] {word:15s} → {clean_word:12s} | {pos:15s} | {'❌ 黑名单' if in_blacklist else '✅ 候选'}")

    if not in_blacklist and clean_word:
        candidates.append((i, clean_word, pos))

print()
print("="*60)
print()

if candidates:
    print("有效候选词:")
    for idx, word, pos in candidates:
        print(f"  [{idx}] {word:12s} ({pos})")

    print()
    print("最可能的挖空词:")
    # 按照权重规则排序（简化版）
    # 名词 > 动词 > 其他
    best_idx, best_word, best_pos = candidates[0]

    # 优先选择名词
    for idx, word, pos in candidates:
        if "名词" in pos:
            best_idx, best_word, best_pos = idx, word, pos
            break

    print(f"  **{best_word}** (index: {best_idx}, 词性: {best_pos})")
    print()
    print("理由:")
    print("  - Thank: 动词但用于问候，通常避免挖空")
    print("  - And: 连词，黑名单")
    print("  - your: 代词，黑名单")
    print(f"  - {best_word}: 具象名词，唯一有效候选词 ✅")
else:
    print("❌ 没有有效候选词！")
