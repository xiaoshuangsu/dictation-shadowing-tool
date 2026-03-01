#!/usr/bin/env python3
"""
使用 GLM API 为素材添加中文翻译
"""

import os
import sys
import time
from pathlib import Path
from typing import List, Dict
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


def translate_with_glm(text: str) -> str:
    """使用 GLM API 翻译文本"""
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
                "content": "你是一个专业的英中翻译。请将用户提供的英文句子翻译成中文。要求：1. 准确流畅 2. 符合中文表达习惯 3. 保持原文的语气和风格 4. 只返回翻译结果，不要有任何解释。"
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
        print(f"    ❌ GLM API 翻译失败: {e}")
        return ""


def translate_material(material_title: str, dry_run: bool = False):
    """为单个素材添加翻译"""
    print("=" * 70)
    print(f"  处理素材: {material_title}")
    print("=" * 70)

    # 连接 Supabase
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 获取素材信息
    result = supabase.table('materials').select('*').eq('title', material_title).execute()

    if not result.data:
        print(f"  ❌ 未找到素材: {material_title}")
        return

    material = result.data[0]
    material_id = material['id']
    transcript = material.get('transcript', [])

    if not transcript:
        print(f"  ❌ 素材没有 transcript")
        return

    # 检查翻译情况
    total = len(transcript)
    needs_translation = []

    for i, sentence in enumerate(transcript):
        text = sentence.get('text', '').strip()
        translation = sentence.get('translation')

        if not translation or not translation.strip():
            needs_translation.append((i, text))

    print(f"\n  总共 {total} 句，需要翻译 {len(needs_translation)} 句")

    if not needs_translation:
        print(f"  ✅ 所有句子都有翻译")
        return

    # 显示前几句需要翻译的内容
    print(f"\n  需要翻译的句子（前5句）:")
    for i, (idx, text) in enumerate(needs_translation[:5]):
        print(f"    [{idx+1}] {text}")

    if len(needs_translation) > 5:
        print(f"    ... 还有 {len(needs_translation) - 5} 句")

    if dry_run:
        print(f"\n  ⚠️  干运行模式，不会实际更新数据库")
        return

    # 确认是否继续
    confirm = input(f"\n  是否开始翻译？(yes/no): ")
    if confirm.lower() not in ['yes', 'y']:
        print(f"  ⏭️  跳过")
        return

    # 开始翻译
    print(f"\n  开始翻译...")

    for i, (idx, text) in enumerate(needs_translation):
        print(f"  [{i+1}/{len(needs_translation)}] 翻译第 {idx+1} 句: {text[:50]}...")

        translation = translate_with_glm(text)

        if translation:
            transcript[idx]['translation'] = translation
            print(f"    ✅ 翻译成功: {translation}")
        else:
            print(f"    ❌ 翻译失败")

        # 避免请求过快
        if i < len(needs_translation) - 1:
            time.sleep(0.5)

    # 更新 Supabase
    print(f"\n  更新 Supabase...")
    try:
        update_result = supabase.table('materials').update({
            'transcript': transcript
        }).eq('id', material_id).execute()
        print(f"  ✅ Supabase 已更新")
    except Exception as e:
        print(f"  ❌ 更新 Supabase 失败: {e}")

    print("\n" + "=" * 70)
    print(f"  ✅ 处理完成")
    print("=" * 70)


def list_materials_without_translation():
    """列出所有需要翻译的素材"""
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    result = supabase.table('materials').select('id', 'title', 'transcript').execute()
    materials = result.data

    no_translation = []
    partial_translation = []

    for m in materials:
        transcript = m.get('transcript')
        title = m['title']

        if not transcript or len(transcript) == 0:
            continue

        total = len(transcript)
        with_trans = sum(1 for s in transcript if s.get('translation'))

        if with_trans == 0:
            no_translation.append(title)
        elif with_trans < total:
            partial_translation.append({'title': title, 'with': with_trans, 'total': total})

    print(f"\n需要翻译的素材:")
    print(f"\n没有翻译:")
    for title in no_translation:
        print(f"  - {title}")

    print(f"\n部分翻译:")
    for item in partial_translation:
        print(f"  - {item['title']}: {item['with']}/{item['total']} 句")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法:")
        print("  列出需要翻译的素材:")
        print("    python add_translations_with_glm.py --list")
        print("  为指定素材添加翻译:")
        print("    python add_translations_with_glm.py '素材标题'")
        print("  干运行（不实际更新）:")
        print("    python add_translations_with_glm.py '素材标题' --dry-run")
        sys.exit(1)

    if sys.argv[1] == "--list":
        list_materials_without_translation()
    else:
        material_title = sys.argv[1]
        dry_run = "--dry-run" in sys.argv
        translate_material(material_title, dry_run=dry_run)
