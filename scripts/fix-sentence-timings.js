#!/usr/bin/env node

/**
 * 批量修复 Supabase 中句子的时间边界问题
 *
 * 使用方法：
 * 1. 安装依赖：npm install @supabase/supabase-js
 * 2. 设置环境变量：
 *    export SUPABASE_URL="https://cuxotlijjnxbsirpdkgr.supabase.co"
 *    export SUPABASE_ANON_KEY="sb_publishable_UeaK10sYGQPjB17Vg-IpcQ_ql3xHKMm"
 * 3. 运行脚本：node scripts/fix-sentence-timings.js
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL || 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_UeaK10sYGQPjB17Vg-IpcQ_ql3xHKMm'

const supabase = createClient(supabaseUrl, supabaseKey)

// 修复策略：
// 1. 如果两个句子的文本应该是一句（基于标点符号规则），合并它们
// 2. 如果句子结束时间太早（与下一句开始时间重叠或接近），添加缓冲时间
async function fixSentenceTimings() {
  console.log('🔍 开始获取素材数据...')

  const { data: materials, error } = await supabase
    .from('materials')
    .select('id, title, transcript')
    .order('title')

  if (error) {
    console.error('❌ 获取素材失败:', error)
    return
  }

  if (!materials || materials.length === 0) {
    console.log('⚠️  没有找到任何素材')
    return
  }

  console.log(`✅ 找到 ${materials.length} 个素材`)

  let totalFixed = 0

  for (const material of materials) {
    if (!material.transcript || !Array.isArray(material.transcript)) {
      continue
    }

    let hasChanges = false
    const fixedTranscript = []

    // 检查每个句子
    for (let i = 0; i < material.transcript.length; i++) {
      const current = material.transcript[i]
      const next = material.transcript[i + 1]

      if (!current) continue

      let newCurrent = { ...current }
      const currentText = current.text || ''
      const nextText = next?.text || ''

      // 规则1：检查句子是否以小写字母开头（说明应该和上一句合并）
      if (currentText && currentText.length > 0) {
        const firstChar = currentText.trim()[0]
        const isLowercaseStart = firstChar === firstChar.toLowerCase() && firstChar !== firstChar.toUpperCase()

        if (isLowercaseStart && fixedTranscript.length > 0) {
          // 合并到上一句
          const prevSentence = fixedTranscript[fixedTranscript.length - 1]
          const combinedText = prevSentence.text + ' ' + currentText.trim()
          const combinedEndTime = current.end_time || prevSentence.end_time

          console.log(`  📝 合并句子: "${prevSentence.text}" + "${currentText.trim()}"`)
          fixedTranscript[fixedTranscript.length - 1] = {
            ...prevSentence,
            text: combinedText,
            end_time: combinedEndTime
          }
          hasChanges = true
          continue
        }
      }

      // 规则2：检查时间边界重叠或过近
      if (next && newCurrent.end_time && next.start_time) {
        const gap = next.start_time - newCurrent.end_time

        // 如果时间间隔小于0.5秒，可能是分句错误
        if (gap < 0.5 && gap > -2) {
          // 添加缓冲时间，让两句不要重叠
          const buffer = 0.3
          const adjustedEndTime = next.start_time - buffer

          console.log(`  ⏰ 调整时间边界: 句子 ${i} end_time ${newCurrent.end_time}s → ${adjustedEndTime}s`)
          newCurrent.end_time = adjustedEndTime
          hasChanges = true
        }
      }

      // 规则3：检查句子是否以标点结尾
      if (currentText && currentText.trim().length > 0) {
        const trimmedText = currentText.trim()
        const lastChar = trimmedText[trimmedText.length - 1]
        const punctuation = ['.', '!', '?', '。', '！', '？', '…']

        if (!punctuation.includes(lastChar)) {
          // 句子没有以标点结尾，可能需要调整
          const sentences = currentText.split(/[.!?。！？]/)

          if (sentences.length > 1 && sentences[sentences.length - 1].trim().length > 0) {
            // 最后一个分句没有标点，补充省略号或句号
            console.log(`  🔡 句子 "${trimmedText}" 缺少标点`)
          }
        }
      }

      fixedTranscript.push(newCurrent)
    }

    // 如果有修改，更新数据库
    if (hasChanges) {
      console.log(`\n💾 更新素材 "${material.title}" 的句子时间...`)

      const { error: updateError } = await supabase
        .from('materials')
        .update({ transcript: fixedTranscript })
        .eq('id', material.id)

      if (updateError) {
        console.error(`  ❌ 更新失败:`, updateError)
      } else {
        console.log(`  ✅ 更新成功`)
        totalFixed++
      }
    }
  }

  console.log(`\n✅ 修复完成！共修复 ${totalFixed} 个素材`)
}

// 执行修复
fixSentenceTimings()
  .then(() => {
    console.log('\n🎉 脚本执行完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error)
    process.exit(1)
  })
