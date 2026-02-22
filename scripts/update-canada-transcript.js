/**
 * Update Canada Provinces and Territories transcript
 *
 * This script updates the transcript for "Canada Provinces and Territories" material
 * with the correct 38-sentence structure from engnovate.com
 *
 * Run: node scripts/update-canada-transcript.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Supabase configuration
const SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY // service_role key with write access

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function updateTranscript() {
  try {
    console.log('📖 Loading transcript data...')
    const transcriptPath = path.join(__dirname, 'data/canada-provinces-transcript.json')
    const transcriptData = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'))

    console.log(`✅ Loaded ${transcriptData.length} sentences`)

    // Find the material by title
    console.log('🔍 Finding material: "Canada: Provinces and Territories"')
    const { data: materials, error: fetchError } = await supabase
      .from('materials')
      .select('*')
      .eq('title', 'Canada: Provinces and Territories')

    if (fetchError) {
      throw fetchError
    }

    if (!materials || materials.length === 0) {
      throw new Error('Material not found')
    }

    const material = materials[0]
    console.log(`✅ Found material: ${material.id}`)

    // Update the transcript
    console.log('📝 Updating transcript...')
    const { error: updateError } = await supabase
      .from('materials')
      .update({ transcript: transcriptData })
      .eq('id', material.id)

    if (updateError) {
      throw updateError
    }

    console.log('✅ Successfully updated transcript!')
    console.log(`   - Material ID: ${material.id}`)
    console.log(`   - Sentences: ${transcriptData.length}`)
    console.log(`   - Duration: ${transcriptData[transcriptData.length - 1].end_time}s`)
    console.log('')
    console.log('🎉 Done! Please refresh your browser to see the changes.')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Run the update
updateTranscript()
