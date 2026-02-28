-- 添加 video_path 字段到 materials 表
-- 用于支持视频素材（如 Bilibili 视频）

-- 执行前请备份数据库！

-- 添加 video_path 列（可为空，因为现有素材都是纯音频）
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS video_path TEXT;

-- 添加注释
COMMENT ON COLUMN public.materials.video_path IS '视频文件路径（相对于 Supabase Storage bucket）';

-- 验证
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'materials'
  AND column_name = 'video_path';
