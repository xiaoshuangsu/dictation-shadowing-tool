#!/usr/bin/env python3
"""
扫描并修复 "come on" 的语境翻译错误
"""

import os
import sys
import json
import re
from pathlib import Path
from typing import List, Dict, Set, Tuple
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
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")


def scan_materials_with_come_on(supabase_client) -> List[Dict]:
    """
    扫描所有素材，找出包含 "come on" 的素材
    """
    print("🔍 正在扫描数据库...")

    result = supabase_client.table('materials').select('id, title, slug, transcript').execute()
    materials = result.data

    materials_with_come_on = []

    for material in materials:
        transcript = material.get('transcript', [])
        if not transcript:
            continue

        # 检查 transcript 中是否包含 "come on"（不区分大小写，使用单词边界）
        pattern = re.compile(r'\bcome on\b', re.IGNORECASE)
        for sent in transcript:
            text = sent.get('text', '')
            if pattern.search(text):
                materials_with_come_on.append(material)
                break

    return materials_with_come_on


def extract_translations_before_after(transcript: List[Dict], target_sentence: str) -> Tuple[List[str], List[str]]:
    """
    提取修正前后的翻译
    """
    before_translations = []
    after_translations = []

    for sent in transcript:
        text = sent.get('text', '')
        # 只提取包含 "come on" 的句子翻译
        if 'come on' in text.lower():
            trans = sent.get('translation', {})
            zh = trans.get('zh', '') if isinstance(trans, dict) else trans
            before_translations.append(zh)

    return before_translations, after_translations


def fix_single_sentence(original_en: str, bad_translation: str, video_title: str) -> Optional[str]:
    """
    修复单个句子的 "come on" 翻译
    """
    url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

    headers = {
        "Authorization": f"Bearer {GLM_API_KEY}",
        "Content-Type": "application/json"
    }

    retry_prompt = f"""请修复以下翻译中的语境错误：

原文：{original_en}
错误翻译：{bad_translation}
视频标题：{video_title}

⚠️ 语境情绪纠错规则：
- Come on (不相信/嘲讽语气) → "得了吧"、"别逗了"、"别装了"
- ❌ 严禁翻译为："快点儿"、"来吧"、"加油"

语境示例：
- Come on, you don't believe that. → "得了吧，你又不信。"
- Come on, be serious! → "别逗了，认真点！"
- Oh, come on! → "得了吧！"

请根据上下文选择最合适的翻译（"得了吧"、"别逗了"或"别装了"），只返回翻译结果："""

    payload = {
        "model": "glm-4-flash",
        "messages": [
            {"role": "user", "content": retry_prompt}
        ],
        "temperature": 0.2,
        "max_tokens": 200
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        result = response.json()

        if 'choices' in result and len(result['choices']) > 0:
            translation = result['choices'][0]['message']['content'].strip()
            # 清理方括号
            translation = translation.replace('[', '').replace(']', '')
            return translation
        return bad_translation  # 保持原翻译
    except:
        return bad_translation


def process_material(material: Dict, supabase_client) -> Dict:
    """
    处理单个素材，修复 "come on" 翻译
    """
    material_id = material['id']
    title = material['title']
    slug = material['slug']
    transcript = material.get('transcript', [])

    print(f"\n{'─'*80}")
    print(f"🎬 {title}")
    print(f"📝 Slug: {slug}")
    print(f"{'─'*80}")

    updated_transcript = []
    fix_count = 0
    comparisons = []

    for sent in transcript:
        text = sent.get('text', '')
        sent_copy = sent.copy()

        # 检查是否包含 "come on"（使用单词边界精确匹配）
        pattern = re.compile(r'\bcome on\b', re.IGNORECASE)
        if pattern.search(text):
            trans = sent_copy.get('translation', {})
            old_zh = trans.get('zh', '') if isinstance(trans, dict) else trans

            # 修复翻译
            new_zh = fix_single_sentence(text, old_zh, title)

            if new_zh != old_zh:
                fix_count += 1
                comparisons.append({
                    'en': text,
                    'old_zh': old_zh,
                    'new_zh': new_zh
                })
                print(f"   ✅ 修正 {fix_count}:")
                print(f"      EN: {text}")
                print(f"      旧: {old_zh}")
                print(f"      新: {new_zh}")

                sent_copy['translation'] = {"zh": new_zh}

        updated_transcript.append(sent_copy)

    # 写入数据库
    if fix_count > 0:
        try:
            supabase_client.table('materials').update({
                'transcript': updated_transcript
            }).eq('id', material_id).execute()

            print(f"\n✅ 完成 | 修正: {fix_count} 句")
            return {
                'success': True,
                'fix_count': fix_count,
                'comparisons': comparisons
            }
        except Exception as e:
            print(f"\n❌ 数据库更新失败: {str(e)[:100]}")
            return {
                'success': False,
                'error': str(e)
            }
    else:
        print(f"\nℹ️  未发现需要修正的翻译")
        return {
            'success': True,
            'fix_count': 0,
            'comparisons': []
        }


def main():
    """主函数"""

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("="*100)
    print("🔍 Come on 语境情绪纠错工具")
    print("="*100)

    # 步骤 1: 扫描包含 "come on" 的素材
    print("\n📋 步骤 1/3: 扫描数据库...")
    materials_with_come_on = scan_materials_with_come_on(supabase)

    print(f"\n📊 扫描结果：")
    print(f"   总素材数: {len(materials_with_come_on)} 个")
    print(f"="*100)

    if not materials_with_come_on:
        print("\n✅ 未发现包含 'come on' 的素材")
        return

    # 打印素材列表
    print(f"\n📝 包含 'come on' 的素材列表：")
    for i, material in enumerate(materials_with_come_on, 1):
        print(f"   {i}. {material['title'][:70]}")
        print(f"      Slug: {material['slug']}")
        print(f"      ID: {material['id']}")

    # 步骤 2: 确认是否继续
    print(f"\n{'='*100}")
    print(f"📋 步骤 2/3: 准备修正...")
    print(f"="*100)
    print(f"\n⚠️  即将修正 {len(materials_with_come_on)} 个素材的 'come on' 翻译")
    print(f"   预计时间: {len(materials_with_come_on) * 5} 秒")

    # 自动继续（不询问用户）

    # 步骤 3: 执行修正
    print(f"\n{'='*100}")
    print(f"📋 步骤 3/3: 执行修正...")
    print(f"="*100)

    all_comparisons = []
    total_fixed = 0

    for idx, material in enumerate(materials_with_come_on):
        current_num = idx + 1
        print(f"\n[{current_num}/{len(materials_with_come_on)}] {material['title'][:60]}")

        result = process_material(material, supabase)

        if result['success']:
            fix_count = result.get('fix_count', 0)
            total_fixed += fix_count
            comparisons = result.get('comparisons', [])
            all_comparisons.extend(comparisons)

            if fix_count > 0:
                print(f"   ✓ 修正了 {fix_count} 句")

    # 打印最终对比结果
    print(f"\n{'='*100}")
    print(f"✅ 修正任务完成")
    print(f"{'='*100}")

    print(f"\n📊 统计结果：")
    print(f"   处理素材数: {len(materials_with_come_on)} 个")
    print(f"   修正句数: {total_fixed} 句")

    if all_comparisons:
        print(f"\n📝 修正前后对比：")
        print(f"{'─'*100}")
        for i, comp in enumerate(all_comparisons, 1):
            print(f"\n{i}. EN: {comp['en']}")
            print(f"   旧: {comp['old_zh']}")
            print(f"   新: {comp['new_zh']}")

    print(f"\n{'='*100}")


if __name__ == "__main__":
    main()
