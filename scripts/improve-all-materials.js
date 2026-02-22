/**
 * 应用翻译改进规则到所有素材
 * 在口语化、正式和准确之间找到平衡
 */

const { createClient } = require('@supabase/supabase-js')
const rules = require('./lib/translationImprover')

const SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

/**
 * 改进单个翻译
 */
function improveTranslation(originalText, currentTranslation) {
  if (!currentTranslation) return currentTranslation

  // 应用改进规则
  let improved = rules.improve(currentTranslation)

  // 应用原有的地理规则
  delete require.cache[require.resolve('./lib/translationRules')]
  const geoRules = require('./lib/translationRules')
  improved = geoRules.applyRules(improved)

  return improved
}

/**
 * 批量改进所有素材
 */
async function improveAllMaterials() {
  try {
    console.log('📖 Loading all materials from database...\n')

    const { data: materials, error } = await supabase
      .from('materials')
      .select('title, transcript')

    if (error) throw error

    console.log(`✅ Found ${materials.length} materials\n`)
    console.log('🔧 Applying improvement rules...\n')

    let totalImproved = 0
    let totalSentences = 0

    for (const material of materials) {
      if (!material.transcript || material.transcript.length === 0) continue

      let materialImproved = 0
      const improvedTranscript = material.transcript.map(sentence => {
        if (!sentence.translation) return sentence

        totalSentences++
        const originalTranslation = sentence.translation
        const improvedTranslation = improveTranslation(sentence.text, originalTranslation)

        if (improvedTranslation !== originalTranslation) {
          materialImproved++
          totalImproved++
          return {
            ...sentence,
            translation: improvedTranslation
          }
        }

        return sentence
      })

      if (materialImproved > 0) {
        console.log(`[${material.title}]`)
        console.log(`  Improved: ${materialImproved} sentences`)

        // 保存到数据库
        const { error: updateError } = await supabase
          .from('materials')
          .update({ transcript: improvedTranscript })
          .eq('title', material.title)

        if (updateError) {
          console.log(`  ⚠️  Failed to save: ${updateError.message}`)
        } else {
          console.log(`  ✅ Saved\n`)
        }
      }
    }

    console.log('='.repeat(70))
    console.log('📊 Summary')
    console.log('='.repeat(70))
    console.log(`Total sentences processed: ${totalSentences}`)
    console.log(`Total improvements applied: ${totalImproved}`)
    console.log(`Improvement rate: ${((totalImproved / totalSentences) * 100).toFixed(1)}%`)
    console.log('✅ All materials improved!')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Run the improver
improveAllMaterials()
