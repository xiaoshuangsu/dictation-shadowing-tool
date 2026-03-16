// Dynamic routes for category pages - generate static paths at build time
import { createClient } from '@supabase/supabase-js'
import { Suspense } from 'react'
import { CATEGORY_SLUG_MAP } from '@/lib/utils/category'
import { Metadata } from 'next'
import CategoryPage from '@/components/topics/CategoryPage'

// 🔴 关键修复：从共享配置导入凭证，避免重复定义
const SUPABASE_CONFIG = {
  url: 'https://cuxotlijjnxbsirpdkgr.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1eG90bGlqam54YnNpcnBka2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDg1MzQsImV4cCI6MjA4NjY4NDUzNH0.J_Ix3NnKEFDGlINAWQBCLZyW1lmep-5BKqnIAfpgQwk'
}

/**
 * Generate static params for all category routes
 * This runs at build time to pre-render all category pages
 */
export async function generateStaticParams() {
  try {
    // Generate params from category slugs
    return Object.entries(CATEGORY_SLUG_MAP).map(([_, slug]) => ({
      category: slug,
    }))
  } catch (error) {
    console.error('Error in generateStaticParams:', error)
    // Fallback to at least one category
    return [{ category: 'daily-life' }]
  }
}

/**
 * Generate dynamic metadata for each category page
 */
export async function generateMetadata({ params }: { params: { category: string } }): Promise<Metadata> {
  const { category } = params

  // Import metadata utilities
  const { getCategoryMetadataBySlug } = await import('@/lib/utils/category')
  const metadata = getCategoryMetadataBySlug(category)

  if (!metadata) {
    return {
      title: 'Category Not Found',
      description: 'The requested category could not be found.',
    }
  }

  return {
    title: `${metadata.name} - English Learning Materials`,
    description: metadata.description,
    openGraph: {
      title: `${metadata.name} - English Dictation & Shadowing`,
      description: metadata.description,
      type: 'website',
    },
  }
}

export const dynamicParams = true

export default function Page({ params }: { params: { category: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading category...</p>
        </div>
      </div>
    }>
      <CategoryPage categorySlug={params.category} />
    </Suspense>
  )
}
