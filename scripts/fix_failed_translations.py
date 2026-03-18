#!/usr/bin/env python3
"""
修复翻译失败的句子（单句翻译模式）
"""

import os
import sys
import json
import time
from pathlib import Path
from typing import List, Dict, Optional
from supabase import create_client
import requests

# 加载 .env.local
env_local_path = Path(__file__).parent.parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# GLM API 配置
GLM_API_KEY = os.environ.get("GLM_API_KEY")

# Supabase 配置
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")


SYSTEM_PROMPT = """你是一位拥有 20 年经验的英汉同声传译专家。请将提供的英文句子翻译成极其地道的中文。

要求：
1. 严禁直译，必须结合语境理解
2. 使用符合中文母语者习惯的表达
3. 保持简洁，不要添加解释

只返回翻译结果，不要有任何其他文字。"""


def translate_single_sentence(text: str) -> Optional[str]:
    """单句翻译"""
    url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

    headers = {
        "Authorization": f"Bearer {GLM_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "glm-4-flash",
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": text
            }
        ],
        "temperature": 0.3,
        "max_tokens": 500
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()

        translation = result['choices'][0]['message']['content'].strip()
        return translation

    except Exception as e:
        print(f"    ❌ 翻译失败: {e}")
        return None


def fix_material_translations(material_title: str, sentence_indices: List[int]):
    """修复指定索引的句子翻译"""
    print(f"🎬 素材: {material_title}")
    print(f"🔧 需要修复的句子: {sentence_indices}\n")

    # 连接 Supabase
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 获取素材
    result = supabase.table('materials').select('*').eq('title', material_title).execute()

    if not result.data:
        print(f"❌ 未找到素材: {material_title}")
        return

    material = result.data[0]
    material_id = material['id']
    transcript = material.get('transcript', [])

    success_count = 0

    for idx in sentence_indices:
        if idx >= len(transcript):
            print(f"⚠️  索引 {idx} 超出范围")
            continue

        sentence = transcript[idx]
        text = sentence.get('text', '').strip()

        print(f"[{idx+1}] {text[:80]}...")

        # 翻译
        translation = translate_single_sentence(text)

        if translation:
            # 更新为 JSONB 格式
            current_translation = sentence.get('translation')

            if isinstance(current_translation, dict):
                current_translation['zh'] = translation
            else:
                sentence['translation'] = {'zh': translation}

            print(f"    ✅ {translation}")
            success_count += 1
        else:
            print(f"    ❌ 翻译失败")

        time.sleep(0.5)

    # 更新数据库
    print(f"\n💾 更新数据库...")
    try:
        supabase.table('materials').update({
            'transcript': transcript
        }).eq('id', material_id).execute()

        print(f"✅ 成功修复 {success_count}/{len(sentence_indices)} 个句子")

    except Exception as e:
        print(f"❌ 更新失败: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("用法:")
        print("  python fix_failed_translations.py '素材标题' 索引1,索引2,...")
        print("\n示例:")
        print("  python fix_failed_translations.py 'Empty Your Mind' 25,26,27,28,29,30,31,32")
        sys.exit(1)

    material_title = sys.argv[1]
    indices = [int(x) for x in sys.argv[2].split(',')]

    fix_material_translations(material_title, indices)
