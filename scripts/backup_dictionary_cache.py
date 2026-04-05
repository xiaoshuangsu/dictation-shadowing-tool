#!/usr/bin/env python3
"""
备份 dictionary_cache 表
导出结构和数据到 SQL 文件
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict
from supabase import create_client

# 加载环境变量
env_path = Path('/Users/a/dictation/.env.local')
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

# Supabase 配置
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_KEY:
    print("❌ 错误: 未找到 SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

print("🔗 连接 Supabase...")
client = create_client(SUPABASE_URL, SUPABASE_KEY)
print("✅ 连接成功\n")

# 备份目录
backup_dir = Path('/Users/a/dictation/backups')
backup_dir.mkdir(exist_ok=True)

# 生成备份文件名（带日期）
date_str = datetime.now().strftime('%Y%m%d')
backup_file = backup_dir / f'dictionary_cache_backup_{date_str}.sql'

print("=" * 70)
print("dictionary_cache 表备份")
print("=" * 70)
print(f"📁 备份文件: {backup_file}")
print()

# 获取所有数据
print("📖 正在获取数据...")
try:
    response = client.table('dictionary_cache').select('*').execute()

    if not response.data:
        print("⚠️  表为空或不存在")
        # 仍然创建备份文件（结构信息）
        with open(backup_file, 'w', encoding='utf-8') as f:
            f.write(f"-- dictionary_cache 表备份\n")
            f.write(f"-- 日期: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"-- 来源: {SUPABASE_URL}\n")
            f.write(f"-- 状态: 表为空或不存在\n")
        print(f"✅ 空表备份已创建: {backup_file}")
        sys.exit(0)

    records = response.data
    print(f"✅ 获取到 {len(records)} 条记录")

except Exception as e:
    print(f"❌ 获取数据失败: {e}")
    sys.exit(1)

# 生成 SQL 备份文件
print(f"💾 正在生成 SQL 备份文件...")

with open(backup_file, 'w', encoding='utf-8') as f:
    # 写入头部信息
    f.write(f"-- dictionary_cache 表备份\n")
    f.write(f"-- 日期: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    f.write(f"-- 来源: {SUPABASE_URL}\n")
    f.write(f"-- 记录数: {len(records)}\n")
    f.write(f"-- \n")
    f.write(f"-- 注意: 这是数据备份，不包含表结构定义\n")
    f.write(f"-- \n")
    f.write(f"-- 如需恢复，请使用 Supabase Dashboard 或 API\n")
    f.write(f"-- \n")
    f.write(f"BEGIN;\n\n")

    # 写入每条记录的 INSERT 语句
    for i, record in enumerate(records, 1):
        word = (record.get('word') or '').replace("'", "''")
        phonetic = (record.get('phonetic') or '').replace("'", "''")
        hit_count = record.get('hit_count', 0) or 0

        # 处理 definitions 字段（JSONB）
        definitions = record.get('definitions') or {}
        if definitions:
            definitions_json = json.dumps(definitions).replace("'", "''")
        else:
            definitions_json = '{}'

        example = (record.get('example') or '').replace("'", "''")
        audio_url_us = (record.get('audio_url_us') or '').replace("'", "''")
        audio_url_uk = (record.get('audio_url_uk') or '').replace("'", "''")

        # 生成 INSERT 语句
        f.write(f"-- 记录 {i}/{len(records)}\n")
        f.write(f"INSERT INTO dictionary_cache (word, phonetic, definitions, example, audio_url_us, audio_url_uk, hit_count) VALUES (\n")
        f.write(f"  '{word}',\n")
        f.write(f"  '{phonetic}',\n")
        f.write(f"  '{definitions_json}'::jsonb,\n")
        f.write(f"  '{example}',\n")
        f.write(f"  '{audio_url_us}',\n")
        f.write(f"  '{audio_url_uk}',\n")
        f.write(f"  {hit_count}\n")
        f.write(f");\n\n")

        # 每 100 条记录显示一次进度
        if i % 100 == 0:
            print(f"  处理中: {i}/{len(records)}")

    f.write("COMMIT;\n")
    f.write(f"\n-- 备份完成: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

# 检查文件大小
file_size = backup_file.stat().st_size
print(f"✅ 备份文件已生成: {backup_file}")
print(f"📊 文件大小: {file_size:,} bytes ({file_size/1024/1024:.2f} MB)")

# 验证文件内容
print(f"\n🔍 验证备份内容...")
with open(backup_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()
    insert_count = sum(1 for line in lines if 'INSERT INTO' in line)

print(f"  - 总行数: {len(lines)}")
print(f"  - INSERT 语句: {insert_count}")

if insert_count == len(records):
    print(f"✅ 验证成功: 所有 {len(records)} 条记录都已备份")
else:
    print(f"⚠️  警告: INSERT 语句数量 ({insert_count}) 与记录数量 ({len(records)}) 不匹配")

print("\n" + "=" * 70)
print("🎉 备份完成！")
print("=" * 70)
