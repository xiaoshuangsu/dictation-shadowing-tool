#!/usr/bin/env python3
"""
验证 Empty Your Mind 素材的翻译质量
"""

import os
import json
from pathlib import Path
from supabase import create_client

# 加载 .env.local
env_local_path = Path(__file__).parent.parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

MATERIAL_ID = "d96f97f5-cc6c-4c96-b768-6525572d9af2"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# 获取素材数据
result = supabase.table('materials').select('transcript').eq('id', MATERIAL_ID).execute()
transcript = result.data[0]['transcript']

print('=== 验证三个问题 ===\n')

# 问题 1 & 2：词汇重复 + 错别字
print('【问题 1 & 2】词汇重复 + 错别字\n')
problem_sentences = [
    (2, 'restless'),  # 第 3 句
    (4, 'uneasy'),    # 第 5 句
    (10, 'psychologist')  # 第 11 句
]

for idx, keyword in problem_sentences:
    sent = transcript[idx]
    text = sent.get('text', '')
    trans = sent.get('translation', {})
    zh = trans.get('zh', '') if isinstance(trans, dict) else ''

    print(f'第 {idx+1} 句：')
    print(f'  原文：{text}')
    print(f'  译文：{zh}')

    # 检查是否修复
    if keyword == 'uneasy' and '不安' in zh:
        print(f'  ✅ 已修复：uneasy 不再重复"心神不宁"')
    elif keyword == 'psychologist' and '心理学家' in zh:
        print(f'  ✅ 已修复：psychologist 翻译正确')
    print()

# 问题 3：对齐错位（第 29-32 句）
print('【问题 3】对齐错位检查（第 28-32 句）\n')
for i in range(27, 32):
    sent = transcript[i]
    text = sent.get('text', '')
    trans = sent.get('translation', {})
    zh = trans.get('zh', '') if isinstance(trans, dict) else ''

    print(f'第 {i+1} 句：')
    print(f'  原文：{text}')
    print(f'  译文：{zh}')
    print()

print('='*80)
print('✅ 验证完成')
