-- 添加素材来源类型和 YouTube 支持到 materials 表
-- 支持 R2 存储（音频/视频）和 YouTube 视频

-- 1. 添加 source_type 列（素材来源类型）
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'r2';

-- 添加 CHECK 约束，确保 source_type 只能是 'r2' 或 'youtube'
ALTER TABLE public.materials
ADD CONSTRAINT materials_source_type_check
CHECK (source_type IN ('r2', 'youtube'));

-- 2. 添加 youtube_id 列（YouTube 视频 ID）
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS youtube_id TEXT;

-- 3. 添加 video_path 列（R2 视频路径，可为空）
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS video_path TEXT;

-- 4. 添加注释
COMMENT ON COLUMN public.materials.source_type IS '素材来源类型：r2（R2存储的音频/视频）或 youtube（YouTube视频）';
COMMENT ON COLUMN public.materials.youtube_id IS 'YouTube 视频 ID，当 source_type=youtube 时使用';
COMMENT ON COLUMN public.materials.video_path IS 'R2 视频文件路径，当 source_type=r2 时使用';

-- 5. 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_materials_source_type ON public.materials(source_type);
CREATE INDEX IF NOT EXISTS idx_materials_youtube_id ON public.materials(youtube_id);

-- 6. 数据完整性：当 source_type='youtube' 时，youtube_id 不能为空
ALTER TABLE public.materials
ADD CONSTRAINT materials_youtube_id_required
CHECK (
  (source_type = 'youtube' AND youtube_id IS NOT NULL AND youtube_id != '') OR
  (source_type = 'r2')
);

-- 验证
DO $$
BEGIN
  RAISE NOTICE '素材来源类型和 YouTube 支持添加完成！';
  RAISE NOTICE '新增字段：';
  RAISE NOTICE '  - source_type: r2 或 youtube（默认 r2）';
  RAISE NOTICE '  - youtube_id: YouTube 视频 ID';
  RAISE NOTICE '  - video_path: R2 视频路径';
END $$;
