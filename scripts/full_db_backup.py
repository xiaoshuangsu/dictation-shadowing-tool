#!/usr/bin/env python3
"""
ShadowHub 全量数据库备份脚本

备份目标表：
- dictionary_cache (词典缓存)
- materials (素材元数据)
- user_words (用户生词本)
- practice_records (练习记录)
- user_profiles (用户资料)

备份格式：每张表导出为 CSV 文件，存储在 backups/ 目录

作者：Claude Sonnet 4.5 + Sarah
日期：2026-04-07
版本：V1.0
"""

import os
import sys
import csv
import time
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any

# 第三方库
from dotenv import load_dotenv
from supabase import create_client

# ══════════════════════════════════════════════════════════════════════════════
# 配置与初始化
# ══════════════════════════════════════════════════════════════════════════════

# 加载环境变量
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ 错误：缺少 Supabase 凭证")
    print("请确保 .env.local 中包含 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

# 创建 Supabase 客户端
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# 创建备份目录
backup_dir = Path(__file__).parent.parent / 'backups'
backup_dir.mkdir(exist_ok=True)

# 生成时间戳
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
date_suffix = datetime.now().strftime('%Y%m%d')

# ══════════════════════════════════════════════════════════════════════════════
# 核心函数
# ══════════════════════════════════════════════════════════════════════════════


def export_table_to_csv(table_name: str) -> Dict[str, Any]:
    """
    导出单个表的数据到 CSV 文件

    Args:
        table_name: 表名

    Returns:
        包含统计信息的字典
    """
    print(f"\n{'='*60}")
    print(f"📦 正在导出表: {table_name}")
    print(f"{'='*60}")

    start_time = time.time()
    stats = {
        'table_name': table_name,
        'rows_count': 0,
        'file_path': '',
        'status': 'pending',
        'error': None
    }

    try:
        # 分页获取所有数据（每次最多 1000 条）
        all_data = []
        offset = 0
        limit = 1000

        while True:
            result = supabase.table(table_name).select("*").range(offset, offset + limit - 1).execute()

            if not result.data:
                break

            all_data.extend(result.data)
            offset += limit

            # 如果返回的数据少于 limit，说明已经是最后一页
            if len(result.data) < limit:
                break

        stats['rows_count'] = len(all_data)

        if not all_data:
            print(f"⚠️  表 {table_name} 没有数据")
            stats['status'] = 'empty'
            return stats

        # 生成文件路径
        file_name = f"{table_name}_{date_suffix}.csv"
        file_path = backup_dir / file_name

        # 写入 CSV 文件
        with open(file_path, 'w', newline='', encoding='utf-8') as f:
            if all_data:
                # 获取所有字段名
                fieldnames = list(all_data[0].keys())
                writer = csv.DictWriter(f, fieldnames=fieldnames)

                writer.writeheader()
                writer.writerows(all_data)

        stats['file_path'] = str(file_path)
        stats['status'] = 'success'

        elapsed = time.time() - start_time
        file_size_mb = file_path.stat().st_size / (1024 * 1024)

        print(f"✅ 导出成功")
        print(f"   - 行数: {stats['rows_count']:,}")
        print(f"   - 文件: {file_name}")
        print(f"   - 大小: {file_size_mb:.2f} MB")
        print(f"   - 耗时: {elapsed:.2f} 秒")

    except Exception as e:
        stats['status'] = 'error'
        stats['error'] = str(e)
        print(f"❌ 导出失败: {e}")

    return stats


def verify_backup_integrity(expected_stats: Dict[str, int]) -> bool:
    """
    验证备份完整性

    Args:
        expected_stats: 预期的行数统计

    Returns:
        验证是否通过
    """
    print(f"\n{'='*60}")
    print(f"🔍 验证备份完整性")
    print(f"{'='*60}")

    all_passed = True

    for table_name, expected_min in expected_stats.items():
        file_name = f"{table_name}_{date_suffix}.csv"
        file_path = backup_dir / file_name

        if not file_path.exists():
            print(f"❌ {table_name}: 文件不存在")
            all_passed = False
            continue

        # 读取文件并统计行数（增加字段大小限制以处理大字段）
        import csv
        csv.field_size_limit(1000000)  # 增加到 1MB
        with open(file_path, 'r', encoding='utf-8') as f:
            row_count = sum(1 for _ in csv.DictReader(f)) + 1  # +1 for header

        # 检查是否符合预期
        if expected_min and row_count >= expected_min:
            print(f"✅ {table_name}: {row_count:,} 行 (预期 ≥ {expected_min:,})")
        elif expected_min:
            print(f"⚠️  {table_name}: {row_count:,} 行 (预期 ≥ {expected_min:,})")
            all_passed = False
        else:
            print(f"✅ {table_name}: {row_count:,} 行")

    return all_passed


def generate_backup_report(backup_results: List[Dict[str, Any]]) -> str:
    """
    生成备份报告

    Args:
        backup_results: 备份结果列表

    Returns:
        报告文件路径
    """
    report_path = backup_dir / f"backup_report_{date_suffix}.txt"

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("=" * 70 + "\n")
        f.write("ShadowHub 数据库备份报告\n")
        f.write("=" * 70 + "\n")
        f.write(f"备份时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"备份目录: {backup_dir}\n")
        f.write("\n")

        total_rows = 0
        total_size = 0

        for result in backup_results:
            f.write("-" * 70 + "\n")
            f.write(f"表名: {result['table_name']}\n")
            f.write(f"状态: {result['status']}\n")
            f.write(f"行数: {result['rows_count']:,}\n")

            if result['file_path']:
                file_size = Path(result['file_path']).stat().st_size / (1024 * 1024)
                total_size += file_size
                f.write(f"文件: {Path(result['file_path']).name}\n")
                f.write(f"大小: {file_size:.2f} MB\n")

            if result['error']:
                f.write(f"错误: {result['error']}\n")

            total_rows += result['rows_count']
            f.write("\n")

        f.write("=" * 70 + "\n")
        f.write(f"总计: {len(backup_results)} 张表, {total_rows:,} 行数据, {total_size:.2f} MB\n")
        f.write("=" * 70 + "\n")

    return str(report_path)


# ══════════════════════════════════════════════════════════════════════════════
# 主程序
# ══════════════════════════════════════════════════════════════════════════════

def main():
    """主函数"""
    print("\n" + "="*70)
    print("🔧 ShadowHub 全量数据库备份工具")
    print("="*70)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"备份目录: {backup_dir}")
    print(f"Supabase URL: {SUPABASE_URL}")

    # 定义要备份的表及预期最小行数
    tables_to_backup = [
        ('dictionary_cache', 8000),  # 词典缓存，预期 8000+ 行
        ('materials', 100),           # 素材表
        ('user_words', 0),            # 用户生词本
        ('practice_records', 0),      # 练习记录
        ('user_profiles', 0),         # 用户资料
    ]

    backup_results = []

    # 逐个导出表
    for table_name, min_rows in tables_to_backup:
        result = export_table_to_csv(table_name)
        backup_results.append(result)

        # 短暂延迟，避免请求过快
        time.sleep(0.5)

    # 生成备份报告
    report_path = generate_backup_report(backup_results)

    # 验证完整性
    expected_stats = {name: min_rows for name, min_rows in tables_to_backup}
    integrity_passed = verify_backup_integrity(expected_stats)

    # 最终汇总
    print(f"\n{'='*70}")
    print("📊 备份完成汇总")
    print(f"{'='*70}")

    success_count = sum(1 for r in backup_results if r['status'] == 'success')
    empty_count = sum(1 for r in backup_results if r['status'] == 'empty')
    error_count = sum(1 for r in backup_results if r['status'] == 'error')
    total_rows = sum(r['rows_count'] for r in backup_results)

    print(f"✅ 成功: {success_count} 张表")
    print(f"⚠️  空表: {empty_count} 张表")
    print(f"❌ 失败: {error_count} 张表")
    print(f"📝 总行数: {total_rows:,} 行")
    print(f"\n📄 详细报告: {report_path}")
    print(f"📁 备份目录: {backup_dir}")

    # 检查关键表的数据量
    print(f"\n{'='*70}")
    print("🔍 关键表数据检查")
    print(f"{'='*70}")

    for result in backup_results:
        if result['table_name'] == 'dictionary_cache':
            if result['rows_count'] >= 8000:
                print(f"✅ dictionary_cache: {result['rows_count']:,} 行 (符合预期 ≥ 8000)")
            else:
                print(f"⚠️  dictionary_cache: {result['rows_count']:,} 行 (预期 ≥ 8000, 数据量偏少!)")

    # 最终状态
    if integrity_passed and error_count == 0:
        print(f"\n{'='*70}")
        print("✅ 备份验证通过，可以安全进行重构!")
        print(f"{'='*70}\n")
        return 0
    else:
        print(f"\n{'='*70}")
        print("⚠️  备份验证未完全通过，请检查备份文件")
        print(f"{'='*70}\n")
        return 1


if __name__ == '__main__':
    sys.exit(main())
