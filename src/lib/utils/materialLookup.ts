import { createClient } from '@supabase/supabase-js'
import { titleToSlug } from '@/lib/utils/slug'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cuxotlijjnxbsirpdkgr.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_UeaK10sYGQPjB17Vg-IpcQ_ql3xHKMm'
)

/**
 * Find material ID by slug
 * Slug is generated from material title
 */
export async function findMaterialIdBySlug(slug: string): Promise<string | null> {
  try {
    const { data: materials } = await supabase
      .from('materials')
      .select('id, title')

    if (!materials) return null

    // Generate slug from each title and find match
    const material = materials.find(m => titleToSlug(m.title) === slug)

    return material?.id || null
  } catch (error) {
    console.error('Error finding material by slug:', error)
    return null
  }
}

/**
 * Fix transcript sentence boundaries by merging lowercase-starting sentences
 * This fixes issues where a sentence is incorrectly split in the middle
 */
export function fixTranscriptSentences(transcript: any[]): any[] {
  if (!transcript || !Array.isArray(transcript)) {
    return transcript
  }

  const fixed = []

  for (let i = 0; i < transcript.length; i++) {
    const current = transcript[i]
    if (!current) continue

    const currentText = current.text || ''
    const trimmedText = currentText.trim()

    // Check if sentence starts with lowercase letter (should merge with previous)
    if (trimmedText.length > 0 && fixed.length > 0) {
      const firstChar = trimmedText[0]
      const isLowercaseStart = firstChar === firstChar.toLowerCase() && firstChar !== firstChar.toUpperCase()

      if (isLowercaseStart) {
        // Merge with previous sentence
        const prevSentence: any = fixed[fixed.length - 1]
        const combinedText = prevSentence.text + ' ' + trimmedText
        // Support both naming conventions: start_time/startTime, end_time/endTime
        const combinedEndTime = current.end_time || current.endTime || prevSentence.end_time || prevSentence.endTime

        console.log(`Merging sentence: "${prevSentence.text}" + "${trimmedText}"`)

        fixed[fixed.length - 1] = {
          ...prevSentence,
          text: combinedText,
          end_time: combinedEndTime,
          endTime: combinedEndTime // Keep both fields
        }
        continue
      }
    }

    fixed.push(current)
  }

  return fixed
}

/**
 * Get material info by slug
 */
export async function getMaterialBySlug(slug: string): Promise<{ id: string; title: string; category: string } | null> {
  try {
    const { data: materials } = await supabase
      .from('materials')
      .select('id, title, category')

    if (!materials) return null

    const material = materials.find(m => titleToSlug(m.title) === slug)

    return material || null
  } catch (error) {
    console.error('Error getting material by slug:', error)
    return null
  }
}
