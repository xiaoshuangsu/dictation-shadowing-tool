#!/usr/bin/env python3
"""
实时监控翻译进度（每 30 秒刷新一次）
"""
import os
import json
import time
from pathlib import Path
from supabase import create_client
from datetime import datetime

def load_env():
    env_path = Path(__file__).parent.parent / '.env.local'
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

print("="*60)
print("  实时监控翻译进度")
print("  每 30 秒刷新一次")
print("="*60)

last_complete = 0

while True:
    result = client.table('materials').select('id, title, transcript').execute()
    materials = result.data

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

    now = datetime.now()
    elapsed = now - now.replace(hour=9, minute=46, second=28)  # 从启动时间开始计算

    print(f"\n[{now.strftime('%H:%M:%S')}] 已运行: {int(elapsed.total_seconds() // 60)} 分钟")
    print(f"✅ 已完成: {complete_count}/308 ({complete_count/308*100:.1f}%)")
    print(f"🔄 处理中: {incomplete_count}")

    if complete_count > last_complete:
        new_count = complete_count - last_complete
        print(f"📈 自上次检查新增: {new_count} 个")
        last_complete = complete_count

    print("-"*60)

    if complete_count >= 308:
        print("\n🎉 所有素材翻译完成！")
        break

    time.sleep(30)
