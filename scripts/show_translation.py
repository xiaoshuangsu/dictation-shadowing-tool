#!/usr/bin/env python3
"""展示三语对比"""
from supabase import create_client
import os
from pathlib import Path

# 加载 .env.local
env_local_path = Path(__file__).parent.parent / '.env.local'
with open(env_local_path, 'r') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# 查找 IELTS 素材
result = supabase.table('materials').select('*').ilike('title', '%IELTS%').execute()

if result.data:
    material = result.data[0]
    print('\n' + '='*80)
    print('📌 验收：雅思素材三语对比')
    print('='*80)
    print('📂 素材：' + material['title'])
    print('📂 分类：' + material.get('category', 'N/A'))
    print('🎯 难度：' + material.get('difficulty', 'N/A'))
    print('='*80)

    count = 0
    for sent in material['transcript']:
        if sent.get('text') and sent.get('translation'):
            trans = sent['translation']
            zh = trans.get('zh', '')
            zh_hant = trans.get('zh_hant', '')
            vi = trans.get('vi', '')

            if zh and zh_hant and count < 3:
                count += 1
                print('\n🔤 第 ' + str(count) + ' 句')
                print('─'*80)
                print('📖 英文: ' + sent['text'])
                print('🇨🇳 简体: ' + zh)
                print('🇹🇼 繁体: ' + zh_hant)
                if vi:
                    print('🇻🇳 越南: ' + vi)

    print('\n' + '='*80)
    print('✅ 验收完成')
    print('='*80)
