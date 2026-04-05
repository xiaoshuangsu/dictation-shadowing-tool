#!/usr/bin/env python3
"""
单个素材翻译测试 - XML 标签隔离 + 差异化污染检测
用于验证新版翻译逻辑是否正常工作
"""
import os
import re
import json
import requests
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client
from typing import Tuple, Dict, List

# 加载环境变量
load_dotenv(Path(__file__).parent.parent / '.env.local')

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
GLM_API_KEY = os.environ.get('GLM_API_KEY')

# 语言配置
LANGUAGES = {
    'el': {'name': 'Ελληνικά'},
    'mn': {'name': 'Монгол'},
    'ja': {'name': '日本語'},
    'ko': {'name': '한국어'},
}

API_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_DELAYS = [1, 2, 4]

# ==================== 污染检测逻辑 ====================

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
        'el': ['Κρίσιμο', 'ΚΡΙΣΙΜΟ', 'Αυστηρά', 'ΑΠΑΓΟΡΕΥΣΗ', 'Μετάφραση', 'ΚΑΙΝΟΤΟΜΙΚΟ'],
        'mn': ['Текст', 'Төрөл', 'Толгойлолт', 'Шуурган', 'Хориг', 'Орчуулга'],
        'uk': ['Критично', 'Критичне', 'Заборона', 'Вибачте', 'Переклад'],
        'ru': ['Критически', 'Строго', 'Запрет', 'Перевод'],
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


# ==================== 翻译函数 ====================

def translate_with_xml_tags(text: str, lang_code: str) -> Tuple[str, bool, Dict]:
    """
    使用 XML 标签隔离的翻译

    Returns:
        (translation, success, debug_info)
    """
    lang_name = LANGUAGES[lang_code]['name']

    # XML 标签隔离 Prompt（V5.0）
    prompt = f"""<instruction>
Translate the following text to {lang_name}.
Return ONLY the raw translation string.
DO NOT include any preamble, apologies, meta-labels, or explanations.
Wrap the final result in <translation_result> tags.
</instruction>

<source_text>
{text}
</source_text>"""

    debug_info = {
        'lang_code': lang_code,
        'lang_name': lang_name,
        'original_text': text,
        'raw_response': None,
        'extracted_translation': None,
        'has_chinese_pollution': False,
        'has_keyword_pollution': False,
        'keyword_reason': '',
    }

    for attempt in range(MAX_RETRIES):
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
                debug_info['raw_response'] = raw_response

                # 解析 <translation_result> 标签
                tag_pattern = re.compile(r'<translation_result>\s*(.*?)\s*</translation_result>', re.DOTALL)
                match = tag_pattern.search(raw_response)

                if match:
                    translation = match.group(1).strip()
                    debug_info['extracted_translation'] = translation
                    debug_info['tags_found'] = True
                else:
                    translation = raw_response
                    debug_info['extracted_translation'] = translation
                    debug_info['tags_found'] = False

                # 污染检测
                has_keywords, keyword_reason = contains_prompt_keywords(translation, lang_code)
                debug_info['has_keyword_pollution'] = has_keywords
                debug_info['keyword_reason'] = keyword_reason

                if has_keywords:
                    if attempt < MAX_RETRIES - 1:
                        import time
                        time.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
                        continue
                    else:
                        return translation, False, debug_info

                has_chinese = contains_chinese_pollution(translation, lang_code)
                debug_info['has_chinese_pollution'] = has_chinese

                if has_chinese:
                    if attempt < MAX_RETRIES - 1:
                        import time
                        time.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
                        continue
                    else:
                        return translation, False, debug_info

                return translation, True, debug_info

            else:
                return f"API Error: {response.status_code}", False, debug_info

        except Exception as e:
            debug_info['error'] = str(e)
            if attempt < MAX_RETRIES - 1:
                import time
                time.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
                continue
            else:
                return f"Error: {str(e)}", False, debug_info

    return text, False, debug_info


# ==================== 主测试函数 ====================

def test_single_material():
    """测试单个素材的翻译"""
    print("="*80)
    print("  单个素材翻译测试 - XML 标签隔离 + 差异化污染检测")
    print("="*80)

    # 连接数据库
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # 查找目标素材
    print("\n正在查找素材: '[Telephone Conversations] Can I Speak to Sally?...'")

    result = client.table('materials').select('id, slug, title, transcript').ilike('title', '%Sally%').execute()

    if not result.data:
        print("❌ 未找到素材，尝试查找其他素材...")
        # 如果找不到，就找一个有 TODO_RETRY 的素材
        result = client.table('materials').select('id, slug, title, transcript').limit(1).execute()

    if not result.data:
        print("❌ 数据库中没有素材")
        return

    material = result.data[0]
    material_id = material['id']
    title = material['title']
    slug = material['slug']

    print(f"\n✅ 找到素材:")
    print(f"  ID: {material_id}")
    print(f"  标题: {title[:60]}...")
    print(f"  Slug: {slug}")

    # 解析 transcript
    transcript = material.get('transcript')
    if isinstance(transcript, str):
        transcript = json.loads(transcript)

    if not transcript:
        print("❌ transcript 为空")
        return

    print(f"\n📊 素材统计:")
    print(f"  总句子数: {len(transcript)}")

    # 统计 TODO_RETRY
    todo_counts = {}
    test_sentences = []

    for idx, sentence in enumerate(transcript[:5]):  # 只测试前 5 个句子
        translation = sentence.get('translation', {})

        for lang in ['el', 'mn', 'ja', 'ko']:
            if lang not in translation:
                todo_counts[lang] = todo_counts.get(lang, 0) + 1
            elif translation[lang] == '[TODO_RETRY]':
                todo_counts[lang] = todo_counts.get(lang, 0) + 1

        if idx < 2:  # 只测试前 2 个句子
            test_sentences.append({
                'index': idx,
                'text': sentence.get('text', ''),
                'translation': translation,
            })

    print(f"  TODO_RETRY 统计（前 5 句）: {todo_counts}")

    # 测试翻译（前 2 个句子，希腊语和蒙古语）
    print(f"\n" + "="*80)
    print("  开始翻译测试（希腊语 el + 蒙古语 mn）")
    print("="*80)

    for test_sentence in test_sentences:
        sentence_idx = test_sentence['index']
        text = test_sentence['text']

        print(f"\n{'─'*80}")
        print(f"句子 #{sentence_idx + 1}: {text[:60]}...")
        print(f"{'─'*80}")

        for lang in ['el', 'mn']:
            print(f"\n🌍 目标语言: {LANGUAGES[lang]['name']} ({lang})")

            translation, success, debug_info = translate_with_xml_tags(text, lang)

            print(f"\n📥 模型原始响应:")
            raw = debug_info.get('raw_response', '')
            if raw:
                print(f"  {raw[:150]}{'...' if len(raw) > 150 else ''}")

            print(f"\n🏷️  标签解析: {'✅ 成功' if debug_info.get('tags_found') else '❌ 失败（未找到标签）'}")

            print(f"\n📤 提取的翻译:")
            print(f"  {translation}")

            print(f"\n🔍 污染检测:")
            print(f"  中文污染: {'❌ 检测到' if debug_info.get('has_chinese_pollution') else '✅ 无'}")
            print(f"  关键词污染: {'❌ ' + debug_info.get('keyword_reason', '') if debug_info.get('has_keyword_pollution') else '✅ 无'}")

            print(f"\n✅ 翻译状态: {'✅ 成功' if success else '❌ 失败'}")

            if not success:
                print(f"  失败原因: {debug_info.get('keyword_reason') or debug_info.get('error', 'Unknown')}")

    print("\n" + "="*80)
    print("  测试完成")
    print("="*80)


if __name__ == '__main__':
    test_single_material()
