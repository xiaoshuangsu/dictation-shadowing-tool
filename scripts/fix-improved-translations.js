/**
 * 手动修正改进后的翻译中的错误
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

/**
 * 手动修正特定句子的翻译
 */
const manualFixes = {
  5: '不列颠哥伦比亚省西临太平洋，东至落基山脉。',
  6: '不列颠哥伦比亚省包括温哥华市，人口200万。',
  12: '阿尔伯塔省蕴藏丰富的油气资源，也有许多养牛的农场。',
  17: '温尼伯拥有世界上最寒冷的大城市冬季，气温有时会达到零下40摄氏度。',
  27: '魁北克市拥有数百年历史的建筑。',
  29: '在所有讲法语的城市中，只有巴黎比蒙特利尔更大。',
  32: '在大西洋省份，渔业是重要产业。',
  38: '夏季短暂，但白昼漫长而明亮。',
}

async function fixTranslations() {
  try {
    console.log('📖 Loading transcript from database...')

    const { data: material, error: fetchError } = await supabase
      .from('materials')
      .select('*')
      .eq('title', 'Canada: Provinces and Territories')
      .single()

    if (fetchError) throw fetchError
    if (!material) throw new Error('Material not found')

    console.log(`✅ Found ${material.transcript.length} sentences`)
    console.log('\n🔧 Applying manual fixes...\n')

    let fixCount = 0

    const fixedTranscript = material.transcript.map((sentence, index) => {
      const sentenceNumber = index + 1

      if (manualFixes[sentenceNumber]) {
        console.log(`[${sentenceNumber}] Fixed`)
        console.log(`  Old: ${sentence.translation}`)
        console.log(`  New: ${manualFixes[sentenceNumber]}`)
        console.log('')

        fixCount++
        return {
          ...sentence,
          translation: manualFixes[sentenceNumber]
        }
      }

      return sentence
    })

    console.log('\n' + '='.repeat(70))
    console.log(`📊 Fix Summary`)
    console.log('='.repeat(70))
    console.log(`Total fixes applied: ${fixCount}`)

    if (fixCount > 0) {
      console.log('\n💾 Saving fixes to database...')

      const { error: updateError } = await supabase
        .from('materials')
        .update({ transcript: fixedTranscript })
        .eq('title', 'Canada: Provinces and Territories')

      if (updateError) throw updateError

      console.log('✅ Successfully saved fixes!')
    } else {
      console.log('\n✅ No fixes needed!')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Run the fixer
fixTranslations()
