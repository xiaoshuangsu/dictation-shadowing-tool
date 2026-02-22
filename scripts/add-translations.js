/**
 * Add Chinese translations to Canada Provinces and Territories transcript
 * Using MyMemory Translation API (free)
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Supabase configuration
const SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Translation function using MyMemory API
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

      // Check if we hit quota limit
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

async function translateAndSave() {
  try {
    console.log('📖 Loading transcript from database...')

    const { data: material, error: fetchError } = await supabase
      .from('materials')
      .select('*')
      .eq('title', 'Canada: Provinces and Territories')
      .single()

    if (fetchError) throw fetchError
    if (!material) throw new Error('Material not found')

    console.log(`✅ Found material with ${material.transcript.length} sentences`)
    console.log('')

    // Translate each sentence
    const translatedTranscript = []

    for (let i = 0; i < material.transcript.length; i++) {
      const sentence = material.transcript[i]
      console.log(`[${i + 1}/${material.transcript.length}] Translating...`)
      console.log(`  EN: ${sentence.text.substring(0, 80)}${sentence.text.length > 80 ? '...' : ''}`)

      const translation = await translateText(sentence.text)

      if (translation) {
        console.log(`  ZH: ${translation}`)
        translatedTranscript.push({
          ...sentence,
          translation: translation
        })
      } else {
        console.log(`  ⚠️  Translation failed, using original`)
        translatedTranscript.push(sentence)
      }

      console.log('')

      // Rate limiting - wait between requests
      if (i < material.transcript.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log('💾 Saving to database...')

    const { error: updateError } = await supabase
      .from('materials')
      .update({ transcript: translatedTranscript })
      .eq('title', 'Canada: Provinces and Territories')

    if (updateError) throw updateError

    console.log('✅ Successfully added translations!')
    console.log(`   - Total sentences: ${translatedTranscript.length}`)
    console.log(`   - Translated: ${translatedTranscript.filter(s => s.translation).length}`)

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Run the translation
translateAndSave()
