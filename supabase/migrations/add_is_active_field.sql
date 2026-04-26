-- ============================================
-- ShadowHub v30.6.2: 添加 is_active 字段
-- ============================================
-- 目的：为素材提供下架机制，解决软 404 问题
-- ============================================

-- 添加 is_active 字段（默认值为 true，保持现有素材可见）
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 为已存在的记录设置默认值
UPDATE public.materials
SET is_active = true
WHERE is_active IS NULL;

-- 添加索引（优化查询性能）
CREATE INDEX IF NOT EXISTS idx_materials_is_active
ON public.materials(is_active)
WHERE is_active = false;

-- 添加注释
COMMENT ON COLUMN public.materials.is_active IS '素材上架状态：true=正常展示，false=已下架（301重定向到分类页）';

-- ============================================
-- 验证结果
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'is_active 字段添加完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '字段说明：';
  RAISE NOTICE '✅ is_active = true: 素材正常展示';
  RAISE NOTICE '❌ is_active = false: 素材已下架（301 重定向）';
  RAISE NOTICE '';
  RAISE NOTICE '接下来需要：';
  RAISE NOTICE '1. 在 Supabase Dashboard 执行此 SQL';
  RAISE NOTICE '2. 修改 sitemap.ts 过滤 is_active = false 的素材';
  RAISE NOTICE '3. 修改详情页添加 301 重定向逻辑';
  RAISE NOTICE '========================================';
END $$;
