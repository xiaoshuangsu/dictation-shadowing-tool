/**
 * Topics Page - 服务端组件（v30.4.0 重构）
 *
 * ✅ 重构目标：
 * - 服务端预取数据：消除客户端 CORS Preflight 延迟
 * - 单次聚合查询：确保首屏只发起 1 个数据库请求
 * - 清理客户端 Effect：子组件通过 Props 接收数据
 */

import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { MaterialsPageContent } from './MaterialsPageContent'

// 🔴 强制动态渲染：避免构建时查询数据库
export const dynamic = 'force-dynamic'

// 🔴 SEO 优化：Topics 列表页元数据
export const metadata: Metadata = {
  title: 'Explore English Practice Materials - ShadowHub Library',
  description: 'Browse our extensive collection of English dictation and shadowing materials across various categories.',
  alternates: {
    canonical: 'https://shadowhub.app/topics',
  },
  openGraph: {
    title: 'Explore English Practice Materials - ShadowHub Library',
    description: 'Browse our extensive collection of English dictation and shadowing materials across various categories.',
    url: 'https://shadowhub.app',
    siteName: 'ShadowHub',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Explore English Practice Materials - ShadowHub Library',
    description: 'Browse our extensive collection of English dictation and shadowing materials across various categories.',
  },
}

// 分类列表
const CATEGORIES = [
  { id: '日常生活', label: 'Daily Life' },
  { id: 'Science and Facts', label: 'Science and Facts' },
  { id: 'BBC Earth', label: 'BBC Earth' },
  { id: '历史演讲', label: 'Historical Speeches' },
  { id: 'TED演讲', label: 'TED Talks' },
  { id: '文化历史', label: 'Culture & History' },
  { id: '心灵故事', label: 'Heart & Soul Stories' },
  { id: '艺术文化', label: 'Arts & Culture' },
  { id: '故事', label: 'Stories' },
  { id: '动画片', label: 'Cartoons' },
  { id: '人物访谈', label: 'Interviews' },
  { id: 'BBC Learning English', label: 'BBC Learning English' },
  { id: 'VOA Learning English', label: 'VOA Learning English' },
  { id: 'IELTS Listening', label: 'IELTS Listening' },
] as const

/**
 * 🔥 v30.4.0: 服务端数据获取函数
 *
 * 在服务端一次性获取所有分类的素材数据，避免客户端 CORS Preflight
 */
async function getTopicsData() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!serviceKey) {
    console.warn('[TopicsPage] ⚠️  SUPABASE_SERVICE_ROLE_KEY not set')
    return {
      materialsByCategory: {},
      categoryCounts: {},
      categories: CATEGORIES
    }
  }

  const supabase = createClient(
    'https://cuxotlijjnxbsirpdkgr.supabase.co',
    serviceKey
  )

  const DEFAULT_COVER = 'thumbnails/culture-history-cover.jpg'
  const categoryIds = CATEGORIES.map(c => c.id)
  const result: Record<string, any[]> = {}
  const counts: Record<string, number> = {}

  try {
    // 🔥 单次聚合查询 - 一次性获取所有分类的素材
    const { data: allMaterials, error } = await supabase
      .from('materials')
      .select('id, title, category, difficulty, thumbnail_path, slug')  // 🔥 严格字段白名单
      .in('category', categoryIds)
      .order('category, title')

    if (error) {
      throw error
    }

    // 🔥 处理素材数据：按分类分组，每个分类最多 4 个
    if (allMaterials) {
      // 按分类分组
      const materialsByCategory: Record<string, any[]> = {}
      categoryIds.forEach(catId => {
        materialsByCategory[catId] = []
      })

      allMaterials.forEach(material => {
        if (materialsByCategory[material.category]) {
          materialsByCategory[material.category].push(material)
        }
      })

      // 处理每个分类的素材
      CATEGORIES.forEach(category => {
        const materials = materialsByCategory[category.id] || []

        if (category.id === '日常生活') {
          // 对于 Daily Life，优先显示有自定义封面的素材
          const customCoverMaterials = materials.filter(m =>
            m.thumbnail_path && m.thumbnail_path !== DEFAULT_COVER
          )
          const defaultCoverMaterials = materials.filter(m =>
            !m.thumbnail_path || m.thumbnail_path === DEFAULT_COVER
          )
          // 合并：自定义封面在前，默认封面在后，各取前几个
          const customMaterials = customCoverMaterials.slice(0, 4)
          const remainingCount = 4 - customMaterials.length
          const defaultMaterials = defaultCoverMaterials.slice(0, remainingCount)
          result[category.id] = [...customMaterials, ...defaultMaterials]
        } else {
          result[category.id] = materials.slice(0, 4)
        }

        // 记录该分类的总数
        counts[category.id] = materials.length
      })
    }

    return {
      materialsByCategory: result,
      categoryCounts: counts,
      categories: CATEGORIES
    }
  } catch (error) {
    console.error('[TopicsPage] Error fetching topics data:', error)
    return {
      materialsByCategory: {},
      categoryCounts: {},
      categories: CATEGORIES
    }
  }
}

// 🔴 服务端组件（默认导出）
export default async function MaterialsPage() {
  // 🔥 v30.4.0: 在服务端获取数据，避免客户端 CORS Preflight
  const topicsData = await getTopicsData()

  return <MaterialsPageContent {...topicsData} />
}
