#!/usr/bin/env python3
"""
测试脚本 - 翻译前 5 个句子到 16 种新语言
不写入数据库，仅展示合并后的完整 JSON
"""
import os
import json
import requests
import time
from pathlib import Path
from supabase import create_client

# 加载环境变量
def load_env():
    env_path = Path(__file__).parent.parent / '.env.local'
    if not env_path.exists():
        raise FileNotFoundError(f".env.local 不存在: {env_path}")
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

load_env()

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
GLM_API_KEY = os.environ.get('GLM_API_KEY')

# 16 种新语言
NEW_LANGUAGES = [
    ('ar', 'العربية'),           # Arabic
    ('de', 'Deutsch'),           # German
    ('es', 'Español'),           # Spanish
    ('ja', '日本語'),            # Japanese
    ('ms', 'Bahasa Melayu'),     # Malay
    ('ru', 'Русский'),           # Russian
    ('tr', 'Türkçe'),            # Turkish
    ('el', 'Ελληνικά'),          # Greek
    ('id', 'Bahasa Indonesia'),  # Indonesian
    ('ko', '한국어'),            # Korean
    ('pt', 'Português'),         # Portuguese
    ('th', 'ภาษาไทย'),         # Thai
    ('uk', 'Українська'),        # Ukrainian
    ('bn', 'বাংলা'),           # Bengali
    ('mn', 'Монгол'),           # Mongolian
    ('hi', 'हिन्दी'),           # Hindi
]

def translate_to_language(text: str, lang_code: str, lang_name: str) -> str:
    """翻译到指定语言"""

    prompt = f"""Translate the following English text to {lang_name}.

Text: {text}

Return ONLY the translation, no explanation."""

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
                    {"role": "system", "content": f"You are a professional translator. Translate accurately to {lang_name}."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 500
            },
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            translation = result["choices"][0]["message"]["content"].strip()
            return translation
        else:
            print(f"  ⚠ API 错误: {response.status_code}")
            return text

    except Exception as e:
        print(f"  ⚠ 翻译失败: {e}")
        return text

print("="*80)
print("  测试：翻译前 5 个句子到 16 种新语言")
print("="*80)

# 连接数据库
client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# 查询素材
result = client.table('materials').select('*').eq('slug', 'corruption').execute()

if not result.data:
    print("❌ 素材不存在: corruption")
    exit(1)

material = result.data[0]
transcript = material.get('transcript')
if isinstance(transcript, str):
    transcript = json.loads(transcript)

print(f"✓ 找到素材: {material['title']}")
print(f"✓ 总句子数: {len(transcript)}")
print(f"✓ 测试句子数: 5")
print(f"✓ 目标语言: 16 种新语言")
print("="*80)

# 测试前 5 个句子
test_sentences = transcript[:5]
results = []

for i, sentence in enumerate(test_sentences, 1):
    original_text = sentence.get('text', '')
    existing_translation = sentence.get('translation', {}).copy()

    print(f"\n[{i}/5] 翻译句子: {original_text[:50]}{'...' if len(original_text) > 50 else ''}")

    # 翻译到 16 种新语言
    new_translations = {}
    for lang_code, lang_name in NEW_LANGUAGES:
        print(f"  → {lang_name} ({lang_code})...", end='', flush=True)
        translation = translate_to_language(original_text, lang_code, lang_name)
        new_translations[lang_code] = translation
        print(f" ✓ {translation[:30]}{'...' if len(translation) > 30 else ''}")
        time.sleep(0.5)  # API 限流

    # 合并翻译（增量更新）
    merged_translation = {**existing_translation, **new_translations}
    results.append({
        'index': i,
        'original': original_text,
        'translation': merged_translation
    })

# 显示完整结果
print("\n" + "="*80)
print("  📋 合并后的完整翻译结果（前 5 个句子）")
print("="*80)

for result in results:
    print(f"\n【句子 {result['index']}】")
    print(f"原文: {result['original']}")
    print(f"\n翻译（{len(result['translation'])} 种语言）:")
    print(json.dumps(result['translation'], ensure_ascii=False, indent=2))
    print("-" * 80)

# 验证总结
print("\n" + "="*80)
print("  验证总结")
print("="*80)

all_keys = set()
for result in results:
    all_keys.update(result['translation'].keys())

print(f"✓ 所有翻译键: {sorted(all_keys)}")
print(f"✓ 语言总数: {len(all_keys)} 种")

# 检查关键语言
check_langs = ['zh', 'zh_hant', 'vi', 'bn', 'mn']
for lang in check_langs:
    present = all(lang in r['translation'] for r in results)
    status = "✓" if present else "✗"
    print(f"  {status} {lang}: {'全部存在' if present else '缺失'}")

print("\n✓ 测试完成（未写入数据库）")
print("="*80)
