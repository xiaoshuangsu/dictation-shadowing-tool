#!/usr/bin/env python3
"""
改进版翻译脚本 - 包含重复检测和重试机制
"""
import os
import json
import requests
import time
from pathlib import Path
from supabase import create_client
from collections import Counter
import re

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

def detect_repetition(text: str, lang_code: str) -> tuple[bool, str]:
    """检测文本中是否有重复词汇

    Returns:
        (has_repetition, details): 是否有重复，详细信息
    """
    # 分词（针对不同语言使用不同的分词策略）
    if lang_code == 'mn':  # 蒙古语 - 按空格分词
        words = text.split()
    elif lang_code in ['zh', 'zh_hant', 'ja', 'ko', 'th']:  # CJK 语言 - 按字符
        words = list(text)
    elif lang_code in ['ar', 'hi', 'bn', 'th']:  # 其他复杂语言 - 按空格
        words = text.split()
    else:  # 拉丁文字 - 按空格和标点
        words = re.findall(r'\b\w+\b', text.lower())

    if len(words) < 3:
        return False, "文本太短"

    # 统计词频
    word_counts = Counter(words)

    # 检查是否有词重复 3 次以上
    for word, count in word_counts.most_common():
        if count >= 3 and len(word) > 2:  # 忽略短词（如标点、助词）
            return True, f"检测到重复词汇: '{word}' 出现 {count} 次"

    # 特殊检测：连续重复（如 "хүрэлт хүрэлт хүрэлт"）
    for i in range(len(words) - 2):
        if words[i] == words[i+1] == words[i+2] and len(words[i]) > 2:
            return True, f"检测到连续重复: '{words[i]}'"

    return False, "正常"

def translate_to_language(text: str, lang_code: str, lang_name: str, is_retry: bool = False) -> str:
    """翻译到指定语言

    Args:
        text: 要翻译的文本
        lang_code: 语言代码
        lang_name: 语言名称
        is_retry: 是否为重试（使用更严厉的提示词）

    Returns:
        翻译结果
    """

    if is_retry:
        # 重试模式 - 更严厉的提示词
        prompt = f"""Provide a single, non-repetitive translation for the following text.

CRITICAL REQUIREMENTS:
- Translate to: {lang_name}
- Avoid word repetition at all costs
- Output only the direct translation without any redundant characters
- Be concise and natural

Text: {text}

Translation:"""
    else:
        # 首次翻译 - 包含避免重复的指令
        prompt = f"""Translate the following English text to {lang_name}.

CRITICAL REQUIREMENTS:
- Avoid word repetition in all languages, especially in Mongolian (mn)
- Output only the direct translation without any redundant characters
- Be concise and natural

Text: {text}

Translation:"""

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
                        "content": f"You are a professional translator. Translate accurately to {lang_name}. Avoid repetition and redundant output."
                    },
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

def translate_with_retry(text: str, lang_code: str, lang_name: str) -> tuple[str, bool]:
    """翻译并自动重试

    Returns:
        (translation, was_retried): 翻译结果，是否进行了重试
    """
    # 首次翻译
    translation = translate_to_language(text, lang_code, lang_name, is_retry=False)

    # 检测重复
    has_repetition, details = detect_repetition(translation, lang_code)

    if has_repetition:
        print(f"  ⚠️ 检测到异常: {details}")
        print(f"  🔄 重新翻译 {lang_name} ({lang_code})...")

        # 重试一次
        translation = translate_to_language(text, lang_code, lang_name, is_retry=True)
        time.sleep(1)

        # 再次检测
        has_repetition_2, details_2 = detect_repetition(translation, lang_code)
        if has_repetition_2:
            print(f"  ❌ 重试后仍有问题: {details_2}")
            return translation, True
        else:
            print(f"  ✅ 重试成功")
            return translation, True

    return translation, False

print("="*80)
print("  改进版测试：句子 4 - 包含重复检测和重试机制")
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

# 获取句子 4（索引 3）
sentence = transcript[3]
original_text = sentence.get('text', '')
existing_translation = sentence.get('translation', {}).copy()

print(f"\n目标句子: {original_text}")
print(f"原有翻译: {list(existing_translation.keys())}")

# 翻译到 16 种新语言（带重试机制）
print(f"\n开始翻译（带重复检测和重试）...")
print("-" * 80)

new_translations = {}
retry_count = 0
retried_langs = []

for lang_code, lang_name in NEW_LANGUAGES:
    print(f"\n→ {lang_name} ({lang_code})", end='', flush=True)

    translation, was_retried = translate_with_retry(original_text, lang_code, lang_name)

    if was_retried:
        retry_count += 1
        retried_langs.append(lang_code)

    new_translations[lang_code] = translation

    # 显示翻译结果（截断长文本）
    preview = translation[:40] + '...' if len(translation) > 40 else translation
    print(f"\n  结果: {preview}")

    time.sleep(0.5)  # API 限流

# 合并翻译（增量更新）
merged_translation = {**existing_translation, **new_translations}

# 显示完整结果
print("\n" + "="*80)
print("  📋 合并后的完整翻译（19 种语言）")
print("="*80)
print(json.dumps(merged_translation, ensure_ascii=False, indent=2))

# 验证总结
print("\n" + "="*80)
print("  验证总结")
print("="*80)

print(f"✓ 语言总数: {len(merged_translation)} 种")
print(f"✓ 翻译键: {sorted(merged_translation.keys())}")
print(f"✓ 重试次数: {retry_count}")
print(f"✓ 重试语言: {retried_langs if retried_langs else '无'}")

# 重点检查蒙古语
print(f"\n蒙古语 (mn) 详细检查:")
mn_translation = merged_translation.get('mn', '')
has_rep, details = detect_repetition(mn_translation, 'mn')
if has_rep:
    print(f"  ❌ 仍有问题: {details}")
    print(f"  内容: {mn_translation}")
else:
    print(f"  ✅ 检测通过: {details}")
    print(f"  内容: {mn_translation[:80]}{'...' if len(mn_translation) > 80 else ''}")

# 确认原有翻译
print(f"\n原有翻译确认:")
print(f"  zh: {merged_translation.get('zh', 'N/A')}")
print(f"  zh_hant: {merged_translation.get('zh_hant', 'N/A')}")
print(f"  vi: {merged_translation.get('vi', 'N/A')}")

print("\n✓ 测试完成")
print("="*80)
