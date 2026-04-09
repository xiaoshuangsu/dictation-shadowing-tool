#!/usr/bin/env python3
"""
执行 Supabase SQL 索引优化
使用 psycopg2 直接连接数据库
"""

import os
import sys
from dotenv import load_dotenv
import psycopg2

# 加载环境变量
load_dotenv('.env.local')

# 数据库连接信息
# 从 Supabase URL 提取连接信息
supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# 解析连接字符串
# Supabase URL 格式: https://[project_id].supabase.co
# PostgreSQL 连接格式: postgresql://postgres:[password]@db.[project_id].supabase.co:5432/postgres

project_id = supabase_url.replace('https://', '').replace('.supabase.co', '')

# 从 service_role_key 提取密码（这是 base64 编码的 JWT token）
# 实际上，我们需要使用数据库密码，不是 service_role_key

# 更好的方法：使用完整的连接字符串
db_url = f"postgresql://postgres.{project_id}:{service_key}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# SQL 语句
sql_statements = """
-- 启用 pg_trgm 扩展
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- word 字段 GIN 索引
DROP INDEX IF EXISTS public.idx_dictionary_cache_word_gin;
CREATE INDEX idx_dictionary_cache_word_gin
ON public.dictionary_cache
USING gin (word gin_trgm_ops);

-- definitions 字段 GIN 索引
DROP INDEX IF EXISTS public.idx_dictionary_cache_definitions_gin;
CREATE INDEX idx_dictionary_cache_definitions_gin
ON public.dictionary_cache
USING gin (definitions);

-- word 字段升序索引
DROP INDEX IF EXISTS public.idx_dictionary_cache_word_asc;
CREATE INDEX idx_dictionary_cache_word_asc
ON public.dictionary_cache (word ASC);
"""

def execute_sql():
    """执行 SQL 语句"""
    print("🚀 开始执行 SQL 索引优化...\n")

    # 尝试使用 DATABASE_URL 环境变量
    database_url = os.getenv('DATABASE_URL')

    if database_url:
        print(f"✅ 找到 DATABASE_URL 环境变量")
        db_url = database_url
    else:
        print("⚠️  未找到 DATABASE_URL，尝试构造连接字符串...")
        print(f"项目 ID: {project_id}")
        print("\n请设置 DATABASE_URL 环境变量，格式如下：")
        print(f"postgresql://postgres.[project_id]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres")
        print("\n或者在 Supabase Dashboard -> Settings -> Database 中获取连接字符串")
        return

    try:
        # 连接数据库
        print(f"\n📡 连接数据库...")
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()

        print("✅ 连接成功")

        # 执行 SQL
        print(f"\n📝 执行 SQL 语句...")
        cursor.execute(sql_statements)
        conn.commit()

        print("✅ SQL 执行成功")

        # 查询索引列表
        print(f"\n🔍 查询现有索引...")
        cursor.execute("""
            SELECT
                indexname,
                indexdef
            FROM pg_indexes
            WHERE tablename = 'dictionary_cache'
            ORDER BY indexname;
        """)

        indexes = cursor.fetchall()

        if indexes:
            print(f"\n✅ dictionary_cache 表的索引:")
            for index_name, index_def in indexes:
                print(f"   - {index_name}")
        else:
            print("\n⚠️  未找到任何索引")

        # 关闭连接
        cursor.close()
        conn.close()

        print("\n🎉 索引优化完成！")

    except Exception as e:
        print(f"\n❌ 执行失败: {e}")
        print("\n请手动执行以下 SQL:")
        print("─" * 60)
        print(sql_statements)
        print("─" * 60)
        print("\n或者访问: https://supabase.com/dashboard/project/cuxotlijjnxbsirpdkgr/sql")

if __name__ == '__main__':
    execute_sql()
