#!/usr/bin/env python3
"""
恢复空的翻译字段（{"zh": ""}）
使用 GLM API 重新生成翻译
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


def is_empty_translation(translation):
    """检查翻译是否为空"""
    if not translation:
        return True

    # 如果是字符串，检查是否为空
    if isinstance(translation, str):
        return not translation.strip()

    # 如果是字典，检查 zh 字段是否为空
    if isinstance(translation, dict):
        zh = translation.get('zh', '')
        return not zh or zh.strip() == ''

    return True


def restore_material_translations(material_id: str, dry_run: bool = False):
    """恢复单个素材的空翻译"""
    # 连接 Supabase
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 获取素材信息
    result = supabase.table('materials').select('*').eq('id', material_id).execute()

    if not result.data:
        print(f"  ❌ 未找到素材 ID: {material_id}")
        return False

    material = result.data[0]
    title = material.get('title', 'Unknown')
    transcript = material.get('transcript', [])

    if not transcript:
        print(f"  ❌ 素材没有 transcript")
        return False

    # 查找空翻译的句子
    empty_translations = []

    for i, sentence in enumerate(transcript):
        translation = sentence.get('translation')

        if is_empty_translation(translation):
            text = sentence.get('text', '').strip()
            empty_translations.append((i, text))

    if not empty_translations:
        print(f"  ✅ {title}: 所有翻译都正常")
        return True

    print(f"\n  📝 {title}:")
    print(f"     总共 {len(transcript)} 句，需要恢复 {len(empty_translations)} 句")

    if dry_run:
        for i, (idx, text) in enumerate(empty_translations[:3]):
            print(f"       [{idx+1}] {text[:60]}...")
        if len(empty_translations) > 3:
            print(f"       ... 还有 {len(empty_translations) - 3} 句")
        return True

    # 开始翻译
    success_count = 0
    for i, (idx, text) in enumerate(empty_translations):
        print(f"     [{i+1}/{len(empty_translations)}] 翻译: {text[:50]}...")

        translation = translate_with_glm(text)

        if translation:
            # 更新为多语言格式
            transcript[idx]['translation'] = {'zh': translation}
            print(f"       ✅ {translation}")
            success_count += 1
        else:
            print(f"       ❌ 翻译失败")

        # 避免请求过快
        if i < len(empty_translations) - 1:
            time.sleep(0.5)

    # 更新 Supabase
    try:
        supabase.table('materials').update({
            'transcript': transcript
        }).eq('id', material_id).execute()

        print(f"     ✅ 已更新 ({success_count}/{len(empty_translations)} 成功)")
        return success_count == len(empty_translations)

    except Exception as e:
        print(f"     ❌ 更新失败: {e}")
        return False


def restore_all_translations(limit: int = None, dry_run: bool = False):
    """恢复所有素材的空翻译"""
    # 连接 Supabase
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 获取所有素材
    result = supabase.table('materials').select('id', 'title', 'transcript').execute()
    materials = result.data

    print(f"\n📊 扫描 {len(materials)} 个素材...\n")

    # 统计需要修复的素材
    needs_fix = []

    for material in materials:
        material_id = material['id']
        title = material.get('title', 'Unknown')
        transcript = material.get('transcript', [])

        if not transcript:
            continue

        # 检查是否有空翻译
        has_empty = False
        empty_count = 0

        for sentence in transcript:
            translation = sentence.get('translation')
            if is_empty_translation(translation):
                has_empty = True
                empty_count += 1

        if has_empty:
            needs_fix.append({
                'id': material_id,
                'title': title,
                'empty_count': empty_count,
                'total': len(transcript)
            })

    print(f"🔍 发现 {len(needs_fix)} 个素材需要修复\n")

    if limit:
        needs_fix = needs_fix[:limit]
        print(f"⚠️  限制处理前 {limit} 个素材\n")

    if not needs_fix:
        print("✅ 所有素材翻译都正常！")
        return

    # 显示需要修复的素材列表
    print("需要修复的素材:")
    for i, item in enumerate(needs_fix[:10]):
        print(f"  {i+1}. {item['title']} ({item['empty_count']}/{item['total']} 句)")

    if len(needs_fix) > 10:
        print(f"  ... 还有 {len(needs_fix) - 10} 个素材")

    if dry_run:
        print("\n⚠️  干运行模式，不会实际更新")
        return

    # 确认是否继续
    print(f"\n⚠️  将使用 GLM API 重新生成翻译")
    confirm = input(f"\n是否继续？(yes/no): ")

    if confirm.lower() not in ['yes', 'y']:
        print("⏭️  已取消")
        return

    # 开始修复
    print(f"\n🚀 开始修复...\n")

    success_count = 0
    for i, item in enumerate(needs_fix):
        print(f"[{i+1}/{len(needs_fix)}]", end=" ")
        if restore_material_translations(item['id'], dry_run=False):
            success_count += 1

    print(f"\n\n✅ 修复完成！")
    print(f"   成功: {success_count}/{len(needs_fix)}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法:")
        print("  修复所有素材的空翻译:")
        print("    python restore_empty_translations.py --all")
        print("  修复前 N 个素材（测试用）:")
        print("    python restore_empty_translations.py --all --limit 3")
        print("  干运行（只检查，不更新）:")
        print("    python restore_empty_translations.py --all --dry-run")
        print("  修复指定素材:")
        print("    python restore_empty_translations.py <material_id>")
        sys.exit(1)

    dry_run = "--dry-run" in sys.argv

    if sys.argv[1] == "--all":
        limit = None
        if "--limit" in sys.argv:
            limit_idx = sys.argv.index("--limit")
            if limit_idx + 1 < len(sys.argv):
                limit = int(sys.argv[limit_idx + 1])
        restore_all_translations(limit=limit, dry_run=dry_run)
    else:
        material_id = sys.argv[1]
        restore_material_translations(material_id, dry_run=dry_run)
