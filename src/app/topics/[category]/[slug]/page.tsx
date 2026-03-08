// Dynamic routes - generate static paths at build time
import { createClient } from '@supabase/supabase-js'
import { Suspense } from 'react'
import { titleToSlug } from '@/lib/utils/slug'
import { categoryToSlug } from '@/lib/utils/category'

// Hardcoded Supabase credentials for static export
const supabaseUrl = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1eG90bGlqam54YnNpcnBka2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDg1MzQsImV4cCI6MjA4NjY4NDUzNH0.J_Ix3NnKEFDGlINAWQBCLZyW1lmep-5BKqnIAfpgQwk'

// Generate static params with error handling
export async function generateStaticParams() {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data: materials, error } = await supabase
      .from('materials')
      .select('id, title, category')
      .limit(1000)

    if (error) {
      console.error('Error fetching materials:', error)
      return [{ category: 'daily-life', slug: 'placeholder' }]
    }

    // Generate routes using category slug and title slug
    return (materials || []).map((material) => ({
      category: categoryToSlug(material.category),
      slug: titleToSlug(material.title),
    }))
  } catch (error) {
    console.error('Error in generateStaticParams:', error)
    return [{ category: 'daily-life', slug: 'placeholder' }]
  }
}

import PracticePage from './PracticePage'

export const dynamicParams = true

export default function Page({ params }: { params: { category: string; slug: string } }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
      <PracticePage category={params.category} slug={params.slug} />
    </Suspense>
  )
}
