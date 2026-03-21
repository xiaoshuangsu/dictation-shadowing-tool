#!/usr/bin/env python3
"""
修复数据库中带空格的连字符词

问题：数据库中存储的文本包含带空格的连字符词，如：
- "self -esteem" → 应为 "self-esteem"
- "t -shirt" → 应为 "t-shirt"
- "co -workers" → 应为 "co-workers"

修复方案：
1. 查找所有 materials 表中的 transcript
2. 识别并修复带空格的连字符词
3. 更新数据库

环境变量：
- SUPABASE_URL: Supabase 项目 URL
- SUPABASE_SERVICE_ROLE_KEY: Supabase 服务角色密钥
"""
import os
import re
from supabase import create_client, Client

# Supabase 配置（从环境变量读取）
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://cuxotlijjnxbsirpdkgr.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')


def fix_hyphen_spacing():
    """修复带空格的连字符词"""

    # 创建 Supabase 客户端
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("🔍 正在查询数据库...")

    # 查询所有素材
    response = supabase.table('materials').select('id,title,transcript').execute()

    print(f"📦 找到 {len(response.data)} 个素材")

    # 统计
    total_fixed = 0
    materials_updated = []

    for material in response.data:
        material_id = material['id']
        title = material['title']
        transcript = material.get('transcript', [])

        has_changes = False
        new_transcript = []

        for sentence in transcript:
            text = sentence.get('text', '')
            if not text:
                new_transcript.append(sentence)
                continue

            original_text = text

            # 修复模式：word -word 或 word- word 或 word - word → word-word
            # 使用正则表达式识别并修复
            # 模式1：字母 + 空格 + - + 字母 → 字母-字母
            text = re.sub(r'([a-zA-Z0-9])\s+-\s*([a-zA-Z0-9])', r'\1-\2', text)

            if text != original_text:
                has_changes = True
                print(f"\n🔧 修复: {title}")
                print(f"   原文: {original_text[:100]}...")
                print(f"   修复: {text[:100]}...")

            # 更新句子
            new_sentence = sentence.copy()
            new_sentence['text'] = text
            new_transcript.append(new_sentence)

        if has_changes:
            # 更新数据库
            try:
                supabase.table('materials').update({
                    'transcript': new_transcript
                }).eq('id', material_id).execute()

                total_fixed += 1
                materials_updated.append({
                    'id': material_id,
                    'title': title
                })

                print(f"✅ 已更新: {title}")

            except Exception as e:
                print(f"❌ 更新失败: {title}")
                print(f"   错误: {e}")

    # 打印总结
    print("\n" + "="*80)
    print("📊 修复总结")
    print("="*80)
    print(f"更新的素材数量: {total_fixed}")
    print(f"更新的素材列表:")
    for material in materials_updated:
        print(f"  - {material['title']}")


if __name__ == '__main__':
    print("="*80)
    print("修复数据库中带空格的连字符词")
    print("="*80)

    # 确认操作
    confirm = input("\n⚠️  此操作将修改数据库中的 transcript 数据。确认继续？(yes/no): ")
    if confirm.lower() != 'yes':
        print("❌ 操作已取消")
        exit(0)

    fix_hyphen_spacing()

    print("\n✅ 修复完成！")
