-- 修复 materials 表的 RLS 策略
-- 确保公开读取可以正常工作

-- 删除现有的 RLS 策略（如果有）
DROP POLICY IF EXISTS "Anyone can view materials" ON public.materials;
DROP POLICY IF EXISTS "Authenticated users can insert materials" ON public.materials;
DROP POLICY IF EXISTS "Authenticated users can update materials" ON public.materials;

-- 创建新的、更宽松的策略
-- 允许所有人（包括未认证用户）读取数据
CREATE POLICY "Enable read access for all users"
  ON public.materials FOR SELECT
  TO public
  USING (true)
  WITH CHECK (false);

-- 允许已认证用户插入数据
CREATE POLICY "Enable insert for authenticated users"
  ON public.materials FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 允许已认证用户更新数据
CREATE POLICY "Enable update for authenticated users"
  ON public.materials FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = 'authenticated')
  WITH CHECK (true);

-- 验证策略
DO $$
BEGIN
  RAISE NOTICE 'RLS 策略已更新！';
  RAISE NOTICE '现在所有人都可以读取 materials 表';
END $$;
