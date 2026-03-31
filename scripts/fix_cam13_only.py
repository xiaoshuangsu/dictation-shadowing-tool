#!/usr/bin/env python3
"""
只修复 Cam 13 Academic Listening Test 4 Part 1 的挖空数据
"""
import os
import sys
import json
from pathlib import Path
from supabase import create_client

# 添加 scripts 目录到路径
sys.path.insert(0, str(Path(__file__).parent))

# 导入挖空脚本的函数
from reprocess_ietts_blanks import process_material

# 从 .env.local 加载环境变量
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

# 目标素材
target_slug = "cam-13-academic-listening-test-4-part-1"

print("=" * 70)
print(f"开始修复素材: {target_slug}")
print("=" * 70)
print()

# 调用挖空脚本的函数
success = process_material(target_slug)

print()
print("=" * 70)
if success:
    print("✅ 修复完成！")
    print()
    print("请刷新浏览器查看效果：")
    print("http://localhost:3000/topics/ielts-listening/cam-13-academic-listening-test-4-part-1")
else:
    print("❌ 修复失败！")
