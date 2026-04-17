/**
 * Category Page - 服务端组件（v30.4.0 重构）
 *
 * ✅ 重构目标：
 * - 服务端预取数据：消除客户端 CORS Preflight 延迟
 * - 单次查询：确保首屏只发起 1 个数据库请求
 * - 清理客户端 Effect：子组件通过 Props 接收数据
 */

import { createClient } from '@supabase/supabase-js'
import { Suspense } from 'react'
import { CATEGORY_SLUG_MAP, slugToCategory } from '@/lib/utils/category'
import { Metadata } from 'next'
import CategoryPage from '@/components/topics/CategoryPage'

// 🔴 强制动态渲染：避免构建时查询数据库
export const dynamic = 'force-dynamic'

// 🔴 ISR 模式：每 60 秒重新生成页面，确保新素材能及时显示
export const revalidate = 60

/**
 * 🔥 v30.4.0: 服务端数据获取函数
 *
 * 在服务端获取指定分类的素材数据，避免客户端 CORS Preflight
 */
async function getCategoryData(categorySlug: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!serviceKey) {
    console.warn('[CategoryPage] ⚠️  SUPABASE_SERVICE_ROLE_KEY not set')
    return {
      materials: [],
      totalCount: 0
    }
  }

  const supabase = createClient(
    'https://cuxotlijjnxbsirpdkgr.supabase.co',
    serviceKey
  )

  const categoryName = slugToCategory(categorySlug)
  const DEFAULT_COVER = 'thumbnails/culture-history-cover.jpg'

  try {
    // 🔥 单次查询 - 获取该分类的所有素材（严格字段白名单）
    const { data: materials, error } = await supabase
      .from('materials')
      .select('id, title, category, difficulty, thumbnail_path, slug, duration')  // 🔥 严格字段白名单
      .eq('category', categoryName)
      .order('title')

    if (error) {
      throw error
    }

    // 对 Daily Life 分类的素材进行特殊排序：有自定义封面的在前
    let sortedMaterials = materials || []
    if (categoryName === '日常生活') {
      sortedMaterials = sortedMaterials.sort((a, b) => {
        const aHasCustomCover = a.thumbnail_path && a.thumbnail_path !== DEFAULT_COVER
        const bHasCustomCover = b.thumbnail_path && b.thumbnail_path !== DEFAULT_COVER

        // 自定义封面优先
        if (aHasCustomCover && !bHasCustomCover) return -1
        if (!aHasCustomCover && bHasCustomCover) return 1

        // 同类型按标题排序
        return (a.title || '').localeCompare(b.title || '')
      })
    }

    return {
      materials: sortedMaterials,
      totalCount: sortedMaterials.length
    }
  } catch (error) {
    console.error('[CategoryPage] Error fetching category data:', error)
    return {
      materials: [],
      totalCount: 0
    }
  }
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

export default async function Page({ params }: { params: { category: string } }) {
  // 🔥 v30.4.0: 在服务端获取数据，避免客户端 CORS Preflight
  const categoryData = await getCategoryData(params.category)

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading category...</p>
        </div>
      </div>
    }>
      <CategoryPage
        categorySlug={params.category}
        initialMaterials={categoryData.materials}
        totalCount={categoryData.totalCount}
      />
    </Suspense>
  )
}
