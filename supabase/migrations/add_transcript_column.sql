-- 添加 transcript 字段到 materials 表
-- 用于存储句子级别的转录数据（JSON 格式）

-- 添加 transcript 列（JSONB 类型）
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS transcript jsonb;

-- 添加注释
COMMENT ON COLUMN public.materials.transcript IS '句子级别转录数据，JSON 格式: [{"id": 1, "text": "...", "startTime": 0.0, "endTime": 1.5}, ...]';

-- 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_materials_transcript ON public.materials USING GIN(transcript);

-- 验证
DO $$
BEGIN
  RAISE NOTICE 'transcript 列添加完成！';
END $$;
