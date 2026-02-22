/**
 * 翻译改进脚本
 * 提升翻译质量：在口语化、正式和准确之间找到平衡
 */

const { createClient } = require('@supabase/supabase-js')
// Clear require cache and reload rules
delete require.cache[require.resolve('./lib/translationImprover')]
const improver = require('./lib/translationImprover')

const SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

/**
 * 改进翻译
 */
function improveTranslation(originalText, currentTranslation) {
  // 首先应用改进规则
  let improved = improver.improve(currentTranslation)

  // 然后应用原有的地理规则
  delete require.cache[require.resolve('./lib/translationRules')]
  const rules = require('./lib/translationRules')
  improved = rules.applyRules(improved)

  return improved
}

/**
 * 主函数
 */
async function improveTranslations() {
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
    console.log('\n🔍 Improving translations...\n')

    const improvedTranscript = []
    let improvedCount = 0
    const details = []

    material.transcript.forEach((sentence, index) => {
      const originalText = sentence.text
      const originalTranslation = sentence.translation || ''

      if (!originalTranslation) {
        improvedTranscript.push(sentence)
        return
      }

      // 应用改进规则
      const improvedTranslation = improveTranslation(originalText, originalTranslation)

      // 检查是否有变化
      if (improvedTranslation !== originalTranslation) {
        console.log(`[${index + 1}] ✓ Improved`)
        console.log(`  EN: ${originalText.substring(0, 70)}...`)
        console.log(`  Old: ${originalTranslation}`)
        console.log(`  New: ${improvedTranslation}`)
        console.log('')

        improvedTranscript.push({
          ...sentence,
          translation: improvedTranslation
        })
        improvedCount++
        details.push({
          index: index + 1,
          originalText: originalText.substring(0, 70),
          old: originalTranslation,
          new: improvedTranslation
        })
      } else {
        improvedTranscript.push(sentence)
      }
    })

    console.log('\n' + '='.repeat(70))
    console.log(`📊 Improvement Summary`)
    console.log('='.repeat(70))
    console.log(`Total sentences: ${material.transcript.length}`)
    console.log(`Improved: ${improvedCount}`)
    console.log(`Unchanged: ${material.transcript.length - improvedCount}`)

    if (improvedCount > 0) {
      console.log('\n💾 Saving improvements to database...')

      const { error: updateError } = await supabase
        .from('materials')
        .update({ transcript: improvedTranscript })
        .eq('title', 'Canada: Provinces and Territories')

      if (updateError) throw updateError

      console.log('✅ Successfully saved improvements!')

      // 显示改进详情
      console.log('\n📝 Improvement Details:')
      console.log('='.repeat(70))
      details.slice(0, 10).forEach(d => {
        console.log(`\n[Sentence ${d.index}]`)
        console.log(`  Before: ${d.old}`)
        console.log(`  After:  ${d.new}`)
      })

      if (details.length > 10) {
        console.log(`\n... and ${details.length - 10} more improvements`)
      }
    } else {
      console.log('\n✅ All translations are already good!')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Run the improver
improveTranslations()
