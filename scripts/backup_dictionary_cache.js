/**
 * 备份 dictionary_cache 表数据到本地 JSON 文件
 *
 * 用途：
 * - 在执行批量更新前备份
 * - 定期备份防止数据丢失
 * - 迁移或恢复时使用
 *
 * 使用方法：
 *   node scripts/backup_dictionary_cache.js
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少环境变量: NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// 备份目录
const BACKUP_DIR = path.join(process.cwd(), 'backups')
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

async function backupTable(tableName) {
  console.log(`📦 开始备份表: ${tableName}`)

  const pageSize = 1000
  let allData = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) {
      console.error(`❌ 查询失败 (第 ${page} 页):`, error.message)
      return
    }

    if (data && data.length > 0) {
      allData = allData.concat(data)
      console.log(`  ✓ 已获取 ${allData.length} 条记录...`)
      page++

      // 如果返回的数据少于 pageSize，说明已经是最后一页
      if (data.length < pageSize) {
        hasMore = false
      }
    } else {
      hasMore = false
    }
  }

  // 生成备份文件名（带时间戳）
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
  const filename = `${tableName}_${timestamp}.json`
  const filepath = path.join(BACKUP_DIR, filename)

  // 写入文件
  fs.writeFileSync(filepath, JSON.stringify(allData, null, 2), 'utf-8')

  console.log(`✅ 备份完成: ${filename}`)
  console.log(`   记录数: ${allData.length}`)
  console.log(`   文件大小: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`)

  return { filename, count: allData.length }
}

async function restoreTable(tableName, backupFile) {
  console.log(`📥 开始恢复表: ${tableName}`)

  // 读取备份文件
  const filepath = path.join(BACKUP_DIR, backupFile)
  if (!fs.existsSync(filepath)) {
    console.error(`❌ 备份文件不存在: ${backupFile}`)
    return
  }

  const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'))
  console.log(`  读取到 ${data.length} 条记录`)

  // 清空表（谨慎操作！）
  console.log(`⚠️  即将清空表 ${tableName}，请确认...`)
  // const { error: deleteError } = await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000')

  // 插入数据
  const batchSize = 100
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize)
    const { error } = await supabase.from(tableName).insert(batch)

    if (error) {
      console.error(`❌ 插入失败 (第 ${i}-${i + batch.length} 条):`, error.message)
      return
    }

    console.log(`  ✓ 已插入 ${Math.min(i + batchSize, data.length)}/${data.length} 条记录`)
  }

  console.log(`✅ 恢复完成`)
}

// 主函数
async function main() {
  const command = process.argv[2] || 'backup'
  const table = process.argv[3] || 'dictionary_cache'

  if (command === 'backup') {
    await backupTable(table)
  } else if (command === 'restore') {
    const backupFile = process.argv[4]
    if (!backupFile) {
      console.error('❌ 请指定备份文件名')
      console.log('用法: node backup_dictionary_cache.js restore dictionary_cache backup_file.json')
      process.exit(1)
    }
    await restoreTable(table, backupFile)
  } else {
    console.log('用法:')
    console.log('  备份: node backup_dictionary_cache.js backup [table_name]')
    console.log('  恢复: node backup_dictionary_cache.js restore [table_name] [backup_file.json]')
  }
}

main()
