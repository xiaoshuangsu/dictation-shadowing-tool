/**
 * Translation Validator and Fixer
 * 检查并修正翻译中的问题
 */

const { createClient } = require('@supabase/supabase-js')
// Clear require cache and reload rules
delete require.cache[require.resolve('./lib/translationRules')]
const rules = require('./lib/translationRules')

const SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

/**
 * 翻译后处理 - 应用规则修正翻译
 */
function postProcessTranslation(originalText, translatedText) {
  // 使用 rules 模块的 applyRules 方法
  return rules.applyRules(translatedText)
}

/**
 * 主函数：检查并修正翻译
 */
async function validateAndFixTranslations() {
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
    console.log('\n🔍 Checking and fixing translations...\n')

    const fixedTranscript = []
    let fixCount = 0

    material.transcript.forEach((sentence, index) => {
      const originalText = sentence.text
      const originalTranslation = sentence.translation || ''

      // 应用后处理规则
      const fixedTranslation = postProcessTranslation(originalText, originalTranslation)

      // 如果翻译被修正了，使用修正后的版本
      if (fixedTranslation !== originalTranslation) {
        console.log(`[✓] Sentence ${index + 1}: Fixed translation`)
        fixedTranscript.push({
          ...sentence,
          translation: fixedTranslation
        })
        fixCount++
      } else {
        // 无问题，保持原样
        fixedTranscript.push(sentence)
      }
    })

    console.log('\n' + '='.repeat(60))
    console.log(`📊 Validation Summary`)
    console.log('='.repeat(60))
    console.log(`Total sentences: ${material.transcript.length}`)
    console.log(`Fixed: ${fixCount}`)

    if (fixCount > 0) {
      console.log('\n💾 Saving corrections to database...')

      const { error: updateError } = await supabase
        .from('materials')
        .update({ transcript: fixedTranscript })
        .eq('title', 'Canada: Provinces and Territories')

      if (updateError) throw updateError

      console.log('✅ Successfully saved corrections!')
    } else {
      console.log('\n✅ No issues found! All translations are correct.')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Run the validator
validateAndFixTranslations()
