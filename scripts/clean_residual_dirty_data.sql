-- ================================================================================
-- 清理残留坏数据 SQL 脚本
-- 生成时间: 2026-04-05 09:19
-- 目标: 清理 57 条残留的孟加拉语幻觉翻译
-- ================================================================================

-- 说明：
-- 1. 这些坏数据是在热更新之前产生的
-- 2. 包含孟加拉语指令词幻觉（如 "শব্দ পুনরাবৃত্তি" = "避免重复"）
-- 3. 需要逐句清理，不影响其他正常翻译

-- ================================================================================
-- 方法 1: 使用 Python 脚本（推荐）
-- ================================================================================

-- 运行以下命令：
-- python3 scripts/clean_dirty_translations.py

-- 优点：
-- - 精确匹配，不会误伤正常翻译
-- - 自动处理复杂的 JSONB 结构
-- - 提供详细的日志报告

-- ================================================================================
-- 方法 2: SQL 直接清理（快速但需要仔细验证）
-- ================================================================================

-- 步骤 1: 备份受影响的数据（重要！）
CREATE TABLE materials_backup_20260405 AS
SELECT * FROM materials;

-- 步骤 2: 查看受影响的素材数量
SELECT COUNT(*) as affected_materials
FROM materials
WHERE transcript::text LIKE '%শব্দ পুনরাবৃত্তি%'
   OR transcript::text LIKE '%সরাসরি অনুবাদ%'
   OR transcript::text LIKE '%ক্রিটিক্যাল%'
   OR transcript::text LIKE '<translation_result>';

-- 步骤 3: 清理孟加拉语幻觉（逐句处理）
-- 注意：这需要使用 Python 脚本处理，因为需要修改 JSONB 数组中的特定元素

-- 以下是示例 SQL（仅供参考，实际使用 Python 脚本）：
UPDATE materials
SET transcript = transcript::jsonb || jsonb_build_object(
  'translation', jsonb_set(
    COALESCE(transcript->'translation', '{}'::jsonb),
    '{bn}', 'null'::jsonb
  )
)
WHERE transcript::text LIKE '%শব্দ পুনরাবৃত্তি%';

-- ================================================================================
-- 方法 3: Python 逐句清理脚本（最安全）
-- ================================================================================

/*
创建并运行以下 Python 脚本:

#!/usr/bin/env python3
from dotenv import load_dotenv
from supabase import create_client
import os
import re
from pathlib import Path

env_path = Path('.env.local')
load_dotenv(env_path)

supabase = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

# 获取所有素材
response = supabase.table('materials').select('id, slug, transcript').execute()

total_cleaned = 0

for material in response.data:
    material_id = material['id']
    slug = material.get('slug')
    transcript = material.get('transcript', [])

    if not transcript:
        continue

    modified = False

    for sentence in transcript:
        translation = sentence.get('translation', {})
        bn_text = translation.get('bn', '')

        if not bn_text:
            continue

        # 检查是否包含幻觉特征
        is_dirty = (
            'শব্দ পুনরাবৃত্তি' in bn_text or  # 避免重复
            'সরাসরি অনুবাদ' in bn_text or  # 直接翻译
            'ক্রিটিক্যাল' in bn_text or        # Critical
            '<translation_result>' in bn_text  # XML 标签
        )

        if is_dirty:
            # 删除该语言的翻译
            del translation['bn']
            modified = True
            total_cleaned += 1
            print(f"清理: {slug} (删除孟加拉语幻觉)")

    # 更新数据库
    if modified:
        supabase.table('materials').update({
            'transcript': transcript
        }).eq('id', material_id).execute()

print(f"✅ 清理完成: {total_cleaned} 条孟加拉语幻觉翻译")

*/

-- ================================================================================
-- 验证清理结果
-- ================================================================================

-- 检查是否还有残留的幻觉翻译
SELECT COUNT(*) as remaining_dirty
FROM materials
WHERE transcript::text LIKE '%শব্দ পুনরাবৃত্তি%'
   OR transcript::text LIKE '%সরাসরি অনুবাদ%'
   OR transcript::text LIKE '%ক্রিটিক্যাল%';

-- 检查各语言翻译数量（确保其他语言未受影响）
SELECT
  jsonb_object_keys(transcript->0->'translation') as lang,
  COUNT(*) as count
FROM materials
WHERE transcript != 'null'::jsonb
GROUP BY lang
ORDER BY count DESC;

-- ================================================================================
-- 恢复备份（如果需要）
-- ================================================================================

-- 如果清理出错，可以从备份恢复：
-- DROP TABLE materials;
-- ALTER TABLE materials_backup_20260405 RENAME TO materials;

-- 或者只恢复特定素材：
-- UPDATE materials m
-- SET transcript = b.transcript
-- FROM materials_backup_20260405 b
-- WHERE m.id = b.id
-- AND m.id = '特定素材ID';

-- ================================================================================
-- 结束
-- ================================================================================
