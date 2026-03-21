#!/usr/bin/env python3
"""
文本规范化工具模块

用于确保素材导入时的文本质量，避免前端显示问题。
"""
import re
from typing import List, Dict, Any


def normalize_hyphenated_words(text: str) -> str:
    """
    规范化连字符词周围的空格

    问题：有些素材的文本包含带空格的连字符词，如：
    - "self -esteem" → 应为 "self-esteem"
    - "t -shirt" → 应为 "t-shirt"
    - "well -known" → 应为 "well-known"

    解决：移除连字符周围的空格，确保连字符词被正确识别为一个单词

    Args:
        text: 原始文本

    Returns:
        规范化后的文本
    """
    if not text:
        return text

    # 修复模式：字母 + 空格 + - + 字母 → 字母-字母
    # 使用正则表达式识别并修复
    # 模式1：字母 + 空格 + - + 字母（如 "self -esteem"）
    text = re.sub(r'([a-zA-Z0-9])\s+-\s*([a-zA-Z0-9])', r'\1-\2', text)

    return text


def normalize_sentence_text(text: str) -> str:
    """
    规范化句子文本（完整的规范化流程）

    包含以下规范化步骤：
    1. 规范化连字符词
    2. 移除多余空格
    3. 确保标点符号前后只有一个空格

    Args:
        text: 原始文本

    Returns:
        规范化后的文本
    """
    if not text:
        return text

    # 1. 规范化连字符词
    text = normalize_hyphenated_words(text)

    # 2. 移除多余空格（将多个空格替换为单个空格）
    text = re.sub(r'\s+', ' ', text)

    # 3. 去除首尾空格
    text = text.strip()

    return text


def normalize_transcript(transcript: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    规范化完整的 transcript 数据

    Args:
        transcript: 原始 transcript 列表

    Returns:
        规范化后的 transcript
    """
    if not transcript:
        return transcript

    normalized = []
    for sentence in transcript:
        normalized_sentence = sentence.copy()

        # 规范化句子文本
        if 'text' in sentence:
            normalized_sentence['text'] = normalize_sentence_text(sentence['text'])

        normalized.append(normalized_sentence)

    return normalized


def validate_hyphenated_words(text: str) -> List[str]:
    """
    验证文本中的连字符词是否正确（无空格）

    用于素材导入后的质量检查

    Args:
        text: 待验证的文本

    Returns:
        错误列表（包含带空格的连字符词）
    """
    errors = []

    # 检测模式：字母 + 空格 + - + 字母
    pattern = r'([a-zA-Z0-9])\s+-\s*([a-zA-Z0-9])'
    matches = re.finditer(pattern, text)

    for match in matches:
        errors.append(f"带空格的连字符词: '{match.group(0)}'")

    return errors


def validate_transcript(transcript: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    """
    验证完整的 transcript 数据

    Args:
        transcript: 待验证的 transcript 列表

    Returns:
        验证结果字典，格式：{sentence_index: [error1, error2, ...]}
    """
    errors = {}

    for i, sentence in enumerate(transcript):
        text = sentence.get('text', '')
        sentence_errors = validate_hyphenated_words(text)

        if sentence_errors:
            errors[i] = sentence_errors

    return errors


# ==================== 使用示例 ====================

if __name__ == '__main__':
    # 测试用例
    test_cases = [
        ("Also known as self -esteem", "Also known as self-esteem"),
        ("I need a t -shirt", "I need a t-shirt"),
        ("Lunch with co -workers", "Lunch with co-workers"),
        ("A long -term change", "A long-term change"),
        ("It's well -known", "It's well-known"),
        ("One -on -one meeting", "One-on-one meeting"),
    ]

    print("="*80)
    print("文本规范化测试")
    print("="*80)

    all_passed = True
    for original, expected in test_cases:
        result = normalize_hyphenated_words(original)
        passed = result == expected
        all_passed = all_passed and passed

        status = "✅" if passed else "❌"
        print(f"{status} '{original}' → '{result}'")
        if not passed:
            print(f"   期望: '{expected}'")

    print("="*80)
    if all_passed:
        print("✅ 所有测试通过！")
    else:
        print("❌ 有测试失败，请检查代码")
