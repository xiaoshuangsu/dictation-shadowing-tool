-- ============================================
-- 多语言翻译支持升级
-- ============================================
-- 将 translation 字段从 TEXT 升级为 JSONB
-- 旧数据自动迁移为 {"zh": "原来的文本"} 格式

-- 1. 添加新的 JSONB 字段 translation_new
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS translation_new JSONB;

-- 2. 迁移旧数据：将现有的 TEXT translation 转换为 JSONB 格式
-- 规则：如果 translation 列存在且有值，转换为 {"zh": "原来的文本"}
UPDATE public.materials
SET translation_new = jsonb_build_object('zh', translation)
WHERE translation IS NOT NULL AND translation != '';

-- 3. 为空的记录设置为空的 JSONB 对象
UPDATE public.materials
SET translation_new = '{}'::jsonb
WHERE translation_new IS NULL;

-- 4. 删除旧的 TEXT 字段
ALTER TABLE public.materials
DROP COLUMN IF EXISTS translation;

-- 5. 重命名新字段为 translation
ALTER TABLE public.materials
RENAME COLUMN translation_new TO translation;

-- 6. 设置默认值为空的 JSONB 对象
ALTER TABLE public.materials
ALTER COLUMN translation SET DEFAULT '{}'::jsonb;

-- 7. 添加注释
COMMENT ON COLUMN public.materials.translation IS '多语言翻译 JSONB 格式：{"zh": "中文", "en": "English", "es": "Español", ...}';

-- 8. 创建 GIN 索引以支持高效的 JSONB 查询
CREATE INDEX IF NOT EXISTS idx_materials_translation ON public.materials USING GIN(translation);

-- 验证结果
DO $$
DECLARE
  old_count INTEGER;
  new_count INTEGER;
  sample_translation JSONB;
BEGIN
  -- 统计有翻译的记录数
  SELECT COUNT(*) INTO new_count
  FROM public.materials
  WHERE translation ? 'zh';

  -- 获取一个示例
  SELECT translation INTO sample_translation
  FROM public.materials
  WHERE translation ? 'zh'
  LIMIT 1;

  RAISE NOTICE '======================================';
  RAISE NOTICE '多语言翻译升级完成！';
  RAISE NOTICE '======================================';
  RAISE NOTICE '字段类型: TEXT -> JSONB';
  RAISE NOTICE '数据格式: {"zh": "原来的文本"}';
  RAISE NOTICE '已迁移记录数: %', new_count;
  RAISE NOTICE '示例数据: %', sample_translation;
  RAISE NOTICE '======================================';
  RAISE NOTICE '接下来请：';
  RAISE NOTICE '1. 更新 TypeScript 类型定义（Sentence interface）';
  RAISE NOTICE '2. 更新前端组件以支持多语言切换';
END $$;
