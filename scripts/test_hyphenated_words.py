#!/usr/bin/env python3
"""
测试连字符词处理修复
"""

import sys
sys.path.insert(0, '.')

from improve_blanks import analyze_sentence_words, build_blanked_text

# 测试句子
test_cases = [
    {
        'sentence': 'Building self-esteem is important.',
        'expected_blank': 'self-esteem',
        'description': '连字符名词'
    },
    {
        'sentence': 'A well-known fact about decision-making.',
        'expected_blank': 'well-known',
        'description': '连字符形容词'
    },
    {
        'sentence': 'Open-minded people are more creative.',
        'expected_blank': 'Open-minded',
        'description': '连字符形容词（大写开头）'
    }
]

print("="*70)
print("🧪 测试连字符词处理修复")
print("="*70)

all_passed = True

for i, test in enumerate(test_cases, 1):
    print(f"\n测试 {i}: {test['description']}")
    print(f"句子: {test['sentence']}")

    # 分析句子
    words_with_pos = analyze_sentence_words(test['sentence'])

    # 先显示所有分词结果
    print("原始分词结果:")
    for word, pos in words_with_pos:
        print(f"  [{word:15}] {pos}")

    # 查找连字符词
    found = False
    for word, pos in words_with_pos:
        if '-' in word:  # 连字符词包含连字符
            print(f"✅ 识别为完整词: {word} ({pos})")
            found = True

            if word.lower() == test['expected_blank'].lower():
                print(f"✅ 与预期匹配: {test['expected_blank']}")
            else:
                print(f"❌ 与预期不匹配: 期望 {test['expected_blank']}")
                all_passed = False
            break

    if not found:
        print(f"❌ 未找到连字符词: {test['expected_blank']}")
        all_passed = False

    # 测试挖空显示
    if found:
        # 找到连字符词的索引
        for idx, (word, pos) in enumerate(words_with_pos):
            if '-' in word and word.isalpha():
                # 构建挖空文本
                blanked = build_blanked_text(test['sentence'], word, idx)
                print(f"挖空效果: {blanked}")

                if '______' in blanked:
                    print(f"✅ 挖空正确")
                else:
                    print(f"❌ 挖空失败")
                    all_passed = False
                break

print("\n" + "="*70)
if all_passed:
    print("✅ 所有测试通过！")
else:
    print("❌ 部分测试失败！")
print("="*70)
