#!/usr/bin/env python3
"""
快速测试脚本 - 只翻译第一个句子，测试 1 种语言
"""
import os
import json
import requests
import time
from pathlib import Path
from supabase import create_client

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
GLM_API_KEY = os.environ.get('GLM_API_KEY')

print("="*80)
print("  快速测试：查询 Corruption 素材")
print("="*80)

# 连接数据库
client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# 查询素材
result = client.table('materials').select('*').eq('slug', 'corruption').execute()

if not result.data:
    print("❌ 素材不存在: corruption")
    exit(1)

material = result.data[0]
transcript = material.get('transcript')
if isinstance(transcript, str):
    transcript = json.loads(transcript)

print(f"✓ 找到素材: {material['title']}")
print(f"✓ 句子数: {len(transcript)}")

# 显示第一句的现有翻译
if transcript and len(transcript) > 0:
    first_sentence = transcript[0]
    existing_translation = first_sentence.get('translation', {})

    print("\n" + "="*80)
    print("  📋 第一句现有翻译")
    print("="*80)
    print(f"英文原文: {first_sentence.get('text', '')}")
    print(f"\n现有翻译键: {list(existing_translation.keys())}")
    print("\n详细内容:")
    print(json.dumps(existing_translation, ensure_ascii=False, indent=2))
    print("="*80)

print("\n✓ 测试完成")
