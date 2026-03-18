#!/usr/bin/env python3
"""
获取失败素材的 ID 列表
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

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# 失败素材列表（排除 Empty Your Mind）
failed_titles = [
    'The Lion And The Mouse',
    'What lack of sleep does to the teenage brain - Wendy Troxel',
    'The Bear and the Bee - US English accent (TheFableCottage.com)',
    'The Crane of Gratitude Japanese Fairy Tales in English',
    'Cam 12 Academic Listening Test 2 Part 1',
    'Do you really need to take 10,000 steps a day? - Shannon Odell',
    "Jessica's First Day of School",
    'The Wind and the Sun - UK English accent (TheFableCottage.com)',
    'What happens to your brain without any social contact? - Terry Kupers',
    'The Fox and the Crow (UK English - TheFableCottage.com)',
    'The Frightened Lion - US English accent (TheFableCottage.com)',
    'Cam 11 Academic Listening Test 3 Part 3',
    'Cam 11 Academic Listening Test 1 Part 2',
    'The Goose That Laid Golden Eggs',
    'Cam 10 Academic Listening Test 4 Part 1',
    'The Goose That Laid The Golden Egg | Short Stories | Aesop\'s fables in English',
    'The Cunning Fox And The Clever Stork'
]

# 获取素材 ID
print('失败素材 ID 列表：\n')
ids = []
for i, title in enumerate(failed_titles, 1):
    result = supabase.table('materials').select('id, title').filter('title', 'ilike', f'%{title}%').execute()
    if result.data:
        material = result.data[0]
        ids.append(material['id'])
        print(f'{i}. ID: {material["id"]}')
        print(f'   {material["title"][:70]}')
        print()

# 输出为可用的格式
print('\n' + '='*80)
print('可用的 ID 列表（用于批量翻译）：')
print('[')
for id in ids:
    print(f'  "{id}",')
print(']')
