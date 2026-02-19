-- 修复 materials 表的 RLS 策略
-- 正确的语法

-- 删除现有的 RLS 策略（如果有）
DROP POLICY IF EXISTS "Anyone can view materials" ON public.materials;
DROP POLICY IF EXISTS "Authenticated users can insert materials" ON public.materials;
DROP POLICY IF EXISTS "Authenticated users can update materials" ON public.materials;

-- 创建正确的策略

-- 1. 允许所有人读取（SELECT 不需要 WITH CHECK）
CREATE POLICY "Enable read access for all users"
  ON public.materials FOR SELECT
  TO public
  USING (true);

-- 2. 允许已认证用户插入
CREATE POLICY "Enable insert for authenticated users"
  ON public.materials FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. 允许已认证用户更新
CREATE POLICY "Enable update for authenticated users"
  ON public.materials FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 验证
DO $$
BEGIN
  RAISE NOTICE 'RLS 策略已更新！';
  RAISE NOTICE '现在所有人都可以读取 materials 表';
END $$;
