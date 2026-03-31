#!/usr/bin/env python3
"""
修正特定雅思素材的翻译文字
仅修改指定句子的简体中文翻译
"""

import os
import json
from supabase import create_client

# Supabase 配置
SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co'

# 从环境变量读取 Service Role Key
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
if not SUPABASE_KEY:
    # 尝试从 .env.local 读取
    try:
        with open('.env.local', 'r') as f:
            for line in f:
                if line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
                    SUPABASE_KEY = line.split('=', 1)[1].strip()
                    break
    except:
        pass

if not SUPABASE_KEY:
    print("❌ 无法获取 SUPABASE_SERVICE_ROLE_KEY")
    exit(1)

print(f"✅ Supabase 连接已建立")

# 初始化客户端
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ============================================================================
# 定义修正配置
# ============================================================================

CORRECTIONS = [
    {
        'title': 'Cam 12 Academic Listening Test 1 Part 1',
        'target_text': "Well, there's also a 40-minute trek round the farm on a horse if he wants.",
        'new_translation_zh': '此外，如果他想的话，还可以骑马在农场周围进行40分钟的徒步旅行。'
    },
    {
        'title': 'Cam 12 Academic Listening Test 2 Part 4',
        'target_text': "For the company, if no effort is made to deal with conflict, it can spiral out of control and even lead to the breakdown of the business.",
        'new_translation_zh': '对于公司来说，如果没有努力去处理冲突，它可能会失控并导致业务的崩溃。'
    }
]

# ============================================================================
# 执行修正
# ============================================================================

print("\n" + "="*80)
print("开始修正翻译...")
print("="*80 + "\n")

modified_count = 0
for idx, correction in enumerate(CORRECTIONS, 1):
    print(f"[{idx}/{len(CORRECTIONS)}] 处理素材: {correction['title']}")

    # 1. 查找素材
    result = supabase.table('materials').select('*').eq('title', correction['title']).execute()

    if not result.data:
        print(f"  ❌ 未找到素材: {correction['title']}")
        continue

    if len(result.data) != 1:
        print(f"  ⚠️  找到 {len(result.data)} 个匹配的素材，预期 1 个")
        continue

    material = result.data[0]
    material_id = material['id']
    print(f"  ✅ 找到素材 ID: {material_id}")

    # 2. 解析 transcript
    transcript = material['transcript']
    if isinstance(transcript, str):
        transcript = json.loads(transcript)

    if not isinstance(transcript, list):
        print(f"  ❌ transcript 格式错误")
        continue

    print(f"  📝 transcript 包含 {len(transcript)} 个句子")

    # 3. 查找目标句子
    target_found = False
    for sentence in transcript:
        if sentence.get('text') == correction['target_text']:
            target_found = True

            # 打印修改前
            old_translation = sentence.get('translation', {})
            old_zh = old_translation.get('zh', 'N/A') if isinstance(old_translation, dict) else 'N/A'
            print(f"  📌 找到目标句子")
            print(f"     原文: {sentence['text'][:80]}...")
            print(f"     旧翻译: {old_zh}")

            # 修改翻译
            if not isinstance(sentence['translation'], dict):
                sentence['translation'] = {}
            sentence['translation']['zh'] = correction['new_translation_zh']

            # 打印修改后
            print(f"     新翻译: {correction['new_translation_zh']}")
            print(f"     ✅ 已修改")
            break

    if not target_found:
        print(f"  ❌ 未找到目标句子: {correction['target_text'][:60]}...")
        continue

    # 4. 更新数据库
    print(f"  💾 正在更新数据库...")
    update_result = supabase.table('materials').update({
        'transcript': transcript
    }).eq('id', material_id).execute()

    if update_result.data:
        print(f"  ✅ 数据库更新成功")
        modified_count += 1

        # 打印修改后的 JSON 片段
        print(f"\n  📋 修改后的完整 JSON 片段:")
        print("  " + "-"*76)
        for sentence in transcript:
            if sentence.get('text') == correction['target_text']:
                json_str = json.dumps(sentence, ensure_ascii=False, indent=2)
                for line in json_str.split('\n'):
                    print(f"  {line}")
                break
        print("  " + "-"*76)
    else:
        print(f"  ❌ 数据库更新失败")

    print()

# ============================================================================
# 最终验证
# ============================================================================

print("="*80)
print("修正完成")
print("="*80)
print(f"\n总修改记录数: {modified_count}")
print(f"预期记录数: {len(CORRECTIONS)}")

if modified_count == len(CORRECTIONS):
    print("\n✅ 修正成功！所有记录已更新")
    exit(0)
else:
    print(f"\n⚠️  警告: 修改记录数 ({modified_count}) 不等于预期 ({len(CORRECTIONS)})")
    print("⚠️  请检查日志，可能未执行提交")
    exit(1)
