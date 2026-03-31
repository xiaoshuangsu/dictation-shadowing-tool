#!/usr/bin/env python3
"""
快速测试脚本 - 翻译第一句到新语言
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

# 翻译函数
def translate_to_language(text: str, target_lang: str, lang_name: str) -> str:
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
print("  快速测试：翻译第一句到新语言")
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

first_sentence = transcript[0]
original_text = first_sentence.get('text', '')
existing_translation = first_sentence.get('translation', {}).copy()  # 复制现有翻译

print(f"英文原文: {original_text}")
print(f"\n现有翻译: {json.dumps(existing_translation, ensure_ascii=False, indent=2)}")

# 测试翻译到 4 种新语言（包含孟加拉语和蒙古语）
test_languages = [
    ('de', 'Deutsch'),
    ('ja', '日本語'),
    ('bn', 'বাংলা'),  # 孟加拉语
    ('mn', 'Монгол'),  # 蒙古语
]

print("\n开始翻译到新语言...")
new_translations = {}

for lang_code, lang_name in test_languages:
    print(f"  翻译到 {lang_name} ({lang_code})...")
    translation = translate_to_language(original_text, lang_code, lang_name)
    new_translations[lang_code] = translation
    print(f"    结果: {translation}")
    time.sleep(1)  # API 限流

# 合并翻译（增量更新）
merged_translation = {**existing_translation, **new_translations}

print("\n" + "="*80)
print("  📋 合并后的完整翻译（7 种语言）")
print("="*80)
print(json.dumps(merged_translation, ensure_ascii=False, indent=2))
print("="*80)

# 验证
print("\n验证:")
print(f"  ✓ 包含所有语言键: {sorted(merged_translation.keys())}")
print(f"  ✓ 语言数量: {len(merged_translation)}")

# 检查孟加拉语和蒙古语
print(f"\n特殊字符检查:")
print(f"  孟加拉语 (bn): {merged_translation.get('bn', 'N/A')}")
print(f"  蒙古语 (mn): {merged_translation.get('mn', 'N/A')}")

# 确认原有翻译未变
print(f"\n原有翻译确认:")
print(f"  zh (简体中文): {merged_translation.get('zh')}")
print(f"  zh_hant (繁體中文): {merged_translation.get('zh_hant')}")
print(f"  vi (Tiếng Việt): {merged_translation.get('vi')}")

print("\n✓ 测试完成")
