import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://cuxotlijjnxbsirpdkgr.supabase.co',
  'sb_publishable_UeaK10sYGQPjB17Vg-IpcQ_ql3xHKMm'
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
    const titleToSlug = (title: string) =>
      title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, '')

    const material = materials.find(m => titleToSlug(m.title) === slug)

    return material?.id || null
  } catch (error) {
    console.error('Error finding material by slug:', error)
    return null
  }
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

    const titleToSlug = (title: string) =>
      title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, '')

    const material = materials.find(m => titleToSlug(m.title) === slug)

    return material || null
  } catch (error) {
    console.error('Error getting material by slug:', error)
    return null
  }
}
