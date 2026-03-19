#!/usr/bin/env python3
"""
扫描并修复 "come on" 的语境翻译错误（V2 - 带语境判断）
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


# 错误修改的映射（用于恢复）
ERROR_FIXES = {
    "5f7d4543-0209-42c4-bbde-dd18799c727c": {
        "text": "Come on.",
        "wrong": "得了吧",
        "correct": "来吧。"
    },
    "c3c9e82d-b867-4603-851d-0b51ccd09851": {
        "text": "Oh, come on, Harry.",
        "wrong": "得了吧",
        "correct": "哎呀，别闹了，哈利。"
    },
    "5f365990-100a-4587-b751-0eb204c662ab": {
        "text": "Come on, Peter.",
        "wrong": "得了吧",
        "correct": "快点儿，彼得。"
    },
    "b23a974d-133b-46b2-8b1f-c2a596162492": {
        "text": "Come on!",
        "wrong": "别逗了",
        "correct": "快点儿！"
    },
    "efd1ff93-5da5-4b83-a0f8-06f778e33ad5": {
        "text": "Come on the radio.",
        "wrong": "得了吧",
        "correct": "在广播里播放。"
    },
    "a14f100d-d4eb-4d0a-90c2-39cba4496629": {
        "text": "Come on!",
        "wrong": "别逗了",
        "correct": "哎呀！"
    },
    "3e497669-a4e7-4dc0-bc46-bf73b3ac341f": {
        "text": "You feel a second wind come on.",
        "wrong": "别逗了。",
        "correct": "你感觉来了第二股劲。"
    },
    "62624d40-fcaf-4105-8102-135b3ba4bce7": {
        "text": "Though it wasn't until the Industrial Revolution...",
        "wrong": "得了吧",
        # 这个应该保持原翻译
        "correct": "直到工业革命时期，对各种金属的需求激增，曼哈姆才扩大成为全国最繁忙的港口之一。"
    },
    "8b12eb34-01a3-4b3d-8514-1d751f65bd30": {
        "text": "Since this study, direct cash giving has become...",
        "wrong": "别逗了",
        # 这个应该保持原翻译
        "correct": "自从这项研究以来，直接现金赠予已成为最被研究的减贫干预措施之一，并且它的一致显示出的影响往往超过了传统的援助计划。"
    }
}


def should_skip_context(text: str) -> Tuple[bool, str]:
    """
    判断是否应该跳过这个句子（非口语语境）

    返回: (是否跳过, 原因)
    """
    text_lower = text.lower()

    # 情况1: "come on" + the + 地点/媒体 = 字面意思（如在广播里播放）
    if re.search(r'\bcome on\b.*(the (radio|tv|television|internet|stage|air))', text_lower):
        return True, "字面意思（在...播放）"

    # 情况2: "come on" 作为"来临/开始"（如 second wind come on）
    if re.search(r'\w+\s+come on\b', text_lower):
        # 检查前面的词是否是名词或动词（表示某种状态来临）
        preceding_match = re.search(r'(\w+(?:\s+\w+)?)\s+come on\b', text_lower)
        if preceding_match:
            preceding = preceding_match.group(1)
            # 常见的表示"来临"的词
            if any(word in preceding for word in ['wind', 'wave', 'feeling', 'pain', 'urge', 'attack', 'spell']):
                return True, "表示状态来临"

    # 情况3: 长句中的"become one"等
    if 'become one' in text_lower or 'become' in text_lower:
        return True, "包含 become（误匹配）"

    return False, ""


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


def restore_wrong_fixes(supabase_client) -> int:
    """
    恢复之前被错误修改的数据
    """
    print("\n📋 步骤 1/4: 恢复错误修改...")

    restore_count = 0

    for material_id, fix_info in ERROR_FIXES.items():
        try:
            # 获取素材
            result = supabase_client.table('materials').select('transcript').eq('id', material_id).execute()
            if not result.data:
                continue

            transcript = result.data[0]['transcript']
            updated = False

            # 查找并恢复
            for sent in transcript:
                if sent.get('text', '') == fix_info['text']:
                    trans = sent.get('translation', {})
                    zh = trans.get('zh', '') if isinstance(trans, dict) else trans

                    if zh == fix_info['wrong']:
                        sent['translation'] = {"zh": fix_info['correct']}
                        updated = True
                        print(f"   ✅ 恢复: {fix_info['text'][:50]}")
                        print(f"      从: {fix_info['wrong']}")
                        print(f"      到: {fix_info['correct']}")

            if updated:
                supabase_client.table('materials').update({
                    'transcript': transcript
                }).eq('id', material_id).execute()
                restore_count += 1

        except Exception as e:
            print(f"   ⚠️  恢复失败 {material_id}: {str(e)[:50]}")

    print(f"\n✅ 恢复完成: {restore_count} 个")
    return restore_count


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
- Come on (不相信/嘲讽/催促语气) → "得了吧"、"别逗了"、"别装了"、"快点儿"
- ❌ 严禁翻译为："来吧"、"加油"

语境示例（整蛊/对话场景）：
- Come on, you don't believe that. → "得了吧，你又不信。"
- Come on, be serious! → "别逗了，认真点！"
- Come on, Peter! → "快点儿，彼得！"（催促）
- Oh, come on! → "得了吧！"（不相信）

请根据上下文选择最合适的翻译，只返回翻译结果："""

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

        # 检查是否包含 "come on"
        pattern = re.compile(r'\bcome on\b', re.IGNORECASE)
        if pattern.search(text):
            # 检查是否应该跳过
            should_skip, reason = should_skip_context(text)

            if should_skip:
                print(f"   ⏭️  跳过: {text[:60]}")
                print(f"      原因: {reason}")
                updated_transcript.append(sent_copy)
                continue

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
    print("🔍 Come on 语境情绪纠错工具 V2")
    print("="*100)

    # 步骤 1: 恢复错误修改
    restore_count = restore_wrong_fixes(supabase)

    # 步骤 2: 扫描包含 "come on" 的素材
    print(f"\n📋 步骤 2/4: 扫描数据库...")
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

    # 步骤 3: 确认是否继续
    print(f"\n{'='*100}")
    print(f"📋 步骤 3/4: 准备修正...")
    print(f"="*100)
    print(f"\n⚠️  即将修正 {len(materials_with_come_on)} 个素材的 'come on' 翻译")
    print(f"   预计时间: {len(materials_with_come_on) * 5} 秒")

    # 步骤 4: 执行修正
    print(f"\n{'='*100}")
    print(f"📋 步骤 4/4: 执行修正...")
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
    print(f"   恢复错误修改: {restore_count} 个")
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
