#!/usr/bin/env python3
"""
数据库迁移：添加 video_path 字段

执行方式：
    python3 migrate_add_video_path.py
"""

import os
import sys
from supabase import create_client

# ============ 配置 ============
SUPABASE_URL = "https://cuxotlijjnxbsirpdkgr.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_KEY:
    print("❌ 错误: 请设置环境变量 SUPABASE_SERVICE_KEY")
    print("   export SUPABASE_SERVICE_KEY=your_key_here")
    sys.exit(1)

def main():
    """主函数"""
    print("=" * 70)
    print("🗄️  数据库迁移: 添加 video_path 字段")
    print("=" * 70)

    # 初始化 Supabase
    print("\n🔗 连接 Supabase...")
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 注意：Supabase JavaScript/Python 客户端不支持 DDL 操作
    # 需要通过 Postgres RPC 或直接 SQL 执行
    print("\n⚠️  Supabase 客户端不支持 DDL 操作（ALTER TABLE）")
    print("\n📝 请手动在 Supabase SQL Editor 中执行以下 SQL：")
    print("\n" + "=" * 70)
    print("-- 添加 video_path 字段到 materials 表")
    print("ALTER TABLE public.materials")
    print("ADD COLUMN IF NOT EXISTS video_path TEXT;")
    print("")
    print("-- 添加注释")
    print("COMMENT ON COLUMN public.materials.video_path IS")
    print("'视频文件路径（相对于 Supabase Storage bucket）';")
    print("")
    print("-- 验证")
    print("SELECT column_name, data_type, is_nullable")
    print("FROM information_schema.columns")
    print("WHERE table_name = 'materials'")
    print("  AND column_name = 'video_path';")
    print("=" * 70)

    print("\n📖 详细步骤：")
    print("1. 访问 https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql")
    print("2. 复制上面的 SQL 代码")
    print("3. 粘贴到 SQL Editor")
    print("4. 点击 Run 执行")
    print("\n💡 提示：可以在浏览器控制台执行以下代码快速跳转：")
    print(f"   window.open('https://supabase.com/dashboard/', '_blank')")

if __name__ == '__main__':
    main()
