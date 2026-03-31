#!/usr/bin/env python3
"""
验证单个句子的挖空逻辑
"""
import re

# 目标句子
sentence_text = "Good morning. I want some information on self-drive tours in..."

# 空格分词
words = sentence_text.split()

print("空格分词结果:")
for i, word in enumerate(words):
    print(f"  [{i}] {word}")

print()
print(f"blanks 字段: word='information', index=3")
print(f"words[3] = '{words[3]}'")
print()
print("分析：")
print("  - blanks 说 index=3 应该是 'information'")
print(f"  - 但实际 words[3] = '{words[3]}'")
print(f"  - 'information' 在空格分词中的位置: {words.index('information') if 'information' in words else '不存在'}")
print()
print("结论：挖空脚本的 index 计算错误！")

# 检查其他句子
print("\n" + "="*60)
print()

sentence_text2 = "Could you send me a brochure?"
words2 = sentence_text2.split()

print("空格分词结果:")
for i, word in enumerate(words2):
    print(f"  [{i}] {word}")

print()
print(f"blanks 字段: word='brochure', index=2")
print(f"words[2] = '{words2[2]}'")
print(f"  - 'brochure' 在空格分词中的位置: {words2.index('brochure?') if 'brochure?' in words2 else words2.index('brochure') if 'brochure' in words2 else '不存在'}")
