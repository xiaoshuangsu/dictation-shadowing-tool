#!/usr/bin/env python3
"""
质量评估：对比旧译文与新译文
使用最新的 v19 翻译逻辑重新翻译（内存），不写入数据库
"""
import os
import sys
import json
import random
from pathlib import Path
from typing import List, Dict

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent))

# 加载 .env.local
env_local_path = Path(__file__).parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# 导入翻译脚本的翻译函数
from retranslate_with_glm_v19 import translate_batch

# Supabase 配置
from supabase import create_client
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# 抽检素材 ID
SAMPLE_IDS = [
    "dea0c421-2726-4e99-9930-fe7b426e21e0",  # What time is it
    "f7b5f896-f9ee-47f4-8aba-a999d880736f",  # Thanksgiving (2)
    "86d8e031-1dc0-4b0b-a5c1-50a0601a8dc3"   # April Fool's Day Joke
]

def compare_translations(material_id: str, material_title: str, category: str, transcript: List[Dict]):
    """对比旧译文与新译文"""

    print(f"\n{'='*80}")
    print(f"🔍 对比素材: {material_title}")
    print(f"📂 分类: {category}")
    print(f"{'='*80}\n")

    # 提取文本
    texts = [s.get('text', '').strip() for s in transcript if s.get('text', '').strip()]

    # 获取旧译文
    old_translations = []
    for s in transcript:
        if s.get('text', '').strip():
            trans = s.get('translation')
            zh = trans.get('zh') if isinstance(trans, dict) else (trans or '')
            old_translations.append(zh)

    # 使用最新 v19 脚本重新翻译
    print("⚙️  使用 v19 脚本重新翻译...")
    new_translations = translate_batch(texts, material_title, category, "A1")

    # 对比展示
    differences = []
    for i, (en, old, new) in enumerate(zip(texts, old_translations, new_translations)):
        if old != new:
            differences.append({
                'index': i + 1,
                'en': en,
                'old': old,
                'new': new
            })

    print(f"\n📊 对比结果:")
    print(f"总句子数: {len(texts)}")
    print(f"不同句子数: {len(differences)}")
    print(f"差异率: {len(differences) / len(texts) * 100:.1f}%\n")

    if differences:
        print("🔍 差异详情（前 10 个）:\n")
        for diff in differences[:10]:
            print(f"句{diff['index']}:")
            print(f"  EN: {diff['en'][:80]}...")
            print(f"  旧: {diff['old'][:80]}...")
            print(f"  新: {diff['new'][:80]}...")
            print()

        if len(differences) > 10:
            print(f"... 还有 {len(differences) - 10} 个差异\n")
    else:
        print("✅ 无差异，译文完全一致\n")

    return {
        'material_id': material_id,
        'title': material_title,
        'category': category,
        'total_sentences': len(texts),
        'differences': len(differences),
        'diff_rate': len(differences) / len(texts) if len(texts) > 0 else 0,
        'diff_details': differences
    }

def main():
    """主函数"""
    print("="*100)
    print("🔍 翻译质量评估")
    print("="*100)
    print("\n📋 抽检素材:")
    for i, mid in enumerate(SAMPLE_IDS, 1):
        print(f"  {i}. {mid}")

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    results = []
    for material_id in SAMPLE_IDS:
        # 查询素材
        result = supabase.table('materials').select('*').eq('id', material_id).execute()
        if not result.data:
            print(f"❌ 未找到素材: {material_id}")
            continue

        material = result.data[0]
        transcript = material.get('transcript', [])

        # 对比译文
        comparison = compare_translations(
            material['id'],
            material['title'],
            material['category'],
            transcript
        )
        results.append(comparison)

    # 总结报告
    print("\n" + "="*100)
    print("📊 总结报告")
    print("="*100 + "\n")

    total_sentences = sum(r['total_sentences'] for r in results)
    total_diffs = sum(r['differences'] for r in results)
    avg_diff_rate = sum(r['diff_rate'] for r in results) / len(results)

    print(f"检查素材数: {len(results)}")
    print(f"总句子数: {total_sentences}")
    print(f"差异句子数: {total_diffs}")
    print(f"平均差异率: {avg_diff_rate * 100:.1f}%\n")

    print("📋 各素材详情:")
    for r in results:
        print(f"  [{r['category']}] {r['title']}")
        print(f"    差异率: {r['diff_rate'] * 100:.1f}% ({r['differences']}/{r['total_sentences']} 句)")

    print("\n💡 建议:")
    if avg_diff_rate > 0.3:
        print("  ⚠️  差异率较高（>30%），建议重新翻译")
    elif avg_diff_rate > 0.1:
        print("  ⚠️  差异率中等（10-30%），建议选择性重新翻译")
    else:
        print("  ✅ 差异率较低（<10%），旧译文质量可接受")

    # 保存详细报告
    report = {
        'timestamp': str(Path(__file__).stat().st_mtime),
        'samples': results,
        'summary': {
            'total_materials': len(results),
            'total_sentences': total_sentences,
            'total_diffs': total_diffs,
            'avg_diff_rate': avg_diff_rate
        }
    }

    with open('quality_assessment_report.json', 'w') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n📄 详细报告已保存至: quality_assessment_report.json")

if __name__ == "__main__":
    main()
