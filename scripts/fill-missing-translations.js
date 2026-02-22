/**
 * 补充所有素材的缺失翻译
 * 使用 MyMemory Translation API
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

/**
 * 翻译函数（带重试）
 */
async function translateText(text, retries = 3) {
  const langPair = 'en|zh-CN'
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url)
      const data = await response.json()

      if (data.responseStatus === 200) {
        return data.responseData.translatedText
      }

      // 检查速率限制
      if (data.responseStatus === 403 || data.responseStatus === 429) {
        console.log(`  ⏳ Rate limit hit, waiting 5 seconds...`)
        await new Promise(resolve => setTimeout(resolve, 5000))
        continue
      }
    } catch (error) {
      console.error(`  ⚠️  Translation error (attempt ${attempt + 1}):`, error.message)
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }

  return null
}

/**
 * 批量补充缺失翻译
 */
async function fillMissingTranslations() {
  try {
    console.log('📖 Loading all materials from database...\n')

    const { data: materials, error } = await supabase
      .from('materials')
      .select('title, transcript')

    if (error) throw error

    console.log(`✅ Found ${materials.length} materials\n`)

    let totalMissing = 0
    let totalFilled = 0
    let totalFailed = 0

    for (const material of materials) {
      if (!material.transcript || material.transcript.length === 0) continue

      // 找出缺失翻译的句子
      const missingIndices = []
      material.transcript.forEach((sentence, index) => {
        if (sentence.text && !sentence.translation) {
          missingIndices.push(index)
        }
      })

      if (missingIndices.length === 0) continue

      totalMissing += missingIndices.length
      console.log(`🔧 [${material.title}]`)
      console.log(`   Missing: ${missingIndices.length} sentences`)

      const updatedTranscript = [...material.transcript]
      let materialFilled = 0
      let materialFailed = 0

      for (const index of missingIndices) {
        const sentence = material.transcript[index]
        console.log(`   [${index + 1}/${material.transcript.length}] Translating...`)

        const translation = await translateText(sentence.text)

        if (translation) {
          updatedTranscript[index] = {
            ...sentence,
            translation: translation
          }
          materialFilled++
          totalFilled++
          console.log(`       ✅ ${translation.substring(0, 50)}...`)
        } else {
          materialFailed++
          totalFailed++
          console.log(`       ❌ Failed`)
        }

        // 速率限制 - 等待2秒
        if (missingIndices.indexOf(index) < missingIndices.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      // 保存到数据库
      if (materialFilled > 0) {
        const { error: updateError } = await supabase
          .from('materials')
          .update({ transcript: updatedTranscript })
          .eq('title', material.title)

        if (updateError) {
          console.log(`   ⚠️  Failed to save: ${updateError.message}`)
        } else {
          console.log(`   ✅ Saved: ${materialFilled} filled, ${materialFailed} failed\n`)
        }
      } else {
        console.log(`   ⚠️  All translations failed\n`)
      }
    }

    console.log('='.repeat(70))
    console.log('📊 Summary')
    console.log('='.repeat(70))
    console.log(`Total missing translations: ${totalMissing}`)
    console.log(`Successfully filled: ${totalFilled}`)
    console.log(`Failed: ${totalFailed}`)
    console.log(`Success rate: ${((totalFilled / totalMissing) * 100).toFixed(1)}%`)

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Run the filler
fillMissingTranslations()
