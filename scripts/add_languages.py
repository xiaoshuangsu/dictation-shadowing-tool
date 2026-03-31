#!/usr/bin/env python3
"""
添加新的 16 种语言到 supported_languages 表
"""
import os
from pathlib import Path
from supabase import create_client

def load_env():
    env_path = Path(__file__).parent.parent / '.env.local'
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

load_env()

client = create_client(
    os.environ.get('NEXT_PUBLIC_SUPABASE_URL'),
    os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
)

# 新增的 16 种语言
NEW_LANGUAGES = [
    {'code': 'ar', 'name': 'Arabic', 'native_name': 'العربية', 'is_active': True, 'priority': 4},
    {'code': 'de', 'name': 'German', 'native_name': 'Deutsch', 'is_active': True, 'priority': 5},
    {'code': 'es', 'name': 'Spanish', 'native_name': 'Español', 'is_active': True, 'priority': 6},
    {'code': 'ja', 'name': 'Japanese', 'native_name': '日本語', 'is_active': True, 'priority': 7},
    {'code': 'ms', 'name': 'Malay', 'native_name': 'Bahasa Melayu', 'is_active': True, 'priority': 8},
    {'code': 'ru', 'name': 'Russian', 'native_name': 'Русский', 'is_active': True, 'priority': 9},
    {'code': 'tr', 'name': 'Turkish', 'native_name': 'Türkçe', 'is_active': True, 'priority': 10},
    {'code': 'el', 'name': 'Greek', 'native_name': 'Ελληνικά', 'is_active': True, 'priority': 11},
    {'code': 'id', 'name': 'Indonesian', 'native_name': 'Bahasa Indonesia', 'is_active': True, 'priority': 12},
    {'code': 'ko', 'name': 'Korean', 'native_name': '한국어', 'is_active': True, 'priority': 13},
    {'code': 'pt', 'name': 'Portuguese', 'native_name': 'Português', 'is_active': True, 'priority': 14},
    {'code': 'th', 'name': 'Thai', 'native_name': 'ภาษาไทย', 'is_active': True, 'priority': 15},
    {'code': 'uk', 'name': 'Ukrainian', 'native_name': 'Українська', 'is_active': True, 'priority': 16},
    {'code': 'bn', 'name': 'Bengali', 'native_name': 'বাংলা', 'is_active': True, 'priority': 17},
    {'code': 'mn', 'name': 'Mongolian', 'native_name': 'Монгол', 'is_active': True, 'priority': 18},
    {'code': 'hi', 'name': 'Hindi', 'native_name': 'हिन्दी', 'is_active': True, 'priority': 19},
]

print("="*60)
print("  添加新的 16 种语言到 supported_languages 表")
print("="*60)

# 逐个添加
success_count = 0
failed_count = 0

for lang in NEW_LANGUAGES:
    print(f"\n添加: {lang['native_name']} ({lang['code']})...", end='', flush=True)

    try:
        result = client.table('supported_languages').insert(lang).execute()

        if result.data:
            print(f" ✓ 成功")
            success_count += 1
        else:
            print(f" ✗ 失败（无返回数据）")
            failed_count += 1

    except Exception as e:
        error_msg = str(e)

        # 检查是否是唯一性约束错误（语言已存在）
        if 'duplicate' in error_msg.lower() or 'unique' in error_msg.lower():
            print(f" ⏭️  已存在")
        else:
            print(f" ✗ 失败: {error_msg}")
            failed_count += 1

print("\n" + "="*60)
print(f"  完成")
print("="*60)
print(f"成功: {success_count}")
print(f"失败: {failed_count}")
print("="*60)

# 验证
print("\n验证：查询所有语言...")
result = client.table('supported_languages').select('*').execute()
if result.data:
    print(f"总计: {len(result.data)} 种语言")
    for lang in result.data:
        status = "✓" if lang['is_active'] else "✗"
        print(f"  {status} {lang['native_name']} ({lang['code']})")
