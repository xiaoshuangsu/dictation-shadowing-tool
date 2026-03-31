#!/usr/bin/env python3
"""
实时监控翻译进度
"""
import os
import json
from pathlib import Path
from supabase import create_client
from datetime import datetime

# 加载环境变量
def load_env():
    env_path = Path(__file__).parent.parent / '.env.local'
    if not env_path.exists():
        raise FileNotFoundError(f".env.local 不存在: {env_path}")
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

load_env()

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

ALL_LANGUAGES = [
    'zh', 'zh_hant', 'vi', 'ar', 'de', 'es', 'ja', 'ms', 'ru', 'tr',
    'el', 'id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi'
]

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# 获取所有素材
result = client.table('materials').select('id, title, transcript').execute()
materials = result.data

# 统计完成状态
complete_count = 0
incomplete_count = 0
no_transcript = 0

for material in materials:
    transcript = material.get('transcript')
    if isinstance(transcript, str):
        transcript = json.loads(transcript)

    if not transcript or len(transcript) == 0:
        no_transcript += 1
        continue

    first_translation = transcript[0].get('translation', {})
    if all(lang in first_translation for lang in ALL_LANGUAGES):
        complete_count += 1
    else:
        incomplete_count += 1

print("="*60)
print(f"  翻译进度监控")
print(f"  时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("="*60)
print(f"总素材数: {len(materials)}")
print(f"✅ 已完成 (19语): {complete_count}")
print(f"🔄 处理中: {incomplete_count}")
print(f"⚠️  无字幕: {no_transcript}")
print(f"完成率: {complete_count / len(materials) * 100:.1f}%")
print("="*60)
