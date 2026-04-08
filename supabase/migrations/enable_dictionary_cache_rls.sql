-- ============================================
-- ShadowHub 安全加固：dictionary_cache 表 RLS 策略
-- ============================================
-- 目的：为 dictionary_cache 表启用 Row-Level Security
-- 策略：公开读取（Read-only），严禁未经授权写入
-- ============================================

-- 1. 启用 Row Level Security
ALTER TABLE public.dictionary_cache ENABLE ROW LEVEL SECURITY;

-- 2. 公开读取策略（允许所有用户查询词典）
CREATE POLICY "Allow public read access to dictionary_cache"
  ON public.dictionary_cache FOR SELECT
  TO public
  USING (true);

-- 3. 仅允许 service_role 写入（防止未经授权的写入、修改、删除）
-- 注意：service_role 是 Supabase 的服务端密钥，拥有绕过 RLS 的权限
-- 因此不需要为 service_role 创建 INSERT/UPDATE/DELETE 策略
-- 但为了更明确的权限控制，我们创建以下策略：

-- 严禁匿名用户写入
CREATE POLICY "Block anon users from inserting"
  ON public.dictionary_cache FOR INSERT
  TO anon
  WITH CHECK (false);

CREATE POLICY "Block anon users from updating"
  ON public.dictionary_cache FOR UPDATE
  TO anon
  USING (false);

CREATE POLICY "Block anon users from deleting"
  ON public.dictionary_cache FOR DELETE
  TO anon
  USING (false);

-- 严禁普通认证用户写入（只有通过 API 路由的操作才能写入）
CREATE POLICY "Block authenticated users from inserting"
  ON public.dictionary_cache FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "Block authenticated users from updating"
  ON public.dictionary_cache FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "Block authenticated users from deleting"
  ON public.dictionary_cache FOR DELETE
  TO authenticated
  USING (false);

-- ============================================
-- 验证 RLS 策略
-- ============================================

-- 查看已创建的策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'dictionary_cache'
ORDER BY policyname;

-- ============================================
-- 测试查询（在 Supabase SQL Editor 中执行）
-- ============================================

-- 测试 1：匿名用户应该能读取
-- SET ROLE anon;
-- SELECT COUNT(*) FROM public.dictionary_cache;

-- 测试 2：匿名用户不应该能写入
-- SET ROLE anon;
-- INSERT INTO public.dictionary_cache (word, phonetic, definition_json) VALUES ('test', '/test/', '{"zh": "测试"}');

-- 测试 3：service_role 应该能写入（绕过 RLS）
-- SET ROLE postgres;  -- 或使用 service_role
-- INSERT INTO public.dictionary_cache (word, phonetic, definition_json) VALUES ('test', '/test/', '{"zh": "测试"}');

-- ============================================
-- 完成提示
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'dictionary_cache RLS 策略已启用！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '策略说明：';
  RAISE NOTICE '✅ 公开读取：任何人都可以查询词典';
  RAISE NOTICE '❌ 匿名写入：严禁匿名用户写入、修改、删除';
  RAISE NOTICE '❌ 认证写入：严禁普通认证用户写入、修改、删除';
  RAISE NOTICE '✅ 服务端写入：只有 service_role 可以写入（通过 API 路由）';
  RAISE NOTICE '';
  RAISE NOTICE '安全加固完成！数据库表已受到保护。';
  RAISE NOTICE '========================================';
END $$;
