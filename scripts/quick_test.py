#!/usr/bin/env python3
"""
快速测试：只处理前 3 个素材
"""
import os
import json
import sys
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

print("="*60)
print("  快速测试：前 3 个素材")
print("="*60)

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# 获取前 3 个素材
result = client.table('materials').select('id, slug, title, transcript').limit(3).execute()

if not result.data:
    print("❌ 没有获取到素材")
    sys.exit(1)

materials = result.data
print(f"✓ 获取了 {len(materials)} 个素材")

for i, material in enumerate(materials, 1):
    print(f"\n[{i}] {material['title']} ({material['slug']})")

    transcript = material.get('transcript')
    if isinstance(transcript, str):
        transcript = json.loads(transcript)

    if not transcript:
        print("  ⚠️  无字幕")
        continue

    # 检查第一句的翻译
    first_trans = transcript[0].get('translation', {})
    print(f"  现有语言: {list(first_trans.keys())}")
    print(f"  语言数量: {len(first_trans)}")

print("\n✓ 测试完成")
