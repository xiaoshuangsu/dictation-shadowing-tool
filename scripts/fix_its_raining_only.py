#!/usr/bin/env python3
"""
只修复 It's Raining 的音频路径
按照 guide.md 规范：静默执行 + 简洁汇总
"""
import os
import sys

try:
    from supabase import create_client
except ImportError:
    sys.exit(1)

# Supabase 配置
SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_KEY:
    print('❌ 错误: 请设置环境变量 SUPABASE_SERVICE_ROLE_KEY')
    sys.exit(1)

def main():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 只修复 It's Raining
    try:
        result = supabase.table('materials').update({
            'audio_path': 'audio/its-raining.mp3'
        }).eq('slug', 'its-raining').execute()
        print("✅ 修复成功")
    except Exception as e:
        print(f"❌ 修复失败: {e}")

if __name__ == '__main__':
    main()
