#!/usr/bin/env python3
"""
合并第 29 和 30 句回一句
"""
import os
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

print(f'当前句数: {len(transcript)}')

# 第 29 句（索引 28）和第 30 句（索引 29）
sent_29 = transcript[28]
sent_30 = transcript[29]

print(f'\n第 29 句原文: {sent_29["text"]}')
print(f'第 30 句原文: {sent_30["text"]}')

# 合并原文
combined_text = sent_29['text'] + ' ' + sent_30['text']

print(f'\n合并后: {combined_text}')

# 合并翻译
trans_29 = sent_29.get('translation', {}).get('zh', '')
trans_30 = sent_30.get('translation', {}).get('zh', '')

print(f'\n第 29 句翻译: {trans_29}')
print(f'第 30 句翻译: {trans_30}')

# 合并翻译
combined_trans = trans_29 + trans_30

print(f'\n合并翻译: {combined_trans}')

# 更新 transcript：合并第 29 和 30 句
# 保留第 29 句的元数据（时间戳等）
transcript[28]['text'] = combined_text
transcript[28]['translation'] = {'zh': combined_trans}

# 删除第 30 句
del transcript[29]

print(f'\n新句数: {len(transcript)}')

# 更新到数据库
supabase.table('materials').update({'transcript': transcript}).eq('id', MATERIAL_ID).execute()

print('\n✅ 已更新到数据库，第 29 和 30 句已合并')
