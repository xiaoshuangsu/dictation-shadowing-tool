/**
 * Supabase 数据库连接探测脚本
 *
 * 用于快速检测数据库连接是否恢复正常
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// 加载环境变量
config({ path: '.env.local' })

const supabaseUrl = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''

async function pingDatabase() {
  const startTime = Date.now()

  console.log('🔍 Ping Supabase Database...')
  console.log('📍', new Date().toISOString())

  if (!supabaseKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // 尝试查询 1 条记录
    const { data, error, status } = await supabase
      .from('materials')
      .select('id, title')
      .limit(1)

    const elapsedTime = Date.now() - startTime

    if (error) {
      console.error('❌ FAILED:', elapsedTime + 'ms')
      console.error('   HTTP Status:', status)
      console.error('   Error:', error.message?.substring(0, 100))
      process.exit(1)
    }

    if (data && data.length > 0) {
      console.log('✅ SUCCESS!', elapsedTime + 'ms')
      console.log('   HTTP Status:', status)
      console.log('   Sample data:', data[0])
      console.log('')
      console.log('🎉 数据库连接已恢复正常！')
      console.log('🚀 请立即解除硬编码并恢复业务逻辑！')
      process.exit(0)
    } else {
      console.log('⚠️  SUCCESS but no data', elapsedTime + 'ms')
      process.exit(0)
    }
  } catch (error: any) {
    const elapsedTime = Date.now() - startTime
    console.error('❌ FAILED:', elapsedTime + 'ms')
    console.error('   Error:', error.message?.substring(0, 100))

    // 检查是否是 522 或 429 错误
    if (error.message?.includes('522') || error.message?.includes('429')) {
      console.error('   Type: Gateway error (522/429)')
    }

    process.exit(1)
  }
}

pingDatabase()
