#!/usr/bin/env python3
"""
翻译脚本 V5.0 测试 - XML 标签隔离 + 差异化污染检测
"""
import os
import re
import requests
from pathlib import Path
from dotenv import load_dotenv
from typing import Tuple

# 加载环境变量
load_dotenv(Path(__file__).parent.parent / '.env.local')
GLM_API_KEY = os.environ.get('GLM_API_KEY')

LANGUAGES = {
    'el': {'name': 'Ελληνικά'},
    'uk': {'name': 'Українська'},
    'ja': {'name': '日本語'},
    'ko': {'name': '한국어'},
}

MAX_RETRIES = 3
API_TIMEOUT = 30


def contains_chinese_pollution(text: str, target_lang: str) -> bool:
    """
    策略 A：非 CJK 语种的中文污染检测
    """
    CJK_LANGUAGES = ['ja', 'ko']

    if target_lang in CJK_LANGUAGES:
        return False

    chinese_char_pattern = re.compile(
        r'[\u4e00-\u9fff\u3400-\u4dbf\U00020000-\U0002a6df\U0002a700-\U0002b73f\U0002b740-\U0002b81f\U0002b820-\U0002ceaf]'
    )

    return bool(chinese_char_pattern.search(text))


def contains_prompt_keywords(text: str, lang_code: str) -> Tuple[bool, str]:
    """
    策略 C：通用 Prompt 指令关键词检测
    """
    TEMPLATE_LABELS = ['Text:', 'Translation:', 'Original:', 'Source:']

    for label in TEMPLATE_LABELS:
        if label in text:
            return True, f"模板标签: '{label}'"

    LANG_SPECIFIC_KEYWORDS = {
        'el': ['Κρίσιμο', 'ΚΡΙΣΙΜΟ', 'Αυστηρά', 'ΑΠΑΓΟΡΕΥΣΗ', 'Μετάφραση'],
        'uk': ['Критично', 'Критичне', 'Заборона', 'Вибачте', 'Переклад'],
        'ja': ['重要', '厳格', '禁止', '指示', '翻訳'],
        'ko': ['중요', '엄격', '금지', '지침', '번역'],
    }

    if lang_code in LANG_SPECIFIC_KEYWORDS:
        keywords = LANG_SPECIFIC_KEYWORDS[lang_code]
        text_upper = text.upper()

        for keyword in keywords:
            if keyword.upper() in text_upper:
                return True, f"指令关键词: '{keyword}'"

    return False, ""


def translate_with_xml_tags(text: str, lang_code: str) -> Tuple[str, bool]:
    """使用 XML 标签隔离的翻译"""
    lang_name = LANGUAGES[lang_code]['name']

    prompt = f"""<instruction>
Translate the following text to {lang_name}.
Return ONLY the raw translation string.
DO NOT include any preamble, apologies, meta-labels, or explanations.
Wrap the final result in <translation_result> tags.
</instruction>

<source_text>
{text}
</source_text>"""

    try:
        response = requests.post(
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {GLM_API_KEY}"
            },
            json={
                "model": "glm-4-flash",
                "messages": [
                    {
                        "role": "system",
                        "content": "You translate text between languages. Return ONLY the translated text. Never include instructions, meta-talk, or repeat the prompt."
                    },
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 500,
            },
            timeout=API_TIMEOUT
        )

        if response.status_code == 200:
            result = response.json()
            raw_response = result["choices"][0]["message"]["content"].strip()

            # 解析 <translation_result> 标签
            tag_pattern = re.compile(r'<translation_result>\s*(.*?)\s*</translation_result>', re.DOTALL)
            match = tag_pattern.search(raw_response)

            if match:
                translation = match.group(1).strip()
            else:
                translation = raw_response

            return raw_response, True
        else:
            return f"API Error: {response.status_code}", False

    except Exception as e:
        return f"Error: {str(e)}", False


def run_tests():
    """运行测试案例"""
    print("="*80)
    print("  翻译脚本 V5.0 测试 - XML 标签隔离 + 差异化污染检测")
    print("="*80)

    test_cases = [
        {
            "name": "测试案例 1：简单英语短语（希腊语）",
            "text": "English Singsing",
            "lang": "el",
            "expect": "希腊语翻译，无标签",
        },
        {
            "name": "测试案例 2：带短语的英语（乌克兰语）",
            "text": "I'm pleased to help",
            "lang": "uk",
            "expect": "乌克兰语翻译，无 'Вибачте' 等碎碎念",
        },
        {
            "name": "测试案例 3：包含汉字的日语短句",
            "text": "少し見ていない",
            "lang": "ja",
            "expect": "日语翻译，允许汉字存在",
        },
        {
            "name": "测试案例 4：韩语测试",
            "text": "Hello",
            "lang": "ko",
            "expect": "韩语翻译，允许汉字存在",
        },
    ]

    for i, test in enumerate(test_cases, 1):
        print(f"\n{'─'*80}")
        print(f"{test['name']}")
        print(f"原文: {test['text']}")
        print(f"目标语言: {LANGUAGES[test['lang']]['name']}")
        print(f"期望: {test['expect']}")
        print(f"{'─'*80}")

        # 执行翻译
        raw_response, success = translate_with_xml_tags(test['text'], test['lang'])

        if not success:
            print(f"❌ 翻译失败: {raw_response}")
            continue

        # 解析标签
        tag_pattern = re.compile(r'<translation_result>\s*(.*?)\s*</translation_result>', re.DOTALL)
        match = tag_pattern.search(raw_response)

        if match:
            translation = match.group(1).strip()
            has_tags = True
        else:
            translation = raw_response
            has_tags = False

        print(f"\n📥 模型原始响应:")
        print(f"  {raw_response[:200]}{'...' if len(raw_response) > 200 else ''}")

        print(f"\n✅ 标签解析: {'成功' if has_tags else '失败（未找到 <translation_result> 标签）'}")

        if has_tags:
            print(f"\n📤 提取的翻译:")
            print(f"  {translation}")

        # 污染检测
        has_chinese = contains_chinese_pollution(translation, test['lang'])
        has_keywords, keyword_reason = contains_prompt_keywords(translation, test['lang'])

        print(f"\n🔍 污染检测结果:")
        print(f"  中文污染: {'❌ 检测到' if has_chinese else '✅ 无'}")
        print(f"  关键词污染: {'❌ ' + keyword_reason if has_keywords else '✅ 无'}")

        # 长度检测
        original_length = len(test['text'])
        translated_length = len(translation)
        length_ratio = translated_length / original_length if original_length > 0 else 0

        print(f"  长度检测: 原文 {original_length} 字符 → 译文 {translated_length} 字符 (比例: {length_ratio:.1f}x)")

        if length_ratio > 5 and original_length < 50:
            print(f"  ⚠️  长度异常（超过 5 倍）")

        print(f"\n{'─'*80}")

    print("\n" + "="*80)
    print("  测试完成")
    print("="*80)


if __name__ == '__main__':
    run_tests()
