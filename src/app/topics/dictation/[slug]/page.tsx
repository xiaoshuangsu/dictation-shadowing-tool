// Dynamic routes - generate static paths at build time
import { createClient } from '@supabase/supabase-js'
import { Suspense } from 'react'
import { titleToSlug } from '@/lib/utils/slug'

const supabaseUrl = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1eG90bGlqam54YnNpcnBka2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDg1MzQsImV4cCI6MjA4NjY4NDUzNH0.J_Ix3NnKEFDGlINAWQBCLZyW1lmep-5BKqnIAfpgQwk'

// Generate static params with error handling
export async function generateStaticParams() {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data: materials, error } = await supabase
      .from('materials')
      .select('id, title')
      .limit(1000)

    if (error) {
      console.error('Error fetching materials:', error)
      return [{ slug: 'placeholder' }]
    }

    // Generate routes using title slug for URL
    return (materials || []).map((material) => ({
      slug: titleToSlug(material.title),
    }))
  } catch (error) {
    console.error('Error in generateStaticParams:', error)
    return [{ slug: 'placeholder' }]
  }
}

import DictationPracticeClient from './DictationPracticeClient'

export const dynamicParams = true

export default function DictationPracticePage({ params }: { params: { slug: string } }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DictationPracticeClient slug={params.slug} />
    </Suspense>
  )
}
