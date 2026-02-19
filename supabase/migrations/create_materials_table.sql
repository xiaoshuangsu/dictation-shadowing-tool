-- ============================================
-- Engnovate 素材表创建脚本
-- ============================================

-- 创建 materials 表存储音频素材
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('A1', 'A2', 'B1', 'B2')),

  -- Storage 文件路径
  audio_path TEXT NOT NULL,
  thumbnail_path TEXT,

  -- 元数据
  audio_size BIGINT NOT NULL,
  duration INTEGER, -- 音频时长（秒），后续可更新

  -- 统计
  play_count INTEGER DEFAULT 0,

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 全文搜索
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(category, '')), 'B')
  ) STORED
);

-- 添加注释
COMMENT ON TABLE public.materials IS 'Engnovate 音频素材表';
COMMENT ON COLUMN public.materials.title IS '素材标题';
COMMENT ON COLUMN public.materials.category IS '分类：日常生活、文化历史、历史演讲、艺术文化';
COMMENT ON COLUMN public.materials.difficulty IS '难度等级：A1, A2, B1, B2';
COMMENT ON COLUMN public.materials.audio_path IS 'Supabase Storage 中的音频文件路径';
COMMENT ON COLUMN public.materials.thumbnail_path IS 'Supabase Storage 中的封面图路径';
COMMENT ON COLUMN public.materials.audio_size IS '音频文件大小（字节）';
COMMENT ON COLUMN public.materials.duration IS '音频时长（秒）';
COMMENT ON COLUMN public.materials.play_count IS '播放次数统计';
COMMENT ON COLUMN public.materials.search_vector IS '全文搜索向量';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_materials_category ON public.materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_difficulty ON public.materials(difficulty);
CREATE INDEX IF NOT EXISTS idx_materials_search ON public.materials USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_materials_created_at ON public.materials(created_at DESC);

-- 启用 Row Level Security
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- RLS 策略：公开读取，仅认证用户可以写入
CREATE POLICY "Anyone can view materials"
  ON public.materials FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert materials"
  ON public.materials FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update materials"
  ON public.materials FOR UPDATE
  TO authenticated
  USING (true);

-- 创建更新时间戳触发器
CREATE OR REPLACE FUNCTION update_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION update_materials_updated_at();

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE 'Materials 表创建完成！';
  RAISE NOTICE '接下来请：';
  RAISE NOTICE '1. 在 Supabase Dashboard 创建 Storage bucket: engnovate-audio';
  RAISE NOTICE '2. 运行 Python 导入脚本上传文件并插入数据';
END $$;
