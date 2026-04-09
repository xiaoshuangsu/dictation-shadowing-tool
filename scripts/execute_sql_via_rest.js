/**
 * 通过 Supabase REST API 执行 SQL
 */
import { config } from 'dotenv';
import { execSync } from 'child_process';

config({ path: '.env.local' });

async function executeSQLViaRest() {
  console.log('🚀 尝试通过 Supabase REST API 执行 SQL...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ 缺少必要的环境变量');
    return;
  }

  // 提取项目 ID
  const projectId = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1];

  if (!projectId) {
    console.error('❌ 无法解析 Supabase 项目 ID');
    return;
  }

  console.log(`📋 项目 ID: ${projectId}`);

  // SQL 语句
  const sqlStatements = `
-- 1. word 字段 GIN 索引（需要先启用 pg_trgm 扩展）
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_word_gin
ON public.dictionary_cache
USING gin (word gin_trgm_ops);

-- 2. definitions 字段 GIN 索引（多语言 JSONB 查询）
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_definitions_gin
ON public.dictionary_cache
USING gin (definitions);

-- 3. 常用查询复合索引
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_word_asc
ON public.dictionary_cache (word ASC);
  `.trim();

  console.log('\n📝 应该执行的 SQL 语句：');
  console.log('─'.repeat(60));
  console.log(sqlStatements);
  console.log('─'.repeat(60));

  console.log('\n⚠️  Supabase REST API 不支持直接执行 DDL 语句');
  console.log('请使用以下方法之一：\n');

  console.log('方法一：Supabase Dashboard（推荐）');
  console.log(`1. 访问: https://supabase.com/dashboard/project/${projectId}/sql`);
  console.log('2. 粘贴上面的 SQL 语句并点击 "Run"\n');

  console.log('方法二：使用 Supabase CLI');
  console.log('supabase db push --db-url "$DATABASE_URL"\n');

  console.log('方法三：使用 curl（通过 REST API）');
  console.log(`curl -X POST '${supabaseUrl}/rest/v1/rpc/exec_sql' \\`);
  console.log('  -H "apikey: ' + serviceKey + '" \\');
  console.log('  -H "Authorization: Bearer ' + serviceKey + '" \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log("  -d '{\"query\": \"YOUR_SQL_HERE\"}'\n");

  // 尝试使用 Supabase CLI（如果安装了）
  console.log('🔍 检查是否安装了 Supabase CLI...');
  try {
    const version = execSync('supabase --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`✅ 找到 Supabase CLI: ${version.trim()}`);

    console.log('\n尝试执行 SQL...');
    const sqlFile = '/tmp/dictionary_indexes.sql';

    // 写入 SQL 文件
    const { writeFileSync } = await import('fs');
    writeFileSync(sqlFile, sqlStatements);

    console.log(`SQL 文件已保存到: ${sqlFile}`);
    console.log('请手动执行: supabase db push --db-url "$DATABASE_URL"');

  } catch (error) {
    console.log('❌ 未找到 Supabase CLI');
  }
}

executeSQLViaRest().catch(console.error);
