-- 添加 SEO 字段到 materials 表

-- 1. 添加 slug 字段（唯一标识符，用于 URL）
ALTER TABLE materials
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- 2. 添加 meta_title 字段（页面标题）
ALTER TABLE materials
ADD COLUMN IF NOT EXISTS meta_title TEXT;

-- 3. 添加 meta_description 字段（页面描述）
ALTER TABLE materials
ADD COLUMN IF NOT EXISTS meta_description TEXT;

-- 4. 添加 og_image 字段（社交媒体分享图片）
ALTER TABLE materials
ADD COLUMN IF NOT EXISTS og_image TEXT;

-- 5. 为现有记录生成 slug（基于 title）
-- 注意：这会跳过重复的 slug，你可以后续手动处理
UPDATE materials
SET slug = LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9\s-]', '', 'g'))
WHERE slug IS NULL;

-- 清理 slug：将空格和连续的连字符替换为单个连字符
UPDATE materials
SET slug = REGEXP_REPLACE(TRIM(slug), '\s+', '-', 'g')
WHERE slug IS NOT NULL;

UPDATE materials
SET slug = REGEXP_REPLACE(slug, '-+', '-', 'g')
WHERE slug IS NOT NULL;

-- 移除开头和结尾的连字符
UPDATE materials
SET slug = TRIM(BOTH '-' FROM slug)
WHERE slug IS NOT NULL;

-- 确保唯一性（对于重复的，添加数字后缀）
-- 注意：如果有很多重复，这个查询可能需要多次执行
DO $$
DECLARE
    duplicate_record RECORD;
    counter INTEGER := 1;
BEGIN
    FOR duplicate_record IN
        SELECT slug, COUNT(*) as count FROM materials
        WHERE slug IS NOT NULL
        GROUP BY slug
        HAVING COUNT(*) > 1
    LOOP
        -- 这里简化处理，实际可能需要更复杂的逻辑
        UPDATE materials
        SET slug = slug || '-' || counter
        WHERE ctid IN (
            SELECT ctid FROM materials
            WHERE slug = duplicate_record.slug
            LIMIT 1 OFFSET counter
        );
        counter := counter + 1;
    END LOOP;
END $$;

-- 为现有记录生成 meta_title（格式：[Title] | English Dictation & Shadowing）
UPDATE materials
SET meta_title = title || ' | English Dictation & Shadowing'
WHERE meta_title IS NULL;

-- 为现有记录生成 meta_description（取前150个字符）
-- 注意：这需要从 transcript 字段提取
UPDATE materials
SET meta_description = SUBSTRING(
    REGEXP_REPLACE(
        CASE
            WHEN transcript::text LIKE '%text%' THEN
                SUBSTRING(transcript::text, 1, 500)
            ELSE
                'Practice English listening and speaking with this dictation exercise: ' || title
        END,
        '[\n\r]+', ' ', 'g'
    ),
    1, 150
) || '...'
WHERE meta_description IS NULL;

-- 为现有记录设置 og_image（复用 thumbnail_path）
UPDATE materials
SET og_image = thumbnail_path
WHERE og_image IS NULL AND thumbnail_path IS NOT NULL;

-- 验证结果
SELECT
    'slug' as field_name,
    COUNT(*) as filled_count,
    COUNT(*) - COUNT(slug) as null_count
FROM materials
UNION ALL
SELECT
    'meta_title',
    COUNT(*),
    COUNT(*) - COUNT(meta_title)
FROM materials
UNION ALL
SELECT
    'meta_description',
    COUNT(*),
    COUNT(*) - COUNT(meta_description)
FROM materials
UNION ALL
SELECT
    'og_image',
    COUNT(*),
    COUNT(*) - COUNT(og_image)
FROM materials;
