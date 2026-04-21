/**
 * API Route: Topics 素材列表（v30.4.0 - 单次聚合查询）
 *
 * ✅ 重构目标：
 * - 单次聚合查询：避免分批次请求导致的 CORS Preflight 排队
 * - 精简字段：只返回 id, title, category, difficulty, thumbnail_path, slug
 * - 服务端预取：由服务端组件调用，消除客户端请求延迟
 *
 * 🔥 性能优化：
 * - 从 28 个并行请求（14 分类 × 2 查询）优化为 2 个聚合查询
 * - 响应体积减少 50%+（移除 audio_path, audio_size, duration, play_count）
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
  { id: 'Business', label: 'Business' },
  { id: 'IELTS Listening', label: 'IELTS Listening' },
] as const

export const dynamic = 'force-dynamic'

/**
 * 获取 Supabase 客户端
 */
const getSupabaseClient = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!serviceKey) {
    console.warn('[API] ⚠️  SUPABASE_SERVICE_ROLE_KEY not set')
  }

  return createClient(
    'https://cuxotlijjnxbsirpdkgr.supabase.co',
    serviceKey || ''
  )
}

/**
 * GET /api/topics
 * 获取所有分类的素材列表（每个分类最多 4 个）
 *
 * 🔥 v30.4.0 优化：单次聚合查询，避免 CORS Preflight 排队
 */
export async function GET() {
  try {
    const supabase = getSupabaseClient()
    const DEFAULT_COVER = 'thumbnails/culture-history-cover.jpg'

    const categoryIds = CATEGORIES.map(c => c.id)
    const result: Record<string, any[]> = {}
    const counts: Record<string, number> = {}

    // 🔥 v30.4.0: 单次聚合查询 - 一次性获取所有分类的素材
    const { data: allMaterials, error: materialsError } = await supabase
      .from('materials')
      .select('id, title, category, difficulty, thumbnail_path, slug')  // 🔥 严格字段白名单
      .in('category', categoryIds)
      .order('category, title')

    if (materialsError) {
      throw materialsError
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

    const responseData = {
      materialsByCategory: result,
      categoryCounts: counts,
      categories: CATEGORIES
    }

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300', // 5分钟缓存
      },
    })
  } catch (error: any) {
    console.error('[API] Error fetching topics:', error)

    // 🔥 优雅降级：如果数据库查询失败，返回空数据而不是错误
    return NextResponse.json({
      materialsByCategory: {},
      categoryCounts: {},
      categories: CATEGORIES,
      error: 'Database query failed, using fallback'
    }, {
      status: 200, // 返回 200 而不是 500，避免前端崩溃
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60', // 失败时减少缓存时间
      },
    })
  }
}

// OPTIONS 方法
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  })
}
