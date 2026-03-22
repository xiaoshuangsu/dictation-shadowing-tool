-- ============================================
-- ShadowHub 用户生词表创建脚本
-- ============================================

-- 创建 user_words 表存储用户的生词
CREATE TABLE IF NOT EXISTS public.user_words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,

  -- 单词信息
  word TEXT NOT NULL,
  phonetic TEXT,              -- 音标
  definition TEXT NOT NULL,    -- 释义（JSON 格式支持多语言）
  context_sentence TEXT,       -- 原始例句

  -- 关联信息
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  material_title TEXT,         -- 冗余存储素材标题（以防素材被删除）

  -- 学习状态
  mastery_status TEXT NOT NULL DEFAULT 'learning' CHECK (mastery_status IN ('learning', 'familiar', 'mastered')),

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 确保同一用户的同一单词只有一条记录
  UNIQUE(user_id, word)
);

-- 添加注释
COMMENT ON TABLE public.user_words IS '用户生词本表';
COMMENT ON COLUMN public.user_words.user_id IS '用户 ID';
COMMENT ON COLUMN public.user_words.word IS '单词（小写存储）';
COMMENT ON COLUMN public.user_words.phonetic IS '音标（如：/həˈləʊ/）';
COMMENT ON COLUMN public.user_words.definition IS '释义（JSON 格式：{"zh": "你好", "vi": "xin chào"}）';
COMMENT ON COLUMN public.user_words.context_sentence IS '原始例句（用户点击单词时的句子）';
COMMENT ON COLUMN public.user_words.material_id IS '关联的素材 ID';
COMMENT ON COLUMN public.user_words.material_title IS '冗余存储素材标题';
COMMENT ON COLUMN public.user_words.mastery_status IS '掌握状态：learning(学习中) / familiar(熟悉) / mastered(已掌握)';

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_user_words_user_id ON public.user_words(user_id);
CREATE INDEX IF NOT EXISTS idx_user_words_word ON public.user_words(word);
CREATE INDEX IF NOT EXISTS idx_user_words_mastery_status ON public.user_words(mastery_status);
CREATE INDEX IF NOT EXISTS idx_user_words_created_at ON public.user_words(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_words_material_id ON public.user_words(material_id);

-- 启用 Row Level Security
ALTER TABLE public.user_words ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能读写自己的生词
CREATE POLICY "Users can view own words"
  ON public.user_words FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own words"
  ON public.user_words FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own words"
  ON public.user_words FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own words"
  ON public.user_words FOR DELETE
  USING (user_id = auth.uid());

-- 创建更新时间戳触发器
CREATE OR REPLACE FUNCTION update_user_words_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_words_updated_at
  BEFORE UPDATE ON public.user_words
  FOR EACH ROW
  EXECUTE FUNCTION update_user_words_updated_at();

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE 'user_words 表创建完成！';
  RAISE NOTICE '接下来可以：';
  RAISE NOTICE '1. 创建 API 路由用于增删改查生词';
  RAISE NOTICE '2. 实现点词翻译功能';
  RAISE NOTICE '3. 创建单词管理页面';
END $$;
