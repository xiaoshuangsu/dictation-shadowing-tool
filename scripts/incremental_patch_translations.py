#!/usr/bin/env python3
"""
增量补齐词典翻译脚本 - V1.0
精准补齐模式：只为缺失的语言生成翻译
"""

import os
import sys
import json
import time
import requests
from pathlib import Path
from typing import List, Dict
from dotenv import load_dotenv
from supabase import create_client

# 加载环境变量
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

# 验证环境变量
GLM_API_KEY = os.getenv('GLM_API_KEY')
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not all([GLM_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY]):
    print("❌ 缺少必要的环境变量")
    sys.exit(1)

# 创建 Supabase 客户端
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# GLM API 配置
GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"
GLM_MODEL = "glm-4-flash"

# 完整的 19 国语言定义（含法语）
ALL_19_LANGUAGES = [
    'zh', 'zh_hant', 'vi',
    'ar', 'de', 'es', 'fr', 'ja', 'ms', 'ru', 'tr', 'el',
    'id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi'
]

# 语言 Prompt 模板
LANGUAGE_PROMPTS = {
    'zh': '简中', 'zh_hant': '繁中', 'vi': '越南',
    'ar': '阿拉伯', 'de': '德语', 'es': '西语', 'fr': '法语',
    'ja': '日语', 'ms': '马来', 'ru': '俄语', 'tr': '土语', 'el': '希腊',
    'id': '印尼', 'ko': '韩语', 'pt': '葡语', 'th': '泰语',
    'uk': '乌克', 'bn': '孟加', 'mn': '蒙语', 'hi': '印地'
}


def call_glm_api(word: str, target_languages: List[str]) -> Dict[str, str]:
    """调用 GLM API 进行翻译"""
    # 获取现有释义（用于上下文）
    response = supabase.table('dictionary_cache').select('definitions').eq('word', word).execute()

    en_definition = ""
    if response.data:
        definitions = response.data[0].get('definitions', {})
        if isinstance(definitions, str):
            definitions = json.loads(definitions)
        en_definition = definitions.get('en', '')

    if not en_definition:
        en_definition = word

    # 构建 Prompt
    languages_prompt = " ".join([
        f"{LANGUAGE_PROMPTS[lang]}({lang})"
        for lang in target_languages
    ])

    json_template = "{" + ", ".join([f'"{lang}": "翻译"' for lang in target_languages]) + "}"

    system_content = f"""你是专业多语言词典翻译引擎。将英文释义翻译为指定语言。

{languages_prompt}

单词：{word}
释义：{en_definition}

严格返回紧凑JSON（无额外文字）：
{json_template}"""

    try:
        api_response = requests.post(
            f"{GLM_BASE_URL}/chat/completions",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {GLM_API_KEY}'
            },
            json={
                'model': GLM_MODEL,
                'messages': [
                    {
                        'role': 'system',
                        'content': system_content
                    },
                    {
                        'role': 'user',
                        'content': word
                    }
                ],
                'temperature': 0.3,
                'max_tokens': 800,
                'top_p': 0.7
            },
            timeout=30
        )

        if api_response.status_code != 200:
            raise requests.RequestException(f"GLM API 错误 ({api_response.status_code}): {api_response.text}")

        data = api_response.json()
        content = data.get('choices', [{}])[0].get('message', {}).get('content')

        if not content:
            raise ValueError("GLM API 返回空内容")

        # 解析 JSON
        result = json.loads(content)
        return result

    except Exception as e:
        print(f"   ❌ API 调用异常：{e}")
        return {}


print("=" * 70)
print("🔧 增量补齐词典翻译 V1.0")
print("=" * 70)
print()

# 分析所有单词的翻译状态
print("[步骤 1/4] 分析单词翻译状态...")
response_all = supabase.table('dictionary_cache').select('word', 'translations').not_.is_('translations', 'null').execute()

all_words = response_all.data
print(f"📊 总共有 translations 字段的单词数：{len(all_words)}")

incomplete_words = []
complete_words = []

for word_entry in all_words:
    word = word_entry['word']
    translations_raw = word_entry.get('translations')

    try:
        if isinstance(translations_raw, str):
            translations = json.loads(translations_raw)
        elif isinstance(translations_raw, dict):
            translations = translations_raw
        else:
            continue

        if translations is None:
            continue

        existing_keys = set(translations.keys())
        standard_keys = set(ALL_19_LANGUAGES)
        missing_keys = standard_keys - existing_keys

        if len(missing_keys) > 0:
            incomplete_words.append({
                'word': word,
                'existing_keys': existing_keys,
                'missing_keys': sorted(list(missing_keys)),
                'translations': translations
            })
        else:
            complete_words.append({
                'word': word,
                'translations': translations
            })

    except (json.JSONDecodeError, TypeError, AttributeError):
        continue

print(f"✅ 翻译不全的单词：{len(incomplete_words)} 个")
print(f"✅ 翻译完整的单词：{len(complete_words)} 个")
print()

# 创建补齐计划
print("[步骤 2/4] 创建精准补齐计划...")

patch_plan = []

# 逻辑 A：针对翻译不全的单词，补齐所有缺失语言
for word_info in incomplete_words:
    patch_plan.append({
        'word': word_info['word'],
        'target_languages': word_info['missing_keys'],
        'mode': '补齐缺失',
        'missing_count': len(word_info['missing_keys'])
    })

# 逻辑 B：针对翻译完整的单词，只补齐法语
for word_info in complete_words:
    patch_plan.append({
        'word': word_info['word'],
        'target_languages': ['fr'],
        'mode': '补齐法语',
        'missing_count': 1
    })

print(f"📋 补齐计划创建完成：{len(patch_plan)} 个单词")
print(f"   - 翻译不全（补齐所有缺失）：{len(incomplete_words)} 个")
print(f"   - 翻译完整（只补法语）：{len(complete_words)} 个")
print()

# 测试模式：只处理前 3 个单词
TEST_MODE = len(sys.argv) > 1 and sys.argv[1] == '--test'
if TEST_MODE:
    print("⚠️  测试模式：只处理前 3 个单词")
    patch_plan = patch_plan[:3]
    print()

# 执行补齐
print("[步骤 3/4] 执行增量补齐...")
print("-" * 70)

success_count = 0
failed_words = []

for idx, task in enumerate(patch_plan, 1):
    word = task['word']
    target_languages = task['target_languages']
    mode = task['mode']

    print(f"\n[{idx}/{len(patch_plan)}] {word} ({mode})")
    print(f"   目标语言：{', '.join(target_languages)} ({len(target_languages)} 种)")

    try:
        # 调用 GLM API 翻译
        result = call_glm_api(word, target_languages)

        if result:
            # 获取现有翻译
            response = supabase.table('dictionary_cache').select('translations').eq('word', word).execute()

            if response.data:
                existing_translations_raw = response.data[0].get('translations', '{}')

                try:
                    if isinstance(existing_translations_raw, str):
                        existing_translations = json.loads(existing_translations_raw)
                    else:
                        existing_translations = existing_translations_raw or {}
                except:
                    existing_translations = {}

                # 合并翻译
                existing_translations.update(result)

                # 更新数据库
                update_response = supabase.table('dictionary_cache').update({
                    'translations': existing_translations
                }).eq('word', word).execute()

                if update_response.data:
                    print(f"   ✅ 补齐成功")
                    success_count += 1
                else:
                    print(f"   ❌ 数据库更新失败")
                    failed_words.append(word)
            else:
                print(f"   ❌ 未找到单词记录")
                failed_words.append(word)
        else:
            print(f"   ❌ API 调用失败")
            failed_words.append(word)

        # 延迟，避免 Rate Limit
        time.sleep(1)

    except Exception as e:
        print(f"   ❌ 处理失败：{e}")
        failed_words.append(word)

print()
print("=" * 70)
print("[步骤 4/4] 补齐完成")
print("=" * 70)
print(f"✅ 成功：{success_count}/{len(patch_plan)}")

if failed_words:
    print(f"⚠️  失败：{len(failed_words)} 个")
    print(f"失败列表：{', '.join(failed_words[:10])}{'...' if len(failed_words) > 10 else ''}")

print()

# 验证结果（测试模式）
if TEST_MODE and success_count > 0:
    print("[验证] 查询第一个补齐单词的 translations JSON...")
    first_word = patch_plan[0]['word']
    response = supabase.table('dictionary_cache').select('word', 'translations').eq('word', first_word).execute()

    if response.data:
        word_data = response.data[0]
        translations = word_data.get('translations')

        if isinstance(translations, str):
            translations = json.loads(translations)

        print(f"\n📝 单词：{first_word}")
        print(f"📊 翻译 JSON：")
        print(json.dumps(translations, ensure_ascii=False, indent=2))

        # 检查关键语言
        required_langs = ['zh', 'zh_hant', 'ja', 'fr']
        missing = [lang for lang in required_langs if lang not in translations]

        if missing:
            print(f"\n⚠️  缺少语言：{', '.join(missing)}")
        else:
            print(f"\n✅ 包含所有关键语言：zh, zh_hant, ja, fr")


if __name__ == '__main__':
    main()
